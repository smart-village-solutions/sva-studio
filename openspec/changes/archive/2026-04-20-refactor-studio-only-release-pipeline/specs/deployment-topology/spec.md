## MODIFIED Requirements
### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende produktionsnahe Remote-Operationen in einem deterministischen CI-/Runner-Kontext ausfuehren.

#### Scenario: Studio-Mutationen laufen nicht mehr ueber lokale Operator-Shells

- **WHEN** ein `studio`-Deploy, `migrate`, `reset` oder `down` ausgefuehrt werden soll
- **THEN** akzeptiert der kanonische Pfad nur einen CI-/Runner-Kontext mit bekanntem Quantum-Zugang
- **AND** lokale Shell-Overlays oder Entwickler-Rechner gelten nicht als regulaerer Mutationspfad
- **AND** eine lokale Ausfuehrung wird mit klarer Fehlermeldung abgewiesen

### Requirement: Kanonischer Studio-Rollout-Pfad

Das System SHALL fuer das Runtime-Profil `studio` genau einen offiziellen digest-basierten Release-Pfad ueber CI bereitstellen.

#### Scenario: Studio-Release folgt Build, Verify und Deploy

- **WHEN** ein neues Studio-Release vorbereitet wird
- **THEN** baut der offizielle Pfad genau ein `linux/amd64`-Image fuer den Commit
- **AND** verifiziert denselben Manifest-Digest vor dem Rollout in einem Runner-basierten Artifact-Gate
- **AND** deployt erst danach genau diesen Digest nach `studio`

#### Scenario: Studio-Deploy nutzt nur digest-basierte Promotion

- **WHEN** ein CI-Workflow `studio` ausrollt
- **THEN** verwendet er `image_digest` als Pflichtinput
- **AND** behandelt einen Tag hoechstens als Metadatum fuer Reports und Korrelation
- **AND** schreibt Deploy-Evidenz fuer Precheck, Image-Smoke, Deploy und Smoke unter `artifacts/runtime/deployments/`

### Requirement: Prod-nahes Parity-Gate vor mutierenden Remote-Rollouts

Das System SHALL fuer `studio` einen runner-basierten Artifact-Verify-Schritt vor jeder Remote-Mutation ausfuehren.

#### Scenario: Runner prueft denselben Digest vor dem Studio-Deploy

- **WHEN** ein Studio-Release den gebauten Digest verifizieren will
- **THEN** startet der CI-Runner genau dieses Image in einem isolierten Container-Kontext
- **AND** prueft mindestens `GET /health/live`, `GET /health/ready` und `GET /`
- **AND** verwendet fuer Datenbank-Readiness denselben dedizierten Runtime-Principal wie der produktionsnahe App-Betrieb
- **AND** blockiert der Prozess den Remote-Deploy, wenn einer dieser Requests haengt, timeouted oder einen unerwarteten Status liefert

#### Scenario: Manueller Studio-Deploy erzwingt das Verify-Gate

- **WHEN** ein Operator den Studio-Deploy-Workflow manuell mit einem vorhandenen Digest startet
- **THEN** fuehrt der Workflow vor jeder Remote-Mutation dasselbe runner-basierte Artifact-Verify gegen genau diesen Digest aus
- **AND** startet der Deploy nur, wenn dieses Verify-Gate erfolgreich war

### Requirement: Studio-Deploy benoetigt einen geeigneten Runner

Das System SHALL mutierende `studio`-Deploys nur auf einem Runner ausfuehren, der die benoetigten Operator-Werkzeuge bereits bereitstellt.

#### Scenario: Quantum-CLI ist Teil des Runner-Vertrags

- **WHEN** ein mutierender Studio-Deploy gestartet wird
- **THEN** laeuft der Job nicht auf einem generischen GitHub-hosted Standard-Runner ohne `quantum-cli`
- **AND** verwendet stattdessen einen Runner-Vertrag, in dem `quantum-cli` und die benoetigten Deploy-Abhaengigkeiten verfuegbar sind
