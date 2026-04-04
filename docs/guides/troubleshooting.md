# Troubleshooting

Dieses Dokument bündelt typische Störungen und schnelle Diagnosepfade für lokale Entwicklung, Tests und Swarm-Betrieb.

## Schnelle Ersttriage

1. Prüfen, welches Profil betroffen ist: lokal, Referenzprofil oder Demo-Profil.
2. Letzte Änderung identifizieren: Code, Image-Tag, Umgebungsvariable, Secret, Migration oder Infrastruktur.
3. Logs des betroffenen Dienstes und seiner direkten Abhängigkeiten prüfen.
4. Erst nach klarer Eingrenzung Folgearbeit als GitHub Issue erfassen.

## Konkrete Problemfälle

### 1. Login endet in Redirect-Loop

**Symptom:** `/auth/login` oder der OIDC-Rückweg springt wiederholt zwischen App und Identity Provider.

**Prüfen:**

- Redirect-URI und Callback-URL
- `AUTH_...`-Umgebungsvariablen oder Secrets
- Proxy-Header und externe Base-URL

**Typische Ursache:** Falsche Origin, falsch registrierte Redirect-URI oder inkonsistenter Demo-/Referenzprofil-Host.

### 1a. Tenant-Login landet immer im Root-Realm

**Symptom:** `https://<instanceId>.studio.../auth/login` landet am Ende auf dem Root-Realm oder Root-Callback.

**Prüfen:**

- externen Redirect von `/auth/login`
- internen Request im laufenden `studio_app`-Container mit explizitem `Host`
- `iam.instance_hostnames`
- `instanceId`-Claim im Token
- Protocol Mapper `instanceId` auf dem Client `sva-studio`

**Typische Ursache:** Kein App-/Resolver-Kontext, fehlender `instanceId`-Mapper oder falsch angebundener Tenant-Realm.

### 1b. Login geht in den richtigen Realm, aber Studio bleibt tenant-los

**Symptom:** Keycloak-Login funktioniert, `/auth/me` oder Session-Kontext hat aber keine `instanceId`.

**Prüfen:**

- User-Attribut `instanceId`
- Protocol Mapper `instanceId`
- Token-/Userinfo-Claims

**Typische Ursache:** `instanceId` nur als User-Attribut vorhanden, aber nicht als OIDC-Claim gemappt.

### 1c. Tenant-Login funktioniert erst nach Secret-Heilung im Studio

**Symptom:** `/auth/login` leitet bereits korrekt in den Tenant-Realm, der Callback oder der eigentliche Login endet aber trotzdem auf `?auth=error` oder faellt intern auf den globalen Secret-Pfad zurueck.

**Pruefen:**

- ob `pnpm env:migrate:studio` `0027_iam_instance_keycloak_bootstrap.sql` bereits angewendet hat
- ob `iam.instances.auth_client_secret_ciphertext` fuer den betroffenen Tenant gesetzt ist
- in Loki nach `tenant_auth_resolution_summary` suchen und auf diese Felder achten:
  - `secret_source`
  - `tenant_secret_configured`
  - `tenant_secret_readable`
  - `oidc_cache_key_scope`

**Sollzustand:**

- `secret_source=\"tenant\"`
- `tenant_secret_configured=true`
- `tenant_secret_readable=true`
- `oidc_cache_key_scope=\"tenant_secret\"`

**Typische Ursache:** Realm und Redirects stimmen bereits, aber Studio kennt das tenant-spezifische Client-Secret noch nicht und faellt deshalb auf `SVA_AUTH_CLIENT_SECRET` zurueck.

### 2. OIDC-State oder CSRF schlägt fehl

**Symptom:** Login startet, endet aber mit `state invalid`, Session- oder CSRF-Fehler.

**Prüfen:**

- App-Secret für State und Session-Verschlüsselung
- Redis-Erreichbarkeit
- Cookies, Domain und HTTPS-Kontext

