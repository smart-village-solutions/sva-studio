## Context

News, Events, POI und Generic Items verwenden bereits den hostseitigen `StudioMediaPickerOverlay` mit den Zuständen `library`, `upload` und `review`. Der Overlay-Flow lädt Assets, verwendet den bestehenden Single-File-Upload-Intake, erlaubt den Metadaten-Review und gibt ein Asset erst nach `Medium übernehmen` an den Editor zurück. Diese Funktionen sind Baseline dieses Changes und werden wiederverwendet.

Die Plugin-Editoren duplizieren weiterhin Bildliste, Formularfelder, Mapping, Validierungsdarstellung und Vorschau. Projects und Cockpit Cards verwenden vereinfachte Inline-Integrationen. Die Persistenzverträge bleiben aufgrund der externen Mainserver-GraphQL-API unterschiedlich: News verwendet `contentMedia`, POI und Events verwenden `content.mediaContents`, Generic Items verwendet `mediaContents`, Projects verwendet positionierte `images` und Cockpit Cards verwendet `images` auf Basis von `mediaContents`.

Studio besitzt parallel eine eigenständige Medienbibliothek mit `MediaAsset` und `iam.media_references`. Die Mainserver-Verträge können diese Asset-Beziehung nicht vollständig abbilden. Deshalb benötigt die Integration bewusst zwei miteinander koordinierte Persistenzebenen.

## Goals / Non-Goals

- Goals:
  - Ein gemeinsamer, zugänglicher Kernbildblock in allen sechs bildfähigen Inhalts-Plugins
  - Eigenständige globale Medienbibliothek mit unverändertem `MediaAsset`-Vertrag
  - Klare Trennung globaler Asset-Metadaten von contentbezogenen Snapshots und Overrides
  - Parallele Studio-Referenz und Mainserver-kompatible Snapshot-Persistenz
  - Erhalt aller bestehenden Mainserver-Fachverträge durch typsichere Adapter
  - Explizite, kontrollierte Aktualisierung eines Content-Snapshots aus der Mediathek
  - Sichtbare und wiederholbare Behandlung von Cross-System-Teilfehlern
- Non-Goals:
  - Keine Vereinheitlichung oder Erweiterung der externen Mainserver-GraphQL-Datenmodelle
  - Keine automatische nachträgliche Änderung bestehender Inhalte bei Asset-Metadatenänderungen
  - Keine Migration manueller URLs in die Medienbibliothek
  - Keine neue Medienreferenztabelle und keine direkte Storage-Schnittstelle für Plugins
  - Keine transaktionale Atomarität zwischen Mainserver und Studio-Datenbank
  - Keine automatische Bereinigung hochgeladener, aber nicht zugeordneter Assets

## Decisions

### Zwei Ebenen: Asset und Verwendung

`MediaAsset` ist das eigenständige globale Bibliotheksobjekt. Es besitzt stabile Identität, globale redaktionelle Metadaten, technische Metadaten, Processing-Status und eine vom Host auflösbare Auslieferung.

Der gemeinsame Bildblock arbeitet mit einer neutralen `ContentMediaUsage`. Der folgende Vertrag beschreibt die erforderliche Semantik; die endgültige TypeScript-Deklaration darf ihn typtechnisch verfeinern, aber nicht abschwächen:

```ts
type ContentMediaUsage = Readonly<{
  uiId: string;
  assetId?: string;
  persistentUrl: string;
  previewUrl?: string;
  altText: string;
  caption: string;
  credit: string;
  license?: string;
  role: string;
  sortOrder: number;
}>;
```

- `uiId` ist ausschließlich stabile Formular-/React-Identität und wird auch für manuelle, noch leere Einträge erzeugt.
- `assetId` existiert nur für Bibliotheks- oder Upload-Verwendungen und verbindet die Verwendung mit einer Studio-`MediaReference`.
- `persistentUrl` ist der in den Mainserver-Vertrag überführbare Snapshot. Presigned oder anderweitig kurzlebige URLs sind unzulässig.
- `previewUrl` ist rein transient und darf nie als persistierender Fallback missbraucht werden.
- Caption, Alt-Text, Bildnachweis und Lizenz sind contentbezogene Werte. Bei der Auswahl werden unterstützte Asset-Werte lediglich als Startwerte kopiert.
- Plugin-spezifische Felder werden außerhalb des neutralen Kerns durch den Adapter oder eng begrenzte Zusatzfeld-Slots gehalten.

