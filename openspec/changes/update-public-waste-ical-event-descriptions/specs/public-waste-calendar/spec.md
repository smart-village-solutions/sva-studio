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
- **AND** jedes `VEVENT` enthält eine gesammelte Beschreibung aus allen verfügbaren fachlichen Hinweisen des Termins

#### Scenario: Event-Beschreibung bündelt fachliche Hinweise stabil

- **WHEN** für einen Kalendereintrag Fraktionsbeschreibung, Tourbeschreibung und/oder Terminnotiz vorliegen
- **THEN** fasst der iCal-Feed diese Inhalte in der `DESCRIPTION` des jeweiligen `VEVENT` zusammen
- **AND** die Reihenfolge bleibt Fraktionsbeschreibung, dann Tourbeschreibung, dann Terminnotiz
- **AND** nicht vorhandene oder inhaltsgleiche Textbausteine werden ausgelassen
