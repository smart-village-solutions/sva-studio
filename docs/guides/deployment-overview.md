# Deployment-Überblick

Dieses Dokument ist der kanonische Einstieg für Deployment- und Betriebsfragen. Es bündelt die bestehenden Leitfäden und beschreibt, welches Profil für welchen Zweck gilt.

## Zielbild

SVA Studio kennt aktuell vier relevante Betriebsmodi:

| Modus | Zweck | Primäre Dokumente |
| --- | --- | --- |
| Lokal | Entwicklung, schnelle Verifikation, E2E | `../development/playbook.md`, `../development/app-e2e-integration-testing.md` |
| Swarm-Referenzprofil | kanonischer Betriebsweg mit Swarm-Secrets und Traefik-v2+-Labels | `./swarm-deployment-guide.md`, `./swarm-deployment-runbook.md` |
| Demo-Profil | vereinfachter Stack ohne Secret-Provisioning, mit Traefik-v1-kompatiblen Labels | `./swarm-deployment-guide.md`, `./swarm-deployment-runbook.md` |
| Studio-Remoteprofil | produktionsnaher Betrieb als eigener Stack auf `studio.smart-village.app` | `./swarm-deployment-guide.md`, `../development/runtime-profile-betrieb.md` |

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

### Studio-Remoteprofil

Das Studio-Profil bildet einen separaten produktionsnahen Rollout-Pfad:

- Runtime-Profil: `studio`
- Stack typischerweise: `studio`
- Quantum-Environment: `studio`
- Traefik auf `sva` läuft derzeit v1.7.34; daher sind nur v1-kompatible Labels wirksam

Wichtig:

- produktionsnahe Werte liegen lokal in `config/runtime/studio.vars` und `config/runtime/studio.local.vars`
- im Repository liegt nur die Vorlage `config/runtime/studio.vars.example`
- Tenant-Realms folgen dem operativen Vertrag aus `./keycloak-tenant-realm-bootstrap.md`
- bei `studio` haben `pnpm env:precheck:studio`, `pnpm env:deploy:studio` und `pnpm env:smoke:studio` Vorrang vor manuellen `quantum-cli`- oder Portainer-Pfaden

## Standardablauf für Releases

1. Image mit konkretem Tag bereitstellen.
   Für Serverprofile muss das Artefakt explizit `linux/amd64` unterstützen.
2. Zielprofil auswählen.
3. Zielumgebungsvariablen oder Secrets prüfen.
4. Für `studio` zuerst `Studio Image Build` und `Studio Artifact Verify` oder den Orchestrator `Studio Release` ausführen.
5. Den kanonischen Serverdeploy über `Studio Deploy` oder `pnpm env:deploy:studio` starten.
6. Den erzeugten Deploy-Report unter `artifacts/runtime/deployments/` prüfen.
7. Monitoring und Logs auf Fehler prüfen.
8. Nicht-sensitive Folgearbeiten als GitHub Issues nachziehen.

Für `studio` zusätzlich wichtig:

- der Rollout gilt erst als erfolgreich, wenn Runtime, Keycloak, Observability und Tenant-Auth gemeinsam grün sind
- `observability-readiness` prüft Logger-Modus, Transportzustand und frische Loki-Sichtbarkeit
- `tenant-auth-proof` prüft tenant-spezifische Redirects und zugehörige Diagnose-Events in Loki
- Shell-Overrides und einzelne Runtime-Flags können bei direktem `quantum-cli stacks update` verloren gehen
- wenn die Env-Propagation zweifelhaft ist, muss der Deploy über den vorgerenderten Runtime-Pfad laufen statt über rohe Compose-Dateien
- ein gesunder Stack ersetzt nicht die Prüfung, ob sich `APP_DB_USER` tatsächlich gegen `POSTGRES_DB` anmelden kann
- `env:precheck:studio` blockiert Images, deren Registry-Manifest kein `linux/amd64` ausweist
- `env:precheck:studio` und `/health/ready` blockieren jetzt auch kritische IAM-Schema-Drifts für die Tenant-Registry, z. B. fehlende Artefakte aus `0025_iam_instance_registry_provisioning.sql` oder `0027_iam_instance_keycloak_bootstrap.sql`

Die operativen Details und Beispielkommandos stehen unter `./swarm-deployment-runbook.md`.

## Smoke-Checks

Nach jedem Deployment sind mindestens diese Prüfungen verpflichtend:

- App-Erreichbarkeit und `GET /`
- Health- oder Ready-Endpoints der App
- interne Monitoring-Komponenten
- kritische Login- oder Kernroute

Für den reproduzierbaren Browser-Smoke-Test gilt `../development/app-e2e-integration-testing.md`. Die PR- und Release-Checkliste verweist zusätzlich auf `../reports/PR_CHECKLIST.md`.

Für tenant-spezifische Remote-Smokes ist zusätzlich verpflichtend:

- Root-Login redirectet auf den Root-Realm
- Tenant-Login redirectet auf den Tenant-Realm
- `/auth/me` liefert `instanceId` und erwartete Rollen

## Migrationen

Migrationen sind ein bewusster Betriebsschritt und nicht implizit Teil jedes Redeployments.

Für das Remote-Profil `studio` gilt zusätzlich:

- `app-only` und `schema-and-app` sind zwei explizite Release-Klassen
- `schema-and-app` erfordert ein dokumentiertes Wartungsfenster
- der kanonische Deploypfad führt Migrationen nur bei `schema-and-app` automatisch aus
- Deploy-Evidenz wird immer als Report-Artefakt geschrieben

Der offizielle CI/CD-Pfad fuer `studio` lautet:

1. `Studio Image Build`
2. `Studio Artifact Verify`
3. `Studio Deploy`

Optional verbindet `Studio Release` diese drei Stufen in einem manuellen Orchestrierungsworkflow.

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
- Das Studio-Remoteprofil auf Endpoint `sva` nutzt aktuell ebenfalls Traefik-v1-kompatible Labels.
- `monitoring-config-init` schreibt Monitoring-Konfiguration einmalig in Volumes und beendet sich danach erfolgreich.
- Ressourcenlimits, RTO/RPO und Eskalationswege sind im Runbook verbindlich dokumentiert.

## Verweise

- Swarm-Leitfaden: `./swarm-deployment-guide.md`
- Swarm-Runbook: `./swarm-deployment-runbook.md`
- Tenant-Realm-Bootstrap: `./keycloak-tenant-realm-bootstrap.md`
- Verteilungssicht: `../architecture/07-deployment-view.md`
- Monitoring-Details: `../development/monitoring-stack.md`
