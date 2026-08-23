## Context

Der aktuelle gemeinsame Content-Media-Flow ruft bei Dateiauswahl unmittelbar `uploadHostMediaFile()` auf. Bereits die Upload-Initialisierung legt `iam.media_assets` und `iam.media_upload_sessions` an; der Abschluss validiert das Original, erzeugt Varianten und markiert das Asset als verarbeitet. Der Content wird erst später über den jeweiligen Mainserver-Editor gespeichert und die Studio-Referenzen werden danach mit `replaceHostMediaReferences()` synchronisiert.

Damit liegen heute drei getrennte Zeitpunkte vor:

1. Asset-Erzeugung bei Dateiauswahl,
2. Mainserver-Speicherung beim Formular-Submit,
3. Studio-Referenz-Replace nach Mainserver-Erfolg.

Die bestehende Trennung von Mainserver-Snapshot und Studio-Referenz bleibt notwendig, weil keine gemeinsame Datenbanktransaktion mit der externen Mainserver-API möglich ist. Issue #969 ändert jedoch die Ownership des ersten Schritts: Eine lokale Datei ist bis zum Content-Speichern kein Bibliotheksasset, sondern Bestandteil des Browser-Entwurfs.

Der aktive Change `update-content-media-overlay-flow` beschreibt noch ausdrücklich, dass ein nach dem Upload abgebrochener Content-Flow das Asset in der Mediathek behält. Dieser Vertrag wird ausschließlich für Uploads aus Content-Editoren ersetzt. Ein bewusst unter `/admin/media` gestarteter Bibliotheksupload bleibt ein sofortiger Asset-Lebenszyklus.

## Goals / Non-Goals

- Goals:
  - Keine Medienpersistenz durch reine lokale Dateiauswahl
  - Sofortige lokale Vorschau und vollständige Content-Bearbeitung vor dem Speichern
  - Gemeinsamer Ablauf für alle sechs bildfähigen Content-Editoren
  - Keine sichtbaren oder dauerhaft verwaisten Bibliotheksassets nach Abbruch oder eindeutig fehlgeschlagenem Save
  - Idempotente Wiederholung nach Upload-, Content-, Referenz- und Cleanup-Fehlern
  - Keine Ausweitung der Redakteursberechtigung auf `media.delete`
  - Ehrliche Behandlung der fehlenden Cross-System-Transaktion
- Non-Goals:
  - Kein verzögerter Upload für den eigenständigen Medienbereich `/admin/media`
  - Keine Offline- oder Reload-Persistenz lokaler Browser-Dateien
  - Keine Speicherung von `File`, Blob-, Data- oder Object-URLs in Formularpayloads, Mainserver oder Studio-Datenbank
  - Keine automatische Löschung bereits vorhandener Bibliotheksassets beim Entfernen einer Content-Verwendung
  - Keine Änderung der Mainserver-Medienfelder oder ihrer URL-/Metadaten-Snapshots
  - Keine Einführung einer allgemeinen Workflow- oder Job-Plattform
  - Keine Lösung der separaten Bildgrößenwarnung aus Issue #970

## Decisions

### Lokaler Browser-Entwurf als eigener Quelltyp

Der neutrale Verwendungsvertrag wird als diskriminierte Quelle modelliert. Die genaue TypeScript-Aufteilung darf packagegerecht erfolgen, muss aber diese Semantik erhalten:

```ts
type ContentMediaUsage = ExistingAssetUsage | ManualUrlUsage | LocalFileDraftUsage;

type LocalFileDraftUsage = Readonly<{
  source: 'local-file';
  uiId: string;
  file: File;
  previewUrl: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  altText: string;
  caption: string;
  credit: string;
  license?: string;
  role: string;
  sortOrder: number;
}>;
```

