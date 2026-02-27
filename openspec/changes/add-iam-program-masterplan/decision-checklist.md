# IAM Entscheidungs-Checkliste (Must / Should / Could)

Ziel: Vor Umsetzung der Child-Changes die wesentlichen Architektur-, Security- und Betriebsentscheidungen verbindlich festlegen.

## Nutzung

- Pro Punkt genau eine Entscheidung dokumentieren.
- Offene Punkte mit Owner und Fälligkeitsdatum versehen.
- Master-Change gilt erst als umsetzungsbereit, wenn alle **Must**-Punkte entschieden sind.

## Beschlussstand (26.02.2026)

Die folgenden Einträge sind **bestätigte Entscheidungen** auf Basis von:

- `concepts/konzeption-cms-v2/03_Systemarchitektur/Umsetzung-Rollen-Rechte.md`
- `openspec/changes/setup-iam-identity-auth/*`
- `DEVELOPMENT_RULES.md`

Änderungen an diesen Entscheidungen erfolgen nur über explizites Update dieses Dokuments und der Masterplan-Spec.

---

## Must (vor Start Child A/B)

### 1) Zielumfang Phase 1
- Entscheidung: [ ] Nur Auth + Session + RBAC-Basis
- Entscheidung: [x] Zusätzlich Multi-Org-Context-Switch
- Entscheidung: [ ] Sonstiges: ____________________
- Vorschlag: Multi-Org-Switch früh aktivieren, damit Daten- und Rechtekontext von Anfang an konsistent ist.
- Owner: Produkt + Architektur
- Fällig am: vor Start Child B (`add-iam-core-data-layer`)

### 2) Permission-Kompositionsmodell und Seed-Defaults (7 Personas)
- Entscheidung: [x] Die konkrete Rechte-Matrix pro Persona ist zur Laufzeit über das SVA Studio konfigurierbar – keine statische Vorab-Freigabe nötig
- Vor Child C müssen folgende Teilentscheidungen stehen:
  - [x] Permission-Schema: Welche `action`-Typen und `resource_type`-Typen existieren → definiert in `Umsetzung-Rollen-Rechte.md` (Abschnitt 5.2)
  - [x] Aggregationsregel: Permissions additiv (OR) oder restriktiv (AND)? Konfliktauflösung bei Hierarchien? → als ADR dokumentiert (`docs/adr/ADR-012-permission-kompositionsmodell-rbac-v1.md`, 27.02.2026)
  - [x] 7 Default-Seed-Zuordnungen als initiale Konfiguration (nicht als unveränderliche Matrix) → Seeds in Child B
- Beschluss (26.02.2026): System-Rollen (7 Personas) werden als Seed-Defaults ausgeliefert. Mandanten-spezifische Custom-Rollen und die konkrete Permission-Zuordnung pro Persona sind zur Laufzeit konfigurierbar. Nur das Permission-Kompositionsmodell (Aggregation, Konfliktauflösung) muss architektonisch fixiert sein.
- Referenz-Dokument: `Umsetzung-Rollen-Rechte.md` (Abschnitt 5) – unterscheidet System-Rollen, Mandanten-Rollen und temporäre Rollen
- Owner: Architektur + Backend
- Fällig am: vor Start Child C (`add-iam-authorization-rbac-v1`) – erledigt (Aggregationsregel via ADR-012 fixiert)

### 3) Tenant-Kanon und Hierarchie
- Kanonischer Scope: [x] instanceId [ ] organizationId [ ] tenantId [ ] workspaceId
- Hierarchietiefe: [ ] 3 Ebenen fix [x] beliebig tief
- Cross-Tenant-Ausnahmen erlaubt: [ ] Nein [x] Ja, nur für `support_admin`-Impersonation mit strengen Gates
- Beschluss: Eine Instanz kann mehrere Organisationen enthalten; Benutzer werden innerhalb einer Instanz einer oder mehreren Organisationen zugeordnet.
- Beschluss: Modell flexibel halten (`parentOrganizationId` rekursiv), UI darf initial 3 Ebenen optimieren.
- Owner: Architektur + Datenmodell

### 4) Security-Gates
- Impersonation verpflichtend mit:
  - [x] Ticketpflicht
  - [x] Vier-Augen-Freigabe
  - [x] Maximaldauer (Minuten/Stunden): 120 Minuten (Vorschlag)
