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

### 5. Neue SQL-Migrationen werden nach Redeploy nicht ausgeführt

**Symptom:** Das neue Image läuft, aber Tabellen oder Spalten fehlen.

**Prüfen:**

- ob ein bestehendes Postgres-Volume verwendet wird
- ob der bewusste Migrationsschritt durchgeführt wurde

**Typische Ursache:** `docker-entrypoint-initdb.d` läuft nur bei leerem Volume. Siehe `./swarm-deployment-runbook.md` und `../development/postgres-setup.md`.

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

### 11. App ist öffentlich erreichbar, Monitoring aber versehentlich ebenfalls

**Symptom:** Grafana oder Prometheus tauchen hinter Traefik auf.

**Prüfen:**

- öffentliche Netzwerke und Labels
- ob interne Monitoring-Services fälschlich ins Public-Netz gelegt wurden

**Typische Ursache:** Profilabweichung oder manuelle Compose-Anpassung außerhalb des Runbooks.

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

## Verweise

- Security-Meldungen: `./security-policy.md`
- Incident-Prozess: `./incident-response.md`
- Deployment-Überblick: `./deployment-overview.md`
- Swarm-Runbook: `./swarm-deployment-runbook.md`
