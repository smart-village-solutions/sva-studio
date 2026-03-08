# OPERATIONS & RELIABILITY REVIEW: IAM-Proposal (setup-iam-identity-auth)

**Reviewer:** Operations & Reliability Specialist  
**Review Date:** 21. Januar 2026  
**Status:** 🔴 **CRITICAL CONCERNS** – Deployment nicht empfohlen ohne Remediation  
**Leitfrage:** "Kann ein externer Dienstleister dieses System 24/7 stabil betreiben?" → **NEIN** (Status quo)

---

## 1. BETRIEBSREIFE-EINSCHÄTZUNG

### Gesamtbewertung: **🔴 LOW (Operability: 25%)**

| Dimension | Rating | Begründung |
|-----------|--------|-----------|
| **Installierbarkeit** | 🟡 Medium | Keycloak vorhanden, aber Deployment-Strategie nicht dokumentiert |
| **Deployment** | 🔴 Low | Keine Zero-Downtime-Strategie, Feature-Flag erwähnt aber nicht implementiert |
| **Monitoring & Observability** | 🔴 Low | Keine Metriken, Logging, oder Alerting-Strategie definiert |
| **Backup & Disaster Recovery** | 🔴 Low | Keine RTO/RPO-Ziele, kein Restore-Konzept dokumentiert |
| **Skalierung** | 🟡 Medium | Redis geplant, aber Sizing nicht definiert |
| **Update-Fähigkeit** | 🔴 Low | Keine Rollback-Strategie, keine Datenbank-Migrations-Safeguards |
| **Runbook-Verfügbarkeit** | 🔴 Low | Keine Incidents, Troubleshooting, Failover-Dokumentation |

---

## 2. KRITISCHE BETRIEBSRISIKEN & MITIGATIONEN

### RISK 1: Keycloak-Ausfallszenario → Kompletter Authentifizierungsausfall

**Severity:** 🔴 **CRITICAL**  
**Impact:** Kein Nutzer kann sich anmelden. Ganze Applikation ist unbrauchbar.

**Aktuelle Dokumentation:**
> "Local JWT cache (1h) + Grace Period"

**Probleme:**
1. **Grace Period nicht spezifiziert** – Was bedeutet "Grace Period"? 5 Minuten? 1 Stunde?
2. **Cache-Strategie unklar** – Wird ein lokal gecacheter Token neu validiert? Wie lange ist der gültig?
3. **No Fallback-Auth** – Wenn Keycloak ausfällt, können Benutzer sich nicht neu anmelden
4. **Keine Wartungsmodus-Integration** – CMS kann nicht in einen Read-Only-Modus wechseln

**Mitigation-Empfehlung:**
```yaml
Strategie: "Graceful Degradation"
1. Kurzzeitiger Keycloak-Ausfall (< 5 Min):
   - Cached JWT (TTL: 5 Min) als Fallback akzeptieren
   - Bestehende Sessions laufen weiter
   - Warnung in Logs & Monitoring

2. Längerer Ausfall (5–60 Min):
   - Read-Only-Modus aktivieren (via Feature-Flag)
   - Neue Logins blockiert, bestehende Sessions laufen
   - Benutzern eine "Maintenance"-Seite zeigen

3. Längerer Ausfall (> 60 Min):
   - Feature-Flag: Fallback zu lokaler Admin-Auth
   - Temporärer HTTP-Basic-Auth für admins
   - Session-Recovery nach Keycloak-Wiederherstellung

Implementierung:
- Keycloak Health-Check alle 30 Sek
- Exponential Backoff für Retry
- Circuit-Breaker bei wiederholten Fehlern
- Rollback zu Cached JWT (mit Warnung)

Runbook:
- operations/runbooks/keycloak-failover.md
```

---

### RISK 2: Redis Cache-Konsistenz & Permission-Staleness

**Severity:** 🟡 **HIGH**  
**Impact:** Benutzer mit alten Permissions können Aktionen durchführen, die ihnen nicht mehr erlaubt sind.

**Aktuelle Dokumentation:**
> "Cache-Invalidation bei Rollenänderungen (via Redis Pub/Sub)"
> "Cache-Miss Fallback zu DB"
> "TTL: 1 Stunde"

**Probleme:**
1. **1-Stunde TTL ist zu lang** – Wenn eine Rolle widerrufen wird, dauert es bis zu 60 Min, bis der Benutzer keinen Zugriff mehr hat
2. **Race Condition nicht adressiert** – Was passiert, wenn parallel eine Role geändert wird und eine Permission-Check anfrage läuft?
3. **Pub/Sub-Zuverlässigkeit** – Redis Pub/Sub ist nicht persistent. Im Netzwerk-Split könnte eine Invalidation verloren gehen
4. **Keine Konsistenz-Metriken** – Wie stellt man fest, dass ein Cache-Miss/Hit-Problem vorliegt?
5. **Fallback-Query Performance** – Bei Cache-Miss lädt die DB für jeden Request. Bei viele Cache-Misses = DoS-Vektor

**Mitigation-Empfehlung:**
```yaml
Verbesserung: "Strong Consistency"
1. TTL reduzieren:
   - Production: 15 Min (Tradeoff Consistency vs. DB-Load)
   - Alternative: Version-based Invalidation (Role-Version in Cache-Key)

2. Pub/Sub Zuverlässigkeit:
   - Implementierung: Redis Streams statt Pub/Sub (persistent Queue)
   - Message-Acknowledgement (ACK) für Invalidation-Events
   - Dead-Letter-Queue für failed Invalidations

3. Race Condition Handling:
   - Optimistic Locking auf role_permissions (mit version_id)
   - Cache-Key mit Permission-Version: iam:permissions:{userId}:{orgId}:v{version}
   - Bei Permission-Update → version++ → alte Cache-Keys auto-ungültig

4. Konsistenz-Monitoring:
   - Metrik: permission_cache_staleness (ms seit letztem Update)
   - Metrik: cache_invalidation_lag (Zeit bis Cache aktualisiert)
   - Alert: Wenn staleness > 30 Min für einen User

5. Fallback-Optimierung:
   - Batch-Loading von Rollen (nicht pro-request)
   - DB-Query mit Index auf (userId, organizationId)
   - Circuit-Breaker: Nach 10 Cache-Misses → Rate-Limit

Runbooks:
- operations/runbooks/cache-inconsistency-detection.md
- operations/runbooks/cache-invalidation-replay.md
```

