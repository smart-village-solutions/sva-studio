## Kontext und geprüfter Bestand

Basis: lokaler `main`-Stand `d3d845b36`, getrennt im Worktree `media-management-rework`; keine Zielsysteme oder Kundendateien verändert. Die genannten Codebefunde wurden gelesen, nicht als Browser-Reproduktion ausgegeben.

| Bestehender Pfad                                                                          | Befund und Konsequenz                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx` und Detailsektionen | Metadaten, Bildsteuerung, Nutzungen und Technik sind getrennte bestehende Bausteine. Diese neu anordnen und ihren Entwurf zusammenführen; keinen zweiten Detailseiten-Owner einführen. |
| `packages/studio-ui-react/src/media-image-preview.tsx`                                    | Fokus über zwei Range-Inputs; vorhandene Canvas-Beispielvorschauen. Direkte Punktbedienung ergänzen und Vorschauen als Beispiele kennzeichnen.                                         |
| `packages/studio-ui-react/src/studio-media-picker-review-panel.tsx`                       | Editor/Metadaten als Ansichtswechsel; Fokus unter den Angaben. Bestehenden Entwurf um eine erkennbare Folge erweitern.                                                                 |
| `packages/auth-runtime/src/iam-media/processing-variants.ts`                              | `metadata.focusPoint` beeinflusst gegenwärtig die erzeugten Pixel. Diese Kopplung widerspricht #2227; kein zusätzlicher Reprocessing-Aufruf als vermeintliche Lösung.                  |
| `packages/plugin-sdk/src/media-picker-client.ts`                                          | Detail-GET ist vorhanden, aber `HostMediaAssetMetadata` und Update-Typ deklarieren keinen Fokus. Bestehenden typisierten Vertrag erweitern.                                            |
| `packages/studio-ui-react/src/mainserver-content-media-adapter.ts`                        | Übernimmt URL, Alttext, Caption und Credit; daraus ist keine Fokusübergabe an die App nachgewiesen. End-to-End-Übergabe gesondert schließen.                                           |
| `-media-unregistered-detail-page.tsx`, `asset-registration-handler.ts`                    | Manuelle Registrierung, browserseitig `public`, Scan-Sperre, separate Anlage und Quotenbuchung. Automatisierung allein im UI wäre unzureichend.                                        |
| Kanonischer DB-Snapshot                                                                   | Eindeutiger Index auf `(instance_id, storage_key)` vorhanden; nicht mit atomarer Quotenfinalisierung oder vollständiger Import-Idempotenz gleichsetzen.                                |

## Gestaltung und Ablauf

Bestehende Studio-Komponenten, Typografie und Themes bestimmen die konkrete Gestaltung. Figma bestimmt Reihenfolge, Aufgaben und Zustände. Keine neue Gestaltungsebene oder Bibliothek.

### Bestehendes Bild

Kompakter Kopf mit Name, Sichtbarkeit und Aktion „Kopie erstellen und bearbeiten“. Darunter vollständige, unverzerrte Bildbühne mit Fokuspunkt und knapper Dateiinformation. Angaben folgen unterhalb des Bildes: Titel, Alternativtext, Beschreibung, Copyright/Lizenz und Tags. Ein gemeinsamer Abschluss „Änderungen speichern“ speichert Texte und Fokus am selben Medium; Status und Fehler bleiben beim Formular. Eigene Inhaltsangaben bleiben erhalten.

Ausgabe-Beispielansichten, verständliche Inhaltsverwendungen und aufklappbare technische Informationen folgen nachgeordnet. Links zu Inhalten verwenden ausschließlich bestätigte typisierte Routen und erlaubte Ziele. Handlungsrelevante Scan-/Verarbeitungssperren bleiben sichtbar; routinemäßige technische Daten kommen unter „Weitere Informationen“. Löschen bleibt nachgeordnet und nutzt die bestehende Prüfung einschließlich Bearbeitungsgrundlagen.

### Fokus als Metadatum

Ein normalisiertes `focusPoint: { x, y }` bezieht sich auf die orientierte Bildfläche. Fehlender Fokus bleibt fehlend; seine neutrale Beispielanzeige verwendet die Mitte, ohne sie still zu speichern. „Bildmitte verwenden“ setzt ausdrücklich `{ x: 0.5, y: 0.5 }`; Entfernen eines gespeicherten Fokus verwendet den bestehenden `null`-Patch. Unveränderte Felder werden nicht versehentlich gelöscht.

Pointer-Koordinaten werden aus der tatsächlich sichtbaren Bildfläche ermittelt; freie Ränder gehören nicht dazu. Der Marker besitzt mindestens 44 × 44 CSS-Pixel Bedienfläche, sichtbaren Tastaturfokus und eine übersetzte Positionsansage. Pfeiltasten bewegen ihn in begrenzten normalisierten Schritten; Bildgröße, Orientierung, Zoom und Touch dürfen den Bezug nicht verändern. Client und Server lehnen ungültige Werte ab.

PATCH und unabhängiger GET `/api/v1/iam/media/{assetId}` verwenden den bestehenden Hook und SDK-Vertrag mit explizitem Fokusfeld. Ein fehlgeschlagener Readback meldet keinen Speichererfolg und erhält den sichtbaren Entwurf. Der PostgreSQL-Nachweis prüft Punkt und `null` sowie unveränderte Dateiidentität, Varianten und Referenzen.

Der vorhandene Mainserver-Snapshot unterstützt bereits `MediaContentInput.payload: JSON` und `MediaContent.payload: JSON`. Der konkrete Übergabevertrag ist `mediaContents[].payload.focusPoint`. Auswahl, lokale Kopie, Draft-Auflösung, Fachformular und serverseitiger Parser erhalten Punkt beziehungsweise `null`. News, Events, POI, Generic Items, Projects und Cockpit Cards verwenden ihre vorhandenen Speicherpfade. Projects bildet seinen bestehenden Bildvertrag auf denselben MediaContent-Payload ab. URL-basierte Branding-/Download-Verbraucher erhalten weiterhin ihre bisherige URL; sie können den zentral über die Medien-API verfügbaren Fokus ignorieren.

Events und POI geben nur den redaktionellen Fokus aus dem Bild-Payload an den Browser weiter. Interne Importdaten verbleiben im serverseitigen Snapshot und werden anhand gespeicherter Medien-ID und unveränderter Quell-URL mit dem validierten Fokus zusammengeführt; wiederholte IDs dürfen einen Quell-Payload höchstens einmal zuordnen. Bei nicht zusammenführbaren Quell-Payloads wird vor dem Write abgebrochen. GraphQL-Verträge werden gegen den vorhandenen Schema-Snapshot geprüft. Kein fremdes Repository und keine neue öffentliche API werden verändert. Die Zielanwendungsdarstellung selbst ist nicht Teil der lokalen Abnahme.

Studio wendet Fokus nicht automatisch als verpflichtenden Pixelzuschnitt an. Bei neuen Verarbeitungen wird die bestehende Fokusauswertung in `processing-variants.ts` entfernt beziehungsweise auf ausdrückliche getrennte Bildoperationen begrenzt. Bestehende Dateien und Varianten werden nicht pauschal neu gerechnet. Explizite Bildoperationen und vorhandene erlaubte Presets bleiben erhalten. Beispielvorschauen werden als unverbindlich erklärt; Zielanwendungen können das Metadatum ignorieren.

### Kopie

1. Bild gestalten: vorhandene freigegebene Filerobot-Werkzeuge einschließlich Zuschnitt, Drehen, Spiegeln, Anpassungen und Filter. Bibliothek und Werkzeugumfang bleiben erhalten.
2. Fokuspunkt setzen: Punktbedienung auf dem gerenderten Ergebnis; Zeichenwerkzeuge sind hier nicht aktiv. Nach erneutem Export aufgrund von Bildoperationen wird ein alter Fokus nicht blind übernommen: auf Bildmitte zurücksetzen und im zweiten Schritt erneut überprüfbar machen. Bloßes Zurückgehen ohne geändertes Ergebnis erhält den Fokus.
3. Ergebnis prüfen: vollständige Bildbühne, Angaben darunter und unverbindliche Beispiele. Ein eindeutiger Abschluss mit sichtbarer Speicherwirkung.

Stepper als Fortschritt, nicht als frei wechselnde Modus-Tabs. Zurück-Navigation erhält den aktiven Entwurf mit Bildoperationen, Metadaten und passendem Fokus. Der Fokusmarker ist eine separate Studio-Ebene und wird nicht exportiert. Erzeugung erst bei ausdrücklichem „Kopie speichern“; nach bestätigtem Erfolg neue Detail-ID öffnen. In Inhaltsformularen wird zunächst lokal übernommen und erst beim Content-Speichern persistiert; Settings-/Waste-Abschlüsse behalten ihre bestehende Wirkung.

Kopf und Hauptaktionen liegen außerhalb der inneren Scrollfläche, auch im letzten Prüfschritt. Höhe und Flex-/Grid-Schrumpfung verhindern, dass Filerobot den Footer aus dem Viewport drückt. Bei geringer Breite werden Informationen untereinander angeordnet. Fokus wird bei Schrittwechsel auf die passende Überschrift und beim Schließen zum Auslöser geführt; Footer darf fokussierte Felder nicht verdecken. ADR-069 gilt nur innerhalb des Spezialeditors.

Export, Upload und Abschluss haben getrennte Zustände. Nach Upload-Initialisierung bleiben die für diese Sitzung festgelegten Daten gesperrt. Fehler erhalten den aktiven Entwurf; Wiederholungen nutzen vorhandene Claims und Sitzungen. Bestätigtes Verwerfen nutzt den bestehenden Verlustdialog. Kein neues Autosave und keine unbelegte Reload-Wiederherstellung.

## Automatische Aufnahme: bestätigter Vertrag

Der Nutzer hat am 18.11.2026 die aktive instanzeigene S3-Schnittstelle als vertrauenswürdige Quelle und deren übernommene Bilder als öffentlich auslieferbar festgelegt. Nur der serverseitig aufgelöste Interface-Port trägt diese Einordnung. Der allgemeine ENV-Fallback, fremde Instanzen und beliebige externe URLs sind keine Aufnahmequelle. Der vorhandene S3-Listing-Scope gilt auch für die Aufnahme; interne `.quarantine/`, `.protected/` und generierte Varianten bleiben ausgeschlossen.

POST `/api/v1/iam/media/register` benötigt `media.read` und `media.create`. Ausschließlich das Mounten der bewusst geöffneten Detailroute stößt ihn an; Loader, Listen, GET und Prefetch bleiben lesend. Ohne Schreibrecht erscheint der Lesemodus. Während der Vorbereitung werden keine redaktionellen Entwürfe angeboten. Navigation beziehungsweise Scope-Wechsel verwirft späte UI-Antworten. Erfolgreiche Annahme öffnet dieselbe reguläre Detailansicht mit deren bestehendem Processing-Polling; bei Fehler ist ausschließlich eine bewusste Wiederholung möglich.

Die Quelle wird mit höchstens 64 MiB gelesen. Pro Prozess sind acht gleichzeitige Aufnahmen im Speicher zulässig. Weitere Aufnahmen können nach einer 503-Antwort erneut versucht werden. Größe und ETag müssen zwischen HEAD, begrenztem Read und anschließendem HEAD übereinstimmen; fehlende Identität, Quellverlust, Austausch und unzulässige tatsächliche Bildsignatur blockieren vor der Anlage. Browser-MIME, Dateiendung und gewünschte Sichtbarkeit bestimmen die Freigabe nicht. Anschließend werden genau diese Bytes in einen privaten Eingang geschrieben. Auch ohne Scan wird der private Bucket über den bestehenden Storage-Guard geprüft. Der vorhandene Worker validiert das Bild und verarbeitet ausschließlich diese unveränderliche Eingangsgrundlage; bei Scanpflicht verwendet er den bestehenden ClamAV-Pfad. Ein späterer Quellwechsel verändert die bereits übernommenen Bytes nicht.

Eine deterministische UUID aus Instanz, Interface-/Endpoint-/Bucket-Identität und Storage-Key verbindet parallele Aufrufe. `createAssetIfAbsent` erweitert den bestehenden Repository-Insert mit `ON CONFLICT DO NOTHING`; es überschreibt weder eine konkurrierende Aufnahme noch deren Status. Die primäre und die bestehende zusammengesetzte Unique-Grenze werden damit gemeinsam berücksichtigt. Nur der Gewinner legt die Upload-Session in derselben kurzen Transaktion an. Unterlegene Requests entfernen ausschließlich ihren eigenen privaten Eingang. Nach einem unklaren Commit-Ausgang wird ein möglicherweise verwendeter Eingang konservativ erhalten. Storage-I/O liegt außerhalb der Datenbanktransaktionen.

Quelle und ETag liegen im vorhandenen technischen JSON. Ein veränderter Quellstand erhält nicht still die alte Identität. Wiederholte Annahme verwendet dieselbe Session und denselben bestehenden Job; Enqueue-Fehler lassen sich ohne neue Kopie wiederholen. Die bestehende tokengebundene Finalisierung bucht Quote und Aktivierung atomar, auch bei Parallelität und Teilfehlern. Ein zusätzliches Schema, eine Migration, ein Worker oder ein Importsystem sind nicht erforderlich. Die Bibliothek löst Quellidentitäten gesammelt über vorhandene Primärschlüssel auf und zeigt das übernommene Objekt nicht doppelt an.

Original, bisherige Quell-URL und bestehende Einbettungen bleiben unverändert. Neue Verwendungen nutzen die bestätigte verwaltete Ausgabe; bestehende Referenzen werden nicht automatisch ersetzt. Ein fehlgeschlagener oder blockierter Auftrag wird nicht als bereit ausgegeben. Die alte Scan-Import-Sperre ist durch diesen begrenzten Aufnahmeweg ersetzt. Der private beziehungsweise Quarantäne-Eingang einer bereits initialisierten Sitzung und ihre Scanpflicht bleiben auch nach einem Schalterwechsel erhalten.

## Issue-Abgleich

Stand: Issues am 18.11.2026 erneut aus GitHub gelesen; Codeprüfung und Browserreproduktion getrennt behandeln.

| Issue         | Behandlung im Change                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #2227         | Hauptumfang: Detailansicht, Fokusübergabe und sichere Aufnahme.                                                                                                                                                                                               |
| #971          | Hauptumfang: Kopie-Entwurf, drei Schritte und Speicherabschluss.                                                                                                                                                                                              |
| #2001         | Zuschneidemenü im vorhandenen Dialog/Portal reproduzieren; lokal begrenzte Integrationskorrektur und Regressionstest, kein Editor-Fork.                                                                                                                       |
| #2156 / #2157 | Als zusammenhängende Grenze untersuchen: Inhalt entfernen/speichern/neuladen sowie Referenz- und Verwendungsreadback. Nur belegten Fehler im bestehenden Owner korrigieren; keine zweite Referenzverwaltung. Backend-Fehler nicht durch UI-Zähler kaschieren. |
| #2154         | Bestätigen, Abbrechen und Escape mit exakten Callback-Zahlen prüfen; erforderlichen Fehler im gemeinsamen Dialog korrigieren und betroffene Verlassen-Pfade gezielt prüfen.                                                                                   |
| #1952         | Privaten Eingang bei Wiederholung einschließlich späterer Worker-Verarbeitung prüfen und vorhandenen Pfad nötigenfalls minimal korrigieren. Kein Scan-Schalter in einem Zielsystem wird geändert.                                                             |
| #1026         | Invarianten für betroffene Runtime-Pfade übernehmen; kein pauschales Komplexitäts-/Refactoring-Projekt.                                                                                                                                                       |
| #970          | Tatsächliche Maße sichtbar und vorhandene Größenwarnungen nicht blockierend erhalten. Neue konfigurierbare Instanz-Mindestgröße bleibt eigener Umfang.                                                                                                        |

Favicon, Organisationslogo, AR und allgemeine Formularmigration sind eigenständige Produktaufträge. Bestehende Verbraucher des gemeinsamen Pickers werden auf Regressionen geprüft; deren Fachfunktionen werden nicht beiläufig erweitert.

## Kritische Invarianten und Nachweise

| Grenze                                       | Geplanter Nachweis                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fokus verändert nur Metadaten                | Datei-/Variantenidentität vor/nach PATCH unverändert; unabhängiger GET und tatsächlicher Verbraucher erhalten Werte; Reset und ungültige Koordinaten geprüft.    |
| Entwurf verändert kein Original              | Öffnen/Zurück/Abbrechen ohne dauerhaftes neues Medium; Export ohne Marker; neue ID erst nach Abschluss; Originalbytes, Angaben und Referenzen unverändert.       |
| Aufnahme erfordert autorisierten Schreibpfad | GET/Prefetch/Lesekonto ohne Mutation; fremde Instanz/Objekte abgelehnt; nur bestätigte Sichtbarkeit, Datei- und Scanprüfung.                                     |
| Konkurrenz und Fehler erhalten Konsistenz    | Echter Repository-/Postgres-Nachweis paralleler Aufnahme, atomarer Quote und Wiederholung; Upload-/Workerfälle für Teilfehler, Quellwechsel und Schalterwechsel. |
| Inhalt und Referenzen stimmen überein        | Speichern und unabhängiger Readback für Entfernung/Verwendung; fehlgeschlagenes Speichern behauptet keine erfolgreiche Entfernung.                               |
| Studio-Rahmen bleibt bedienbar               | Gezielte Browserprüfung bei 1280 × 720, 1440 × 900, schmaler Ansicht, Zoom und Tastatur; Dropdown, Fokuspunkt, letzte Hauptaktion und Verwerfendialog.           |

Kleinste aussagekräftige Nx-Unit-/Type-Gates je Änderung; vorhandene Tests erweitern. Für Runtime-Änderungen früh Server-Runtime-Gate sowie betroffene Auth-/Security-/Datenintegritätsprüfungen. Bildreferenzen betroffener gemeinsamer UI zusammenhängend prüfen, Toleranzen nicht erhöhen. Dokumentations-, OpenSpec- und Platzierungsprüfungen vor Abschluss. Keine Tests allein für CSS-Klassen oder Pixelwerte; technische, live und fachliche Abnahme getrennt berichten.

## Alternativen und Entscheidungen

Nur Texte/Abstände korrigieren würde weder Schrittführung noch Fokuszuständigkeit lösen. Ein eigener Editor oder Importdienst würde zusätzliche Ownership schaffen. Gewählt ist deshalb die Überarbeitung der bestehenden Owner mit proportionalen Lieferabschnitten und gezielten Vertragsnachweisen.