Eine manuelle URL erzeugt eine Verwendung ohne `assetId` und ohne `MediaReference`. Gleiche URLs oder dasselbe Asset dürfen nur mehrfach vorkommen, wenn der jeweilige Plugin-Vertrag mehrere Bilder erlaubt; jede Verwendung besitzt dann eine eigene `uiId`, Rolle und Position. Fachliche Anzahl-, Duplikat- und Pflichtregeln bleiben beim Plugin.

### Asset-Metadaten und Content-Snapshot

Änderungen globaler Asset-Metadaten verändern bereits verknüpfte Inhalte nicht automatisch. Neue Verknüpfungen übernehmen die zum Auswahlzeitpunkt aktuellen und vom Plugin unterstützten Werte.

Die Aktion `Metadaten aus Mediathek aktualisieren`:

- ist nur für Verwendungen mit `assetId` verfügbar
- zeigt Asset- und Content-Wert je unterstütztem Feld nebeneinander
- erlaubt eine feldweise Auswahl
- wählt standardmäßig nur Felder vor, deren Content-Wert noch dem ursprünglich übernommenen Asset-Wert entspricht; lokale Abweichungen bleiben abgewählt
- bietet vom Zielvertrag nicht unterstützte Felder nicht an
- erneuert bei Auswahl die persistierbare Asset-Auslieferungs-URL
- verändert ausschließlich den Content-Snapshot und niemals das `MediaAsset`

Damit die Standardauswahl lokale Overrides zuverlässig erkennen kann, muss der Formularzustand den zuletzt übernommenen Asset-Snapshot für die Dauer der Bearbeitung kennen. Eine dauerhafte zusätzliche Snapshot-Tabelle ist nicht Teil dieses Changes. Nach erneutem Laden ohne persistierte Ursprungswerte gilt jede Abweichung vorsichtshalber als lokaler Override und bleibt standardmäßig abgewählt; der Benutzer kann die Aktualisierung weiterhin explizit auswählen.

### Bestehender Host-Media-Picker

Bibliothek und Upload verwenden weiterhin denselben hostseitigen Overlay-Flow. Ein Upload durchläuft `library` beziehungsweise `upload` und `review`; erst `Medium übernehmen` gibt das Asset an den Bildblock zurück. Der Change erweitert diesen bestehenden Flow nur dort, wo Berechtigungsdarstellung oder der neutrale Rückgabevertrag dies erfordern.

Abbruch vor einem abgeschlossenen Upload erzeugt keine Content-Verwendung. Ist der Upload bereits abgeschlossen, bleibt das eigenständige Asset in der Medienbibliothek bestehen, wird beim Abbruch aber weder dem Formular hinzugefügt noch über eine `MediaReference` zugeordnet.

### Mainserver-Bridge und Referenzpersistenz

Bei einer Asset-basierten Verwendung werden zwei Verträge gespeichert:

1. Der Plugin-Adapter schreibt URL und unterstützte contentbezogene Metadaten in den vorhandenen Mainserver-GraphQL-Vertrag.
2. Studio schreibt für dasselbe Ziel eine `MediaReference` mit `assetId`, `targetType`, `targetId`, fachlicher Rolle und Reihenfolge.

Der Speichervorgang ist mangels gemeinsamer Transaktion bewusst geordnet:

1. Mainserver-Content einschließlich Snapshots speichern.
2. Nach Erhalt der stabilen Content-ID alle Studio-Referenzen für das Ziel idempotent über den bestehenden Replace-Vertrag ersetzen.
3. Den Gesamterfolg erst nach beiden erfolgreichen Schritten anzeigen.
4. Bei fehlgeschlagener Referenzsynchronisation den Mainserver-Erfolg nicht zurückrollen, sondern einen unterscheidbaren Teilfehler anzeigen und die Referenzsynchronisation wiederholbar anbieten.
5. Beim Laden bestimmen Mainserver-Daten den sichtbaren Content-Snapshot. Fehlende, zusätzliche oder nicht auflösbare Studio-Referenzen werden als Synchronisationszustand angezeigt und nicht stillschweigend erfunden oder gelöscht.

Entfernen einer Verwendung entfernt beim nächsten erfolgreichen Replace ihre `MediaReference`, nicht das Asset. Die bestehende Löschsicherung der Medienverwaltung berücksichtigt aktive Referenzen.

### Plugin-Mapping