- PII in Logs:
  - [x] strikt minimiert/pseudonymisiert
  - [ ] partiell sichtbar (welche Felder): ____________________
- Vorschlag: Keine Klartext-PII in Audit-Details außer technisch notwendiger Referenz-IDs.
- Owner (Security): Security + DSB

### 5) Compliance-Vorgaben
- Audit-Retention: [x] 24 Monate (bestätigt, 26.02.2026) – der Wert MUSS konfigurierbar sein (Admin-Setting, nicht hardcoded)
- Lösch-/Sperrregeln (DSGVO): Soft-Delete + Sperrstatus für Betriebsnachweis, endgültige Löschung nach policy-gesteuerter Frist
- Nachweisformat für Audits: [x] CSV [x] JSON [x] SIEM-Export
- PII-Pseudonymisierungsstrategie: [x] bestätigt – Klartext-PII (E-Mail, IP, User-Agent) werden in Audit-Logs durch pseudonymisierte Referenzen ersetzt; Re-Identifikation nur durch autorisiertes Personal mit dokumentiertem Grund (siehe Leitplanke „PII-Pseudonymisierung")
- Owner (Legal/DSB): DSB + Legal

### 6) Performance- und Lastziele
- `authorize`-SLO: [x] P95 < 50 ms [ ] P99 < 50 ms [ ] anderer Wert: ____________________
- Lastprofil (RPS, Concurrent Users, Peak): initial 100 RPS, 500 concurrent, Peak-Faktor 3 (Vorschlag für Testbaseline)
- Owner (Plattform): Plattform + Backend

### 7) Eventing-Entscheidung für Cache-Invalidierung
- Primär: [x] Postgres NOTIFY [ ] Redis Streams [ ] Broker (NATS/Kafka)
- Fallback-Strategie: TTL-basierte Selbstheilung + periodisches Recompute kritischer Konten
- Vorschlag: NOTIFY zuerst für geringe Komplexität, später optional auf Broker migrierbar.
- Owner (Architektur): Architektur + Plattform

### 8) Rollout-Strategie
- Rollout: [x] Feature-Flags stufenweise [ ] Big Bang
- Parallelbetrieb Altpfad bis: Abschluss Child C + 1 Release-Zyklus Stabilisierung
- Harte Go-Live-Kriterien: Security-Tests grün, IAM-Regression grün, `authorize` P95 SLO erreicht, Audit-Nachweis exportierbar
- Owner (Produkt): Produkt + Tech Lead

### 8a) Operative Observability und Logging (Logging-Review 26.02.2026)
- SDK Logger Pflicht für alle IAM-Module: [x] Ja
- Beschluss: Alle IAM-Server-Module nutzen `createSdkLogger({ component: 'iam-<modul>' })` gemäß ADR-006. Kein `console.log` in IAM-Code.
- `workspace_id`-Mapping: [x] `workspace_id` === `instanceId`
- Beschluss (26.02.2026): In der Logging-Pipeline entspricht `workspace_id` dem kanonischen IAM-Scope `instanceId`. Alle IAM-Logger-Instanzen werden mit `{ workspace_id: ctx.instanceId, component: 'iam-...' }` initialisiert.
- Korrelations-IDs: [x] `X-Request-Id` + OTEL Trace-Context in allen IAM-APIs
- Dual-Write Audit-Events: [x] DB (`iam.activity_logs`) + OTEL-Pipeline (SDK Logger)
- Beschluss: Sicherheitsrelevante Audit-Events werden parallel in die DB und über den SDK Logger in die OTEL→Loki-Pipeline emittiert, um Echtzeit-Monitoring und Alerting zu ermöglichen.
- Log-Level-Konvention für IAM: [x] definiert
- Beschluss:
  - `error`: Systemfehler, RLS-Bypass-Versuche, Cache-Invalidierung fehlgeschlagen
  - `warn`: Token-Validierungsfehler, Authorize-Denials, Impersonation-Start/-Ende, fehlgeschlagene Logins
  - `info`: Erfolgreiche Logins, Account-Erstellung, Rollenänderungen
  - `debug`: Token-Refresh, Cache-Hit/Miss, Authorize-Allow
- Owner (Architektur): Architektur + Plattform
- Referenz: `docs/development/observability-best-practices.md`, `docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md`

---

## Should (vor Start Child C/D)

### 9) ABAC-Attributkatalog
- Pflichtattribute (z. B. Org, Geo, Zeitfenster, Acting-As) final definiert?
- Entscheidung: [ ] Ja [x] Nein
- Vorschlag: Finalisierung im Child D (`add-iam-abac-hierarchy-cache`) mit verpflichtendem Security-Review.
- Owner: Architektur + Security

### 9a) Datenklassifizierung für IAM-Entitäten
- Schutzlevel pro IAM-Datenart definiert und in Schema dokumentiert?
- Entscheidung: [x] Ja
- Beschluss (26.02.2026):
  - **Vertraulich:** Accounts (E-Mail, Credentials), Session-Daten, Audit-Logs mit PII-Referenzen
  - **Intern:** Organisationsmetadaten, Rollenzuordnungen, Hierarchiebeziehungen
  - **Öffentlich:** Rollennamen, Permission-Definitionen (Systemrollen)
- Schutzmaßnahmen: Vertraulich → Encryption at Rest (Column-Level), Intern → Zugriffsbeschränkung, Öffentlich → Standard-Schutz
- Owner: Architektur + DSB

### 10) Entscheidungsbegründungen (`reason`-Codes)
- Standardisierte Denial-/Allow-Gründe freigegeben?
- Entscheidung: [ ] Ja [x] Nein
- Vorschlag: reason-Codes als API-Vertrag in Child C einführen und in Child D erweitern.
- Owner: Backend + SDK

### 11) Betriebs- und Incident-Prozesse
- On-Call, Alarmierung, Runbook für IAM-Ausfälle definiert?
- Entscheidung: [ ] Ja [x] Nein
- Vorschlag: Runbook + Alarmkatalog bis Ende Child C, inkl. Cache-Stale- und Keycloak-Degradationspfad.
- Owner: Plattform

### 12) Datenmigration
- Migrationsstrategie für Bestandsnutzer und Rollen final?
- Entscheidung: [ ] Ja [x] Nein
- Vorschlag: JIT-Provisioning + Backfill-Job als duale Strategie, dry-run vor Produktivmigration.
- Owner: Daten + Backend

---

## Could (für Reifegrad nach Go-Live)

### 13) Policy-Simulation / Dry-Run
- Vorab-Prüfung von Policy-Änderungen ohne produktive Wirkung
- Entscheidung: [x] Geplant [ ] Nicht geplant

### 14) Self-Service Rollenberichte
- Organisationen können eigene Rollen-/Rechteberichte exportieren
- Entscheidung: [x] Geplant [ ] Nicht geplant

### 15) Realtime Permission Prewarming
- Proaktives Neuaufbauen kritischer Permission-Snapshots
- Entscheidung: [x] Geplant [ ] Nicht geplant

---

## Abschlusskriterium Masterplan

Master-Change kann in „bereit zur Umsetzung“ überführt werden, wenn:
- alle **Must**-Punkte entschieden sind,
- Owner benannt sind,
- und offene **Should**-Punkte mit Termin im jeweiligen Child-Change verankert wurden.
---

## Explizit deferred (außerhalb aktueller Entwicklungsphase)

Die folgenden Punkte werden bewusst auf einen späteren Zeitpunkt verschoben, da sie Keycloak-seitige Konfigurationen betreffen und kein Produktiv-Rollout geplant ist:

### D1) Keycloak-Härtung
- MFA-Enforcement für Admin-Personas (BSI IT-Grundschutz §3.1)
- Passwortrichtlinie (BSI: 12 Zeichen, Komplexität, 90-Tage-Ablauf)
- Session-Idle-Timeout (BSI: 30 Minuten Inaktivität)
- Account-Lockout nach 5 fehlgeschlagenen Versuchen
- Rate-Limiting auf Auth-Endpoints (WAF vs. App-Layer)
- Brute-Force-Detection in Keycloak-Realm
- **Trigger:** Wird adressiert, wenn Produktivbetrieb geplant wird

### D2) Keycloak-Version
- Festlegung auf eine spezifische LTS-Version
- **Trigger:** Wird adressiert, wenn Produktivbetrieb geplant wird

### D3) SAST/DAST/Container-Scans
- Bereits in bestehenden Issues referenziert: #18, #72
- **Trigger:** CI-Pipeline-Ausbau
