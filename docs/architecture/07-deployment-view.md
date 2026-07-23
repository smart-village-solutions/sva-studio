# 07 Verteilungssicht

## Zweck

Dieser Abschnitt beschreibt die technische Verteilung auf Umgebungen und
Laufzeitknoten auf Basis des aktuellen Repos.

## Mindestinhalte

- Deployment-Topologie (lokal, CI, staging, production)
- Abhängigkeiten zu externen Diensten (z. B. Redis, OTEL, Loki)
- Sicherheits- und Betriebsaspekte je Umgebung

## Aktueller Stand

### Medienmanagement im Betriebsprofil

- Medienoriginale und Varianten liegen in einem S3-kompatiblen Objektspeicher; das Referenzziel im MVP ist MinIO.
- Die Studio-Runtime hält Bucket- und Zugangsdaten als Betriebsgeheimnisse; diese Informationen werden nicht in Plugin- oder Fachverträge gespiegelt.
- Geschützte Auslieferung bleibt ein hostseitiger Laufzeitpfad und wird nicht als direkter Storage-Zugriff an Browser oder Plugins delegiert.

### Lokale Entwicklungsverteilung

- App: `pnpm nx run sva-studio-react:serve` auf `localhost:3000`
- Öffentliche App: `pnpm nx run public-waste-calendar-web:serve` auf `localhost:3002`
- Postgres IAM-DB: `compose.yaml` (`5432`)
- Redis: `compose.yaml` (`6379`, optional TLS `6380`)
- Monitoring Stack: `compose.monitoring.yaml`
  - Collector: `4317`, `4318`, `13133`
  - Loki: `3100`
  - Prometheus: `9090`
  - Grafana: `3001`
  - Promtail: `3101`
  - Alertmanager: `9093`
  - Redis Exporter: `9121` (für Redis-/Permission-Cache-Metriken im Zielbild)

### Deployment-Bausteine (logisch)

- Web-App Runtime (TanStack Start / Node)
- Öffentliche Waste-Web-App als separates Vite-Frontend mit eigenem Playwright-Gate
- Nx-/pnpm-basierte Build- und Test-Pipeline
- Separates IAM-Acceptance-Gate für Paket-1-/2-Abnahmen
- Externe Plattform (GitHub Actions) für CI-Ausführung
- Keycloak als zentraler OIDC Identity Provider
- Redis Session Store
- Redis Permission Snapshot Cache als primärer Shared-Read-Path für effektive IAM-Berechtigungen
- Postgres IAM Core Data Layer
- OTEL Collector als Telemetrie-Hub
- Loki/Prometheus als Storage, Grafana für Auswertung
- `redis-exporter` als Prometheus-Scrape-Target für Redis-Infrastrukturmetriken
- Plugin-Distributionsartefakte als eigener Betriebsgegenstand neben dem App-Image; sie werden über Manifest plus gebaute Artefakte aktiviert, nicht über Core-Codeänderungen

### Ergänzung 2026-03: Minimaler Server-Rollout mit Portainer

> **Hinweis:** Der ursprüngliche, nicht-Swarm-basierte Portainer-Stack ist durch das Swarm-Referenz-Betriebsprofil ersetzt. Die folgenden Abschnitte beschreiben den aktuellen Stand.

### Swarm-/Traefik-Referenz-Betriebsprofil (ab 2026-03)

Für den serverbasierten Betrieb ist ein Docker-Swarm-Stack mit Traefik als Ingress-Proxy definiert:

- Compose-Datei: `deploy/portainer/docker-compose.yml`
- Services: `app`, `postgres`, `redis`, `otel-collector`, `loki`, `prometheus`, `grafana`, `promtail`, `alertmanager`
- Monitoring bleibt intern auf dem Overlay-Netzwerk; nur die App hängt zusätzlich am `public`-Netzwerk

#### Topologie