- `file` und `previewUrl` sind browserlokal und werden durch keinen Serializer akzeptiert.
- `previewUrl` entsteht über `URL.createObjectURL(file)` und wird bei Entfernen, Ersetzen, erfolgreicher Auflösung sowie Unmount zuverlässig widerrufen.
- Eine lokale Verwendung besitzt vor dem Save weder `assetId` noch `persistentUrl` noch `MediaReference`.
- MIME-Type und Dateigröße werden sofort clientseitig geprüft. Die kanonische serverseitige Inhaltsvalidierung bleibt maßgeblich.
- Bereits vorhandene Bibliotheksassets und manuelle URLs behalten ihre bisherigen Verträge.

Der gemeinsame Overlay-Controller erhält einen expliziten Kontext beziehungsweise eine Upload-Strategie. Im Bibliothekskontext bleibt `immediate`; im Content-Kontext erzeugt die Dateiauswahl `deferred`. Plugins dürfen diese Entscheidung nicht individuell nachbauen.

### Provisorische Assets und Save-Operationen

Der persistente Medienvertrag erhält zwei voneinander unabhängige Zustandsachsen:

- technische Verarbeitung: bestehende Upload-/Processing-Zustände
- fachliche Sichtbarkeit: `provisional` oder `active`

Bestehende Assets werden bei der Migration als `active` behandelt. Ein Content-Upload erzeugt ein `provisional` Asset, das:

- genau einer Instanz, einem Actor-Subject und einer Content-Media-Save-Operation gehört,
- nicht in regulären Listen, Suche, Mediathek oder Picker-Ergebnissen erscheint,
- nur innerhalb seiner Operation geladen, aktualisiert, ausgeliefert, aktiviert oder verworfen werden kann,
- bei aktivem Zustand keine provisorische Operation oder Ablaufzeit mehr besitzt.

Die Migration ergänzt mindestens:

- `iam.media_assets.lifecycle_status` mit `provisional | active` und Default `active`
- `iam.media_assets.provisional_operation_id` und `provisional_expires_at`
- `iam.media_content_save_operations` mit Instanz, Actor-Subject, Zieltyp, optionaler Ziel-ID, Status, Lease/Ablaufzeit, sicherem Fehlercode und Zeitstempeln
- `iam.media_content_save_operation_references` mit Operation, Asset, Rolle und Sortierung für den vollständigen gewünschten Referenzsatz
- Constraints und Indizes für Instanz/Status/Ablaufzeit sowie eindeutige, idempotente Zuordnung eines lokalen `uiId` innerhalb einer Operation

Die konkrete FK-Reihenfolge muss zyklusfrei bleiben. Falls `media_assets.provisional_operation_id` und die Operation-Referenzen einen FK-Zyklus erzeugen würden, bleibt die Operation-Asset-Zuordnung ausschließlich in der Join-Tabelle führend; es darf keine doppelte, auseinanderlaufende Ownership-Quelle entstehen.

### Zustandsautomat

Eine Save-Operation verwendet einen expliziten, monotonicen Zustand:

```text
preparing -> uploading -> saving_content -> content_saved -> committed
     |           |              |
     +-----------+--------------+-> abandon_pending -> abandoned
                                |
                                +-> outcome_unknown -> reconciliation_required
```

- Wiederholte Requests mit derselben Operation und demselben lokalen `uiId` liefern dasselbe provisorische Asset oder den bereits erreichten terminalen Zustand.
- `committed` und `abandoned` sind terminal.
- Nur Zustände, für die sicher kein erfolgreicher Mainserver-Content existiert, dürfen automatisch nach `abandon_pending` übergehen.
- `content_saved`, `outcome_unknown` und `reconciliation_required` dürfen nicht durch einen generischen TTL-Sweeper gelöscht werden; sie benötigen Commit oder explizite, evidenzbasierte Reconciliation.
- Storage-, Varianten-, Asset-, Session-, Quota- und Operation-Cleanup ist idempotent und toleriert bereits entfernte Teilobjekte.

### Gemeinsamer Speichervorgang