| Plugin | Formular-/Mainserver-Pfad | Gemeinsamer Kern | Erhaltene Zusatzfelder | Referenzrolle und Reihenfolge |
| --- | --- | --- | --- | --- |
| News | `contentMedia` → `contentBlocks[].mediaContents` | `sourceUrl.url`, `sourceUrl.description` als Alt-/URL-Beschreibung, `captionText`, `copyright` | `contentType`, `width`, `height` | `gallery_item`, Listenindex als `sortOrder` |
| Events | `content.mediaContents` | `sourceUrl.url`, `sourceUrl.description`, `captionText`, `copyright` | `contentType`, `width`, `height` | `gallery_item`, Listenindex als `sortOrder` |
| POI | `content.mediaContents` | `sourceUrl.url`, `sourceUrl.description`, `captionText`, `copyright` | `contentType`, `width`, `height` | `gallery_item`, Listenindex als `sortOrder` |
| Generic Items | `mediaContents` | `sourceUrl.url`, `sourceUrl.description`, `captionText`, `copyright` | `contentType`, `width`, `height`; verschachtelte Blockmedien bleiben außerhalb dieses initialen Kernblocks, sofern der Editor sie nicht bereits gemeinsam bearbeitet | `gallery_item`, Listenindex als `sortOrder` |
| Projects | `images` | `url`, `altText`, `caption`, `credits` | keine Asset-Lizenz im Mainserver-Vertrag; unbekannte Felder bleiben im Roundtrip erhalten | `gallery_item`; `position` wird lückenlos ab `0` aus der Reihenfolge abgeleitet |
| Cockpit Cards | `images` → `mediaContents` | `sourceUrl.url`, optionale `sourceUrl.description`, `captionText`, `copyright` | festes `contentType: 'image'`; Pflichtbildvalidierung bleibt erhalten | `gallery_item`, Listenindex als `sortOrder` |

Alle geordneten Bildlisten verwenden die bereits im Media-Core-Vertrag vorhandene Rolle `gallery_item`. `targetType`, `targetId` und `sortOrder` unterscheiden Plugin-Kontext, Content und Position. Adapter erhalten nicht im gemeinsamen Block bearbeitete Felder unverändert. Sie dürfen keine Bucket-Namen, Object-Keys oder presigned URLs an das Plugin-Formular durchreichen.

### Berechtigungen

- Manuelle URL: fachliche Content-Create-/Update-Berechtigung
- Bibliotheksauswahl: zusätzlich `media.read` und `media.reference.manage`
- Upload: zusätzlich `media.create` und `media.reference.manage`
- Bearbeitung globaler Asset-Metadaten im Review: zusätzlich `media.update`
- Ohne `media.update` bleibt der Review sichtbar und schreibgeschützt; `Medium übernehmen` bleibt möglich.
- Contentbezogene Overrides benötigen nur die fachliche Content-Berechtigung.
- Nicht erlaubte Einstiege werden in der UI nicht angeboten und serverseitig weiterhin fail-closed geschützt.
- Läuft eine Berechtigung während des Flows ab, bleibt das Content-Formular unverändert und der Fehler wird unterscheidbar angezeigt.
- Geschützte Assets dürfen nur übernommen werden, wenn der Host eine dauerhaft persistierbare, für den Mainserver-Zielvertrag zulässige Auslieferungs-URL liefert. Eine presigned URL darf nie persistiert werden.

### Gemeinsamer Bildblock

Der gemeinsame Block vereinheitlicht den Interaktionskern, nicht jeden fachlichen Feldsatz:

- Überschrift, Beschreibung und Leerzustand
- geordnete Bildkarten mit responsiver Vorschau und stabilem Fallback
- gemeinsame Metadatenfelder, soweit der Adapter sie unterstützt
- pluginbezogene Zusatzfelder über kleine belegte Slots statt Plugin-Flags
- Feld- und Listenvalidierung
- Entfernen sowie Verschieben nach oben und unten
- Mediathek, Upload und manuelle URL
- sichtbarer Asset-Verknüpfungs- und Referenzsynchronisationszustand
- explizite Metadatenaktualisierung aus der Mediathek

Die UI-Komponente entscheidet nicht über fachliche Pflichtigkeit, Maximalanzahl, Duplikate, Persistenz oder Plugin-Actions.

### Accessibility and Error Handling

