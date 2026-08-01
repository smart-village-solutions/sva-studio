# Swarm-Betriebsrunbook für SVA Studio

## Zweck und Grenze

Dieses Runbook beschreibt Infrastrukturprüfung, Diagnose, Restore und Incident-Recovery für die Studio-Swarm-Stacks. Der reguläre Rollout nach Dev, Staging und Production ist ausschließlich im [kanonischen Studio-Rollout](./studio-rollout-process.md) definiert und wird durch GitHub Actions ausgeführt.

Direkte Portainer-, Docker- oder Quantum-Mutationen aus diesem Runbook sind keine alternative Releaseprozedur. Sie benötigen einen dokumentierten Incident, ein explizites Ziel und eine anschließende Verifikation gegen den kanonischen Vertrag.

## Zieltopologie

| Umgebung   | Stack            | Root-Host                          | internes Netz            |
| ---------- | ---------------- | ---------------------------------- | ------------------------ |
| Dev        | `studio-dev`     | `studio-dev.smart-village.app`     | `studio-dev_default`     |
| Staging    | `studio-staging` | `studio-staging.smart-village.app` | `studio-staging_default` |
| Production | `studio`         | `studio.smart-village.app`         | `studio_default`         |

Jeder Stack enthält mindestens App, PostgreSQL und Redis. Traefik routet Root- und Tenant-Hosts über das öffentliche Overlay-Netz. Konkrete Docker-Netzwerk-IDs sind flüchtig und dürfen nicht dokumentiert oder wiederverwendet werden; vor jeder netzbezogenen Reparatur ist die aktuelle ID anhand des Namens live aufzulösen.

## Betriebsziele

| Bereich                 | Zielwert     |
| ----------------------- | ------------ |
| App und Monitoring      | `RTO <= 2h`  |
| IAM-Daten in PostgreSQL | `RPO <= 24h` |

Das vor mutierenden Promotes erzeugte PostgreSQL-Backup verbessert den Recovery-Punkt, ist aber kein vollständiger Snapshot aller externen Systeme.

## Read-only Diagnose

Die bevorzugte Wahrheitsebene ist die Portainer-/Docker-API über den fest zugewiesenen Quantum-Endpoint. Zulässige CLI-Abfragen sind:

```bash
quantum-cli endpoints ls
quantum-cli stacks ls --endpoint sva
quantum-cli ps --endpoint sva --stack <studio-dev|studio-staging|studio> --all
```

Zusätzlich stehen die lokalen read-only Runtime-Befehle zur Verfügung:

```bash
pnpm env:status:studio
pnpm env:doctor:studio
pnpm env:precheck:studio
pnpm env:smoke:studio
```

Diese Befehle sind Diagnosewerkzeuge und starten keinen regulären Rollout.

## Verifikation nach einem Rollout

GitHub Actions führt die regulären Prüfungen aus. Für eine unabhängige Incident-Verifikation gelten mindestens:

| Prüfung                   | Erwartung                                                 |
| ------------------------- | --------------------------------------------------------- |
| `GET /health/live`        | HTTP 200                                                  |
| `GET /health/ready`       | HTTP 200                                                  |
| Root-Login                | HTTP 302 zum korrekten Root-Realm                         |
| jeder aktive Tenant-Login | HTTP 302 zum jeweiligen Tenant-Realm                      |
| Live-Service-Image        | exakt erwarteter SHA-256-Digest                           |
| App-Task                  | gewünschter Zustand `running`                             |
| Netzwerke                 | internes Zielnetz und öffentliches Traefik-Netz vorhanden |
| Traefik-Labels            | Root- und Wildcard-Router entsprechen der Zielumgebung    |

Ein Swarm-Service darf nach einem Update bis zu fünf Minuten konvergieren. Vor Ablauf dieses Fensters wird kein zusätzlicher mutierender Reparaturversuch gestartet. Bleibt ein Fehler danach bestehen, gilt der Rollout als fehlgeschlagen.

## Backup-Agent