Der gemeinsame SDK-Orchestrator ersetzt für Saves mit lokalen Dateien die heutige einfache Reihenfolge:

1. Das Content-Formular einschließlich lokaler Metadaten vollständig validieren. Bei Validierungsfehlern entsteht keine Save-Operation.
2. Eine Content-Media-Save-Operation mit stabiler clientseitiger Operations-ID und vollständigem gewünschten Asset-Referenzsatz eröffnen.
3. Lokale Dateien über den bestehenden Vertrag `initialize -> signed PUT -> complete` als provisorische Assets hochladen. Uploads werden deterministisch nach `sortOrder` verarbeitet; nach jedem Schritt wird der wiederholbare Operationszustand aktualisiert.
4. Provisorische Assets in persistierbare `ContentMediaUsage`s mit `assetId` und dauerhafter Delivery-URL auflösen und daraus erst jetzt den Mainserver-Payload bauen.
5. Die Mainserver-Create-/Update-Anfrage mit der Save-Operations-ID korrelieren. Der hostseitige Mainserver-Pfad markiert nach bestätigtem Upstream-Erfolg die stabile Ziel-ID als `content_saved`.
6. In einer Studio-Datenbanktransaktion den vollständigen Referenzsatz ersetzen und alle von der Operation verwendeten provisorischen Assets aktivieren.
7. Erst nach erfolgreichem Mainserver-Save und Commit den UI-Speichervorgang als vollständig erfolgreich melden und lokale Object-URLs freigeben.

Der Mainserver-Payload wird nicht vor Schritt 4 dauerhaft im Formularzustand überschrieben. Bei einem fehlgeschlagenen Versuch bleiben die lokalen Draft-Verwendungen für einen erneuten Save erhalten; provisorische technische Werte werden nicht als neue Formwerte gespeichert.

### Fehler- und Recovery-Vertrag

| Fehlerzeitpunkt                                                     | Content-Zustand                          | Asset-Zustand             | Verhalten                                                                                                          |
| ------------------------------------------------------------------- | ---------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Validierung vor Upload                                              | unverändert                              | kein Asset                | Feld-/Summary-Fehler anzeigen                                                                                      |
| Upload/Validierung eindeutig fehlgeschlagen                         | unverändert                              | provisorische Teilobjekte | Operation idempotent verwerfen; Draft bleibt wiederholbar                                                          |
| Mainserver lehnt Save eindeutig ab                                  | unverändert                              | provisorisch              | `abandon_pending`, synchroner Cleanup-Versuch und lease-basierter Retry                                            |
| Mainserver-Ergebnis technisch unklar                                | unbekannt                                | verborgen provisorisch    | nicht löschen; `outcome_unknown` und Reconciliation anbieten                                                       |
| Mainserver erfolgreich, Referenz-/Aktivierungscommit fehlgeschlagen | gespeichert                              | verborgen provisorisch    | `content_saved`, unterscheidbarer Teilfehler, idempotenter Commit-Retry ohne erneuten Mainserver-Save              |
| Cleanup teilweise fehlgeschlagen                                    | unverändert                              | `abandon_pending`         | wiederholbarer serverseitiger Cleanup; kein Bibliothekseintrag                                                     |
| Browser wird während Save geschlossen                               | abhängig vom letzten bestätigten Schritt | verborgen provisorisch    | Lease-Recovery übernimmt nur beweisbar verwerfbare Zustände; erfolgreiche Content-Zustände bleiben rekonstruierbar |

Die Runtime erhält einen datenbankgestützten, lease-basierten Recovery-Lauf mit `FOR UPDATE SKIP LOCKED` oder gleichwertiger Konkurrenzkontrolle. Er darf horizontal mehrfach gestartet werden, ohne dieselbe Operation parallel zu bereinigen. Der Lauf verarbeitet begrenzte Batches und protokolliert ausschließlich IDs, Zustände und redigierte Fehlercodes.

### Berechtigungen und Audit

