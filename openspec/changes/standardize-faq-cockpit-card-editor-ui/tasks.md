## 1. Referenzmuster und gemeinsame Studio-Verträge festziehen

- [x] 1.1 News, Events, POIs und GenericItems entlang der Referenzmatrix für Tabs, Sections, Formularfehler, History, Pagination und Löschen charakterisieren.
- [x] 1.2 Pro Muster festhalten, welches Verhalten übernommen und welche lokale Doppelimplementierung ausdrücklich nicht fortgeführt wird.
- [x] 1.3 `refactor-shared-editor-primitives` auf verfügbare Detailkarten-, Repeater- und History-Bausteine prüfen und Überschneidungen dokumentieren.
- [x] 1.4 Fehlende, mindestens zweifach belegte Primitives für History oder Löschbestätigung in `studio-ui-react` ergänzen; keine pluginlokale Parallelbasis einführen.
- [x] 1.5 Gemeinsame Feld-ID- und Tab-Zuordnung für FAQ- und Kachel-Validierungsfehler festlegen.
- [x] 1.6 Gemeinsame Listenparameter-Normalisierung für `page`, `pageSize` und optionale Fachfilter aus dem Events-/POI-Muster ableiten oder wiederverwenden.
- [x] 1.7 Vor der Pluginmigration prüfen, dass die Zielstruktur lokale Tabs-, Panel-, Pagination- und Bestätigungslogik tatsächlich reduziert und keine zusätzlichen Wrapper ohne Mehrfachnutzung erzeugt.

## 2. FAQ-Editor und FAQ-Liste migrieren

- [x] 2.1 FAQ-Tabs auf `StudioDetailTabs` umstellen und Desktop-/Mobilnavigation sowie Panelbeschreibungen vereinheitlichen.
- [x] 2.2 FAQ-Formularstatus auf `StudioFormSummary` und `StudioFormSummaryErrors` mit feldbezogener Navigation umstellen.
- [x] 2.3 FAQ-Felder und Sprachfilter ausschließlich mit bestehenden Studio-/shadcn-Komponenten darstellen.
- [x] 2.4 FAQ-Liste und -Editor mit fachlicher Seitenbeschreibung, modusabhängiger Primäraktion und Pending-Sperre vervollständigen.
- [x] 2.5 Sprachfilter als URL-Search-Param modellieren und im Host auf die vollständige FAQ-Teilmenge vor Sortierung und Pagination anwenden.
- [x] 2.6 FAQ-Listenpagination und Search-Param-Erhaltung für Vorwärts-, Rückwärts- und Browsernavigation absichern.
- [x] 2.7 FAQ-Historie auf das gemeinsame History-Muster umstellen.

## 3. Kachel-Editor und Kachel-Liste migrieren

- [x] 3.1 Kachel-Tabs auf `StudioDetailTabs` umstellen und bereits besuchte Formularbereiche mit Werten, Fehlern und Bild-Repeatern gemountet halten.
- [x] 3.2 Kachel-Inhalt in gemeinsame Detailkarten für Text, Bilder und Link gliedern, ohne Feldpfade oder Mapper zu verändern.
- [x] 3.3 Kachel-Formularstatus auf `StudioFormSummary` und `StudioFormSummaryErrors` mit feldbezogener Navigation umstellen.
- [x] 3.4 Kachel-Liste und -Editor mit fachlicher Seitenbeschreibung, modusabhängiger Primäraktion und Pending-Sperre vervollständigen.
- [x] 3.5 Bildvorschauen mit stabilen Dimensionen, langen Texten und responsiver Kartenanordnung absichern; Medienauswahl und sichtbare Metadaten unverändert erhalten.
- [x] 3.6 Kachel-Historie auf das gemeinsame History-Muster umstellen.
- [x] 3.7 URL-gesteuerte Vor-/Zurück-Pagination anhand der hostseitigen Kachel-Pagination ergänzen und Search-Params erhalten.

## 4. Destruktive Aktionen vereinheitlichen

- [x] 4.1 Gemeinsamen Studio-Bestätigungsdialog für Content-Löschaktionen bereitstellen oder vorhandenes Dialog-Primitive wiederverwenden.
- [x] 4.2 FAQ-Löschen mit Objektbezug, Pending-Sperre, Abbruch und sichtbarer Fehlerbehandlung migrieren.
- [x] 4.3 Kachel-Löschen mit demselben Vertrag migrieren.
- [x] 4.4 GenericItems-Löschen mit demselben Vertrag migrieren.
- [x] 4.5 Sicherstellen, dass erfolgreiche Löschungen genau einmal mutieren und anschließend zur kanonischen Inhaltsübersicht navigieren.

## 5. Tests und Dokumentation

- [x] 5.1 `studio-ui-react`-Unit-Tests für ergänzte gemeinsame Primitives und Fokus-/Pending-Verhalten hinzufügen.
- [x] 5.2 Charakterisierungstests oder bestehende Referenztests für die übernommenen News-, Events- und POI-Verhaltensmuster identifizieren und als Abnahmereferenz dokumentieren.
- [x] 5.3 FAQ-Komponententests für Create/Edit, mobile Tabs, Werterhalt, Fehlernavigation, History, URL-Filter und Pagination ergänzen.
- [x] 5.4 Kachel-Komponententests für Create/Edit, Tabwechsel mit mehreren Bildern, Fehlernavigation, Medienkarten, History und Pagination ergänzen.
- [x] 5.5 GenericItems-Komponententests für den bestätigten Löschablauf ergänzen.
- [x] 5.6 Host-Tests belegen lassen, dass der FAQ-Sprachfilter vor Sortierung, Gesamtzahl und Pagination angewendet wird.
- [ ] 5.7 Mindestens einen E2E-Flow je Fachplugin für Bearbeiten, Tabwechsel, Speichern und bestätigtes Löschen ergänzen; FAQ zusätzlich mit Sprachfilter, Kacheln zusätzlich mit mehreren Bildern.
- [x] 5.8 Betroffene Tests von News, Events und POIs ausführen, falls gemeinsame `studio-ui-react`-Primitives deren Build- oder Laufzeitpfade verändern; keine fachfremden Snapshot-Anpassungen ohne sichtbare Verhaltensänderung vornehmen.
- [x] 5.9 Relevante arc42-Abschnitte `05`, `08`, `10` und `11` sowie die Studio-Form-Migrationsdokumentation aktualisieren.
- [x] 5.10 Kleinste relevante Nx-Unit-, Type-, Lint- und bei Hoständerungen Server-Runtime-Gates nach jedem Block ausführen.
- [x] 5.11 Vor PR-Freigabe den gemessenen affected Scope bewerten und nach Möglichkeit `pnpm test:pr` ausführen.
- [x] 5.12 `pnpm exec openspec validate standardize-faq-cockpit-card-editor-ui --strict` und `pnpm check:file-placement` erfolgreich ausführen.