---

### RISK 3: Datenbank-Migration Ohne Rollback-Plan

**Severity:** 🟡 **HIGH**  
**Impact:** Beim rollback nach failed migration → Datencorruption, Downtime

**Aktuelle Dokumentation:**
> "Migrations-Skripte (Flyway/Alembic)"
> (Aber: Keine spezifischen Migration-Strategien dokumentiert)

**Probleme:**
1. **Keine Zero-Downtime-Migration** – Wenn neue Spalten hinzugefügt werden (z.B. `organizational_level`), blockiert das bestehende Queries
2. **Kein Versioning** – Wie stellt man fest, welche Migration gerade aktiv ist?
3. **Keine Smoke-Tests nach Migration** – Wie validiert man, dass die Migration erfolgreich war?
4. **Fehlende Rollback-Tests** – Ist ein Rollback überhaupt getestet worden?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Safe Migrations"
1. Zero-Downtime Deployments:
   - Additive Changes zuerst (neue Spalten mit DEFAULT)
   - Code-Backward-Compatibility während Migration
   - Späteren Cleanup (Constraints, Defaults) in Separate Migration

   Beispiel Migration:
   ① Phase A (vor Code-Deploy): ALTER TABLE iam.organizations ADD COLUMN level INT DEFAULT 1;
   ② Code-Deploy: Application-Code ignoriert neue Spalte
   ③ Phase B (nach Code-Deploy): Application füllt level mit Daten
   ④ Phase C (Cleanup): Entferne DEFAULT, setze NOT NULL

2. Versionskontrolle & Tracking:
   - Migration-Version in fleaway_schema_history (Standard)
   - Pre-Deploy: Alle Migrationen (n) bis (n-2) müssen validated sein
   - Post-Deploy: Audit alle Migrationen

3. Smoke-Tests post-Migration:
   - Schema-Validierung (alle Tabellen, Spalten, Constraints existieren)
   - Data-Integrity-Checks (z.B. COUNT vor/nach Migration gleich)
   - Query-Performance-Test (SELECT * FROM iam.organizations; EXPLAIN ANALYZE)

4. Rollback-Strategie:
   - Nur Rollback zu n-1 erlaubt (nicht beliebig weit zurück)
   - Rollback-Test: Vor jedem Prod-Deploy mindestens 1x rehearsal in Staging
   - Undo-Script pro Migration dokumentiert

5. Monitoring während Migration:
   - DB-Connection-Pool Auslastung
   - Query-Performance (P95, P99 Latency)
   - Fehlerrate (Connection timeouts, etc.)

Runbook:
- operations/runbooks/migration-deployment.md
- operations/runbooks/migration-rollback.md
```

---

### RISK 4: Row-Level Security (RLS) Policy-Fehler → Data Leak

**Severity:** 🔴 **CRITICAL**  
**Impact:** Ein Benutzer sieht Daten von einer anderen Organisation. DSGVO-Violation.

**Aktuelle Dokumentation:**
> "RLS policies automatically filter rows"
> "Integration tests verify that User A (Org A) cannot query data from Org B"

**Probleme:**
1. **RLS ist komplex** – Eine falsche Policy und die Sicherheit ist weg
2. **Keine RLS-Policy-Linting** – Wie wird überprüft, dass die Policies korrekt sind?
3. **Keine Compliance-Audit-Trail** – Welche Policies sind aktuell aktiv?
4. **Stagingumgebung-Parity** – Sind die RLS-Policies in Staging identisch wie Production?
5. **Keine Regelmäßige RLS-Revalidation** – Wie stellt man fest, dass RLS nicht durchbrochen wurde?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Defense-in-Depth RLS"
1. RLS-Policy-Validierung:
   - RLS-Policy als Code (nicht nur SQL)
   - Test-Matrix: 3x3 (3 Users, 3 Orgs, 9 Kombinationen)
   - Negative Tests: Verify User A CANNOT query Org B data

   Beispiel Test:
   ```sql
   BEGIN;
   SET ROLE test_user_a;  -- User in Org A
   SELECT COUNT(*) FROM iam.accounts;  -- Should return 0 if RLS correct
   ROLLBACK;
   ```

2. RLS-Policy-Audit-Trail:
   - Alle RLS-Policies in Git versioniert
   - Policy-Changes erfordern 2x Code Review
   - Policy-Version + Deploy-Timestamp in Logs

3. Staging-Prod-Parity:
   - RLS-Policies sind 100% identisch in Staging & Prod
   - Weekly Automated Test: Deploy RLS aus Prod zu Staging, verify
   - Automated Diff-Check vor Production Deploy

4. Regelmäßige RLS-Revalidation:
   - Weekly Job: Stichproben-Test (10 Zufallsuser × 5 Orgs)
   - Automatische Alerts bei Anomalien (z.B. User sieht mehr Rows als erwartet)
   - Quarterly Manual Audit von RLS-Policies

5. Monitoring:
   - Metrik: queries_affected_by_rls (Pro DB-Session)
   - Alert: Wenn Query 0 Rows zurückgibt (könnte RLS-Bug sein)
   - Alert: Wenn >5000 Rows ohne RLS-Filterung returned (möglicher Leak)

Runbook:
- operations/runbooks/rls-validation.md
- operations/runbooks/rls-data-leak-recovery.md
```

---

### RISK 5: Permission-Check Performance Regression (< 50ms nicht erreicht)

**Severity:** 🟡 **HIGH**  
**Impact:** Ganze UI wird langsam. Benutzerfeeling: "Das System ist kaputt."

**Aktuelle Dokumentation:**
> "Performance-Anforderung: Permission-Checks < 50ms"
> "Redis-Cluster für Permission-Snapshot-Caching"
> "Batch-Loading von Rollen"

**Probleme:**
1. **Keine Performance-Tests dokumentiert** – Wie wird verifiziert, dass < 50ms erreicht wird?
2. **Keine DB-Query-Optimierung** – Ist der Index auf (userId, organizationId) ausreichend?
3. **Keine Load-Test-Anforderungen** – Wie verhält sich Permission-Check bei 1000 concurrent requests?
4. **Keine Baseline-Metriken** – Wo sind wir jetzt? (Ist heute schon < 50ms?)
5. **Keine SLO-Definition** – 50ms P95? P99? Average? Worst-Case?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Performance-Driven Operations"
1. Baseline-Messung:
   - Load-Test Phase 3 implementieren VOR Go-Live
   - Messparameter: P50, P95, P99, Max Latency
   - Test-Szenarien:
     * Single Permission-Check (Cached)
     * Single Permission-Check (Cache-Miss)
     * 100 concurrent Permission-Checks (mixed cache hit/miss)
     * Permission-Check mit tiefer Org-Hierarchie (5+ Levels)