```
Internet
  │
  ▼
Traefik (Ingress, TLS, HostRegexp-Routing)
  │  Overlay-Netzwerk „public"
  ▼
┌──────────────────────────────────────────────────────────────┐
│  Swarm-Stack „sva-studio"                                    │
│                                                              │
│  app ←──── internes Overlay ────→ redis                      │
│   │                                     │                    │
│   ├──── internes Overlay ────→ postgres │                    │
│   │                                     │                    │
│   └──── internes Overlay ────→ otel-collector ──→ Loki       │
│                                         │         │           │
│                                         └──────→ Prometheus   │
│                                                   │           │
│                                           Grafana + Alerting  │
│                                           Promtail (Node-Logs)│
└──────────────────────────────────────────────────────────────┘
```

#### Demo-Profil

Neben dem Referenzprofil mit Docker Swarm Secrets existiert ein vereinfachtes
Demo-Profil (`deploy/portainer/docker-compose.demo.yml`) für Evaluierungs-
und Vorführungszwecke. Unterschiede zum Referenzprofil:

- Secrets werden als Umgebungsvariablen statt Docker Swarm Secrets übergeben
- Konfiguration über `deploy/portainer/.env.demo.example`
- Quantum-CLI-Unterstützung über `.quantum`-Datei im Repository-Root
- Traefik-v1-kompatible Labels statt der v2+-Router-Labels des Referenzprofils
- Nicht für Produktionseinsatz vorgesehen

#### Deployment-Muster

- Der Build-Graph des Portainer-Images baut `sva-mainserver` explizit nach `auth` und vor `routing` sowie dem App-Build, damit die serverseitige Integrationsschicht im Deploy-Artefakt verlässlich vorhanden ist.

