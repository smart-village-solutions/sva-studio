## ADDED Requirements

### Requirement: Waste-Management führt ausgewählte Touren auf eine Zieltour zusammen

Das System SHALL Benutzern mit `waste-management.tours.manage` innerhalb ihrer Instanz die Sammelaktion „Ausgewählte Touren zusammenführen“ für mindestens zwei ausgewählte Touren anbieten. Die Bestätigung SHALL genau eine explizit gewählte Zieltour aus der Auswahl voraussetzen und auf eine gültige Vorschau für dieselbe Auswahl und Zieltour Bezug nehmen.

#### Scenario: Benutzer prüft die Auswirkungen für gleichnamige Touren

- **GIVEN** drei veröffentlichte Touren besitzen dieselbe Terminplanung und 13, 9 und 6 Abholpunkt-Zuordnungen, darunter einen gemeinsamen Abholpunkt
- **WHEN** der Benutzer die Tour mit 13 Abholpunkten als Zieltour auswählt
- **THEN** unterscheidet der Dialog die Touren anhand ihres vollständigen Namens, der Abholpunktzahl, des Turnus, der Gültigkeit und der kurzen Tour-ID
- **AND** die Vorschau zeigt 13 neue und insgesamt 26 eindeutige Zuordnungen in der Zieltour sowie die zwei zu archivierenden Quelltouren einschließlich ausgewählter Touren außerhalb des sichtbaren Filters

#### Scenario: Unterschiedliche Planung blockiert die Bestätigung

- **GIVEN** eine gewählte Tour ist unveröffentlicht oder nutzt keinen festen beziehungsweise aufgelösten benutzerdefinierten Turnus, oder ihre Fraktionen, Gültigkeit, Terminregeln, individuellen Tourtermine oder Hinweise weichen von der Zieltour ab, oder eine beteiligte Tour hat eigenständige Einsätze oder abholpunktspezifische Einzeltermine
- **WHEN** das System die Zusammenführung prüft
- **THEN** zeigt es die betroffene Tour und den Grund an und blockiert die Bestätigung
- **AND** die Terminprüfung berücksichtigt auch tourbezogene und global auf einzelne Touren eingeschränkte Ausweichregeln

#### Scenario: Bestätigung ergänzt Zuordnungen und archiviert Quellen atomar

- **GIVEN** eine gültige Vorschau für die gewählte Zieltour und dieselben Quelltouren
- **WHEN** der Benutzer die Zusammenführung bestätigt
- **THEN** enthält die veröffentlichte Zieltour die vereinigte Menge der Abholpunkte mit genau einer Zuordnung je Abholpunkt
- **AND** die Quelltouren werden in derselben Transaktion archiviert und behalten ihre Planungsdaten und Zuordnungen
- **AND** die wirksamen Abholtage, Fraktionen und fachlichen Hinweise bleiben je Abholpunkt erhalten, während Wiederholungen aus den archivierten Touren aus der Kalenderausgabe entfallen
- **AND** der Server auditiert das Ergebnis und die beteiligten Touren ohne vollständige Fachdaten

#### Scenario: Veraltete Vorschau oder Fehler verhindert alle Änderungen

- **GIVEN** relevante Planungsdaten, Status oder Abholpunkt-Zuordnungen haben sich seit der Vorschau verändert, oder beim Schreiben entsteht ein Fehler
- **WHEN** die Bestätigung verarbeitet wird
- **THEN** ergänzt der Server keine Zuordnungen und archiviert keine Tour dauerhaft
- **AND** die Oberfläche zeigt den Grund an und ermöglicht eine aktualisierte Vorschau

#### Scenario: Instanzfremde Touren oder fehlendes Recht werden abgelehnt

- **WHEN** jemand Vorschau oder Bestätigung ohne `waste-management.tours.manage` oder mit einer Tour außerhalb der eigenen Instanz anfordert
- **THEN** lehnt der Server die Anfrage ab und gibt keine instanzfremden Tourendaten aus