2. SLO Definition:
   - Permission-Check P95 < 50ms (mit 95% confidence)
   - Cache-Hit P99 < 5ms
   - Cache-Miss P99 < 100ms
   - Permission-Aggregation < 200ms (für 10+ Roles)

3. Monitoring:
   - Real-Time Histogram: Permission-Check Latency (Prometheus)
   - Alert: Wenn P95 > 50ms für 5 Min
   - Alert: Wenn Cache-Hit-Rate < 70%
   - Dashboard: Permission-Check Heatmap (by User, by Organization)

4. Load-Testing kontinuierlich:
   - Weekly: Load-Test mit 100 concurrent requests
   - Monthly: Load-Test mit 1000 concurrent requests
   - Trend-Analyse: Ist Latenz stabil oder steigt sie?

5. Query-Optimierung Checklist:
   - [ ] Index auf (userId, organizationId) existiert
   - [ ] EXPLAIN ANALYZE für alle Queries done
   - [ ] N+1 Query-Problem ausgeschlossen
   - [ ] Sorting/Filtering auf Index-Spalten

Runbook:
- operations/runbooks/permission-check-performance.md
- operations/runbooks/cache-performance-tuning.md
```

---

### RISK 6: Fehlende Audit-Log Speicherungs-Strategie

**Severity:** 🟡 **MEDIUM** (aber wichtig für Compliance)  
**Impact:** Audit-Logs werden gelöscht, Compliance-Audit schlägt fehl.

**Aktuelle Dokumentation:**
> "Data-Retention-Policy (z.B. 2 Jahre)"
> "Audit-Log Export (CSV, JSON)"
> (Aber: Keine Backup-, Archivierung-, oder Conformance-Strategie)

**Probleme:**
1. **Keine Immutability-Garantie** – Können Audit-Logs verändert/gelöscht werden?
2. **Keine Archivierung-Strategie** – Wo landen Audit-Logs nach 2 Jahren?
3. **Keine Backup-Frequenz** – Wie oft werden Audit-Logs gebackupped?
4. **Keine Compliance-Zertifikation** – Erfüllt das die DSGVO / digitale Archivierung?
5. **Keine Long-Term-Retention** – Wie lange müssen Audit-Logs aufbewahrt werden?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Compliant Audit Logging"
1. Immutability:
   - activity_logs table: Nur INSERT & SELECT erlaubt, NO UPDATE/DELETE
   - Datenbank-Trigger: Prevent any UPDATE/DELETE
   - Application-Code: Keine Update/Delete-Operationen auf activity_logs

2. Archivierung:
   - After 1 Year: Export zu Cloud Storage (z.B. S3) mit Archive-Tag
   - Archive-Format: Compressed JSON-Lines (.jsonl.gz)
   - Archive-Signature: HMAC-SHA256 für Integrität
   - Archive-Verification: Weekly automated check

3. Backup-Strategie:
   - Daily: Incremental Backup von activity_logs
   - Weekly: Full Backup (separate Standort)
   - Monthly: Backup-Restore-Test (recovery time verification)

4. Long-Term Retention:
   - DSGVO Anforderung: Min 6 Jahre (für Kommunen)
   - Archivierungs-Policy: Nach 2 Jahren zu S3 Glacier (cold storage)
   - Destruction-Policy: Nach 6+ Jahren via Secure Deletion

5. Monitoring:
   - Metrik: activity_logs row count (trend)
   - Alert: Wenn activity_logs shrinks (zeigt falsche Deletions)
   - Alert: Wenn Archive-Backup fehlschlägt
   - Alert: Wenn Backup-Integrität-Check fehlschlägt

Runbook:
- operations/runbooks/audit-log-archival.md
- operations/runbooks/audit-log-retention-compliance.md
```

---

### RISK 7: Keine Rollout-Strategie & Feature-Flag-Management

**Severity:** 🟡 **HIGH**  
**Impact:** Fehler bei Go-Live → Ganze Applikation down, Kein schneller Rollback möglich.

**Aktuelle Dokumentation:**
> "Feature-Flag für IAM-Middleware (Default: OFF)"
> "Gradual Rollout (10% → 50% → 100% Users)"
> (Aber: Keine konkrete Feature-Flag-Implementierung, keine Canary-Strategie)

**Probleme:**
1. **Feature-Flag nicht implementiert** – Code erwähnt Flag aber nicht als echte Implementierung
2. **Keine Canary-Deployment-Strategie** – Wie werden 10% Users ausgewählt?
3. **Keine Rollback-Automation** – Wenn Fehler bei 10% Users, automatische Rollback?
4. **Keine Feature-Flag-Monitoring** – Welche Flags sind gerade aktiv?
5. **Keine Runbook für Feature-Flag-Ops** – Wie schalten Ops-Team den Flag um?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Controlled Rollout with Feature-Flags"
1. Feature-Flag-System:
   - Tool: LaunchDarkly oder ähnlich (centralizes Flag-Management)
   - Flag-Definition:
     * iam_authentication_enabled (Default: false)
     * iam_authorization_enabled (Default: false)
     * iam_permission_caching_enabled (Default: false)

2. Canary-Deployment:
   - Phase 0: 1% Internal Users (Ops, Dev)
   - Phase 1: 5% Beta Users (Voluntary)
   - Phase 2: 25% Early Adopters (Random)
   - Phase 3: 50% Users (Random)
   - Phase 4: 100% All Users

   Transition-Criteria zwischen Phasen:
   - Phase 1 → 2: 24h without critical errors
   - Phase 2 → 3: Error Rate < 0.1%, P95 Latency < 200ms
   - Phase 3 → 4: Error Rate < 0.01%, P99 Latency < 50ms

3. Automated Rollback:
   - Alert: Wenn Error Rate > 1% für einen User Segment
   - Alert: Wenn P99 Latency > 500ms
   - Automatic Action: Feature-Flag flip to previous version
   - Notification: Ops + On-Call Engineer

