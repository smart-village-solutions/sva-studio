# Docker-Swarm- und Planetary-Quantum-Infrastruktur

## Geltungsbereich

Dieses Dokument beschreibt die technische Swarm-Grundlage und das nicht produktive Demo-Profil. Es ist keine Anleitung für reguläre Rollouts nach Dev, Staging oder Production. Dafür gilt ausschließlich der [kanonische Studio-Rollout](./studio-rollout-process.md).

## Infrastrukturvertrag

SVA Studio läuft auf Docker Swarm hinter Traefik. Der reguläre Studio-Prozess verwendet:

- den Quantum-Endpoint `sva`,
- die Stacks `studio-dev`, `studio-staging` und `studio`,
- immutable App-Images aus GHCR,
- das gemeinsame öffentliche Ingress-Netz,
- je Stack ein internes Overlay-Netz,
- GitHub Actions `Build` und `Promote` als einzige reguläre Mutationskanäle.

Quantum CLI und Portainer bleiben Infrastruktur- und Diagnosewerkzeuge. Direkte Stack- oder Service-Mutationen damit sind Incident-Recovery und kein normaler Studio-Rollout.

## Demo-Profil

Das Demo-Profil unter `deploy/portainer/docker-compose.demo.yml` ist absichtlich vereinfacht:

- direkte Umgebungsvariablen statt des GitHub-Environment-Vertrags,
- kein Production-Secrets-Modell,
- kein Staging-Paritätsnachweis,
- kein verpflichtender Backup-Agent,
- keine Freigabe für produktive Daten.

Es darf nicht als Vorlage für Dev, Staging oder Production verwendet werden.

Für eine lokale Validierung der Demo-Compose-Datei kann Quantum CLI ohne Mutation verwendet werden:

```bash
quantum-cli validate --project .
```

Ein Demo-Deploy muss ausdrücklich als Demo gekennzeichnet sein und einen separaten Stack verwenden. Der Stackname `studio`, `studio-staging` oder `studio-dev` ist für Demo-Läufe verboten.

## Secrets

- Secrets liegen in GitHub-Environments oder externen Swarm-Secrets, niemals in versionierten `.env`-Dateien.
- `config/runtime/*.local.vars` ist lokal und darf nicht committed oder ausgegeben werden.
- Quantum CLI ist kein Secret-Store.
- Portainer- oder Docker-Secret-Provisionierung gehört zur initialen Infrastruktur beziehungsweise Rotation, nicht zum App-Rollout.

## Netzwerke und DNS

Vor einer erstmaligen Inbetriebnahme müssen vorhanden sein:

- öffentliches Traefik-Overlay-Netz,
- internes Overlay-Netz je Studio-Stack,
- Root- und Wildcard-DNS für jede Umgebung,
- TLS für Root- und Tenant-Hosts,
- die verifizierten Backup-Domains für Staging und Production.

Die verbindlichen Namen und Domains stehen im [kanonischen Studio-Rollout](./studio-rollout-process.md). Netzwerk-IDs dürfen nie aus älteren Reports übernommen werden; maßgeblich sind Name und aktuelle Live-ID am Zielendpoint.

## Diagnose

Read-only Abfragen sind zulässig, sofern sie keine Secrets ausgeben:

```bash
quantum-cli endpoints ls
quantum-cli stacks ls --endpoint sva
quantum-cli ps --endpoint sva --stack <expliziter-stack> --all
```

Bei `401 Invalid JWT token` ist auch ein veralteter lokaler `QUANTUM_API_KEY` als Ursache zu prüfen. Diagnoseergebnisse dürfen keine vollständigen Runtime-Environments oder Secret-Werte enthalten.

## Weiterführende Dokumente

- Regulärer Studio-Rollout: [`studio-rollout-process.md`](./studio-rollout-process.md)
- Swarm-Diagnose, Restore und Incident-Recovery: [`swarm-deployment-runbook.md`](./swarm-deployment-runbook.md)
- Deployment-Architektur: [`07-deployment-view.md`](../architecture/07-deployment-view.md)
- Monitoring: [`monitoring-stack.md`](../development/monitoring-stack.md)