**Typische Ursache:** Nicht gesetztes Secret, wechselnde Hostnames oder Redis-Probleme.

### 3. Redis startet, App meldet aber Auth- oder Session-Fehler

**Symptom:** App läuft, Sessions brechen jedoch sofort ab.

**Prüfen:**

- Redis-Passwort und Verbindung
- Netzwerk zwischen App und Redis
- Logs auf `NOAUTH`, Timeouts oder Verbindungsfehler

**Typische Ursache:** Secret oder Umgebungsvariable stimmt nicht mit der Redis-Konfiguration überein.

### 4. Postgres meldet `password authentication failed`

**Symptom:** Die App oder Initialisierung kann sich nicht mit Postgres verbinden.

**Prüfen:**

- `POSTGRES_PASSWORD` oder Swarm-Secret
- App-DB-Credentials
- ob das Volume schon mit anderen Zugangsdaten initialisiert wurde

**Typische Ursache:** Passwortwechsel bei bestehendem Volume ohne Neuinitialisierung.

Zusatz für `studio`:

- prüfen, ob sich `APP_DB_USER` tatsächlich gegen `POSTGRES_DB` anmelden kann
- ein grüner `schema-guard` beweist nicht, dass der Laufzeit-User `sva_app` existiert

### 5. Neue SQL-Migrationen werden nach Redeploy nicht ausgeführt

**Symptom:** Das neue Image läuft, aber Tabellen oder Spalten fehlen.

**Prüfen:**

- ob ein bestehendes Postgres-Volume verwendet wird
- ob der bewusste Migrationsschritt durchgeführt wurde
- ob `pnpm nx run data:db:migrate:status` bzw. `pnpm env:doctor:<profil>` den erwarteten `goose`-Stand anzeigen

**Typische Ursache:** `docker-entrypoint-initdb.d` läuft nur bei leerem Volume. Siehe `./swarm-deployment-runbook.md` und `../development/postgres-setup.md`.

Zusatz fuer `studio`:

- wenn neue Instanzverwaltungs- oder Keycloak-Bootstrap-Felder bereits im Live-Code verwendet werden, darf `0027_iam_instance_keycloak_bootstrap.sql` nicht mehr `Pending` sein
- ein manuell angelegtes Spaltenset heilt die Anwendung nur teilweise; fuer einen sauberen Betriebszustand muss Goose denselben Stand ebenfalls kennen

### 6. Monitoring-Dashboards oder Alerting-Regeln fehlen

**Symptom:** Grafana startet, aber Dashboards oder Datasources sind leer.

**Prüfen:**

- Logs von `monitoring-config-init`
- ob die Volumes geschrieben wurden
- Dateirechte und Mounts

**Typische Ursache:** Der Init-Container ist vorzeitig fehlgeschlagen. Im Sollzustand beendet er sich einmalig erfolgreich.

### 7. Prometheus, Loki oder Grafana bleiben unready

**Symptom:** Monitoring-Dienste laufen, aber Health-Checks schlagen fehl.

**Prüfen:**

- Reihenfolge nach dem einmaligen Monitoring-Bootstrap
- Speicher- und CPU-Ressourcen
- interne Service-Namen und Ports

**Typische Ursache:** Fehlende Konfigurationsdateien, zu frühe Health-Prüfung oder falscher Volume-Inhalt.

### 8. `pnpm test:types` schlägt lokal fehl, obwohl CI grün war

**Symptom:** Typfehler nur lokal.

**Prüfen:**

- aktive Node-Version gegen `.nvmrc` oder `.node-version`
- frische Installation mit `pnpm install`
- lokale Build-Artefakte oder generierte Dateien

**Typische Ursache:** Falsche Node-LTS oder veraltete lokale Artefakte.

### 9. `pnpm nx affected ...` findet keine Projekte

**Symptom:** Affected-Run läuft, aber ohne betroffene Targets.

**Prüfen:**

- `origin/main` aktualisieren
- ob Änderungen innerhalb erkannter Nx-Projekte liegen
- ob das Ziel-Target im Projekt definiert ist

