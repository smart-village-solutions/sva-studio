## ADDED Requirements

### Requirement: FAQ-Plugin verwendet getrennte autorisierbare Actions

Das System MUST die FAQ-Operationen über die fully-qualified Actions `faq.read`, `faq.create`, `faq.update` und `faq.delete` autorisieren. Das FAQ-Plugin MUST seine FAQ-Admin-Ressource und UI-Bindings deklarativ über den bestehenden Standard-Content-Plugin-Vertrag registrieren.

#### Scenario: FAQ-Operation wird autorisiert

- **WHEN** ein Benutzer eine FAQ-Listen-, Create-, Update- oder Delete-Operation ausführt
- **THEN** prüft der Host die zugehörige `faq.*`-Action im Instanz- und Organisationskontext
- **AND** führt die Operation nur bei erfolgreicher Prüfung aus

#### Scenario: Fehlende FAQ-Berechtigung blockiert die Operation

- **WHEN** einem Benutzer die für eine FAQ-Operation benötigte `faq.*`-Action fehlt
- **THEN** veröffentlicht der Host die geschützte Admin-Fläche nicht für diesen Benutzer oder weist die serverseitige Operation ab
- **AND** der Mainserver wird nicht aufgerufen

#### Scenario: FAQ folgt dem Standard-Content-Plugin-Vertrag

- **WHEN** der Host den FAQ-Plugin-Beitrag registriert
- **THEN** veröffentlicht er die FAQ-`list`-, `detail`- und `editor`-Bindings zusammen mit der FAQ-Admin-Ressource
- **AND** blendet er deren direkte Navigation zugunsten der gemeinsamen Inhaltsübersicht aus
