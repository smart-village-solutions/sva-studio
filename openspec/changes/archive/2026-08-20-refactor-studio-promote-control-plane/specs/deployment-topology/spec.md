## MODIFIED Requirements

### Requirement: Remote-Konfigurationen werden deterministisch und gestuft aktiviert

Das System SHALL nicht-sensitive Studio-Remote-Konfiguration versioniert im Repository führen und sie über einen repository-lokalen Builder ausschließlich mit dem geschützten Override-Bundle des jeweiligen GitHub-Environments zusammenführen. Lokale `*.local.vars` und das historische vollständige `APP_CONFIG` dürfen keine reguläre Remote-Deployment-Quelle sein.

#### Scenario: Builder erzeugt die autoritative Remote-Konfiguration

- **WHEN** Dev, Staging oder Production die Remote-Konfiguration vorbereitet
- **THEN** führt der Builder das versionierte Umgebungsprofil mit `PROMOTE_CONFIG_OVERRIDES` zusammen
- **AND** validiert er Pflichtschlüssel, Typen, Secret-Klassifikationen und externe Referenznamen vor jeder Remote-Mutation
- **AND** stoppt er bei fehlendem oder ungültigem Override-Bundle fail-closed

#### Scenario: Lokale Override-Datei wird als Remote-Quelle angeboten

- **WHEN** eine `config/runtime/*.local.vars` als Remote-Profil oder geschütztes Override-Bundle verwendet werden soll
- **THEN** endet der Config-Build vor Upload, Backup oder Deployment mit `PROMOTE_CONFIG_SOURCE_FORBIDDEN`
- **AND** nennt die Fehlermeldung die zulässige Remote-Quelle, ohne lokale Inhalte auszugeben

#### Scenario: Secret-Wert liegt unter einem Referenzschlüssel

- **WHEN** ein Schlüssel mit der Semantik `_SECRET_NAME` oder `_SECRET_REF` keinen zulässigen externen Referenznamen enthält
- **THEN** stoppt der Builder fail-closed vor jeder Remote-Mutation
- **AND** übernimmt den referenzierten Secret-Wert weder in Config-Evidenz noch Logs

### Requirement: Candidate-Konfiguration wird vor jeder Zielmutation read-only geprüft

Das System SHALL nach Image-, Git- und statischer Config-Validierung einen isolierten, blockierenden und read-only Candidate-One-shot mit Zielimage, Candidate-Konfiguration und erforderlichen Secret-Mounts ausführen. Der Candidate SHALL keine Migration, keinen Bootstrap und keine fachliche Datenmutation ausführen können.

#### Scenario: Candidate ist vollständig und kompatibel

- **WHEN** ein Staging- oder Production-Promote den Candidate-Preflight erreicht
- **THEN** prüft der One-shot Runtime-Profil, externe Secret-Referenzen, Registry-Lesbarkeit, Release-Tenant-Scope und Entschlüsselbarkeit aktiver Tenant-Secrets
- **AND** wird er vor Backup und App-Deploy terminal ausgewertet und entfernt
- **AND** darf der Workflow Candidate-Fehler nicht beobachtend fortsetzen

#### Scenario: Candidate kann aktive Tenant-Secrets nicht entschlüsseln

- **WHEN** der konfigurierte Schlüsselbund nicht zur Registry passt
- **THEN** stoppt der Promote vor Backup und App-Deploy mit `PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE`
- **AND** enthält die Meldung eine konkrete nächste Aktion, aber keine Secret-Inhalte, Hashes oder Wertlängen

### Requirement: Standard und Recovery bleiben Modi desselben Promote-Workflows

Das System SHALL reguläre Rollouts und degradierte Production-Ausgangszustände innerhalb desselben kanonischen `Promote`-Workflows als `standard` beziehungsweise `recovery` behandeln. Dev und Staging SHALL ausschließlich `standard` verwenden.

#### Scenario: Standard-Promote trifft degradierte Production

- **WHEN** `promote_mode=standard` gewählt ist und die bestehende Production vor der Mutation nicht HTTP 200 von `health/ready` liefert
- **THEN** stoppt der Promote vor der ersten Zielmutation mit `PROMOTE_READINESS_NOT_READY`
- **AND** verweist auf den kontrollierten Recovery-Modus

#### Scenario: Production-Recovery wird ausdrücklich freigegeben

- **WHEN** `promote_mode=recovery` für Production mit nicht leerem Grund und geschützter Environment-Freigabe gestartet wird
- **THEN** darf ausschließlich der initiale Readiness-Ausgangszustand degradiert sein
- **AND** bleiben Imagevertrag, Config-Revision, Backup, Staging-Digest-Parität, Migration-/Bootstrap-Gates, finale Readiness, Release-Tenant-Smoke und Digest-Prüfung unverändert blockierend
- **AND** erzwingt der Workflow Staging-Parität auch bei gleichem Ziel- und Live-Digest

#### Scenario: Recovery ist außerhalb von Production oder ohne Grund angefordert

- **WHEN** `promote_mode=recovery` für Dev oder Staging oder ohne nicht leeren dokumentierten Grund gestartet wird
- **THEN** stoppt der Workflow vor jeder Zielmutation mit einem stabilen `PROMOTE_`-Fehlercode

### Requirement: Backup-Agent-Capabilities werden vor dem Auftrag live validiert

Das System SHALL den tatsächlich laufenden zentralen Backup-Agenten über einen geschützten read-only Capability-Endpoint blockierend prüfen, bevor ein Backup-Auftrag erzeugt wird. Ein temporärer regulärer Backup-Executor ist nicht zulässig.

#### Scenario: Agent erfüllt den Consumer-Vertrag

- **WHEN** der Promote ein Backup benötigt
- **THEN** validiert er Protokollversion, Agent-Revision, Datenbankziele, Ergebnisfelder und Waste-Inventar-Unterstützung
- **AND** erzeugt erst danach den signierten Backup-Auftrag

#### Scenario: Agent ist nicht kompatibel

- **WHEN** eine benötigte Capability oder Ergebnisversion fehlt
- **THEN** stoppt der Promote vor Backup und Zielmutation mit `PROMOTE_BACKUP_AGENT_INCOMPATIBLE`
- **AND** nennt die Meldung den erforderlichen Producer-vor-Consumer-Rollout ohne sensitive Agent-Konfiguration auszugeben

## ADDED Requirements

### Requirement: Workflow-Controller und Release-Quellstand bleiben revisionsgebunden getrennt

Das System SHALL die Revision des ausgeführten Promote-Workflows und den durch `change_head` beschriebenen Release-Quellstand als zwei vollständige Git-Checkouts bereitstellen, ohne eine manuell gepflegte Controller-Dateiliste oder ein zusätzliches Controller-Artefakt zu benötigen.

#### Scenario: Ein älterer Release-Commit wird promotet

- **WHEN** `change_head` von `${{ github.workflow_sha }}` abweicht
- **THEN** laufen Controller-Validierung, Fehlerklassifikation und Evidenz aus der Workflow-Revision
- **AND** stammen Compose-Dateien, Runtime-Profile, Diff-Auswertung und Deploy-Render aus `change_head`
- **AND** prüft der Source-Contract den aufgelösten Head und die Ancestor-Beziehung vor jeder Remote-Mutation