- Lokale Dateiauswahl benötigt noch keine Serverberechtigung, der Upload-Einstieg bleibt aber nur bei wirksamer Content-Berechtigung sowie `media.read`, `media.create` und `media.reference.manage` sichtbar.
- Provisorische Uploads verwenden weiterhin `media.create`.
- Aktivierung und Operation-Cleanup sind interne Folgen der autorisierten Save-Operation und verlangen kein `media.delete`.
- Explizites Löschen aktiver Bibliotheksassets bleibt unverändert an `media.delete` gebunden.
- Jeder Operationszugriff prüft Instanz und Actor-Subject; ein anderer Actor kann eine fremde provisorische Operation nicht übernehmen oder verwerfen.
- Ein privilegierter Recovery-Lauf handelt als hostseitiger Systempfad und ist kein Benutzer-Delete-Ersatz.
- Audit unterscheidet mindestens `media.contentDraftStarted`, `media.contentDraftUploaded`, `media.contentDraftCommitted`, `media.contentDraftAbandoned`, `media.contentDraftCleanupFailed` und `media.contentDraftReconciliationRequired`.
- Logs und Audit enthalten weder Binärdaten, lokale Dateipfade, Blob-/Data-/Object-URLs, signierte Upload-URLs noch Mainserver-Payloads.

### UI und Accessibility

- Nach Dateiauswahl erscheint sofort dieselbe Vorschaukarte wie bei einem Asset, eindeutig mit lokalisiertem Status `Noch nicht gespeichert`.
- Entfernen, Abbrechen und Navigation ohne Speichern widerrufen Object-URLs und erzeugen keine Serveranfrage.
- Während Save zeigt die bestehende Save-Feedback-Fläche die Phasen `Bilder werden hochgeladen`, `Inhalt wird gespeichert`, `Medien werden verknüpft` und gegebenenfalls `Bereinigung wird wiederholt`.
- Doppelte Saves, Entfernen und Umsortieren sind während einer laufenden Operation gesperrt; Fokus und Live-Region bleiben nachvollziehbar.
- Ein Teilfehler nach erfolgreichem Mainserver-Save darf nicht als vollständiger Speicherfehler formuliert werden.
- Bei `outcome_unknown` darf die Oberfläche weder Erfolg noch sicheren Fehlschlag behaupten und muss eine Wiederaufnahme beziehungsweise Statusprüfung anbieten.

## Package Boundaries

- `packages/studio-ui-react`: lokaler Dateiquelltyp, Object-URL-Lebenszyklus, Overlay-Strategie, Statusdarstellung und zugängliche Interaktionen
- `packages/plugin-sdk`: frameworkarme Save-Orchestrierung, Media-Save-Operationsclient, idempotente Upload-/Commit-/Abandon-Aufrufe und Ergebnisunion
- Inhalts-Plugins: ausschließlich Adapter zwischen neutraler Verwendung und fachlichem Mainserver-Payload; kein eigener Upload- oder Cleanup-Lebenszyklus
- `packages/auth-runtime`: HTTP-/Service-Vertrag für Operation, provisorisches Asset, Commit, Abandon, Recovery, Autorisierung und Audit
- `packages/data-repositories`: SQL-Verträge und transaktionale Status-/Referenz-/Aktivierungsoperationen
- `packages/sva-mainserver`: Korrelation der Mainserver-Mutation mit der Operations-ID und bestätigter Ziel-ID; keine Storage- oder UI-Ownership
- `apps/sva-studio-react`: Routenverdrahtung und Start des begrenzten Recovery-Laufs

## Alternatives Considered

### Clientseitiges Löschen nach Save-Fehler

Verworfen. Der normale Delete-Endpunkt benötigt `media.delete`, obwohl ein Redakteur für Content-Uploads nur `media.create` besitzen muss. Außerdem kann ein Browser-Cleanup durch Navigation, Netzwerkfehler oder Prozessabbruch ausfallen und ist daher kein zuverlässiger Lebenszyklus.

