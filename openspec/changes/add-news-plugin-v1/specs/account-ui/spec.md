## ADDED Requirements

### Requirement: Plugin-Navigation kann in die Account-UI integriert werden

Das System SHALL Plugin-definierte Navigationspunkte in die bestehende Account-UI integrieren können.

#### Scenario: News-Navigation erscheint in der Shell

- **WENN** das News-Plugin im Studio registriert ist
- **DANN** erscheint ein Navigationspunkt für News in der Studio-Navigation
- **UND** der Navigationspunkt verweist auf die plugin-definierte News-Listenansicht
- **UND** der Anzeigetext wird über einen i18n-Key (`news.navigation.title`) bezogen, nicht als harter String

#### Scenario: Plugin-Navigation ist barrierefrei

- **WENN** der News-Navigationspunkt in die Shell integriert ist
- **DANN** erscheint er innerhalb des bestehenden `<nav>`-Landmarks
- **UND** bei aktiver Route ist der Navigationspunkt via `aria-current="page"` ausgezeichnet
- **UND** der Navigationspunkt ist per Tastatur erreichbar

### Requirement: Plugin-Routen nutzen bestehende Schutzmechanismen

Das System SHALL Plugin-Routen mit denselben Authentifizierungs- und UI-Schutzmechanismen absichern wie fachlich gleichartige Core-Routen.

#### Scenario: News-Plugin nutzt Content-Schutzpfad

- **WENN** ein Benutzer eine News-Plugin-Route aufruft
- **DANN** verwendet das System bestehende Account-/Content-Guards zur Zugangskontrolle
- **UND** unberechtigte Benutzer erhalten denselben Schutzpfad wie bei Core-Content-Funktionen

#### Scenario: Benutzer ohne Content-Berechtigung wird blockiert

- **WENN** ein Benutzer ohne `content.read`-Berechtigung eine News-Plugin-Route aufruft
- **DANN** wird der Zugriff verweigert
- **UND** der Navigationspunkt für News erscheint nicht in der Studio-Navigation
