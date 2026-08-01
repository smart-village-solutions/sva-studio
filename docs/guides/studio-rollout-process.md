# Kanonischer Studio-Rollout für Dev, Staging und Production

Status: **verbindlicher Betriebsvertrag**

Dieses Dokument ist die einzige normative Bedienanleitung für reguläre Studio-Rollouts. Technische Wahrheit sind die Workflows [Build](../../.github/workflows/build.yml) und [Promote](../../.github/workflows/promote.yml). Andere Runbooks dürfen Diagnose, Recovery oder Infrastrukturaufbau beschreiben, aber keinen konkurrierenden Deploymentpfad definieren.

## Unveränderliche Grundregeln

- Ein App-Image wird genau einmal gebaut und anschließend über seinen SHA-256-Digest durch die Umgebungen befördert.
- Ausschließlich `.github/workflows/build.yml` darf das reguläre Studio-App-Image veröffentlichen; frühere Image-Build-/Release-Preparation-Workflows sind entfernt.
- Dev folgt automatisch auf einen erfolgreichen Push nach `main`.
- Staging wird vor Production mit demselben Digest vollständig verifiziert.
- Production wird ausschließlich manuell über das geschützte GitHub-Environment `prod` freigegeben.
- `auto` ist ausschließlich in Dev zulässig. Staging und Production verwenden `assert-none` oder `run`.
- Bei Migration oder Bootstrap in Staging oder Production muss vor der ersten Datenmutation ein erfolgreich verifiziertes PostgreSQL-Backup vorliegen.
- Backup, Migration, Bootstrap, Postconditions und Verifikation sind fail-closed: Ein Fehler blockiert alle nachfolgenden mutierenden Phasen.
- Secrets kommen ausschließlich aus dem jeweiligen GitHub-Environment. Sie werden weder in Workflow-Inputs noch in Logs, Reports oder Dokumentation geschrieben.
- Direkte Portainer-Änderungen, Docker-Service-Updates, rohe `quantum-cli stacks deploy/update`-Aufrufe und `env:release:studio:local` sind kein regulärer Rolloutpfad.

## Umgebungsvertrag

| Umgebung | Stack | Root-URL | Auslösung | Modi | Backup |
| --- | --- | --- | --- | --- | --- |
| Dev | `studio-dev` | `https://studio-dev.smart-village.app` | automatisch nach erfolgreichem Build auf `main` | `migration_mode=auto`, `bootstrap_mode=auto` | kein Promote-Backup |
| Staging | `studio-staging` | `https://studio-staging.smart-village.app` | manuell über `Promote`, geschützt durch das Environment `staging` | `assert-none` oder `run` | verpflichtend, sobald Migration oder Bootstrap ausgeführt wird |
| Production | `studio` | `https://studio.smart-village.app` | manuell über `Promote`, geschützt durch das Environment `prod` | `assert-none` oder `run` | verpflichtend, sobald Migration oder Bootstrap ausgeführt wird |

Die Backup-Endpunkte und Buckets sind fest an die Zielumgebung gebunden:

| Umgebung | Endpoint | Bucket |
| --- | --- | --- |
| Staging | `https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests` | `studio-db-backup-staging` |
| Production | `https://backup-studio.smart-village.app/_ops/backup/v1/requests` | `studio-db-backup-production` |

Der zentrale Agent akzeptiert nur den engen, OIDC- und HMAC-gesicherten Vertrag `backup-and-verify`. Er stellt keine Remote-Shell bereit. Der S3-kompatible Speicher ist MinIO unter `https://fileserver.smart-village.app`; AWS CLI und S3 SDK dienen lediglich als kompatible Clients.

## Phase 1: Image bauen und Dev aktualisieren

Ein Push nach `main` startet [Build](../../.github/workflows/build.yml):

1. Finales Node-Runtime-Artefakt verifizieren.
2. Genau ein App-Image für `linux/amd64` bauen und nach GHCR pushen.
3. Imagevertrag und OCI-Revision binden.
4. `Promote` für `dev` mit dem vom Build ausgegebenen SHA-256-Digest und beiden Modi `auto` aufrufen.
5. Migration und Bootstrap anhand des konkreten Commit-Diffs unabhängig bewerten.
6. Erforderliche One-shot-Jobs vor dem App-Deploy ausführen.
7. Nur nach erfolgreichen Gates den Stack `studio-dev` aktualisieren.

Dev ist die schnelle Integrationsstufe. Der fehlende Datenbank-Backup-Schritt ist bewusst auf Dev begrenzt und darf nicht auf Staging oder Production übertragen werden.

## Phase 2: Denselben Digest nach Staging promoten

Der manuelle Workflow [Promote](../../.github/workflows/promote.yml) erhält:

- `environment=staging`
- den aus dem erfolgreichen Build stammenden Image-Ref beziehungsweise Digest
- `change_base` und `change_head` des tatsächlich im Image enthaltenen Änderungsbereichs
- je nach Diff `migration_mode` und `bootstrap_mode` als `assert-none` oder `run`
- bei `migration_mode=run` einen nicht-sensitiven, revisionsfähigen `maintenance_window`-Verweis

`assert-none` ist kein Skip: Sobald der Diff ein entsprechendes Risiko enthält, bricht das Gate ab. Dann muss der betreffende Modus bewusst auf `run` gesetzt werden.

Wenn mindestens ein One-shot-Job läuft, ist die Reihenfolge unveränderlich:

