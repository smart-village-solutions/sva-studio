## ADDED Requirements
### Requirement: Persistentes fachliches Rechtstext-Modell

Das System SHALL Rechtstext-Versionen serverseitig als fachliche Inhalte mit UUID, Name, Versionsnummer, Sprache, HTML-Inhalt, Status sowie Erstellungs-, Änderungs- und Veröffentlichungsdatum persistieren.

#### Scenario: Rechtstext serverseitig erstellen

- **WHEN** ein berechtigter Administrator eine neue Rechtstext-Version anlegt
- **THEN** vergibt das System eine UUID automatisch
- **AND** speichert Name, Versionsnummer, Sprache, HTML-Inhalt, Status und Zeitstempel serverseitig

#### Scenario: Rechtstext serverseitig aktualisieren

- **WHEN** ein berechtigter Administrator eine bestehende Rechtstext-Version bearbeitet
- **THEN** persistiert das System die geänderten Fachfelder serverseitig
- **AND** aktualisiert das Änderungsdatum

#### Scenario: Statusmodell wird fachlich validiert

- **WHEN** eine Rechtstext-Version erstellt oder aktualisiert wird
- **THEN** akzeptiert das System nur die Statuswerte `draft`, `valid` oder `archived`
- **AND** lehnt ungültige Statuswerte mit einem Validierungsfehler ab

#### Scenario: Gültige Rechtstexte verlangen Veröffentlichungsdatum

- **WHEN** eine Rechtstext-Version mit Status `valid` gespeichert wird
- **THEN** verlangt das System ein Veröffentlichungsdatum
- **AND** speichert den Datensatz nicht ohne diese Angabe