- **Image-basiert:** Vorgebaute Images aus Container-Registry; für die App ist im Acceptance-Referenzpfad `SVA_IMAGE_REF` mit Digest verpflichtend, der Tag bleibt nur Metadatum. Kein `build:`-Block im Stack.
- **Promote-Integrität:** `dev` darf weiter mutable Referenzen wie `latest` verwenden. `staging` löst jede zulässige Eingabe vor der Mutation zu einem Digest auf und prüft dessen OCI-Revision gegen den Git-Head; `prod` erfordert einen Digest. Der Deploy-Report hält den konkret aufgelösten Image-Ref plus `SVA_DEPLOY_REVISION` fest.
- **Traefik-Labels:** Host-basiertes Routing über `HostRegexp` für Instanz-Subdomains unter `SVA_PARENT_DOMAIN`. TLS über Traefiks `certresolver`.
- **Profilgrenze Traefik:** Das Referenzprofil verwendet Traefik v2+-Labels; das Demo-Profil bleibt bewusst bei Traefik-v1-kompatiblen Labels und ist deshalb kein 1:1-Abbild des Referenzbetriebs.
- **Swarm Secrets:** Vertrauliche Werte als externe Docker-Swarm-Secrets mit Namenskonvention `sva_studio_<service>_<secret_name>`. Ein Shell-Entrypoint (`entrypoint.sh`) liest Secret-Dateien und exportiert sie als Env-Variablen.
- **Versionierte Monitoring-Konfigurationen:** Prometheus-, Loki-, Grafana-, Promtail- und Alertmanager-Konfigurationen liegen versioniert im Repository und werden über ein dediziertes `monitoring-config-init`-Image einmalig in die Swarm-Volumes geschrieben.
- **Rolling Updates:** `start-first` für Updates, `stop-first` für Rollbacks.
- **Kanonischer Studio-Releasepfad:** Für `staging` ist GitHub Actions `Promote` der einzige mutierende Standardpfad: `Preflight -> Migration -> optional Bootstrap -> Postconditions -> App-Deploy -> interne und externe Verifikation`. Der lokale Operatorpfad bleibt Diagnose und Recovery. `prod` bleibt bis zu einem separaten Freigabechange App-only.
- **Finales Runtime-Artefakt als Release-Wahrheit:** Vor jedem Image-Build prueft der CI-Pfad den gebauten Node-Output `apps/sva-studio-react/.output/server/**` direkt. Intermediate-SSR-Artefakte unter `.nitro/vite/services/ssr/**` sind nur Diagnosematerial und kein Freigabenachweis.
- **Release-Gate-Bündel:** `pnpm test:release:studio` verbindet das normale PR-Gate mit `verify:runtime-artifact`; `test:pr` bleibt bewusst leichter und enthält den Runtime-Verify nicht.
- **Image-Verify-Evidenz:** `env:precheck:studio` weist fuer den Ziel-Digest aus, ob unter `artifacts/runtime/image-verify/` ein erfolgreiches Studio-Image-Verify-Artefakt vorhanden ist.
- **Release-Klassen:** Studio-Deploys unterscheiden `app-only` und `schema-and-app`; nur `schema-and-app` darf Migrationen auslösen.
- **Gepinnter Goose-Pfad:** Schema-Rollouts laufen über einen repository-lokalen `goose`-Wrapper mit fixer Version innerhalb eines dedizierten Swarm-One-off-Jobs; Zielsysteme benötigen keine permanente `goose`-Vorinstallation.
- **Dedizierte Job-Services:** Die Stack-Compose-Dateien führen zusätzlich die Services `migrate` und `bootstrap` mit `replicas: 0`. Remote-Deploys rendern daraus ein temporäres Quantum-Projekt, das genau den benötigten One-off-Job gegen das aus der Live-Service-Spec ermittelte interne Overlay-Netz startet.
- **Explizites Promote-Gate:** `promote.yml` bindet Git-Base/-Head, ausgecheckten Executor-Code und für Staging einen durch OCI-Revision attestierten Image-Digest vor jeder Mutation. Ein Main-Push verwendet für `dev` den diff-basierten Modus `auto`: Er führt nur benötigte Migration- und Bootstrap-One-shot-Jobs aus und aktualisiert die App erst nach deren Erfolg. `run` startet in Dev und Staging einen eindeutigen temporären One-shot-Stack auf dem ermittelten Live-Netz; eine Staging-Migration benötigt zusätzlich einen nicht-sensitiven, revisionsfähigen Wartungsfenster-Verweis. `auto` ist außerhalb von Dev gesperrt, Production-`run` bleibt fail-closed.
- **Gehärteter Live-Render:** Der für `quantum-cli stacks update` erzeugte Deploy-Render validiert vor dem Rollout die vollständige `app`-Service-Spec. Pflicht sind mindestens die Netzwerke `internal` und `public` sowie die ingressrelevanten Traefik-Labels.
- **Prod-nahe Paritaet vor Mutationen:** Vor mutierenden `studio`-Rollouts prueft `image-smoke` Root-Host, Tenant-Hosts und OIDC-Verhalten gegen das Zielartefakt. Wenn dasselbe Digest bereits live laeuft, ist nur eine dokumentierte Live-Paritaets-Wiederverwendung fuer genau dieses Digest zulaessig.
- **Strikte Stack-Trennung:** Temp-Job-Stacks für `migrate` und `bootstrap` enthalten keinen `app`-Service und dürfen keine Live-Service-Spec des eigentlichen Stacks ableiten oder überschreiben.
- **Deploy-Evidenz:** Jeder Studio-Deploy schreibt redigierte JSON- und Markdown-Artefakte mit Image-, Actor-, Workflow-, Stack- und Verifikationsdaten. Weder `.env`, `APP_CONFIG` noch unredigierte Remote-Logs oder personenbezogene Daten gehören in Evidenz oder Step Summary; der vorherige App-Digest bleibt Recovery-Hinweis. Datenbank-Rollback ist nicht automatisiert.
- **Health-Modell:** `live` bleibt prozessnah und ohne schwere optionale Abhängigkeiten; `ready` bildet nur minimale Traffic-Voraussetzungen ab; öffentliche Freigabe erfolgt erst über externe Smoke-Probes.
- **Tenant-Login als Readiness-Bestandteil:** Für aktive Instanzen bewertet `ready` zusätzlich den Tenant-Login-Vertrag aus Registry-Grunddaten und lesbarem tenant-spezifischem Auth-Secret; ein Plattform-Secret-Fallback zählt dafür nicht als bereit.
- **Recovery-Patch ist Legacy:** `deploy/portainer/entrypoint.sh` darf Build-Artefakte nur noch unter explizitem Recovery-Flag `SVA_ENABLE_RUNTIME_RECOVERY_PATCH=1` umschreiben. Der Standardbetrieb nutzt den finalen Build-Output unverändert.
- **App-Principal als Betriebsvertrag:** `precheck`, `doctor` und Post-Deploy-Verifikation muessen Registry-, Auth- und RLS-relevante Readiness aus Sicht des laufenden `APP_DB_USER` bestaetigen. Eine rein administrative DB-Sicht reicht nicht als Freigabe.
- **Persistenz:** Named Volumes für Postgres, Redis, Prometheus, Loki, Grafana und Alertmanager.
- **Monitoring-Bootstrap:** Der Node-Prozess lädt OpenTelemetry vor dem Nitro-Entry per `--import`, statt erst beim ersten Root-Request.
- **Ressourcenprofile:** Das Referenzprofil setzt CPU-Limits für App, Datenbank und Monitoring-Services, damit der Stack auf kleinen Swarm-Nodes kontrolliert bleibt.
- **Redis-Keyspaces:** Session-/Login-State und Permission-Snapshots teilen sich höchstens die Infrastruktur, werden aber fachlich getrennt behandelt (`session:*` vs. `perm:v1:*`).
- **Eviction-Policy:** Für den Permission-Snapshot-Keyspace ist `allkeys-lru` verbindlich; wenn Session- und Snapshot-Keys dieselbe Redis-Instanz nutzen, muss das Betriebsprofil Evictions getrennt überwachen oder die Keyspaces logisch/physisch separieren.