1. Inputs, Git-Bindung, Image-Digest und OCI-Revision validieren.
2. Vorherigen Live-Digest erfassen.
3. Signierten Backup-Auftrag an den Staging-Agenten senden.
4. Terminales Ergebnis aus MinIO abwarten und das Dump-Objekt unabhängig per S3-`HEAD` verifizieren.
5. Migration ausführen, falls angefordert.
6. Bootstrap ausführen, falls angefordert.
7. Postconditions gegen Datenbank und aktuellen Runtime-Vertrag prüfen.
8. App-Stack `studio-staging` aktualisieren.
9. Runtime-Smoke, Tenant-Logins und Live-Digest verifizieren.
10. Redigierte Staging-Paritätsevidenz für genau diesen Digest schreiben.

Nur ein insgesamt erfolgreicher mutierender Staging-Lauf erzeugt die für eine mutierende Production-Promotion gültige Paritätsevidenz.

## Phase 3: Denselben Digest nach Production promoten

Production verwendet denselben Workflow und denselben bereits in Staging geprüften Digest. Zusätzlich gelten:

- Das GitHub-Environment `prod` muss ausdrücklich freigegeben werden.
- Bei `migration_mode=run` oder `bootstrap_mode=run` ist ein nicht-sensitiver, revisionsfähiger `maintenance_window`-Verweis Pflicht.
- Für genau den Zieldigest muss die erfolgreiche Evidenz eines abgeschlossenen mutierenden Staging-Laufs vorliegen.
- Vor der ersten Production-Mutation muss der Production-Backup-Agent ein erfolgreiches und anschließend unabhängig verifiziertes Backup liefern.

Danach gilt dieselbe Reihenfolge wie in Staging: Backup → Migration → Bootstrap → Postconditions → App-Deploy → Runtime-Smoke → Digest-Prüfung.

Ein reines App-Deployment mit beiden Modi `assert-none` führt kein Datenbank-Backup aus. Das ist nur zulässig, wenn die Diff-Gates belastbar bestätigen, dass weder Migration noch Bootstrap erforderlich sind.

## Konvergenz und Erfolgsdefinition

Docker-Swarm-Dienste dürfen nach einem Update bis zu fünf Minuten benötigen, bis alle Probes stabil sind. Deshalb gilt:

1. Ein unmittelbar nach dem Deploy fehlschlagender Smoke wird nicht durch weitere Mutationen „repariert“.
2. Zuerst Service-Update und Tasks prüfen und bis zu fünf Minuten ab dem abgeschlossenen Update konvergieren lassen.
3. Danach `health/live`, `health/ready`, den Release-Blocking-Tenant-Login-Redirect (`de-studio-sandbox`) und den Live-Digest erneut prüfen. Weitere Tenant-Redirects bleiben operativ überwacht, blockieren den Release aber nicht.
4. Bleibt ein Fehler bestehen, ist der Rollout rot und wird diagnostiziert oder auf den vorherigen Digest zurückgeführt.
5. Ein Workflow-Retry ist erst nach dokumentierter Ursache beziehungsweise bestätigtem reinen Konvergenzfehler zulässig.

Ein regulärer Rollout ist nur erfolgreich, wenn der GitHub-Workflow grün ist, der erwartete Digest live läuft, `live` und `ready` HTTP 200 liefern und der Release-Blocking-Tenant-Smoke für `de-studio-sandbox` bestanden ist. Weitere Tenant-Smokes sind operative Signale und keine Release-Blocker.

## Backup- und Rollback-Grenzen

- Das Promote-Backup ist ein PostgreSQL-Custom-Dump, kein Snapshot des gesamten Systems.
- Keycloak, MinIO-Objekte und weitere externe Systeme sind nicht automatisch Bestandteil dieses Dumps.
- Ein App-Rollback verwendet den vorherigen unveränderlichen Digest.
- Erfolgreich angewandte Datenbankmigrationen werden niemals automatisch zurückgerollt.
- Nicht rückwärtskompatible Migrationen benötigen vor dem Rollout einen separat geprüften Restore-Plan.
- Die Workflows **Staging Backup Drill** und **Production Backup Drill** prüfen Backups ohne Migration, Bootstrap oder App-Deployment; sie ersetzen keinen Promote-Lauf.

## Diagnose und Recovery

Lokale Befehle wie `env:status:*`, `env:doctor:*`, `env:precheck:*` und `env:smoke:*` bleiben für read-only Diagnose zulässig. Direkte Service-, Stack- oder Portainer-Mutationen sind ausschließlich Incident-Recovery, müssen auf den expliziten Zielstack begrenzt und anschließend durch den kanonischen `Promote`-Vertrag reconciled und verifiziert werden.

Historische Reports unter `docs/reports/`, zeitgebundene Staging-Unterlagen unter `docs/staging/`, PR-Dokumente unter `docs/pr/`, Planungsunterlagen unter `docs/superpowers/` und archivierte OpenSpec-Changes sind Evidenz, aber keine Bedienanleitung.

## Verbindliche Referenzen

- Workflow: [`.github/workflows/build.yml`](../../.github/workflows/build.yml)
- Workflow: [`.github/workflows/promote.yml`](../../.github/workflows/promote.yml)
- Backup-Drills: [Staging](../../.github/workflows/staging-backup-drill.yml) und [Production](../../.github/workflows/production-backup-drill.yml)
- Architektur: [`07-deployment-view.md`](../architecture/07-deployment-view.md)
- Sicherheits- und Evidenzvertrag: [`08-cross-cutting-concepts.md`](../architecture/08-cross-cutting-concepts.md)
- Backup-Entscheidung: [`ADR-048`](../adr/ADR-048-zentraler-backup-agent-mit-gehaertetem-https-trigger.md)
- Infrastruktur, Diagnose und Restore: [`swarm-deployment-runbook.md`](./swarm-deployment-runbook.md)
