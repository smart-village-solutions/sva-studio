## MODIFIED Requirements

### Requirement: Minimaler Betriebsvertrag für stateful Swarm-Services

Das System SHALL stateful Services, Secrets, Configs, Migrationen, Bootstrap, Backups und Rollback im Swarm-Referenzprofil so betreiben und dokumentieren, dass temporäre Jobs vom Live-Stack isoliert, nachvollziehbar und sicher bereinigt bleiben.

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

- **WHEN** `migrate`, `bootstrap` oder `backup` für `studio` in einem temporären Job-Stack ausgeführt werden
- **THEN** enthält der temporäre Stack keinen `app`-Service
- **AND** reconciled der Job-Lauf nicht den Live-Stack mit `app`, `postgres` oder `redis`
- **AND** nutzt der Job-Stack nur das vorhandene Overlay-Netz `<stack>_internal`

#### Scenario: Recovery-Pfad für Netzwerk- oder Ingress-Drift ist dokumentiert

- **WHEN** ein Live-Rollout zu einem Zustand `app 1/1`, aber externem `502` oder fehlendem Ingress-Netz führt
- **THEN** beschreibt die Betriebsdokumentation einen kanonischen Recovery-Pfad aus Diagnose, gezieltem App-Reconcile und nachgelagerter Verifikation
- **AND** behandelt sie direkte Portainer-API-Eingriffe nur als Incident-Recovery und nicht als Standardpfad

#### Scenario: Staging- und Production-Backup geht jeder Datenmutation voraus

- **WHEN** ein `Promote` für `staging` oder `prod` Migration oder Bootstrap im Modus `run` ausführt
- **THEN** erzeugt der Workflow vor dem ersten mutierenden One-shot-Job genau ein PostgreSQL-Custom-Backup in einem isolierten temporären Stack
- **AND** legt er das Staging-Backup in `studio-db-backup-staging` und das Production-Backup in `studio-db-backup-production` über den S3-kompatiblen Endpoint `https://fileserver.smart-village.app` ab
- **AND** bestätigt er Objektgröße, den SHA-256-Wert vor und nach dem Download sowie die Lesbarkeit über `pg_restore --list`
- **AND** verwendet er keinen S3-ETag als Integritätsnachweis
- **AND** beendet er den Rollout vor Migration, Bootstrap und App-Deploy, wenn dieser Nachweis fehlschlägt

### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende Remote-Operationen in einem deterministischen, umgebungsgebundenen Kontext ausführen.

#### Scenario: Staging-Run erfordert explizite Freigabe und Wartungsfenster

- **WHEN** `Promote` für `staging` mit `migration_mode=run` ausgeführt wird
- **THEN** ist das GitHub-Environment `staging` freigegeben
- **AND** enthält `maintenance_window` einen nicht-sensitiven revisionsfähigen Wartungsfenster-Verweis
- **AND** dürfen die benötigten mutierenden Credentials nur aus diesem Environment bezogen werden

#### Scenario: Production-Run verwendet den Staging-erprobten Ablauf

- **WHEN** `Promote` für `prod` mit `migration_mode=run` oder `bootstrap_mode=run` ausgeführt wird
- **THEN** verwendet der Workflow dieselbe Reihenfolge und dieselben gehärteten One-shot-Executors wie Staging
- **AND** bestätigt er vor der Mutation, dass genau der Ziel-Digest zuvor erfolgreich in Staging verifiziert wurde
- **AND** liest er für den identischen Ziel-Digest eine erfolgreiche, redigierte Evidenz eines abgeschlossenen mutierenden Staging-Promotes
- **AND** erfordert jede Production-Migration oder jeden Production-Bootstrap einen nicht-sensitiven revisionsfähigen Wartungsfenster-Verweis
- **AND** blockiert er den App-Deploy bei Backup-, One-shot-, Postcondition- oder Verify-Fehlern
