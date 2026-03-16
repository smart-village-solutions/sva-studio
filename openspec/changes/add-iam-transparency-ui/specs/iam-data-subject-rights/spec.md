## ADDED Requirements

### Requirement: UI-gestützte Betroffenenrechtsprozesse

Das System SHALL Betroffenenrechtsprozesse nicht nur per API, sondern auch über nachvollziehbare Self-Service- und Admin-Oberflächen bereitstellen.

#### Scenario: Self-Service zeigt Anträge und Exportstatus

- **WHEN** ein authentifizierter Benutzer die Datenschutz-Oberfläche seines Accounts öffnet
- **THEN** sieht er seine Betroffenenanfragen und Export-Jobs mit Status, Zeitstempeln und Ergebnis
- **AND** blockierende Umstände wie Legal Holds oder Verarbeitungseinschränkungen sind verständlich kenntlich gemacht

#### Scenario: Admin-UI zeigt bearbeitbare DSR-Fälle

- **WHEN** ein berechtigter Administrator die DSR-Sicht im IAM-Cockpit öffnet
- **THEN** sieht er Requests, Export-Jobs, Legal Holds, Profilkorrekturen und Empfängerbenachrichtigungen in filterbaren Listen
- **AND** die Oberfläche unterstützt Drill-downs für Statuswechsel, Fristen und Audit-relevante Metadaten

#### Scenario: Optionale Verarbeitung ist für Betroffene sichtbar

- **WHEN** ein Benutzer der optionalen Verarbeitung widersprochen hat oder eine Einschränkung aktiv ist
- **THEN** zeigt die UI den aktuellen Verarbeitungsstatus und dessen Wirksamkeit an
- **AND** der Benutzer muss den Zustand nicht aus technischen API-Rohdaten ableiten
