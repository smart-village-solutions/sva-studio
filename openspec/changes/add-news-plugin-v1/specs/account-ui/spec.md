## ADDED Requirements

### Requirement: Plugin-Navigation kann in die Account-UI integriert werden

Das System SHALL Plugin-definierte Navigationspunkte in die bestehende Account-UI integrieren können.

#### Scenario: News-Navigation erscheint in der Shell

- **WENN** das News-Plugin im Studio registriert ist
- **DANN** erscheint ein Navigationspunkt `News` in der Studio-Navigation
- **UND** der Navigationspunkt verweist auf die plugin-definierte News-Listenansicht

### Requirement: Plugin-Routen nutzen bestehende Schutzmechanismen

Das System SHALL Plugin-Routen mit denselben Authentifizierungs- und UI-Schutzmechanismen absichern wie fachlich gleichartige Core-Routen.

#### Scenario: News-Plugin nutzt Content-Schutzpfad

- **WENN** ein Benutzer eine News-Plugin-Route aufruft
- **DANN** verwendet das System bestehende Account-/Content-Guards zur Zugangskontrolle
- **UND** unberechtigte Benutzer erhalten denselben Schutzpfad wie bei Core-Content-Funktionen
