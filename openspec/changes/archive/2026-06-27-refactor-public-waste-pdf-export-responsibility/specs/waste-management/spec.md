## MODIFIED Requirements
### Requirement: Waste-Management ist eine vollständige Studio-Capability

Das System SHALL eine eigenständige Capability `waste-management` für die vollständige administrative Pflege des kommunalen Abfallkalenders bereitstellen.

#### Scenario: Waste-Management deckt den vollen Admin-Scope ab

- **WHEN** das Waste-Management-Modul im Studio verwendet wird
- **THEN** können Abfallarten, Regionen, Orte, Straßen, Hausnummern, Abholorte, Touren, Standort-Zuordnungen, globale Datumsverschiebungen und tourbezogene Datumsverschiebungen verwaltet werden
- **AND** das Modul umfasst CSV-Import, Seed, Reset und modulbezogene Einstellungen
- **AND** Feiertags- und sonstige Abweichungslogik ist Teil des fachlichen Scopes
- **AND** öffentliche Bürger-Read-APIs oder Export-Feeds sind nicht Teil dieser Capability
- **AND** die Capability erzeugt keine Bürger-PDFs mehr selbst

## ADDED Requirements
### Requirement: Studio verwaltet nur statische PDF-Stamminhalte

Das System SHALL den Tab `Ausgabe` im Studio ausschließlich für PDF-bezogene Stamminhalte verwenden, die nicht aus den fachlichen Waste-Daten stammen.

#### Scenario: Ausgabe-Tab erzeugt keine PDFs mehr

- **WHEN** ein berechtigter Benutzer den Tab `Ausgabe` im Waste-Management öffnet
- **THEN** kann er dort nur statische Inhalte wie Branding oder Kontakttext pflegen
- **AND** es wird kein Button zur PDF-Erzeugung angeboten
- **AND** es werden keine erzeugten PDF-Artefakte oder Jahreslinks gelistet

### Requirement: Waste-Fraktionen können ein optionales PDF-Kürzel tragen

Das System SHALL an Waste-Fraktionen ein optional pflegbares Kürzel für die PDF-Legende unterstützen.

#### Scenario: Fraktionskürzel wird migrationssicher eingeführt

- **WHEN** das System das neue Fraktionskürzel einführt
- **THEN** erfolgt die Persistenz über eine explizite DB-Migration in der bestehenden `waste_*`-Tabellenfamilie
- **AND** Schema-Snapshot und Schema-Dokumentation werden im selben Change aktualisiert

#### Scenario: Fehlendes Kürzel blockiert die Pflege nicht

- **WHEN** für eine Fraktion kein Kürzel gepflegt ist
- **THEN** bleibt die Fraktion gültig und verwendbar
- **AND** nachgelagerte PDF-Logik darf auf einen Fallback aus der Bezeichnung zurückgreifen
