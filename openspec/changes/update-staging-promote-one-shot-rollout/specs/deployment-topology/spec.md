## MODIFIED Requirements

### Requirement: Minimaler Betriebsvertrag für stateful Swarm-Services

Das System SHALL stateful Services, Secrets, Configs, Migrationen, Bootstrap und Rollback im Swarm-Referenzprofil so betreiben und dokumentieren, dass temporäre Jobs vom Live-Stack isoliert, nachvollziehbar und sicher bereinigt bleiben.

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

- **WHEN** `migrate` oder `bootstrap` für `studio` in einem temporären Job-Stack ausgeführt werden
- **THEN** enthält der temporäre Stack keinen `app`-Service
- **AND** reconciled der Job-Lauf nicht den Live-Stack mit `app`, `postgres` oder `redis`
- **AND** nutzt der Job-Stack nur das vorhandene Overlay-Netz `<stack>_internal`

#### Scenario: Recovery-Pfad für Netzwerk- oder Ingress-Drift ist dokumentiert

- **WHEN** ein Live-Rollout zu einem Zustand `app 1/1`, aber externem `502` oder fehlendem Ingress-Netz führt
- **THEN** beschreibt die Betriebsdokumentation einen kanonischen Recovery-Pfad aus Diagnose, gezieltem App-Reconcile und nachgelagerter Verifikation
- **AND** behandelt sie direkte Portainer-API-Eingriffe nur als Incident-Recovery und nicht als Standardpfad

#### Scenario: Staging-One-shot-Jobs sind isoliert und nachweisbar

- **WHEN** ein Staging-`Promote` Migration oder Bootstrap im Modus `run` ausführt
- **THEN** startet jeder Job in einem eindeutigen temporären Stack gegen ausschließlich das vorhandene Overlay-Netz `<stack>_internal` und den Datenbankhost des Zielstacks
- **AND** enthalten die Job-Dokumente keinen `app`-, `postgres`- oder `redis`-Service
- **AND** erfasst der Workflow Task-ID, Terminalzustand, Exit-Code und redigierte Diagnose vor dem Cleanup
- **AND** entfernt er temporäre Stacks und lokale Secret-Dateien auch im Fehlerpfad

#### Scenario: Fehlerhafte One-shot-Phase stoppt den Live-Deploy

- **WHEN** ein One-shot-Job keinen lesbaren Task liefert, timeoutet, nicht-terminal bleibt, mit Exit-Code ungleich null endet oder eine Postcondition verletzt
- **THEN** beendet der Workflow den Lauf fail-closed vor dem App-Deploy
- **AND** dokumentiert er den Cleanup- und Recovery-Status ohne Secrets oder personenbezogene Daten

### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende Remote-Operationen in einem deterministischen, umgebungsgebundenen Kontext ausführen.

#### Scenario: Staging-Run erfordert explizite Freigabe und Wartungsfenster

- **WHEN** `Promote` für `staging` mit `migration_mode=run` ausgeführt wird
- **THEN** ist das GitHub-Environment `staging` freigegeben
- **AND** enthält `maintenance_window` einen nicht-sensitiven revisionsfähigen Wartungsfenster-Verweis
- **AND** dürfen die benötigten mutierenden Credentials nur aus diesem Environment bezogen werden

#### Scenario: Production-Run bleibt gesperrt

- **WHEN** `Promote` für `prod` mit `migration_mode=run` oder `bootstrap_mode=run` aufgerufen wird
- **THEN** blockiert das Gate den Lauf vor jeder Mutation
- **AND** bleibt der vorhandene Production-App-only-Deploy mit unveränderlichem Digest unverändert verfügbar
- **AND** nennt die Evidenz den separaten Folgebedarf für Staging-Parität, Production-Freigabe, Backup-/Restore-Readiness und production-spezifische Postconditions

## ADDED Requirements

### Requirement: Studio-Release wird in Vorbereitung und lokalen Final-Deploy getrennt

Das System SHALL für `studio` zwischen Artefaktverifikation, kanonischem Staging-Rollout und lokalen Diagnose-/Recovery-Operationen unterscheiden.

#### Scenario: GitHub Actions rollt Staging kanonisch aus

- **WHEN** ein freigegebener `Promote`-Lauf ein verifiziertes Studio-Image nach `staging` ausrollt
- **THEN** validiert der Workflow Environment, konkreten Git-Änderungsbereich, ausgecheckten Executor-Code und unveränderliches Ziel-Digest vor jeder Mutation
- **AND** führt er bei angeforderten `run`-Modi Migration, optional Bootstrap und deren Postconditions vor dem App-Deploy aus
- **AND** verifiziert er anschließend Servicezustand, Ziel-Digest sowie interne und externe Staging-Smokes
- **AND** gilt GitHub Actions für diesen Staging-Pfad als kanonischer mutierender Deploymentkanal

#### Scenario: Lokaler Operatorpfad bleibt Diagnose und Recovery

- **WHEN** ein Operator für `studio` Status, Doctor, Precheck, Diagnose oder Recovery benötigt
- **THEN** stehen die dokumentierten lokalen Operator-Einstiege weiterhin zur Verfügung
- **AND** gelten sie nicht als konkurrierender Standardpfad für einen normalen Staging-Rollout

### Requirement: Promote liefert redigierte Rollout-Evidenz

Das System SHALL für jeden mutierenden Staging-Promote redigierte, menschen- und maschinenlesbare Evidenz bereitstellen.

#### Scenario: Evidenz verknüpft Zielartefakt und Phasen

- **WHEN** ein Staging-Promote endet, unabhängig von Erfolg oder Fehlschlag
- **THEN** enthalten Step Summary und maschinenlesbare Artefakte Commit, Ziel-Digest, vorherigen Live-Digest, Wartungsfenster-Verweis, Phasenstatus, Job-/Task-IDs, Cleanup, Postflight und Recovery-Hinweis
- **AND** enthalten sie weder `.env`-Inhalte, `APP_CONFIG`, Secrets, unredigierte Remote-Logs noch personenbezogene Daten

#### Scenario: Datenbankmigration wird nicht automatisch zurückgerollt

- **WHEN** eine Staging-Migration erfolgreich war, der nachfolgende App-Deploy oder Postflight aber fehlschlägt
- **THEN** startet der Workflow kein automatisches Datenbank-Rollback
- **AND** hält er den vorigen App-Digest und einen dokumentierten Recovery-Hinweis fest
- **AND** erfordert eine nicht rückwärtskompatible Migration weiterhin einen separaten Restore-Plan