#### Instanz-Routing

- `<instanceId>.<SVA_PARENT_DOMAIN>` → Instanz-Kontext
- Root-Domain (`SVA_PARENT_DOMAIN`) → Kanonischer Auth-Host
- Registry-basierte Freigabe in Postgres als autoritative Quelle
- Env-basierte Allowlist (`SVA_ALLOWED_INSTANCE_IDS`) nur noch als lokaler oder migrationsbezogener Kompatibilitätspfad
- Startup-Validierung gegen `instanceId`-Regex bleibt für Kompatibilitätsprofile aktiv

#### DB-Initialisierung

Im Swarm-Stack sind keine automatischen Initialisierungsskripte enthalten. Die DB-Einrichtung bleibt ein bewusster Betriebsschritt und wird fuer `studio` ueber den offiziellen `env:migrate:studio`-/`env:release:studio:local`-Pfad mit dediziertem Swarm-Migrationsjob und nachgelagertem Bootstrap-Job statt ueber ad-hoc SQL, `quantum-cli exec`-Streaming oder implizite Redeploys gesteuert. Details im [Swarm-Deployment-Runbook](../guides/swarm-deployment-runbook.md).

Betriebliche Einordnung:

- App läuft als Node-/Nitro-Server aus dem TanStack-Start-Build.
- Für spätere Updates bestehender Datenbanken bleiben Migrationen ein bewusster separater Betriebsschritt.
- Auch der CI-Promote-Pfad erzwingt diesen Vertrag: Ohne erfolgreichen Nachweis fuer Migration und Bootstrap oder ohne sauberen No-Risk-Nachweis startet kein App-Deploy.
- Der kanonische Migrationspfad nutzt ein einzelnes `goose`-SQL-File pro Version mit `Up` und `Down`; ein getrennter `up`/`down`-Dateibaum ist kein Sollzustand mehr.
- Ein reiner Job-Lauf für `migrate` oder `bootstrap` darf keinen vollständigen Stack-Reconcile auf `sva-studio_app` auslösen; der Live-Stack wird erst im expliziten `deploy`-Schritt aktualisiert.

