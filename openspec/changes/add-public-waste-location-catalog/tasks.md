## 1. Öffentlicher Ortskatalog

- [x] 1.1 App-lokale, strikt typisierte Verträge für Katalogantwort, Mappingstatus und `calendarQuery` ergänzen.
- [x] 1.2 Eine ausschließlich lesende Repository-Projektion für aktive Abholorte mit vorhandenen Regions-, Orts-, Straßen- und Hausnummerwerten implementieren.
- [x] 1.3 Identische Auswahlpfade deterministisch über den bestehenden Standortschlüssel deduplizieren und stabil sortieren.
- [x] 1.4 `GET /api/public-waste/locations` in Handler und produktiver Public-Waste-Runtime registrieren, ohne den bestehenden Auswahl- oder Kalenderpfad zu verändern.

## 2. Mapping und Fehlerfälle

- [x] 2.1 Vorhandene Region als `municipality` und vorhandenen Ort als `district` mit unveränderten IDs und Originalnamen projizieren.
- [x] 2.2 Fehlende Regionen als `municipality: null`, `mappingComplete: false` und `missingFields: ["municipality"]` ausgeben.
- [x] 2.3 Vorhandene orts-, straßen- und hausnummerweite Abholorte mit der bestehenden `all`-Semantik abbilden.
- [x] 2.4 Sicherstellen, dass inaktive Abholorte und nicht öffentliche Waste-Daten nicht in die Antwort gelangen.

## 3. Tests und Qualität

- [x] 3.1 Repository-Tests für vollständige Hierarchien, fehlende Regionen, Sammelwerte, Deduplizierung, Sortierung und inaktive Datensätze ergänzen.
- [x] 3.2 Endpoint- und Runtime-Tests für Status, Content-Type, Antwortvertrag und unveränderte Kalenderverwendung ergänzen.
- [x] 3.3 Typ-Gate und vollständige Unit-Tests von `public-waste-calendar-web` ausführen.
- [x] 3.4 Betroffenen Scope messen und die kleinsten relevanten zusätzlichen Lint-, Build- und PR-Gates gemäß `AGENTS.md` ausführen.

## 4. Dokumentation

- [x] 4.1 Öffentlichen API-Vertrag mit Join-Beispiel aus Ortskatalog und Kalenderantwort auf Deutsch dokumentieren.
- [x] 4.2 `docs/architecture/03-context-and-scope.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md` und `docs/architecture/08-cross-cutting-concepts.md` um die neue Read-Projektion und ihre Datenminimierungsgrenze ergänzen.
- [ ] 4.3 Nach Vergabe einer PR-Nummer den zugehörigen Changelog-Eintrag ergänzen.
- [x] 4.4 Dokumentieren, dass keine Schemaänderung, Datenmigration, künstliche Gemeinde, Quellenversion oder neue Termin-ID eingeführt wurde.
- [x] 4.5 `pnpm check:file-placement` und die relevanten Dokumentationsgates ausführen.
