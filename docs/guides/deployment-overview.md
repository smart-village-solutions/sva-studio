# Deployment-Überblick

Dieses Dokument ordnet die unterschiedlichen Deploymentprofile ein. Für reguläre Studio-Rollouts nach Dev, Staging und Production ist ausschließlich der [kanonische Studio-Rollout](./studio-rollout-process.md) verbindlich.

## Profile und Zuständigkeit

| Profil | Zweck | Normative Quelle |
| --- | --- | --- |
| Lokale Entwicklung | Entwicklung, Tests und lokale Keycloak-Integration | [`runtime-profile-betrieb.md`](../development/runtime-profile-betrieb.md) |
| Studio Dev/Staging/Production | gemeinsamer Swarm-Rollout über immutable Images und GitHub Actions | [`studio-rollout-process.md`](./studio-rollout-process.md) |
| Swarm-Infrastruktur | Ersteinrichtung, Diagnose, Restore und Incident-Recovery | [`swarm-deployment-runbook.md`](./swarm-deployment-runbook.md) |
| Demo | nicht produktives, vereinfachtes Swarm-Profil | [`swarm-deployment-guide.md`](./swarm-deployment-guide.md) |
| Public Waste Web | eigenständiger tag-basierter Releasepfad | [`public-waste-web-release-runbook.md`](./public-waste-web-release-runbook.md) |

## Studio-Zielbild

Der Studio-Prozess besteht aus einer durchgängigen Promotion desselben Image-Digests:

```text
main → Build → Dev → manuelles Staging → manuell freigegebenes Production
```

- Dev wird nach einem erfolgreichen Main-Build automatisch aktualisiert.
- Staging prüft den unveränderlichen Digest, Migrationen, Bootstrap, Runtime und Tenant-Logins.
- Production akzeptiert bei Datenmutationen nur denselben erfolgreich in Staging geprüften Digest.
- Ein erfolgreich verifiziertes Datenbank-Backup liegt vor jeder Migration oder jedem Bootstrap in Staging und Production.
- Die GitHub-Environments `staging` und `prod` bilden die Freigabe- und Secret-Grenzen.
- Nach einem Swarm-Update wird eine Konvergenzzeit von bis zu fünf Minuten berücksichtigt.

Die vollständige Reihenfolge, Eingaben, Stacknamen, Domains, Buckets und Erfolgskriterien stehen ausschließlich im [kanonischen Studio-Rollout](./studio-rollout-process.md).

Infrastrukturannahme: Traefik auf `sva` läuft derzeit v3.6. Studio-Rollouts nutzen den bestehenden Ingress-Vertrag, verändern den Traefik-Stack aber nicht.

## Keine konkurrierenden Studio-Pfade

Folgende Werkzeuge bleiben technisch für Diagnose oder Incident-Recovery vorhanden, sind aber kein regulärer Studio-Release:

- lokale `env:release:*`- oder `env:deploy:*`-Mutationen,
- direkte `quantum-cli stacks deploy/update`-Aufrufe,
- Portainer-Klickpfade,
- direkte Docker-Service-Updates,
- manuell ausgeführte SQL- oder Bootstrap-Schritte.

Nach einem genehmigten Notfalleingriff muss der Zustand wieder gegen den GitHub-`Promote`-Vertrag geprüft und beim nächsten kontrollierten Lauf reconciled werden.

## Backup und Rollback

Das verpflichtende Promote-Backup bei Migration oder Bootstrap ist ein PostgreSQL-Custom-Dump in MinIO. Es ersetzt keinen vollständigen Snapshot von Keycloak, MinIO und anderen externen Systemen. App-Rollbacks verwenden den vorherigen Digest; Datenbankmigrationen werden nicht automatisch zurückgerollt.

## Historische Dokumente

Reports, Staging-Unterlagen, PR-Dokumente, Planungsdokumente und archivierte OpenSpec-Changes beschreiben den Zustand zu einem bestimmten Zeitpunkt. Sie sind keine aktuelle Betriebsanweisung. Bei Widersprüchen gilt immer der [kanonische Studio-Rollout](./studio-rollout-process.md) zusammen mit den tatsächlich versionierten Workflows.
