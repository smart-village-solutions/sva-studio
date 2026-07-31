# Swarm-Betriebsrunbook für SVA Studio

## Zweck und Grenze

Dieses Runbook beschreibt Infrastrukturprüfung, Diagnose, Restore und Incident-Recovery für die Studio-Swarm-Stacks. Der reguläre Rollout nach Dev, Staging und Production ist ausschließlich im [kanonischen Studio-Rollout](./studio-rollout-process.md) definiert und wird durch GitHub Actions ausgeführt.

Direkte Portainer-, Docker- oder Quantum-Mutationen aus diesem Runbook sind keine alternative Releaseprozedur. Sie benötigen einen dokumentierten Incident, ein explizites Ziel und eine anschließende Verifikation gegen den kanonischen Vertrag.

## Zieltopologie

| Umgebung | Stack | Root-Host | internes Netz |
| --- | --- | --- | --- |
| Dev | `studio-dev` | `studio-dev.smart-village.app` | `studio-dev_default` |
| Staging | `studio-staging` | `studio-staging.smart-village.app` | `studio-staging_default` |
| Production | `studio` | `studio.smart-village.app` | `studio_default` |

Jeder Stack enthält mindestens App, PostgreSQL und Redis. Traefik routet Root- und Tenant-Hosts über das öffentliche Overlay-Netz. Konkrete Docker-Netzwerk-IDs sind flüchtig und dürfen nicht dokumentiert oder wiederverwendet werden; vor jeder netzbezogenen Reparatur ist die aktuelle ID anhand des Namens live aufzulösen.

## Betriebsziele

| Bereich | Zielwert |
| --- | --- |
| App und Monitoring | `RTO <= 2h` |
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

| Prüfung | Erwartung |
| --- | --- |
| `GET /health/live` | HTTP 200 |
| `GET /health/ready` | HTTP 200 |
| Root-Login | HTTP 302 zum korrekten Root-Realm |
| jeder aktive Tenant-Login | HTTP 302 zum jeweiligen Tenant-Realm |
| Live-Service-Image | exakt erwarteter SHA-256-Digest |
| App-Task | gewünschter Zustand `running` |
| Netzwerke | internes Zielnetz und öffentliches Traefik-Netz vorhanden |
| Traefik-Labels | Root- und Wildcard-Router entsprechen der Zielumgebung |

Ein Swarm-Service darf nach einem Update bis zu fünf Minuten konvergieren. Vor Ablauf dieses Fensters wird kein zusätzlicher mutierender Reparaturversuch gestartet. Bleibt ein Fehler danach bestehen, gilt der Rollout als fehlgeschlagen.

## Backup-Agent

Der zentrale Service `studio-backup-agent` ist mit den aktuellen internen Netzen von Staging und Production sowie dem öffentlichen Traefik-Netz verbunden. Er veröffentlicht keinen Docker-Port. Traefik akzeptiert ausschließlich:

- `POST https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests`
- `POST https://backup-studio.smart-village.app/_ops/backup/v1/requests`

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

### Restore-Grundvertrag

Ein Restore verwendet `pg_restore` gegen eine explizit benannte Zieldatenbank. Vorher werden Bucket, Objektpfad, Prüfsumme, Quellumgebung und Zielumgebung überprüft. Zugangsdaten werden über den Secret-Store injiziert und niemals auf der Kommandozeile oder im Report ausgegeben.

Nach dem Restore sind mindestens erforderlich:

1. `goose`-Versionsstand prüfen,
2. kritischen IAM-Schema-Guard ausführen,
3. App-DB-Principal validieren,
4. Registry- und Tenant-Secrets prüfen,
5. `health/live`, `health/ready` und alle aktiven Tenant-Logins prüfen.

## DNS- und TLS-Prüfung

Root- und Wildcard-DNS jeder Umgebung müssen auf denselben vorgesehenen Swarm-Ingress zeigen. Die Backup-Hosts müssen denselben verifizierten Ingress erreichen. DNS- oder TLS-Abweichungen werden diagnostiziert, aber nicht durch spontane Traefik-Änderungen im App-Rollout behoben.

## Secrets und Evidenz

- Keine vollständigen Service-Environments, `.env`-Dateien oder Secret-Inhalte ausgeben.
- Reports enthalten nur Digest, Stack, Service-/Task-ID, Status, Zeitpunkte und redigierte Fehlerklassen.
- Lokale `*.local.vars` bleiben ignoriert.
- MinIO-ETags sind keine kryptografischen Prüfsummen; maßgeblich ist die separat berechnete SHA-256-Prüfung nach erneutem Download.

## Eskalation

| Fall | Primärer Kanal | Zusätzlicher Kanal |
| --- | --- | --- |
| Betriebsstörung ohne sensitive Daten | `operations@smart-village.app` | bereinigtes GitHub Issue |
| Sicherheits- oder DSGVO-Vorfall | `security@smart-village.app` | `operations@smart-village.app` |

## Referenzen

- Regulärer Rollout: [`studio-rollout-process.md`](./studio-rollout-process.md)
- Deployment-Überblick: [`deployment-overview.md`](./deployment-overview.md)
- Architektur: [`07-deployment-view.md`](../architecture/07-deployment-view.md)
- Backup-ADR: [`ADR-048`](../adr/ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md)
- Monitoring: [`monitoring-stack.md`](../development/monitoring-stack.md)
- Incident Response: [`incident-response.md`](./incident-response.md)
