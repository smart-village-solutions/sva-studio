## ADDED Requirements
### Requirement: Fachliche Rechtstext-Verwaltung im Admin-Bereich

Das System MUST im Admin-Bereich Rechtstexte als fachliche Inhalte mit UUID, Name, Versionsnummer, Sprachzuordnung, Status, Veröffentlichungsdatum sowie Erstell- und Änderungsdatum darstellen und bearbeiten.

#### Scenario: Rechtstext-Liste zeigt fachliche Metadaten

- **WENN** ein berechtigter Administrator die Rechtstext-Verwaltung öffnet
- **DANN** zeigt die Liste für jeden Rechtstext mindestens UUID, Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum, Erstellungsdatum und Änderungsdatum
- **UND** der Name darf mehrfach vorkommen, ohne dass die UI einen Konflikt meldet

#### Scenario: Rechtstext mit HTML-Inhalt anlegen

- **WENN** ein berechtigter Administrator einen neuen Rechtstext anlegt
- **DANN** vergibt das System die UUID automatisch
- **UND** die UI bietet Felder für Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum und HTML-Inhalt
- **UND** der HTML-Inhalt ist über einen Rich-Text-Editor bearbeitbar

#### Scenario: Rechtstext mit HTML-Inhalt bearbeiten

- **WENN** ein berechtigter Administrator einen bestehenden Rechtstext bearbeitet
- **DANN** kann er Name, Versionsnummer, Sprache, Status, Veröffentlichungsdatum und HTML-Inhalt ändern
- **UND** die Oberfläche zeigt nach erfolgreichem Speichern den serverseitig persistierten Inhalt erneut an

#### Scenario: Keine irreführenden Speicherhinweise

- **WENN** die Rechtstext-Erstellung oder -Bearbeitung angezeigt wird
- **DANN** enthält die UI keinen Hinweis, dass der Textkörper nicht serverseitig gespeichert werde

