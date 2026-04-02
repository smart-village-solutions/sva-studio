# Deployment-Überblick

Dieses Dokument ist der kanonische Einstieg für Deployment- und Betriebsfragen. Es bündelt die bestehenden Leitfäden und beschreibt, welches Profil für welchen Zweck gilt.

## Zielbild

SVA Studio kennt aktuell drei relevante Betriebsmodi:

| Modus | Zweck | Primäre Dokumente |
| --- | --- | --- |
| Lokal | Entwicklung, schnelle Verifikation, E2E | `../development/playbook.md`, `../development/app-e2e-integration-testing.md` |
| Swarm-Referenzprofil | kanonischer Betriebsweg mit Swarm-Secrets und Traefik-v2+-Labels | `./swarm-deployment-guide.md`, `./swarm-deployment-runbook.md` |
| Demo-Profil | vereinfachter Stack ohne Secret-Provisioning, mit Traefik-v1-kompatiblen Labels | `./swarm-deployment-guide.md`, `./swarm-deployment-runbook.md` |

## Profilwahl

### Lokale Entwicklung

Für lokale Entwicklung und schnelle Validierung ist der Entwicklungs-Workflow unter `../development/playbook.md` maßgeblich. Datenbank- und Migrationsdetails liegen unter `../development/postgres-setup.md`.

### Swarm-Referenzprofil

Das Referenzprofil ist für den regulären Swarm-Betrieb gedacht:

- Compose-Datei: `../../deploy/portainer/docker-compose.yml`
- Secrets werden über Docker Swarm oder Portainer bereitgestellt.
- Traefik-Routing nutzt v2+-Router- und Middleware-Labels.
- Monitoring wird über den internen Monitoring-Block mitgeführt.

### Demo-Profil

Das Demo-Profil ist bewusst einfacher gehalten:

- Compose-Datei: `../../deploy/portainer/docker-compose.demo.yml`
- Umgebungsvariablen statt Swarm-Secrets
- Traefik-v1-kompatible Labels statt v2+-Router-Konfiguration
- Monitoring bleibt intern, nur die App ist öffentlich erreichbar

Die Profilgrenzen sind bewusst dokumentiert. Das Demo-Profil ist kein verstecktes zweites Referenzprofil.

## Standardablauf für Releases

1. Image mit konkretem Tag bereitstellen.
2. Zielprofil auswählen.
3. Zielumgebungsvariablen oder Secrets prüfen.
4. Für `acceptance-hb` zuerst `pnpm env:precheck:acceptance-hb` ausführen.
5. Den kanonischen Serverdeploy über `pnpm env:deploy:acceptance-hb` starten.
6. Den erzeugten Deploy-Report unter `artifacts/runtime/deployments/` prüfen.
7. Monitoring und Logs auf Fehler prüfen.
8. Nicht-sensitive Folgearbeiten als GitHub Issues nachziehen.

Die operativen Details und Beispielkommandos stehen unter `./swarm-deployment-runbook.md`.

## Smoke-Checks

Nach jedem Deployment sind mindestens diese Prüfungen verpflichtend:

- App-Erreichbarkeit und `GET /`
- Health- oder Ready-Endpoints der App
- interne Monitoring-Komponenten
- kritische Login- oder Kernroute

Für den reproduzierbaren Browser-Smoke-Test gilt `../development/app-e2e-integration-testing.md`. Die PR- und Release-Checkliste verweist zusätzlich auf `../reports/PR_CHECKLIST.md`.

## Migrationen

Migrationen sind ein bewusster Betriebsschritt und nicht implizit Teil jedes Redeployments.

Für `acceptance-hb` gilt zusätzlich:

- `app-only` und `schema-and-app` sind zwei explizite Release-Klassen
- `schema-and-app` erfordert ein dokumentiertes Wartungsfenster
- der kanonische Deploypfad führt Migrationen nur bei `schema-and-app` automatisch aus
- Deploy-Evidenz wird immer als Report-Artefakt geschrieben

- Lokales Setup und SQL-Workflow: `../development/postgres-setup.md`
- Swarm-Ausführung und Reihenfolge: `./swarm-deployment-runbook.md`
- Profil ohne Monitoring für reduzierte Setups: `./portainer-deployment-ohne-monitoring.md`

Wichtig: Bestehende Datenbank-Volumes übernehmen neue SQL-Dateien nicht automatisch. Dafür ist ein expliziter Migrationslauf erforderlich.
Im Sollzustand läuft dieser Migrationsschritt über den repository-lokalen `goose`-Pfad und nicht über manuelle `psql`-Schleifen.

## Rollback

Rollback und Recovery hängen davon ab, ob sich nur das App-Image oder auch das Schema geändert hat.

- App-Rollback ohne Schemaänderung: `./swarm-deployment-runbook.md`
- Datenbank- und Migrationsaspekte: `./swarm-deployment-runbook.md`
- Monitoring- und Ressourcenannahmen: `../architecture/07-deployment-view.md`

Wenn eine Änderung ein neues Schema voraussetzt, ist ein reiner Image-Rollback nicht ausreichend.

## Betriebsannahmen

- Das Referenzprofil nutzt Traefik v2+.
- Das Demo-Profil bleibt absichtlich Traefik-v1-kompatibel.
- `monitoring-config-init` schreibt Monitoring-Konfiguration einmalig in Volumes und beendet sich danach erfolgreich.
- Ressourcenlimits, RTO/RPO und Eskalationswege sind im Runbook verbindlich dokumentiert.

## Verweise

- Swarm-Leitfaden: `./swarm-deployment-guide.md`
- Swarm-Runbook: `./swarm-deployment-runbook.md`
- Verteilungssicht: `../architecture/07-deployment-view.md`
- Monitoring-Details: `../development/monitoring-stack.md`
