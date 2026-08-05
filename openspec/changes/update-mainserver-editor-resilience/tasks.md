## 1. Gemeinsamer Vertrag und akuter Fehler

- [x] 1.1 Reproduktionstests für mehrsegmentige fully-qualified Media-Actions und den POI-/Event-Detail-Load bei fehlgeschlagenen Medienreferenzen ergänzen
- [x] 1.2 Media-Action-Normalisierung auf den allgemeinen fully-qualified `<namespace>.<actionName>`-Vertrag ausrichten, ohne neue Kurzformen einzuführen
- [x] 1.3 POI- und Event-Hauptdaten von optionalen Medienreferenzen entkoppeln und getrennte Fehlerzustände darstellen
- [x] 1.4 Betroffene Unit-, Type- und Server-Runtime-Gates ausführen

## 2. Detail- und Abweichungsvertrag

- [x] 2.1 Für POI, Events, News und GenericItem-Fachtypen die generierten Detailquery-/Update-Inputs prüfen und eine Feldmatrix für harte, kontrollierte, nur lesbare, Passthrough- und nicht erhaltbare Felder dokumentieren
- [x] 2.2 Neutralen `MainserverDetailResult`-/Abweichungsvertrag in `@sva/plugin-sdk` definieren
- [x] 2.3 Host-Routen und Clients additiv um sichere Detailmetadaten erweitern; bestehende `get(id)`-Aufrufer und Response-Shapes durch Vertragstests absichern
- [x] 2.4 Gemeinsame PII-arme Abweichungsserialisierung mit normalisierten Listenpfaden, begrenzter Kardinalität und request-lokaler Deduplizierung implementieren
- [x] 2.5 SDK- und Routen-Vertragstests für leere, einzelne und mehrere Abweichungen sowie nicht migrierte Clients ergänzen

## 3. POI und Events als Referenzmigration

- [x] 3.1 POI-Mapper in Identität, Skalare und isolierte Unterfeldgruppen zerlegen
- [x] 3.2 Event-Mapper in Identität, Skalare und isolierte Unterfeldgruppen zerlegen
- [x] 3.3 Feldmatrizen für POI und Events gegen die generierten GraphQL-Fragmente und Mutation-Inputs vervollständigen und als Tests abbilden
- [x] 3.4 Sichere Read-Merge-Write-Pfade für unmittelbar zuvor gelesene, bestätigte Felder implementieren
- [x] 3.5 Roundtrip-Tests für ungültige optionale Skalare, einzelne ungültige Listeneinträge, unbekannte Payload-Schlüssel, Replace- gegenüber Patch-Semantik und schreibgeschützte Feldgruppen ergänzen
- [x] 3.6 Strukturierte Server-Runtime-Logs ohne Rohwerte oder PII testen

## 4. Gemeinsame Editor-Darstellung

- [x] 4.1 Zugängliche Seitenzusammenfassung und abschnittsbezogene Abweichungsdarstellung in `@sva/studio-ui-react` ergänzen
- [x] 4.2 POI und Events an Warnungen, schreibgeschützte Feldgruppen und Wiederholungsaktionen anbinden
- [x] 4.3 Sicherstellen, dass unabhängige Felder bei degradierten Bereichen speicherbar bleiben
- [x] 4.4 Accessibility-, Interaktions- und Lokalisierungstests ergänzen

## 5. Weitere Mainserver-Editoren

- [x] 5.1 News migrieren und Veröffentlichungsdatum sowie Content-Blocks als eigene Feldgruppen absichern
- [x] 5.2 Generic Items migrieren und vorhandenen Payload-Roundtrip erhalten
- [x] 5.3 FAQ und Cockpit Cards unter Erhalt ihrer GenericItem-Diskriminatoren migrieren
- [x] 5.4 Projects unter Erhalt des bestehenden Payload-/Passthrough-Mergevertrags migrieren
- [x] 5.5 Pro Plugin fokussierte Unit-, Type-, Roundtrip- und Integrationsgates ausführen
- [x] 5.6 Vor jeder Plugin-Migration harte Typdiskriminatoren und Read-/Write-Symmetrie prüfen; nicht erhaltbare Mutationen explizit blockieren statt Felder still zu verwerfen

## 6. Dokumentation und Abschluss

- [x] 6.1 `docs/architecture/05-building-block-view.md`, `06-runtime-view.md` und `08-cross-cutting-concepts.md` aktualisieren
- [x] 6.2 `docs/architecture/logging-architecture.md` und `request-flow-szenarien.md` aktualisieren
- [x] 6.3 Relevante Plugin-Entwicklungsdokumentation um Feldgruppen-, Logging- und Erhaltungsvertrag ergänzen
- [ ] 6.4 Passenden deutschen Changelog-Eintrag unter `docs/changelog/entries/` ergänzen
- [x] 6.5 Nach jedem serverseitigen Änderungsblock den kleinsten relevanten Nx-Type-/Unit-Gate-Pfad und früh `pnpm check:server-runtime` ausführen
- [x] 6.6 Abschließend relevante Nx-Gates, `pnpm check:file-placement`, OpenSpec-Strict-Validierung und `git diff --check` ausführen
- [ ] 6.7 Vor PR-Erstellung bevorzugt `pnpm test:pr` ausführen oder ausgelassene breite Gates transparent dokumentieren