Der zentrale Service `studio-backup-agent` ist mit den aktuellen internen Netzen von Staging und Production sowie dem öffentlichen Traefik-Netz verbunden. Er veröffentlicht keinen Docker-Port. Traefik akzeptiert ausschließlich:

- `POST https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests`
- `POST https://backup-studio.smart-village.app/_ops/backup/v1/requests`
- `POST https://backup-studio-staging.smart-village.app/_ops/restore/v1/requests`
- `POST https://backup-studio.smart-village.app/_ops/restore/v1/requests`

Ein erfolgreicher Auftrag erzeugt dauerhaft in MinIO:

- das Request-Objekt unter `control/requests/`,
- das terminale Ergebnis unter `control/results/`,
- einen PostgreSQL-Custom-Dump im umgebungsgebundenen Präfix,
- redigierte Diagnose- und Prüfsummenevidenz.

Der Promote-Workflow akzeptiert das Backup nur, wenn Request-ID, Umgebung, Digest und Terminalstatus passen und das Dump-Objekt anschließend unabhängig verifiziert wurde. Der historische temporäre Backup-Executor ist nur Incident-Fallback und darf nicht als reguläre Variable aktiviert werden.

## Backup-Drills

Die Workflows **Staging Backup Drill** und **Production Backup Drill** testen den Agenten ohne App-Deployment. Production benötigt die Freigabe des Environments `prod`, einen Wartungsfenster-Verweis und den passenden Staging-Nachweis. Ein Drill ersetzt weder Staging-Promotion noch Production-Promotion.

## Incident-Recovery

### App- oder Ingress-Fehler

1. Zielstack, erwarteten Digest und Zeitpunkt festhalten.
2. Service-Spec, Taskzustände, Netzwerke und Traefik-Labels read-only prüfen.
3. Bis zu fünf Minuten Konvergenzzeit ab dem abgeschlossenen Service-Update berücksichtigen.
4. Root- und Tenant-Probes erneut ausführen.
5. Bei anhaltendem Fehler den vorherigen Digest als Recovery-Ziel festlegen.
6. Eine notwendige direkte Mutation auf genau den App-Service des Zielstacks begrenzen.
7. Danach vollständige Health-, Tenant-, Digest- und Netzprüfung wiederholen und einen Incident-Report unter `docs/reports/` anlegen.

Direkte Änderungen an Traefik, gemeinsamen Netzwerken oder fremden Stacks sind außerhalb eines explizit erweiterten Incident-Scopes verboten.

### Datenbankfehler nach Migration

- Keine automatische Down-Migration ausführen.
- Zuerst feststellen, ob App-Rollback und neue Datenbankversion kompatibel sind.
- Dump, SHA-256, Archivlesbarkeit und Zielumgebung des Promote-Backups prüfen.
- Restore ausschließlich in einem kontrollierten Wartungsfenster und nach expliziter Freigabe durchführen.
- Vor Umschalten der App Schema-Guard, App-DB-Principal und Tenant-Registry prüfen.

### Kontrollierter Vollrestore

Der einzige zulässige Aufrufpfad ist der manuell freigegebene GitHub-Workflow **Controlled Database Restore** (`database-restore.yml`). Direkte HTTPS-Aufrufe, `quantum-cli exec`, freie `pg_restore`-Kommandos und lokale Deploy-Skripte sind kein Restore-Vertrag. Der Workflow verlangt Umgebung, exakten MinIO-Objektschlüssel, kleingeschriebene SHA-256, Wartungsfensterreferenz, unveränderliches App-Image und dessen Git-Revision. Für Production ist zusätzlich die Run-ID eines vollständig erfolgreichen Staging-Restore-Drills erforderlich.

Vor dem ersten Staging-Drill müssen pro Umgebung externe Swarm-Secrets für Restore-HMAC und Restore-Principal vorhanden sein. Der Datenbank-Principal wird einmalig durch einen Datenbankadministrator eingerichtet; das Passwort wird dabei ausschließlich aus dem Secret-Store bezogen:

```sql
CREATE ROLE sva_restore LOGIN NOINHERIT PASSWORD '<aus Secret-Store>';
GRANT sva TO sva_restore;
GRANT pg_read_all_stats TO sva_restore;
```

