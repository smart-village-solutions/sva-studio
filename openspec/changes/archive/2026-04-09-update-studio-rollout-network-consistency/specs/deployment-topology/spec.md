## MODIFIED Requirements
### Requirement: Swarm-kompatibler Portainer-Stack

Das System SHALL einen Portainer-Stack bereitstellen, der für Docker Swarm mit externem Ingress-Netzwerk und Traefik-Routing geeignet ist.

#### Scenario: Deployment in bestehender Swarm-Umgebung

- **WHEN** ein Operator den bereitgestellten Stack in einer bestehenden Swarm-/Portainer-Umgebung ausrollt
- **THEN** verwendet der Stack ein externes Netzwerk für den Ingress
- **AND** der öffentlich erreichbare Service wird über Traefik-Labels statt über direkt veröffentlichte Host-Ports exponiert
- **AND** der Stack enthält Swarm-kompatible `deploy`-Metadaten

#### Scenario: Live-Rollout validiert vollständige App-Netzwerke

- **WHEN** der Live-Stack für `studio` oder `acceptance-hb` für `app-only` oder `schema-and-app` gerendert wird
- **THEN** validiert der Deploypfad vor dem Stack-Update, dass der Service `app` weiterhin die Netzwerke `internal` und `public` enthält
- **AND** verwirft der Rollout den Renderpfad, wenn diese Netzwerke oder ingressrelevante Labels fehlen

### Requirement: Minimaler Betriebsvertrag für stateful Swarm-Services

Das System SHALL dokumentieren, wie stateful Services, Secrets, Configs, Migrationen und Rollback im Swarm-Referenzprofil minimal belastbar betrieben werden.

#### Scenario: Klassifizierung von Secrets und Configs

- **WHEN** ein Team die Runtime-Konfiguration des Swarm-Stacks dokumentiert
- **THEN** trennt die Dokumentation sensitive Secrets von nicht sensitiven Configs
- **AND** hält fest, dass sensitive Werte nicht in allgemeinen Stack-Variablen oder Stack-Dateien abgelegt werden
- **AND** stellt eine verbindliche Klassifizierungstabelle bereit, die jede Runtime-Variable als Secret oder Config einordnet

#### Scenario: Persistenz und Placement für stateful Services

- **WHEN** das Zielbild für Postgres und Redis beschrieben wird
- **THEN** benennt die Dokumentation persistente Volumes und Placement-Annahmen für stateful Services
- **AND** beschreibt einen Restore-Pfad für diese Services

#### Scenario: Kompatibles Rollback-Fenster

- **WHEN** ein Team Rollout und Rollback des Swarm-Stacks dokumentiert
- **THEN** beschreibt die Dokumentation ein kompatibles Rollback-Fenster für App- und Schema-Änderungen
- **AND** grenzt destruktive oder nicht rückwärtskompatible Migrationen aus diesem Change aus

#### Scenario: Temp-Job-Stack verändert den Live-Stack nicht

- **WHEN** `migrate` oder `bootstrap` für `studio` oder `acceptance-hb` in einem temporären Job-Stack ausgeführt werden
- **THEN** enthält der temporäre Stack keinen `app`-Service
- **AND** reconciled der Job-Lauf nicht den Live-Stack mit `app`, `postgres` oder `redis`
- **AND** nutzt der Job-Stack nur das vorhandene Overlay-Netz `<stack>_internal`

#### Scenario: Recovery-Pfad für Netzwerk- oder Ingress-Drift ist dokumentiert

- **WHEN** ein Live-Rollout zu einem Zustand `app 1/1`, aber externem `502` oder fehlendem Ingress-Netz führt
- **THEN** beschreibt die Betriebsdokumentation einen kanonischen Recovery-Pfad aus Diagnose, gezieltem App-Reconcile und nachgelagerter Verifikation
- **AND** behandelt sie direkte Portainer-API-Eingriffe nur als Incident-Recovery und nicht als Standardpfad