- Alle Aktionen besitzen lokalisierte zugängliche Namen und sichtbare Fokuszustände.
- Nach manueller Anlage wechselt der Fokus zum neuen URL-Feld.
- Nach Umsortieren bleibt der Fokus bei derselben Bildverwendung; eine Live-Region meldet neue Position und Gesamtzahl.
- Nach Entfernen wechselt der Fokus deterministisch zum Nachfolger, Vorgänger oder zur Hinzufügen-Aktion.
- Verschiebeaktionen sind am jeweiligen Listenrand deaktiviert.
- Upload-, Review-, Preview-, Mainserver-Speicher- und Referenzsynchronisationsfehler bleiben textuell unterscheidbar.
- Ein Referenzteilfehler darf nicht als vollständiger Speicherfehler oder vollständiger Erfolg erscheinen.
- Leere, fehlerhafte oder nicht dauerhaft auslieferbare URLs erhalten einen stabilen Preview- beziehungsweise Validierungszustand.

## Package Boundaries

- `packages/studio-ui-react`: neutraler kontrollierter Bildblock, Bildkarten, Differenzdialog, Vorschau, Interaktions- und Accessibility-Vertrag sowie bestehender Overlay-Controller
- `packages/plugin-sdk`: Host-Media-Clients, bestehende Referenz-Clients und neutrale Host-Asset-Verträge
- Inhalts-Plugins: Formularadapter, Rollen, fachliche Validierung, Defaults, Mainserver-Snapshot und geordnete Referenzableitung
- `apps/sva-studio-react`: Host-Media-Routen, IAM-Gates und kanonischer Upload-Intake

## Testing

- Zentrale Komponenten-Tests decken die drei Einstiege, Preview-Fallback, Metadatenänderung, Entfernen, Umsortieren, Fokus, Live-Region und Fehlerzustände ab.
- Overlay-Tests decken Bibliothek, Upload, schreibbaren und schreibgeschützten Review, Abbruch und explizite Übernahme ab.
- Differenzdialog-Tests decken unveränderte Startwerte, lokale Overrides, nicht unterstützte Felder und persistierbare URL-Aktualisierung ab.
- Jedes Plugin besitzt Adapter- und Roundtrip-Tests für Lesen, Bearbeiten, Umsortieren und Speichern ohne Verlust fachlicher Felder.
- Integrations- beziehungsweise E2E-Tests decken Mainserver-Erfolg plus Referenzerfolg, Referenzteilfehler und idempotente Wiederholung ab.
- Permission-Tests decken alle Kombinationen aus Content-Recht, `media.read`, `media.create`, `media.update` und `media.reference.manage` ab.
- Geschützte Assets und kurzlebige URLs besitzen negative Persistenztests.

## Risks / Trade-offs

- Zwei Persistenzsysteme können auseinanderlaufen. Gegenmaßnahme: feste Speicherreihenfolge, idempotentes Replace, sichtbarer Teilfehler und gezielte Wiederholung.
- Content-Snapshots können bewusst von Asset-Metadaten abweichen. Das ist fachlich gewollt; Aktualisierung erfolgt ausschließlich explizit und feldweise.
- Ohne dauerhaft gespeicherten Ursprungssnapshot lässt sich nach erneutem Laden nicht sicher erkennen, ob ein Wert ein lokaler Override ist. Gegenmaßnahme: konservativ nicht vorauswählen; eine spätere Ursprungssnapshot-Persistenz wäre ein separater Change.
- Zu generische Props können eine schwer wartbare API erzeugen. Gegenmaßnahme: kleiner Kernvertrag und nur belegte Zusatzfeld-Slots.
- Adapter können Daten verlieren. Gegenmaßnahme: Roundtrip-Fixtures mit allen bekannten und unbekannten Feldern pro Plugin.
- Die Migration aller Plugins erhöht den Review-Scope. Gegenmaßnahme: POI als Referenzmigration, anschließend getrennt validierte Plugin-Blöcke.

## Migration and Rollback Plan

1. Neutralen Verwendungsvertrag und gemeinsamen Bildblock anhand des POI-Verhaltens extrahieren.
2. POI ohne sichtbare fachliche Änderung migrieren und die Referenz-/Snapshot-Persistenz ergänzen.
3. News, Events und Generic Items einzeln auf Adapter umstellen.
4. Projects und Cockpit Cards auf vollständigen Bildblock und Referenzpersistenz aufwerten.
5. Nach jedem Plugin-Block fokussierte Unit-, Type- und Roundtrip-Gates ausführen.
6. Erst nach erfolgreicher Migration die jeweilige plugin-eigene Duplikation entfernen.

Ein UI-Rollback kann pluginweise erfolgen. Bereits gespeicherte Mainserver-Snapshots bleiben gültig. Studio-Referenzen können über den bestehenden Replace-Vertrag wiederhergestellt werden; Assets werden beim Rollback nicht gelöscht.

## Open Questions

- Keine offenen Produktentscheidungen für den vereinbarten Scope.