**Typische Ursache:** Veraltete Base-Referenz oder Änderung nur in nicht gemappten Dateien.

### 10. `docker compose config` meldet Variablenwarnungen oder unerwartete Labels

**Symptom:** Compose lässt sich rendern, aber Platzhalter oder Routing wirken falsch.

**Prüfen:**

- alle erforderlichen Env-Variablen
- gewähltes Profil
- Traefik-Label-Variante des Profils

**Typische Ursache:** Demo-Profil und Referenzprofil verwenden bewusst unterschiedliche Label-Schemata.

Zusatz für Portainer/Quantum:

- Top-Level-`name:` kann im vorgerenderten Compose stören
- numerische `deploy.resources.limits.cpus` müssen ggf. als Strings serialisiert werden

### 11. App ist öffentlich erreichbar, Monitoring aber versehentlich ebenfalls

**Symptom:** Grafana oder Prometheus tauchen hinter Traefik auf.

**Prüfen:**

- öffentliche Netzwerke und Labels
- ob interne Monitoring-Services fälschlich ins Public-Netz gelegt wurden

**Typische Ursache:** Profilabweichung oder manuelle Compose-Anpassung außerhalb des Runbooks.

### 11a. `observability-readiness` ist rot

**Symptom:** `env:doctor:studio` oder `env:precheck:studio` meldet den Gate-Namen `observability-readiness` als `warn` oder `error`.

**Prüfen:**

- `ENABLE_OTEL` und `SVA_ENABLE_SERVER_CONSOLE_LOGS`
- ob die App `observability_ready` oder `observability_degraded` schreibt
- ob `~/.config/quantum/env` valide `SVA_GRAFANA_URL`, `SVA_LOKI_URL` und optional `SVA_GRAFANA_TOKEN` enthält
- ob frische `studio_app`-Logs in Loki sichtbar sind

**Typische Ursache:** Logger läuft ohne aktiven Transport, OTEL ist halb aktiviert oder Loki/Grafana-Zugang ist lokal nicht verfügbar.

### 11b. Loki zeigt nur Startup-Rauschen, aber keine verwertbaren App-Diagnoselogs

**Symptom:** Grafana/Loki ist erreichbar, aber tenant- oder auth-spezifische Logs fehlen.

**Prüfen:**

- ob `SVA_ENABLE_SERVER_CONSOLE_LOGS=true` im Live-Service wirklich ankommt
- ob die App meldet, dass keine Log-Transports aktiv sind
- ob aktuelle Container-Logs überhaupt in Loki landen

**Typische Ursache:** Observability-Zugriff ist vorhanden, aber die produktive Console-/Transport-Konfiguration der App ist nicht aktiv.

Praxisbeweis fuer `studio`:

- der Logging-Pfad gilt erst dann als wirklich brauchbar, wenn nach frischen Tenant-Probes sowohl `observability_ready` als auch `tenant_auth_resolution_summary` fuer `bb-guben` und `de-musterhausen` in Loki auftauchen
- nur allgemeine Startup-Logs reichen nicht als Auth-Diagnose

### 11c. Deploy-Report ist rot, obwohl der Stack faktisch gesund ist

**Symptom:** Report unter `artifacts/runtime/deployments/` endet auf `error`, aber Service-Spec, Tasks und externe Smokes sind grün.

**Prüfen:**

- laufende Tasks via `quantum-cli ps`
- tatsächliche Live-Service-Spec
- externe Health- und Login-Smokes
- bekannte `quantum-cli exec`-/Websocket-Flakes

**Typische Ursache:** False-Negative im Verify-/Transportpfad, nicht zwingend ein fehlgeschlagener Rollout.

### 12. E2E-Smoke-Test bricht vor dem eigentlichen Browserlauf ab

**Symptom:** `pnpm test:e2e` stoppt wegen fehlender Services.

**Prüfen:**

