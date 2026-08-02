## MODIFIED Requirements

### Requirement: Mutationen laufen in einem deterministischen Operator-Kontext

Das System SHALL mutierende Remote-Operationen in einem deterministischen, umgebungsgebundenen Kontext ausführen, ohne einen wirkungslosen Wartungsfenster-Verweis als Pflichtfeld zu verwenden.

#### Scenario: Staging-Run verwendet die Environment-Freigabe ohne Wartungsfenster

- **WHEN** `Promote` für `staging` mit `migration_mode=run` oder `bootstrap_mode=run` ausgeführt wird
- **THEN** ist das GitHub-Environment `staging` freigegeben
- **AND** dürfen die benötigten mutierenden Credentials nur aus diesem Environment bezogen werden
- **AND** benötigt der Lauf keinen Wartungsfenster-Verweis

#### Scenario: Production-Run verwendet den Staging-erprobten Ablauf

- **WHEN** `Promote` für `prod` mit `migration_mode=run` oder `bootstrap_mode=run` aufgerufen wird
- **THEN** verwendet der Workflow dieselbe Reihenfolge und dieselben gehärteten One-shot-Executors wie Staging
- **AND** erfordert er vor der Mutation ein erfolgreiches Artifact eines abgeschlossenen mutierenden Staging-Pfads für exakt dasselbe Digest und ein erfolgreiches Backup
- **AND** benötigt der Lauf keinen Wartungsfenster-Verweis
- **AND** blockiert er den App-Deploy bei Backup-, One-shot-, Postcondition- oder Verify-Fehlern
- **AND** bleibt der vorhandene Production-App-only-Deploy mit unveränderlichem Digest unverändert verfügbar

#### Scenario: Automatischer Modus bleibt auf Dev begrenzt

- **WHEN** `Promote` für `staging` oder `prod` mit `migration_mode=auto` oder `bootstrap_mode=auto` aufgerufen wird
- **THEN** blockiert das Gate den Lauf vor jeder Mutation
- **AND** bleiben für diese Umgebungen nur die expliziten Modi `assert-none` und `run` gemäß ihren jeweiligen Freigaberegeln zulässig

### Requirement: Migrations- und Bootstrap-Pfad für Studio

Das System SHALL für reguläre Studio-Rollouts Migration und Bootstrap ausschließlich über die `Promote`-Modi sowie für genehmigte Incident-Recovery über den lokalen Recovery-Vertrag bereitstellen.

#### Scenario: Regulärer Promote führt angeforderte One-shots aus

- **WHEN** `Promote` für Staging oder Production Migration oder Bootstrap im Modus `run` ausführt
- **THEN** laufen Backup, Migration, Bootstrap und Postconditions kontrolliert vor dem App-Deploy
- **AND** dokumentiert die GitHub-Evidenz die Modi, Commit, Ziel-Digest und Phasenstatus ohne Wartungsfenster-Verweis
- **AND** bleibt Schema-Recovery auf dokumentierten Roll-forward, kompatiblen App-Digest-Rollback oder explizit freigegebenen Restore beschränkt

#### Scenario: Hostname-Bootstrap für erlaubte Testinstanzen

- **WHEN** `Promote` oder ein genehmigter lokaler Recovery-Pfad Bootstrap ausführt
- **THEN** werden erlaubte Testinstanzen und ihre primären Hostnames idempotent sichergestellt
- **AND** fehlende Hostname-Mappings werden als Diagnose sichtbar

### Requirement: Promote liefert redigierte Rollout-Evidenz

Das System SHALL für jeden mutierenden Staging-Promote redigierte, menschen- und maschinenlesbare Evidenz bereitstellen.

#### Scenario: Evidenz verknüpft Zielartefakt und Phasen

- **WHEN** ein Staging-Promote endet, unabhängig von Erfolg oder Fehlschlag
- **THEN** enthalten Step Summary und maschinenlesbare Artefakte Commit, Ziel-Digest, vorherigen Live-Digest, Phasenstatus, Job-/Task-IDs, Cleanup, Postflight und Recovery-Hinweis
- **AND** enthalten sie weder `.env`-Inhalte, `APP_CONFIG`, Secrets, unredigierte Remote-Logs noch personenbezogene Daten

#### Scenario: Datenbankmigration wird nicht automatisch zurückgerollt

- **WHEN** eine Staging-Migration erfolgreich war, der nachfolgende App-Deploy oder Postflight aber fehlschlägt
- **THEN** startet der Workflow kein automatisches Datenbank-Rollback
- **AND** hält er den vorigen App-Digest und einen dokumentierten Recovery-Hinweis fest
