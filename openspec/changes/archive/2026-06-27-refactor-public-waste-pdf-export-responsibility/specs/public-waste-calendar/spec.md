## MODIFIED Requirements
### Requirement: Öffentliche App liefert PDF- und iCal-Aktionen konsistent zum Standort

Das System SHALL globale PDF- und iCal-Aktionen aus demselben finalen Standortkontext ableiten wie die Kalenderansicht.

#### Scenario: PDF-Aktion erzeugt das Dokument ad hoc

- **WHEN** für einen vollständig aufgelösten Standort globale Aktionen angezeigt werden
- **THEN** stellt die App eine PDF-Exportaktion für ein ausdrücklich gewähltes Jahr bereit
- **AND** der Export wird serverseitig ad hoc erzeugt
- **AND** die App ist selbst für die Auslieferung des PDFs verantwortlich
- **AND** es werden keine stabilen, vorgenerierten PDF-URLs benötigt

#### Scenario: iCal-Feed liefert alle verfügbaren künftigen Termine

- **WHEN** ein Benutzer oder ein Kalender-Client den iCal-Link eines vollständig aufgelösten Standorts aufruft
- **THEN** liefert die App einen serverseitig erzeugten iCal-Feed
- **AND** der Feed enthält alle verfügbaren künftigen Termine dieses Standorts
- **AND** der Feed ist konsistent zu den in der App sichtbaren Kalenderdaten

## ADDED Requirements
### Requirement: Öffentliche App exportiert PDFs mit Jahres- und Fraktionswahl

Das System SHALL PDF-Exporte serverseitig aus dem vollständig aufgelösten Standort, dem gewählten Jahr und den ausgewählten Fraktionen erzeugen.

#### Scenario: Export berücksichtigt nur die Auswahl des Benutzers

- **WHEN** Benutzerinnen oder Benutzer ein Jahr und mindestens eine Fraktion für den Export wählen
- **THEN** enthält das PDF nur Termine des gewählten Jahres
- **AND** nur Termine der ausgewählten Fraktionen werden in den Export aufgenommen

### Requirement: Öffentliche App berücksichtigt übergeordnete Abholorte im PDF-Export

Das System SHALL beim PDF-Export alle wirksamen Termine des Standortkontexts einschließlich übergeordneter Abholorte berücksichtigen.

#### Scenario: Ortsebene vererbt Termine an konkrete Straßen

- **WHEN** ein konkreter Standort wie `Perleberg, Ackerstraße` exportiert wird
- **AND** eine Tour nur dem übergeordneten Abholort `Perleberg (alle Straßen)` zugeordnet ist
- **THEN** wird diese Tour trotzdem in den PDF-Export aufgenommen
- **AND** erst danach greifen Jahres- und Fraktionsfilter