#### Rollout-Hardening und Recovery

- Der Live-Precheck vergleicht den gerenderten Sollzustand der `app`-Service-Spec mit der Remote-Spec aus Portainer-/Swarm-Daten.
- Read-only Runtime-Diagnostik fuer `status`, `doctor` und `precheck` nutzt bevorzugt die Portainer-API mit fester Endpoint-ID statt lokalem `quantum-cli`-Kontext.
- Drift wird nicht nur über Image-Referenz und Env-Schlüssel bewertet, sondern auch über Netzwerknamen und ingressrelevante Traefik-Labels.
- Der Fehlerzustand `app 1/1`, aber externer `502`, gilt als eigener Ingress-/Netz-Drift-Fall und nicht als unscharfer generischer Verify-Fehler.
- Die Vertragsgrenze zwischen lokalem Development und `studio` bleibt hart: lokale Docker-Kandidaten koennen Private-DNS-, Swarm- und Ingress-Vertraege nur teilweise abbilden und sind deshalb kein alleiniger Freigabenachweis.
- Der kanonische Recovery-Pfad lautet:
  1. Ziel-Digest, Render-Compose und Live-Service-Spec verifizieren.
  2. Kontrollierten `app-only`-Reconcile gegen denselben Ziel-Digest ausführen.
  3. Danach `status`, `smoke` und `precheck` erneut pruefen.
  4. Direkte Portainer-API-Eingriffe bleiben Incident-Recovery und sind kein Standardweg.

Referenzen:

- `deploy/portainer/docker-compose.yml`
- `deploy/portainer/entrypoint.sh`
- `docs/guides/swarm-deployment-runbook.md`
- `docs/guides/swarm-deployment-guide.md`
- `docs/adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md`
- `docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md`

### Sicherheits-/Betriebsaspekte

- Monitoring-Ports in Compose explizit auf `127.0.0.1` gebunden
- Die öffentliche Abfallkalender-App ist bewusst iFrame-tauglich ausgelegt und benötigt für lokale oder eingebettete Browserläufe keine Studio-Session.
- Redis TLS-Unterstützung vorhanden, in local Dev optional
- Postgres mit Healthcheck (`pg_isready`) und separatem Volume
- Healthchecks für zentrale Monitoring-Services konfiguriert
- Graceful OTEL Shutdown im SDK vorgesehen
- `/health/ready` bewertet den Authorization-Cache separat über `checks.authorizationCache` mit den Zuständen `ready`, `degraded` und `failed`
- `degraded` gilt für den Permission-Cache bei Redis-Latenz > `50 ms` oder Recompute-Rate > `20/min`; `failed` bei drei aufeinanderfolgenden Redis-Fehlern
- Session-Ausfälle und Permission-Cache-Ausfälle werden operativ getrennt behandelt: Session-Wiederherstellung folgt dem Plattform-RTO, Snapshots sind flüchtig und werden aus Postgres rekonstruiert
- Keycloak wird aktuell als externer Dienst angebunden (nicht über Repo-Compose provisioniert)
- Das IAM-Acceptance-Gate läuft gegen eine bereits vorhandene Testumgebung und startet keine eigene Keycloak-Topologie im Workflow.
- Swarm-Stack: Secrets als externe Swarm-Secrets, nicht als Klartext-Env-Variablen
- Swarm-Stack: Entrypoint-basierte Secret-Injektion, abwärtskompatibel mit Nicht-Swarm-Betrieb
- Swarm-Stack: Host-Validierung gegen Registry-Status mit fail-closed-Policy (identische 403-Antwort)
- Swarm-Stack: Root-Host rendert die globale Instanzverwaltung, Tenant-Hosts nicht
- Swarm-Stack: Monitoring-UI und Storage bleiben intern; keine öffentliche Exponierung ohne zusätzliche Zugangskontrolle
- Swarm-Stack: `monitoring-config-init` ist ein One-shot-Initialisierer und soll nach erfolgreicher Volume-Befüllung beendet sein
- Swarm-Stack: `postgres-schema-bootstrap` ist nur noch ein Legacy-Übergangspfad; der regulaere Schemarollout erfolgt ueber `pnpm env:migrate:studio` bzw. `pnpm env:release:studio:local -- --release-mode=schema-and-app` mit `migrate`- und `bootstrap`-Job
- Operative Zielwerte für das Referenzprofil: `RTO <= 2h` für App/Monitoring und Session-Store, `RTO <= 15 min` für den rekonstruierbaren Permission-Cache, `RPO <= 24h` für IAM-Daten in Postgres
- Primäre betriebliche Eskalation via `operations@smart-village.app`, Sicherheits-/DSGVO-Eskalation via `security@smart-village.app`