Der Principal erhält keine freie Host-, Datenbank- oder Rollenwahl. Der Agent setzt für Dump und Restore immer die fest konfigurierte App-Rolle `sva`. Das Agent-Image verwendet passend zum Studio-Stack ausschließlich PostgreSQL-16-Clientwerkzeuge.

Ablauf:

1. GitHub Environment freigeben und Inputs revisionsfähig dokumentieren.
2. Der Workflow bindet Executor-Revision und unveränderliches Image, prüft bei Production die Staging-Evidenz und setzt App sowie Provisioner auf null Replikate.
3. Der Agent lehnt aktive App-Sessions, Replay, falsche Umgebung, falsches Präfix, abgelaufene Requests, unbekannte Felder oder eine abweichende SHA-256 vor jeder Mutation ab.
4. Der Agent prüft `pg_restore --list` und die erforderlichen Goose-/IAM-Archiveinträge.
5. Der Agent erzeugt einen neuen Custom-Dump, lädt ihn nach `safety-before-restore/`, lädt ihn erneut herunter und verifiziert seine SHA-256.
6. Erst danach startet der einmalige Vollrestore. Fehler oder Timeout führen zu keinem automatischen Retry oder Gegenrestore.
7. Der Agent prüft Goose-Version, IAM-Schema, App-Principal einschließlich Tabellenrechten und Registry.
8. Nur nach erfolgreicher DB-Evidenz startet der Workflow App und Provisioner wieder und fordert HTTP 200 für `health/live` und `health/ready` sowie einen erfolgreichen Runtime-Smoke mit Tenant-Login-Redirect.
9. Schlägt ein Schritt nach der Stilllegung fehl, deployt der Workflow den gestoppten Stackvertrag erneut. Die App bleibt bis zu einer manuellen Recovery-Entscheidung stillgelegt.

MinIO hält Request, Sicherheitsdump-Metadaten und Agent-Ergebnis getrennt unter `control/restores/`. GitHub hält zusätzlich die redigierte Workflow-Evidenz. Weder Evidenz enthält Secrets, SQL-Inhalte oder Datenbankdaten. Keycloak wird nicht verändert; erkannter Drift wird ausschließlich über die vorhandenen IAM-Reconcile-Pfade behandelt.

## DNS- und TLS-Prüfung

Root- und Wildcard-DNS jeder Umgebung müssen auf denselben vorgesehenen Swarm-Ingress zeigen. Die Backup-Hosts müssen denselben verifizierten Ingress erreichen. DNS- oder TLS-Abweichungen werden diagnostiziert, aber nicht durch spontane Traefik-Änderungen im App-Rollout behoben.

## Secrets und Evidenz

- Keine vollständigen Service-Environments, `.env`-Dateien oder Secret-Inhalte ausgeben.
- Reports enthalten nur Digest, Stack, Service-/Task-ID, Status, Zeitpunkte und redigierte Fehlerklassen.
- Lokale `*.local.vars` bleiben ignoriert.
- MinIO-ETags sind keine kryptografischen Prüfsummen; maßgeblich ist die separat berechnete SHA-256-Prüfung nach erneutem Download.

## Eskalation

| Fall                                 | Primärer Kanal                 | Zusätzlicher Kanal             |
| ------------------------------------ | ------------------------------ | ------------------------------ |
| Betriebsstörung ohne sensitive Daten | `operations@smart-village.app` | bereinigtes GitHub Issue       |
| Sicherheits- oder DSGVO-Vorfall      | `security@smart-village.app`   | `operations@smart-village.app` |

## Referenzen

- Regulärer Rollout: [`studio-rollout-process.md`](./studio-rollout-process.md)
- Deployment-Überblick: [`deployment-overview.md`](./deployment-overview.md)
- Architektur: [`07-deployment-view.md`](../architecture/07-deployment-view.md)
- Backup-ADR: [`ADR-048`](../adr/ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md)
- Monitoring: [`monitoring-stack.md`](../development/monitoring-stack.md)
- Incident Response: [`incident-response.md`](./incident-response.md)