4. Feature-Flag-Monitoring:
   - Dashboard: "Currently Active Flags" (real-time)
   - Metric: "Flag Evaluation Latency" (should be < 5ms)
   - Audit Log: Every flag change + who changed it + when
   - Alert: Unexpected flag state change

5. Runbook:
   - How to manually flip a flag (WebUI + CLI)
   - How to rollback IAM after critical error
   - How to monitor flag propagation (should be < 30 sec)

Runbook:
- operations/runbooks/iam-feature-flag-management.md
- operations/runbooks/iam-canary-deployment.md
- operations/runbooks/iam-emergency-rollback.md
```

---

### RISK 8: Keine Notfall-Kommunikations-Prozesse

**Severity:** 🟡 **MEDIUM**  
**Impact:** Bei kritischem Fehler weiß das On-Call-Team nicht, was zu tun ist.

**Aktuelle Dokumentation:**
> (Keine Erwähnung von Incident-Response, Escalation, War-Room-Prozessen)

**Probleme:**
1. **Keine War-Room-Prozedur** – Wer wird angerufen? In welcher Reihenfolge?
2. **Keine Incident-Severity-Definition** – Wie wird "kritisch" definiert?
3. **Keine Kommunikations-Vorlage** – Was sagt man dem Management?
4. **Keine Communication-Cadence** – Alle 15 Min Update während Incident?

**Mitigation-Empfehlung:**
```yaml
Strategie: "Incident-Response Readiness"
1. Incident-Severity:
   - SEV-1 (Critical): Kein Nutzer kann sich anmelden, Keycloak komplett down
   - SEV-2 (High): 50%+ Nutzer betroffen, Permission-Cache konsistent fehlerhaft
   - SEV-3 (Medium): <50% betroffen, aber länger als 15 Min
   - SEV-4 (Low): Einzelne Nutzer, automatisch recovered