### Fortschreibung 2026-05: Öffentliches Waste-Frontend

- Die öffentliche App wird lokal über den separaten Vite-Port `3002` ausgeliefert und über Playwright gegen denselben Devserver geprüft.
- Der Bootstrap-Pfad liest optionale Serverkonfiguration aus `PUBLIC_WASTE_CONFIG_JSON`; fehlende oder invalide Werte werden als expliziter Fehlerzustand statt als impliziter Runtime-Abbruch modelliert.
- Für die aktuelle Entwicklungsstufe läuft die öffentliche Bürgeroberfläche mit einer app-lokalen Demo-Runtime. Der spätere produktive Datenpfad über öffentliche Read-Endpunkte bleibt davon architektonisch getrennt.

### Fortschreibung 2026-06: Isolierter Releasepfad für die öffentliche Waste-Webversion

- Die produktive Waste-Webversion besitzt einen eigenen Node-Laufzeitpfad unter `apps/public-waste-calendar-web/src/server/**`; der Build erzeugt ein gekapseltes Artefakt aus statischen Assets plus kleinem HTTP-Server.
- Der produktive Stack läuft getrennt vom Studio-Stack als `web-waste-calendar` mit `deploy/portainer/docker-compose.public-waste.yml`.
- Das zugehörige Container-Image wird getrennt unter `ghcr.io/smart-village-solutions/public-waste-calendar-web:<tag>` gebaut; Studio-Image, Studio-Stack und Studio-Workflows bleiben unberührt.
- Die produktive Runtime-Konfiguration nutzt führend getrennte `PUBLIC_WASTE_*`-Variablen (`PUBLIC_WASTE_IMAGE_TAG`, `PUBLIC_WASTE_PUBLIC_HOST`, `PUBLIC_WASTE_BASE_URL`, `PUBLIC_WASTE_INSTANCE_ID`, `PUBLIC_WASTE_DATABASE_URL`, `PUBLIC_WASTE_SCHEMA_NAME`).
- `PUBLIC_WASTE_CONFIG_JSON` bleibt nur als lokaler oder kompatibilitätsbezogener Fallbackpfad erhalten und ist kein produktionsführender Betriebsvertrag.
- Der Releasepfad wird ausschließlich über Git-Tags `waste-web-vX.Y.Z` ausgelöst. GitHub baut damit nur das Waste-Web-Image und aktualisiert im Portainer-Stack ausschließlich `PUBLIC_WASTE_IMAGE_TAG`.
- Rollback folgt bewusst demselben einfachen Modell: vorigen SemVer-Tag in `PUBLIC_WASTE_IMAGE_TAG` eintragen und den Stack erneut deployen.

### Noch offen (Stand heute)

- HA-/Skalierungsdetails für produktiven Betrieb sind nur teilweise als ADR/Doku beschrieben
- Sichere externe Erreichbarkeit für Grafana oder alternative interne Zugriffswege sind noch kein Teil des Referenzprofils
- Redis-L2-Cache für Registry-Lookups ist Folgearbeit
- Der produktive Betriebsvertrag für installierte Plugin-Distributionen, Katalog-Persistenz und Artefaktablage ist architektonisch beschrieben, aber noch nicht umgesetzt

### Fortschreibung 2026-05: Verteilung der Plugin-Plattform v2