- Docker Engine
- Redis, Loki, OTEL Collector und Promtail lokal gestartet
- Playwright-Browser installiert

**Typische Ursache:** Unvollständiger lokaler Stack. Siehe `../development/app-e2e-integration-testing.md`.

## FAQ

**1. Darf ich Sicherheitsprobleme als normales GitHub Issue melden?**  
Nein. Dafür immer GitHub Private Vulnerability Reporting oder `security@smart-village.app` nutzen.

**2. Wohin gehen normale Betriebsstörungen?**  
An `operations@smart-village.app`, danach nur nicht-sensitive Nachverfolgung in GitHub.

**3. Welche Node-Version ist lokal verbindlich?**  
Die aktuelle LTS aus `.nvmrc` und `.node-version`.

**4. Warum startet `monitoring-config-init` nicht dauerhaft?**  
Weil der Dienst bewusst nur Konfiguration schreibt und danach erfolgreich beendet wird.

**5. Ist das ein Fehler, wenn `monitoring-config-init` auf `Completed` steht?**  
Nein. Das ist der Sollzustand.

**6. Warum nutzt das Demo-Profil andere Traefik-Labels?**  
Weil es bewusst Traefik-v1-kompatibel bleibt.

**7. Warum nutzt das Referenzprofil andere Traefik-Labels?**  
Weil es das kanonische Traefik-v2+-Betriebsprofil ist.

**8. Reicht ein Redeploy für neue Datenbankmigrationen?**  
Nein, bei bestehenden Volumes nicht.

**9. Wo steht der manuelle Migrationspfad für Swarm?**  
In `./swarm-deployment-runbook.md`.

**10. Wo steht der lokale Migrationspfad?**  
In `../development/postgres-setup.md`.

**11. Welche Tests muss ich vor einem Push mindestens laufen lassen?**  
Mindestens affected `test:unit`, bei Typänderungen zusätzlich affected `test:types`.

**12. Welche Tests sind vor einem finalen Merge verpflichtend?**  
`pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint` und `pnpm test:e2e`.

**13. Warum meldet ESLint nur Warnings, aber keinen Fehler?**  
Warnings blockieren nicht immer, sollten aber vor dem Merge bewertet werden.

**14. Was mache ich bei leerem `affected`-Ergebnis?**  
`git fetch origin main` ausführen und den Run wiederholen.

**15. Wo finde ich den reproduzierbaren E2E-Smoke-Test?**  
In `../development/app-e2e-integration-testing.md`.

**16. Wo finde ich die Coverage- und Gate-Regeln?**  
In `../development/testing-coverage.md`.

**17. Welche Dienste sind für den lokalen E2E-Stack Pflicht?**  
Mindestens Redis, Loki, OTEL Collector und Promtail.

**18. Wie erkenne ich ein Secret-Problem im Referenzprofil?**  
Meist über Auth-, Redis- oder Postgres-Fehler direkt nach dem Start.

**19. Wie erkenne ich ein Profilproblem zwischen Demo und Referenz?**  
An abweichenden Labels, Secrets und Routing-Annahmen.

**20. Wohin mit nicht-sensitiven Folgearbeiten nach einem Incident?**  
Als normales GitHub Issue, nachdem sensible Details entfernt wurden.

**21. Reicht für Tenant-Realm-Admins `instance_registry_admin`?**  
Nein. Das ist eine Plattformrolle. Für tenant-lokale Admin-Funktionen ist im Minimalfall `system_admin` maßgeblich.

**22. Reicht ein Keycloak-User-Attribut `instanceId` ohne Mapper?**  
Nein. Studio erwartet `instanceId` als OIDC-Claim.

## Verweise

- Security-Meldungen: `./security-policy.md`
- Incident-Prozess: `./incident-response.md`
- Deployment-Überblick: `./deployment-overview.md`
- Swarm-Runbook: `./swarm-deployment-runbook.md`
- Tenant-Realm-Bootstrap: `./keycloak-tenant-realm-bootstrap.md`
