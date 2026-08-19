## MODIFIED Requirements

### Requirement: Recovery-Evidenz bleibt minimal und reproduzierbar

Das System SHALL vorherigen und neuen Image-Digest, Git-Grenzen, versionierte nicht-sensitive Config-Revision, externe Secret-Referenznamen, Backup-Agent-Vertrag und blockierende Gate-Ergebnisse redigiert erfassen. Der Change SHALL keinen automatischen Rollback oder eine vollständige Secret-Historisierung voraussetzen. Abgeschlossene einmalige Live-Config-Seed-Verträge SHALL nicht mehr durch einen aktiven Workflowpfad autorisierbar sein.

#### Scenario: App-Rollback wird vorbereitet

- **WHEN** ein fehlgeschlagener Promote auf den vorherigen App-Digest zurückgeführt werden soll
- **THEN** verwendet der kontrollierte Pfad den vorherigen Digest und dessen versionierte nicht-sensitive Config-Revision
- **AND** setzt er Rückwärtskompatibilität des geschützten Override-Bundles voraus
- **AND** verlangt für eine inkompatible Secret-Rotation einen separat geprüften Rollback- oder Recovery-Plan

#### Scenario: Eine Zwischen-Promotion ist fehlgeschlagen

- **WHEN** ein neuer Main-Push folgt, obwohl der vorherige Zielstand nicht erfolgreich live gegangen ist
- **THEN** leitet der Workflow die effektive Diff-Basis aus der OCI-Revision des tatsächlich live konfigurierten App-Images ab
- **AND** darf der reine Git-Push-Vorgänger keine Migrations- oder Bootstrap-Risiken aus dem Prüfbereich entfernen

#### Scenario: Live-Config-Revision fehlt oder ist ungültig

- **WHEN** Staging oder Production bereits einen Live-Digest besitzt und die gleichzeitig gelesene `sva.config.revision` fehlt oder ungültig ist
- **THEN** stoppt jeder Standard- und Recovery-Promote fail-closed vor Backup und Mutation
- **AND** bietet weder `workflow_dispatch` noch `workflow_call` einen Prepare-, Seed- oder Run-Referenz-Eingang an
- **AND** verlangt jede weitere Wiederherstellung einen neuen separat geprüften Recovery-Change innerhalb des kanonischen Promote-Pfads

#### Scenario: Reguläre Promote-Evidenz bleibt schema-v2-kompatibel

- **WHEN** ein Standard- oder Recovery-Promote neue Evidence v2 schreibt
- **THEN** sind `seedPreparation` und `seedAuthorization` explizit `null`
- **AND** können historische v2-Artefakte mit nicht-leeren Seed-Inhalten weiterhin gelesen werden
- **AND** kann historische Seed-Evidenz keinen aktiven Workflowpfad autorisieren

#### Scenario: Ein One-shot schlägt vor dem Cleanup fehl

- **WHEN** Candidate, Migration oder Bootstrap einen terminalen Taskfehler oder Timeout meldet
- **THEN** persistiert der Workflow vor beziehungsweise trotz Stack-Bereinigung Jobart, allowlistete Failure-Klasse, Task-ID, Zustand und Exit-Code
- **AND** persistiert er weder Task-Message noch Remote-Logs, SQL-Text, URL, PII oder Secret-Werte
