## ADDED Requirements

### Requirement: Öffentliche Waste-Web-App hat einen eigenen Swarm-Stack

Das System SHALL für `public-waste-calendar` einen eigenen Portainer-/Swarm-Stack
bereitstellen, der nicht Teil des normalen `studio`-Stacks ist.

#### Scenario: Öffentliche Waste-Web-App wird getrennt von Studio ausgerollt

- **WHEN** ein Operator oder Workflow die öffentliche Waste-Web-App ausrollt
- **THEN** erfolgt der Rollout gegen den dedizierten Stack `public-waste-calendar`
- **AND** der bestehende `studio`-Stack bleibt unverändert
- **AND** die Compose-Definition des Waste-Web-Stacks erweitert nicht die Studio-Compose

### Requirement: Öffentliche Waste-Web-App nutzt tag-basiertes Image-Deployment

Das System SHALL die öffentliche Waste-Web-App im produktiven Stack über einen
parametrisierbaren Image-Tag referenzieren.

#### Scenario: Git-Tag steuert den produktiven Image-Tag

- **WHEN** ein Git-Tag `waste-web-v1.2.3` den öffentlichen Releaseworkflow auslöst
- **THEN** veröffentlicht der Workflow das Waste-Web-Image mit dem Tag `v1.2.3`
- **AND** aktualisiert im Zielstack nur die Variable `PUBLIC_WASTE_IMAGE_TAG`
- **AND** andere Laufzeitvariablen des Stacks bleiben dabei unverändert

#### Scenario: Rollback erfolgt über vorherigen SemVer-Tag

- **WHEN** ein Operator einen öffentlichen Waste-Web-Release zurücknehmen muss
- **THEN** kann der Stack auf einen früheren `PUBLIC_WASTE_IMAGE_TAG` zurückgesetzt werden
- **AND** der Rollback benötigt keinen Eingriff in den normalen Studio-Stack

### Requirement: Öffentliche Waste-Web-App verwendet isoliertes Host-Routing

Das System SHALL die öffentliche Waste-Web-App über eigene Ingress-Hosts und
eigene Runtime-Variablen routen.

#### Scenario: Öffentlicher Host wird über eigenen Variablenraum aufgelöst

- **WHEN** der produktive Waste-Web-Stack gerendert wird
- **THEN** leitet die Compose-Datei den öffentlichen Host aus `PUBLIC_WASTE_PUBLIC_HOST` ab
- **AND** die Runtime nutzt `PUBLIC_WASTE_BASE_URL` als kanonische Base-URL
- **AND** weder Host noch Base-URL werden aus `SVA_PARENT_DOMAIN` oder `SVA_PUBLIC_BASE_URL` des Studios abgeleitet
