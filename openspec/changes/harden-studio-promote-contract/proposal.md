# Change: Studio-Promote-Vertrag fokussiert stabilisieren

## Why

Der Production-Promote vom 2. August 2026 war nach Korrektur der Zielkonfiguration und kontrollierter Konvergenz erfolgreich. Gleichzeitig zeigte der Ablauf konkrete Schwächen: Eine lokale Override-Datei konnte als vollständiges Remote-`APP_CONFIG` verwendet werden, ein nicht zur Production passender IAM-Schlüsselbund blieb bis zur Live-Readiness unentdeckt, das Production-Paritätsgate wurde bei einem reinen App-Deployment übersprungen, der Backup-Consumer erwartete einen neueren Agent-Vertrag und die Smoke-Retry-Logik brach bei einem vollständigen Traefik-Warmup vorzeitig ab.

Der funktionierende Deploymentmechanismus soll nicht breit umgebaut werden. Der Change ergänzt deshalb vorwiegend read-only beziehungsweise vor der Mutation wirksame Gates, führt sie gestuft über Shadow-Modus, Dev und Staging ein und verändert weder die bestehende IAM-Secret-Injektion noch den kanonischen GitHub-Actions-Promote-Pfad.

## What Changes

- Nicht-sensitive Remote-Konfiguration wird unter `config/runtime/remote/` versioniert; sensitive Overrides bleiben zunächst als kompaktes Secret im jeweiligen GitHub-Environment.
- Ein repository-lokaler Builder führt beide Quellen deterministisch zusammen, validiert das vollständige Bundle und lehnt `*.local.vars` als Remote-Quelle technisch ab.
- Der Builder läuft zunächst im Shadow-Modus. Eine redigierte Äquivalenzprüfung muss den bestehenden und den neuen Rendervertrag in Dev und Staging bestätigen, bevor der neue Builder autoritativ wird.
- Ein statischer Preflight und ein isolierter read-only Candidate-One-shot prüfen die Zielkonfiguration vor Backup, One-shots und App-Deploy, ohne Migration, Bootstrap oder fachliche Datenmutation.
- Derselbe `Promote`-Workflow unterstützt `promote_mode=standard|recovery`; Recovery bleibt ausdrücklich freigegeben und vollständig nachweispflichtig, statt einen zweiten Deploypfad einzuführen.
- Production verlangt bei jedem Wechsel des Live-Digests eine erfolgreiche Staging-Promotion exakt desselben Image-Digests. Umgebungskonfigurationen werden nicht miteinander verglichen, sondern jeweils eigenständig validiert.
- Ein geschützter read-only Capability-Endpoint macht den tatsächlich laufenden Backup-Agent-Vertrag vor dem ersten Auftrag prüfbar.
- Nach dem Deploy wird zuerst die Swarm-Konvergenz abgewartet und danach ein begrenztes HTTP-Warmup ausgeführt. Production-Readiness ist nur mit HTTP 200 erfolgreich.
- Alle neuen Gates verwenden stabile Fehlercodes, strukturierte redigierte Ergebnisse, klare Retryklassifikation und handlungsorientierte deutsche Fehlermeldungen.
- Rollout-Evidenz erfasst vorherigen Digest, versionierte nicht-sensitive Config-Revision und relevante externe Secret-Referenzen. Automatischer Rollback und allgemeine Secret-Historisierung bleiben außerhalb des Scopes.

## Impact

- Affected specs: `deployment-topology`, `architecture-documentation`
- Affected code: `.github/workflows/build.yml`, `.github/workflows/promote.yml`, Config-Builder und Preflight unter `scripts/ci/`, Runtime-Smoke und Konvergenz unter `scripts/ops/runtime/`, Backup-Agent-Capability-Vertrag und zugehörige Tests
- Affected configuration: neue versionierte nicht-sensitive Profile unter `config/runtime/remote/`; bestehende GitHub-Environment-Secrets bleiben während der Shadow-Phase autoritativ
- Affected docs: `docs/guides/studio-rollout-process.md`, `docs/development/runtime-profile-betrieb.md`, `docs/guides/swarm-deployment-runbook.md`, arc42-Abschnitte 06, 07, 08, 10 und 11
- Operational rollout: Shadow-Modus → redigierte Äquivalenz → Dev → Staging → Production → blockierende Aktivierung der neuen Gates
- Non-goals: keine allgemeine Migration von Runtime-Secrets, kein externer Secret-Manager, kein automatischer Rollback, kein konkurrierender Deploy- oder Recovery-Workflow und kein Wartungsfenster-Verweis