### Content zuerst ohne neues Bild speichern und danach hochladen

Verworfen. Für neue Inhalte fehlt zunächst das beabsichtigte Bild; danach wäre ein zweiter Mainserver-Write nötig. Upload- oder Update-Fehler würden einen fachlich teilweise gespeicherten Content erzeugen und die bestehende Snapshot-/Referenzreihenfolge verschlechtern.

### Upload erst beim Save, aber sofort als aktives Asset

Verworfen. Das verschiebt lediglich den Zeitpunkt des heutigen Problems. Zwischen Upload und Mainserver-/Referenzerfolg bliebe weiterhin ein sichtbares, unreferenziertes Bibliotheksasset.

### Vollständig atomare Cross-System-Transaktion

Nicht möglich, da Studio-Datenbank, Objekt-Storage und externe Mainserver-API keine gemeinsame Transaktion besitzen. Die gewählte Saga macht bestätigte Zustände persistent, trennt sichere Kompensation von unklarem Ausgang und bietet idempotente Recovery.

## Risks / Trade-offs

- Der Save dauert bei lokalen Bildern länger, weil der Upload erst nach Submit beginnt. Gegenmaßnahme: phasengenaues Feedback, Save-Sperre und gezielter Retry.
- Große lokale Dateien belegen bis zum Save Browser-Speicher. Gegenmaßnahme: bestehende Größenlimits früh prüfen, Object-URLs statt Base64 verwenden und Referenzen deterministisch freigeben.
- Der neue Operationsvertrag erweitert Schema und Runtime. Gegenmaßnahme: additive Migration, bestehende Assets als `active`, expliziter Zustandsautomat und eng begrenzte Service-API.
- Ein unbekannter Mainserver-Ausgang kann nicht automatisch kompensiert werden. Gegenmaßnahme: niemals voreilig löschen, Zustand dauerhaft markieren und gezielte Reconciliation ermöglichen.
- Das gleichzeitige Bestehen des alten aktiven OpenSpec-Changes kann widersprüchliche Anforderungen erzeugen. Gegenmaßnahme: vor Implementierungsbeginn dessen Content-Upload-Abbruchszenario archivieren oder durch diesen Change eindeutig superseden; der Bibliotheksupload bleibt getrennt.
- Sechs Plugin-Adapter erhöhen den Review-Scope. Gegenmaßnahme: gemeinsamen Kern zuerst an POI und Events charakterisieren, danach pluginweise migrieren und testen.

## Migration and Rollback Plan

1. Additive Tabellen/Spalten mit Default `active` einführen; bestehende Assets und Uploads bleiben unverändert sichtbar.
2. Serververträge und Recovery zunächst ohne UI-Konsumenten bereitstellen und testen.
3. Gemeinsamen lokalen Draft- und Save-Orchestrator hinter einem zentralen, vorübergehenden Rollout-Schalter integrieren; der Schalter darf nur zwischen altem und neuem Gesamtlebenszyklus wählen, nicht pluginweise dauerhaft divergieren.
4. POI und Events als Referenzpfade migrieren, danach News, Generic Items, Projects und Cockpit Cards in getrennten validierten Blöcken.
5. Nach vollständiger Migration den alten sofortigen Content-Upload-Pfad und den temporären Schalter entfernen.
6. Rollback vor Schemaentfernung schaltet den gemeinsamen Content-Flow zurück. Provisorische Operationen werden vorher terminal verarbeitet; aktive Assets und bestehende Referenzen bleiben kompatibel.

## Open Questions

- Keine offenen Produktentscheidungen. Die Implementierung muss vor der Migration lediglich die konkrete Runtime-Einbindung des lease-basierten Recovery-Laufs gegen die dann aktuelle generische Job-/Scheduler-Fähigkeit prüfen und die kleinere bereits etablierte Plattformintegration wählen.