- Lokale Entwicklung bleibt als Source-Mode innerhalb des Monorepos oder über lokal verlinkte Packages möglich, darf aber keinen App-Code-Edit für zusätzliche Plugin-Imports voraussetzen.
- Veröffentlichte Plugins bestehen im Zielbild aus serialisierbarem Manifest und gebauten Artefakten; der Host aktiviert sie über einen Katalogzustand statt über Bundle-Neubau.
- App-Deploy und Plugin-Deploy werden damit getrennte betriebliche Veränderungen, auch wenn beide weiterhin denselben hostvalidierten Snapshot-Vertrag erfüllen müssen.

Referenzen:

- `compose.yaml` (lokale Entwicklung)
- `compose.monitoring.yaml`
- `deploy/portainer/docker-compose.yml` (Swarm-Referenzprofil)
- `docs/development/postgres-setup.md`
- `docs/guides/swarm-deployment-runbook.md`
- `docs/guides/instance-registry-local-development.md`
- `packages/server-runtime/src/server/bootstrap.server.ts`

### Ergänzung 2026-03: IAM-Admin-Integration

Für den produktiven Betrieb der Account-/Admin-UI sind zusätzlich erforderlich:

- Keycloak Service-Account `sva-studio-iam-service` mit Minimalrechten (`manage-users`, `view-users`, `view-realm`, `manage-realm`).
- Secret-Injektion für `KEYCLOAK_ADMIN_CLIENT_SECRET` über Secrets-Manager (nicht im Repository).
- Feature-Flags auf Backend-Seite:
  - `IAM_UI_ENABLED`
  - `IAM_ADMIN_ENABLED`
  - `IAM_BULK_ENABLED`
- Scheduler-Konfiguration für Rollen-Reconciliation:
  - `IAM_ROLE_RECONCILE_INTERVAL_MS`
  - `IAM_ROLE_RECONCILE_INSTANCE_IDS`
- Optional korrespondierende Frontend-Flags:
  - `VITE_IAM_UI_ENABLED`
  - `VITE_IAM_ADMIN_ENABLED`
  - `VITE_IAM_BULK_ENABLED`

Rollout-Reihenfolge:

1. Datenbankmigrationen (`0004` bis `0007`) ausrollen.
2. Keycloak-Service-Account inklusive `manage-realm` prüfen und Secret-Injektion verifizieren.
3. Backend mit Keycloak-Admin-Credentials deployen.
4. Feature-Flags initial auf `false` verifizieren (Kill-Switch).
5. Stufenweise aktivieren: UI -> Admin -> Bulk.
6. Geplanten Reconcile-Lauf aktivieren und Alerting gegen Drift-Backlog prüfen.
7. Separates IAM-Acceptance-Gate gegen die Zielumgebung ausführen und Bericht unter `docs/reports/` archivieren.

### Ergänzung 2026-07: Verteilung des lokalen Instanz-MCP

Der MCP-Prozess läuft lokal beim Operator und ist kein Dienst im Studio-Swarm. Jeder Root-Realm (`studio-dev`, `studio-staging`, `sva-studio`) hält einen eigenen Client `sva-studio-mcp` mit eigenem Secret und eigener Ziel-Audience. Secrets werden nur lokal per OS-Keychain oder nicht versionierter Konfiguration verteilt; Studio validiert JWTs über OIDC/JWKS und benötigt kein MCP-Client-Secret.

Der Rollout erfolgt `studio-dev` → `studio-staging` → `sva-studio`. Pro Stufe werden Read-only-Smoke, kontrollierte Testmutation, Challenge-geschützte Testmutation, Audit und OTEL geprüft. Ein Environment-Kill-Switch bleibt bis zur Freigabe aus. Rollback deaktiviert zuerst den Kill-Switch und widerruft Client/Credential; ein App-Rollback verwendet den vorherigen freigegebenen Image-Digest. Details stehen im [MCP-Betriebsleitfaden](../guides/studio-instance-mcp-betrieb.md).