2. War-Room-Escalation (SEV-1/2):
   - Page: On-Call IAM Engineer + On-Call Database Engineer
   - Conference: All engineers (Slack Channel #iam-incident)
   - Manager: Notify Leadership (Slack + Email)
   - Communication: Update Status every 5 minutes

3. Communication-Template:
   - Initial: "We are investigating IAM authentication outage affecting [X%] users"
   - Ongoing: "Root cause identified. We are [action]. ETA [time]"
   - Resolved: "Issue resolved. Here's what happened [postmortem link]"

4. Runbook-Links in Alerts:
   - Every PagerDuty Alert links to relevant runbook
   - Alert Title: "[SEV-X] IAM: [Component] Failure - See runbook: [link]"

Runbook:
- operations/runbooks/incident-response-iam.md
- operations/runbooks/war-room-escalation.md
```

---

## 3. FEHLENDE RUNBOOKS & DOKUMENTATION

### Kategorie A: Deployment & Updates

| Runbook | Status | Priority |
|---------|--------|----------|
| `deployment-iam-phase1.md` | ❌ Missing | 🔴 CRITICAL |
| `deployment-iam-phase2.md` | ❌ Missing | 🔴 CRITICAL |
| `deployment-iam-phase3.md` | ❌ Missing | 🔴 CRITICAL |
| `rollback-iam-to-previous.md` | ❌ Missing | 🔴 CRITICAL |
| `feature-flag-management.md` | ❌ Missing | 🟡 HIGH |
| `keycloak-upgrade.md` | ❌ Missing | 🟡 HIGH |
| `redis-cluster-upgrade.md` | ❌ Missing | 🟡 HIGH |
| `postgres-migration-execute.md` | ❌ Missing | 🟡 HIGH |

### Kategorie B: Incident & Failover

| Runbook | Status | Priority |
|---------|--------|----------|
| `keycloak-failover.md` | ❌ Missing | 🔴 CRITICAL |
| `redis-cache-failover.md` | ❌ Missing | 🔴 CRITICAL |
| `database-failover.md` | ❌ Missing | 🔴 CRITICAL |
| `permission-cache-recovery.md` | ❌ Missing | 🟡 HIGH |
| `rls-policy-remediation.md` | ❌ Missing | 🟡 HIGH |
| `incident-response-war-room.md` | ❌ Missing | 🟡 HIGH |

### Kategorie C: Monitoring & Troubleshooting

| Runbook | Status | Priority |
|---------|--------|----------|
| `monitoring-dashboard-setup.md` | ❌ Missing | 🟡 HIGH |
| `permission-check-latency-tuning.md` | ❌ Missing | 🟡 HIGH |
| `cache-consistency-validation.md` | ❌ Missing | 🟡 HIGH |
| `audit-log-query-examples.md` | ❌ Missing | 🟡 HIGH |
| `debug-user-permissions.md` | ❌ Missing | 🟡 HIGH |
| `performance-baseline-retest.md` | ❌ Missing | 🟡 HIGH |

### Kategorie D: Maintenance & Compliance

| Runbook | Status | Priority |
|---------|--------|----------|
| `audit-log-archival.md` | ❌ Missing | 🟡 HIGH |
| `backup-restore-test.md` | ❌ Missing | 🟡 HIGH |
| `compliance-audit-preparation.md` | ❌ Missing | 🟡 HIGH |
| `rls-policy-audit.md` | ❌ Missing | 🟡 HIGH |
| `keycloak-account-cleanup.md` | ❌ Missing | 🟡 HIGH |

---

## 4. DEPLOYMENT-STRATEGIE BEWERTUNG

### Szenario: Production Go-Live von Phase 1

**Proposal-Strategie:**
```
Feature-Flag: iam_authentication_enabled (Default: OFF)
Gradual Rollout: 10% → 50% → 100%
```

**Bewertung: 🟡 Incomplete**

#### Kritische Lücken:

1. **Pre-Deployment Checkliste fehlt**
   ```
   ❌ Keycloak-Kapazität validiert?
   ❌ Redis Cluster Sizing done?
   ❌ Database Backups getest?
   ❌ Rollback-Prozedur durchgespielt?
   ❌ Alerting Rules in Production?
   ```

2. **No Parallel-Run Definition**
   - Wie lange laufen alte + neue Auth parallel?
   - Wie werden Inconsistenzen bei parallel logins gehandhabt?

3. **No Health-Check Definition**
   - Welche Health-Checks müssen grün sein VOR Rollout?
   - Wie lange beobachtet man Phase 10% vor Phase 50%?

4. **No Rollback Trigger Definition**
   - Error Rate > X% → Automatic Rollback?
   - Latency P99 > Y ms → Rollback?

**Verbesserte Deployment-Strategie:**

```yaml
Pre-Deployment:
  1. Code Review: 2x Approval erforderlich
  2. Type Checks: pnpm test:types PASSED
  3. Unit Tests: pnpm test:unit PASSED (> 90% Coverage)
  4. E2E Tests: Login, Logout, Token-Refresh Scenarios PASSED
  5. Load Tests: 100 concurrent users, P95 < 200ms
  6. Capacity Planning:
     - Redis: 8GB for 50k users (estimate)
     - Keycloak: 4CPU, 4GB RAM
     - Database: 10GB IAM schema
  7. Backup Verification: Recent backup restored & tested
  8. Rollback Test: Switch off feature-flag, verify graceful fallback

Deployment Phase 1: 1% Internal Users
  Duration: 24 hours
  Monitoring:
    - Alert: Error Rate > 1%
    - Alert: P99 Latency > 500ms
    - Alert: Cache-Hit-Rate < 50%
  Success Criteria:
    - 0 Critical Errors
    - Error Rate < 0.1%
    - P95 Latency < 200ms
  Advance to Phase 2 if all criteria met

Deployment Phase 2: 10% Beta Users (Opt-in)
  Duration: 48 hours
  Additional Monitoring:
    - Track login_success vs. login_failed rate
    - Alert: Failed Login Rate > 2%
  Rollback Condition:
    - If Error Rate > 0.5% → Immediate Rollback
    - Auto-notification: PagerDuty + Slack

Deployment Phase 3: 50% Users (Random Selection)
  Duration: 72 hours
  Same monitoring as Phase 2

Deployment Phase 4: 100% Users (All Users)
  After Phase 3 successful
```

---

## 5. NOTWENDIGE MONITORING & ALERTING

### 5.1 Monitoring-Infrastruktur

**Status: 🔴 Not Defined**

Erforderlich:

```yaml
Stack:
  - Metrics: Prometheus (for time-series data)
  - Tracing: Jaeger or similar (for distributed tracing)
  - Logging: ELK Stack or similar (for centralized logs)
  - Alerts: PagerDuty + Slack (for escalation)
  - Dashboard: Grafana (for visualization)
```

### 5.2 Kritische Metriken

| Metrik | Target | Alert | Grafana Dashboard |
|--------|--------|-------|-------------------|
| `auth_login_attempts_total` | N/A | N/A | "Auth Metrics" |
| `auth_login_success_rate` | > 99% | < 95% for 5 min | "Auth Metrics" |
| `auth_login_latency_p95` | < 1s | > 2s | "Auth Metrics" |
| `token_validation_latency_p95` | < 100ms | > 200ms | "IAM Performance" |
| `permission_check_latency_p95` | < 50ms | > 100ms | "IAM Performance" |
| `permission_cache_hit_rate` | > 85% | < 70% | "Cache Metrics" |
| `permission_cache_staleness_sec` | < 300 | > 600 | "Cache Metrics" |
| `database_query_latency_p99` | < 200ms | > 500ms | "Database" |
| `redis_memory_usage_bytes` | < 80% | > 90% | "Redis" |
| `rls_policy_evaluation_latency_p99` | < 50ms | > 100ms | "Security" |
| `audit_log_write_latency_p99` | < 100ms | > 200ms | "Audit" |
| `keycloak_health_status` | UP | DOWN | "Infrastructure" |

### 5.3 Recommended Dashboards

```yaml
Dashboard 1: "IAM System Health"
  - Key Status: Keycloak (UP/DOWN), Redis (UP/DOWN), DB (UP/DOWN)
  - Error Rate (last 1h)
  - Active Users (currently logged in)
  - Latency (P50, P95, P99)

Dashboard 2: "Authentication Flows"
  - Login Success/Failure Rate
  - Token Refresh Count
  - Session Duration Distribution
  - Geographic Distribution (IP-based)

Dashboard 3: "Authorization Performance"
  - Permission Check Latency (histogram)
  - Cache Hit/Miss Rate
  - Role Hierarchy Depth (max)
  - Permission Aggregation Time

Dashboard 4: "Audit & Compliance"
  - Recent Activity Log Events
  - Anomalous Login Attempts (from new IP, multiple failed)
  - Role Changes (auditable)
  - Organization Hierarchy Changes

Dashboard 5: "Resource Utilization"
  - Redis Memory Usage
  - Database Disk Usage (IAM schema)
  - Keycloak CPU/Memory
  - Connection Pool Utilization
```

---

## 6. SKALIERUNGS-ROADMAP

### Current State (Phase 1-3)
```
Users: 1-10k
Redis: Single Node (8GB)
Database: Single Instance (Postgres Supabase)
Keycloak: Single Instance
Permission Cache TTL: 1 hour
```

### Problem: Not Production-Ready für hohe Last

**Lücken:**
1. **Redis ist Single Node** → No HA, kein Failover
2. **Database ist Single Instance** → No Replicas für Read-Scaling
3. **Keycloak ist Single Instance** → Login-Bottleneck bei hoher Last
4. **No Horizontal Scaling Strategy** – IAM-Service kann auf meherer Instances laufen?

### Skalierungs-Roadmap für Q2-Q4 2026

```yaml
Q2 2026: Infrastructure HA
  - Redis: Migrate to Redis Sentinel (3x Nodes, 1 Master + 2 Replicas)
  - Database: Add Read Replicas (Postgres streaming replication)
  - Keycloak: Deploy 3x Instances with Load Balancer
  - Target: Support 50k concurrent users

Q3 2026: Horizontal Scaling
  - IAM-Service: Containerize (Docker), Kubernetes-ready
  - Auto-Scaling: HPA based on permission_check_latency_p95
  - Load Balancing: Nginx Ingress Controller
  - Target: Support 100k concurrent users, < 50ms P95 guaranteed

Q4 2026: Advanced Caching
  - Multi-Region Caching (Redis Cluster with Geo-replication)
  - Permission-Cache Preloading (background job)
  - Batch Permission-Checks (reduce individual queries)
  - Target: Support 500k concurrent users, < 30ms P95

Monitoring Additions:
  - Capacity Planning Dashboard (CPU, Memory, Network trends)
  - Cost Tracking (AWS/Infra costs per user)
  - SLA Tracking (99.9%, 99.95% targets)
```

---

## 7. DISASTER-RECOVERY-LÜCKEN

### Szenario 1: Keycloak komplett down (1+ Stunden)

**Recovery Time Objective (RTO):** < 1 Min (Auto-Failover) OR < 15 Min (Manual)  
**Recovery Point Objective (RPO):** < 5 Min (tägliche Backups)

**Current Plan:** 🔴 Not Documented

**Erforderlich:**

```yaml
Pre-Failure Prevention:
  1. Keycloak: 3x Deployment (Active-Active hinter Load Balancer)
  2. Regular Backup: nightly Keycloak config to S3
  3. Restore Test: monthly dry-run restore

Failure Response:
  1. Health-Check: Keycloak endpoint /auth/health every 30 sec
  2. Alert: If 3x consecutive failures → SEV-1
  3. Failover: Route traffic to Replica Keycloak
  4. Recovery: Fix original Keycloak, rejoin cluster

Post-Failure:
  1. Postmortem: Root cause analysis within 24 hours
  2. Prevention: Implement safeguards
  3. Training: Run incident drill quarterly
```

---

### Szenario 2: Redis Cache komplett corrupted

**RTO:** < 5 Min  
**RPO:** < 15 Min (permission cache can be regenerated)

**Current Plan:** 🔴 Not Documented

**Erforderlich:**

```yaml
Pre-Failure:
  1. Redis: Snapshot (RDB) every 5 minutes
  2. Redis: Append-Only-File (AOF) enabled
  3. Backup: Copy snapshots to S3 every hour

Failure Response:
  1. Detection: Redis Health-Check fails 3x
  2. Alert: SEV-1 Incident triggered
  3. Action: Flush Redis (FLUSHALL)
  4. Recovery: Code restarts and rebuilds cache on-demand

Post-Failure:
  1. Cache will be rebuilt gradually (Cache-Miss → DB Query → Cache-Populate)
  2. Database query may spike for 5-10 minutes (acceptable)
  3. Permission checks degrade to < 100ms (acceptable for short period)
```

---

### Szenario 3: Database corruption / Ransomware

**RTO:** < 1 Hour  
**RPO:** < 15 Min (hourly backups)

**Current Plan:** 🔴 Not Documented

**Erforderlich:**

```yaml
Pre-Failure:
  1. Database: Daily incremental backups (to S3)
  2. Database: Weekly full backups (separate region)
  3. Point-in-Time Recovery (PITR): 7 days retained
  4. Backup Encryption: AWS KMS
  5. Immutable Backups: Versioning enabled, no delete for 90 days

Failure Response:
  1. Detection: Data integrity check fails
  2. Alert: SEV-1 + Page all database engineers
  3. Isolation: Stop all writes to IAM schema
  4. Assessment: Determine point of corruption
  5. Recovery: Restore from most recent valid backup
  6. Validation: Run data integrity checks post-restore

Post-Failure:
  1. Missed audit-logs can be recovered from WAL (if available)
  2. Notify compliance/legal (DSGVO incident notification if needed)
  3. Implement database security enhancements
  4. Restore test drill quarterly
```

---

## 8. PERFORMANCE-TEST-ANFORDERUNGEN

### Pre-Production Test-Matrix

Alle Tests müssen **BEFORE** Production Go-Live durchgeführt werden:

```yaml
Test 1: Baseline Permission-Check Performance
  Scenario: Single user, permission-check hit cache
  Load: Sequential (1 request/sec)
  Duration: 5 minutes
  Success Criteria: P95 < 20ms, P99 < 50ms, 0 errors

Test 2: Cache-Miss Performance
  Scenario: Single user, cache-miss (Redis empty)
  Load: Sequential
  Duration: 5 minutes
  Success Criteria: P95 < 100ms, P99 < 200ms, 0 errors

Test 3: Token Validation Performance
  Scenario: Login flow (token validation)
  Load: Sequential
  Duration: 10 minutes
  Success Criteria: P95 < 500ms (including Keycloak latency)

Test 4: Concurrent Permission-Checks
  Scenario: 100 concurrent users, each doing 1 permission-check
  Load: 100 users for 5 minutes
  Success Criteria: P95 < 50ms, P99 < 100ms, Error Rate < 0.1%

Test 5: Concurrent Permission-Checks (High Load)
  Scenario: 500 concurrent users
  Load: 500 users for 5 minutes
  Success Criteria: P95 < 100ms, P99 < 200ms, Error Rate < 1%

Test 6: Organization Hierarchy Query
  Scenario: List all organizations in hierarchy (County → Municipalities → Districts)
  Load: Sequential, 1000+ orgs
  Success Criteria: < 500ms response time

Test 7: Cache Invalidation Latency
  Scenario: Role change → Permission cache invalidation → Next permission-check
  Load: 10 concurrent role changes + concurrent permission-checks
  Success Criteria: Cache invalidation < 5 seconds, subsequent check < 50ms

Test 8: Database Connection Pool Stress
  Scenario: Simulated spike in concurrent requests
  Load: Ramp from 10 to 500 concurrent requests over 5 minutes
  Success Criteria: Connection pool not exhausted, queuing acceptable

Test 9: Keycloak Load Test
  Scenario: Concurrent logins
  Load: 100 concurrent login requests
  Success Criteria: P95 < 1s, < 2% error rate

Test 10: Audit Log Write Performance
  Scenario: 1000 concurrent audit events
  Load: 1000 events/sec for 1 minute
  Success Criteria: < 1% loss, write latency P99 < 200ms
```

### Continuous Performance Testing (Post-Go-Live)

```yaml
Daily:
  - Synthetic test: Single permission-check latency
  - Alert if regression > 10% from baseline

Weekly:
  - Full load-test (Test 4 from matrix above)
  - Compare P95 latency trend
  - Alert if > 20% degradation

Monthly:
  - Full load-test with 500 concurrent users
  - Generate performance trend report
  - Capacity planning adjustment
```

---

## 9. BETRIEBS-CHECKLISTE: Go-Live Vorbereitung

### Pre-Deployment (1 Woche vor)

```yaml
❌ Infrastructure Setup:
   [ ] Keycloak instances running in HA config (3x)
   [ ] Redis cluster ready (3x nodes minimum)
   [ ] Database replicas running (read + write replicas)
   [ ] Load balancers configured for all components
   [ ] TLS/HTTPS certificates valid

❌ Monitoring & Alerting:
   [ ] Prometheus scraping all targets
   [ ] Grafana dashboards created (5x dashboards from section 5.3)
   [ ] PagerDuty integration configured
   [ ] Alert rules deployed (20+ rules)
   [ ] Slack integration ready
   [ ] Log aggregation (ELK/Datadog) active

❌ Backup & Disaster Recovery:
   [ ] Keycloak backups running (daily)
   [ ] Database backups tested (restore + verify)
   [ ] Redis snapshots enabled (5-min interval)
   [ ] S3 backup replication working
   [ ] RTO/RPO documented per component

❌ Documentation & Runbooks:
   [ ] All 15 runbooks from section 3 written & reviewed
   [ ] Post-incident runbook template created
   [ ] Escalation procedures documented
   [ ] On-call playbook created & distributed
   [ ] War-room process defined

❌ Testing:
   [ ] All 10 performance tests passed (from section 8)
   [ ] Load test result baseline documented
   [ ] Rollback procedure rehearsed (dry-run)
   [ ] Disaster recovery drill completed (restore from backup)
   [ ] E2E test suite passes (> 95% coverage)
```

### Deployment Day (Go-Live)

```yaml
6 Hours Before:
  [ ] Final code review passed
  [ ] All tests (unit, integration, e2e) green
  [ ] Backup of production database taken
  [ ] On-call team in Slack war-room
  [ ] Communication template prepared

2 Hours Before:
  [ ] Feature-flag (iam_authentication_enabled) still OFF
  [ ] All monitoring dashboards visible
  [ ] PagerDuty on-call alert test done
  [ ] Rollback procedure validated one more time

Deployment (Phase 0: 1% Internal Users):
  [ ] Feature-flag enabled for 1% of users
  [ ] Monitoring refresh rate: every 30 seconds
  [ ] Real-time Slack updates every 5 minutes
  [ ] Error Rate target: < 0.1%
  [ ] Watch for 2 hours

Checkpoint (after 2 hours):
  [ ] Error rate < 0.1%? → Continue to next phase
  [ ] Error rate > 0.5%? → Rollback immediately
  [ ] All health checks green? → OK to proceed
  [ ] Database replication lag < 100ms? → OK
  [ ] Redis memory healthy? → OK

Proceed to Phase 1 (5% Beta Users):
  [ ] Same monitoring intensity (30-sec refresh)
  [ ] Watch for 6 hours
  [ ] Decision: Continue to 10% or Rollback

Post-Deployment (24 hours after 100% rollout):
  [ ] All metrics stable?
  [ ] No surprise errors?
  [ ] Latency target maintained?
  [ ] Capacity headroom > 50%?
  [ ] Post-incident meeting scheduled (even if successful)
```

### Ongoing Operations (Nach Go-Live)

```yaml
Daily:
  [ ] Check critical metrics (via dashboard)
  [ ] Review error logs
  [ ] Verify backups completed

Weekly:
  [ ] Performance baseline test
  [ ] Runbook review & update
  [ ] Disaster recovery drill (30 min)
  [ ] Security audit (RLS policy check)

Monthly:
  [ ] Capacity planning review
  [ ] Cost analysis
  [ ] Compliance audit (audit log retention check)
  [ ] Post-incident review (if any incidents)

Quarterly:
  [ ] Full infrastructure health check
  [ ] Security penetration test
  [ ] Load test with increased concurrent users
  [ ] Upgrade feasibility study (Keycloak, Redis, Postgres)
```

---

## 10. EXECUTIVE SUMMARY & EMPFEHLUNGEN

### Status-quo: 🔴 NOT READY FOR PRODUCTION

**Bewertung nach 8 Dimensionen:**

| Dimension | Rating | Impact |
|-----------|--------|--------|
| Architecture | 🟢 Good | Solid design, but... |
| Security | 🟢 Good | RLS planned, but not tested |
| Performance | 🟡 Medium | 50ms target defined, but no load-tests |
| Scalability | 🟡 Medium | Redis caching planned, but no HA for Redis |
| Monitoring | 🔴 Critical | ZERO monitoring infrastructure |
| Disaster Recovery | 🔴 Critical | NO backup/restore procedures |
| Operations | 🔴 Critical | NO runbooks, NO incident procedures |
| Documentation | 🔴 Critical | Design doc exists, but operational doc missing |

---

### Empfehlung für Management

**Keine Production-Freigabe bis folgende Punkte erfüllt sind:**

1. **Monitoring & Alerting** (2-3 Wochen)
   - Prometheus + Grafana setup
   - 20+ alert rules configured
   - PagerDuty integration

2. **Runbook-Library** (2-3 Wochen)
   - 15 critical runbooks written
   - 2x peer review per runbook
   - On-call training completed

3. **Performance Baseline** (1-2 Wochen)
   - All 10 load tests executed & passed
   - Baseline metrics documented
   - Scaling strategy validated

4. **Disaster Recovery Procedures** (1-2 Wochen)
   - Backup/restore tested
   - RTO/RPO defined per component
   - Quarterly drill schedule

5. **Feature-Flag System** (1 Woche)
   - Implement LaunchDarkly or similar
   - Canary deployment automated
   - Automatic rollback on error rate spike

**Gesamtaufwand zur Produktionsreife: 4-6 Wochen**

---

### Frage: "Kann ein externer Dienstleister dieses System 24/7 betreiben?"

**Antwort: NEIN (heute nicht möglich)**

**Gründe:**
1. Keine Runbooks für Incident-Response
2. Keine Monitoring-Infrastruktur für Alerting
3. Keine Disaster-Recovery-Prozeduren
4. Keine Performance-Baseline-Tests
5. Keine Feature-Flag für sicheren Rollback

**Nach Remediation (4-6 Wochen): JA, mit Vorbehalt**
- External Ops-Team benötigt 2-3 Wochen Onboarding
- Weekly Sync mit Development-Team empfohlen
- Quarterly Review für Skalierungs-Anforderungen

---

## 11. PRIORITÄTS-ROADMAP ZUR PRODUKTIONSREIFE

### Sprint 1 (Woche 1-2): Monitoring & Observability Foundation
```
Priority: 🔴 CRITICAL
Tasks:
  1. Prometheus + Grafana deployment
  2. Define 25+ metrics (see section 5.2)
  3. Create 5 Grafana dashboards
  4. PagerDuty integration
  5. Slack alerting

Outcome: Real-time visibility into IAM system health
```

### Sprint 2 (Woche 3-4): Runbooks & Incident Response
```
Priority: 🔴 CRITICAL
Tasks:
  1. Write 15 critical runbooks (see section 3)
  2. Incident severity definitions
  3. On-call playbook
  4. War-room procedures
  5. Training for Ops team

Outcome: On-call engineers can handle 99% of incidents
```

### Sprint 3 (Woche 5-6): Performance & Reliability
```
Priority: 🟡 HIGH
Tasks:
  1. Execute all 10 load tests (section 8)
  2. Document baseline metrics
  3. Implement feature-flag system
  4. Canary deployment automation
  5. Rollback testing

Outcome: Production-ready, safe deployment procedure
```

### Sprint 4 (Woche 7-8): Disaster Recovery & Backups
```
Priority: 🟡 HIGH
Tasks:
  1. Backup procedures for all components
  2. Restore testing (dry-run)
  3. RTO/RPO documentation
  4. Disaster recovery drill
  5. Legal/Compliance sign-off

Outcome: Data safety & compliance verified
```

---

## 12. NOTIZEN FÜR OPERATIONS TEAM

### Was ist neu & komplex?

1. **Keycloak Integration** – Many moving parts (OIDC, Realms, Mappers)
2. **RLS Policies** – Database-level security, hard to debug if broken
3. **Redis Cache** – Distributed caching introduces consistency challenges
4. **Multi-Org Routing** – All queries must be scoped to organizationId

### Häufige Fehler (vorbeugen!)

1. **Forgetting organizationId in Query** → Data leak across orgs
2. **Cache not invalidated after role change** → User sees stale permissions
3. **Keycloak realm misconfigured** → Users can't login
4. **RLS policy order wrong** → Some queries bypass RLS
5. **Performance not tested** → Permission-check takes 500ms (not < 50ms)

### Training für On-Call Team

1. **Video:** "How IAM System Works" (5 min)
2. **Hands-on:** Debug permission-check latency (1 hour lab)
3. **War Game:** Simulate Keycloak outage (2 hour drill)
4. **Case Study:** Permission-cache stale issue (1 hour walkthrough)

---

## ANHANG: Detaillierte Mitigations-Strategien

### A1. Keycloak Failover Strategy (Detailed)

```yaml
Architecture:
  - 3x Keycloak Instances (Active-Active)
  - 1x PostgreSQL Backend (shared for all Keycloak instances)
  - 1x Load Balancer (Nginx) für Keycloak
  - Health-Check: /auth/health every 30 sec

Failure Scenario: Keycloak Instance 1 fails
  1. Health-check fails 3x consecutive times
  2. Load balancer removes Instance 1 from pool
  3. New requests route to Instance 2 or 3
  4. Existing user sessions (JWT-based) continue to work
  5. Alert: SEV-2 (degraded performance)
  6. On-call engineer investigates Instance 1

Recovery:
  1. Restart Instance 1 (or replace if hardware failed)
  2. Instance 1 rejoin Keycloak cluster
  3. Load balancer adds Instance 1 back to pool
  4. Verify health-check passing

Backup Plan: All Keycloak instances fail
  1. Alert: SEV-1 (all users can't login)
  2. Fall back to JWT grace period (1 hour)
  3. Users with valid JWT can still use system
  4. Restore Keycloak from backup (ETA 15 min)
  5. Or use temporary local auth (HTTP-Basic) for admins
```

### A2. Permission Cache Invalidation Flow (Detailed)

```yaml
Scenario: Admin changes User's role from "Redakteur" to "Prüfer"

Flow:
  1. Admin opens User Management UI
  2. Selects User "Anna"
  3. Clicks "Remove Role: Redakteur"
  4. Backend: DELETE FROM iam.account_roles WHERE accountId=anna, roleId=redakteur
  5. Backend: Publish to Redis Pub/Sub: "permission_invalidate:anna:orgId"
  6. Backend: Return success to frontend

Cache Invalidation:
  7. Redis Pub/Sub Consumer (listening on "permission_invalidate:*") receives event
  8. Consumer: DELETE Redis Key "iam:permissions:anna:orgId"
  9. Consumer: DELETE Redis Key "iam:roles:anna:orgId"
  10. Acknowledgement: Success log

Next Permission-Check (Anna tries to publish):
  11. Backend: canUserPerformAction(anna, "publish_news", ...)
  12. Backend: Check Redis for "iam:permissions:anna:orgId" → MISS (cache cleared)
  13. Backend: Query DB for Anna's current roles → ["Prüfer"]
  14. Backend: Query DB for "Prüfer" permissions → ["publish_news", "approve_news"]
  15. Backend: Compute result → TRUE (Prüfer can publish)
  16. Backend: Cache result in Redis with TTL 15 min
  17. Backend: Return TRUE to caller
  18. Anna can publish

Potential Issue: Pub/Sub message lost
  - Redis Pub/Sub is not persistent
  - If subscriber is down when message published → Message lost
  - Fix: Use Redis Streams (persistent queue) instead of Pub/Sub
  - Or: Use database-driven invalidation (poll for changes every 1 min)
```

---

## FAZIT

**Das IAM-Proposal hat eine solide technische Architektur, aber es ist NICHT bereit für Production-Betrieb ohne signifikante Operational-Enhancements.**

**Minimale Anforderungen für Production-Readiness:**
1. ✅ Complete monitoring & alerting infrastructure
2. ✅ Comprehensive runbook library
3. ✅ Load-testing & performance baseline
4. ✅ Disaster recovery procedures
5. ✅ Feature-flag & safe rollout strategy

**Geschätzter Aufwand: 4-6 Wochen Operational Engineering**

**Externe Dienstleister können das System nach Remediation betreiben, benötigen aber:**
- 2-3 Wochen Onboarding
- Weekly Sync mit Development-Team
- Quarterly Review für Scaling

---

**Review abgeschlossen:** 21. Januar 2026  
**Nächste Schritte:** Kickoff Sprint 1 (Monitoring & Observability)

