## ADDED Requirements
### Requirement: App-Host-Einstiege fuer Mainserver-Inhalte bleiben duenn

Das System SHALL host-owned Mainserver-Inhaltsrouten fuer News, Events und POI so schneiden, dass `apps/sva-studio-react` nur framework-spezifische Einstiege und Request-Dispatching enthaelt, waehrend Request-Parsing, fachliche Validierung, Fehlerabbildung und Mutationsdelegation in serverseitigen Zielpackages liegen.

#### Scenario: News-Request wird ueber duennen App-Einstieg delegiert

- **GIVEN** die Host-App empfaengt einen Request fuer News
- **WHEN** der Request verarbeitet wird
- **THEN** uebernimmt die App nur Request-Matching und framework-spezifischen Einstiegscode
- **AND** Parsing, Validierung und fachliche Mutationslogik werden von einem serverseitigen Package-Handler ausgefuehrt

#### Scenario: Events- oder POI-Request wird ueber duennen App-Einstieg delegiert

- **GIVEN** die Host-App empfaengt einen Request fuer Events oder POI
- **WHEN** der Request verarbeitet wird
- **THEN** uebernimmt die App nur Request-Matching und framework-spezifischen Einstiegscode
- **AND** Parsing, Validierung und fachliche Mutationslogik werden von einem serverseitigen Package-Handler ausgefuehrt

#### Scenario: Mainserver-spezifische Validierungsregeln sind paketseitig testbar

- **WHEN** Mainserver-Eingaben, Fehlerfaelle oder Feldmappings getestet werden
- **THEN** koennen diese Tests gegen package-seitige Servermodule laufen
- **AND** die App muss fuer diese fachlichen Tests keine kanonische Owner-Schicht bleiben

#### Scenario: App-interne Umsortierung ersetzt keine Package-Delegation

- **WHEN** News-, Events- oder POI-Parsing in kleinere Helper innerhalb von `apps/sva-studio-react` zerlegt wird
- **THEN** gilt dies allein nicht als Erfuellung des Boundary-Vertrags
- **AND** der fachliche Parse-, Validierungs- und Fehlervertrag muss weiterhin ueber ein serverseitiges Zielpackage konsumierbar und testbar sein
