## 0. Vorarbeit (Bereits erledigt ✅)
- [x] 0.1 Unit-Tests für Session-Management geschrieben (33 Tests, alle grün)
- [x] 0.2 Cookie-Handling und Serialisierung getestet
- [x] 0.3 TanStack Router Set-Cookie Problem identifiziert und dokumentiert
- [x] 0.4 Integration-Tests für OAuth-Callback-Flow
- [x] 0.5 Redis docker-compose.yml & Dokumentation erstellt
- [x] 0.6 Redis Session Adapter implementiert (redis-session.server.ts)
- [x] 0.7 Auth-API auf async migriert (auth.server.ts)
- [x] 0.8 17 Redis Unit-Tests geschrieben (alle grün)

## 1. Vorbereitung
- [x] 1.1 Redis-Setup für lokale Entwicklung definieren (Compose/Docs)
- [x] 1.2 Konfigurationsparameter (REDIS_URL, TLS, TTL) festlegen
- [x] 1.3 **Session-ID Transport-Mechanismus designen** (wegen Set-Cookie Problem)
  - ✅ Design-Dokument erstellt: session-transport-design.md
  - ✅ Lösung: SessionStorage + Custom Header + CSRF-Token
  - ✅ Sicherheits-Analyse durchgeführt
  - ✅ Testing-Strategie definiert

## 2. Implementierung
- [x] 2.1 Redis-Session-Adapter in packages/auth implementieren
- [x] 2.2 Session-API auf async umstellen (create/get/delete/update)
- [x] 2.3 Cookie-Transport fixen (Set-Cookie Reihenfolge)
- [x] 2.4 Logout/Revocation-Flow auf Redis umstellen

## 3. Qualität & Tests
- [x] 3.2 Redis Integration Tests (17 Tests, TTL, PKCE, Lifecycle)
- [x] 3.3 Integrationstest für Session-Persistenz (HMR/Restart mit Redis)
- [x] 3.4 **E2E-Test für Cookie-Transport** (OAuth-Login → Callback → Cookie gesetzt → /auth/me = 200)
- [x] 3.5 Security-Review durchführen (siehe SECURITY_REVIEW_COMPLETED.md) ✅ **READY FOR STAGING**

## 4. Betrieb
- [x] 4.1 Monitoring/Alerting-Anforderungen dokumentieren ✅ (monitoring-alerting-requirements.md)
- [x] 4.2 Backup/Restore-Runbook skizzieren ✅ (backup-restore-runbook.md)

## 5. Rollout
- [ ] 5.1 Staging-Konfiguration (Managed/Self-Hosted) festlegen
- [ ] 5.2 Production-HA-Variante (Sentinel/Cluster) definieren

---

## 6. Security & Compliance (VOR Staging-Deployment)
**Ref:** security-compliance-review.md - Phase 1 (Critical Fixes)

- [x] 6.1 **Redis TLS aktivieren** (CRITICAL)
  - [x] 6.1.1 TLS-Zertifikate generieren/beschaffen (Self-signed CA + Server-Cert)
  - [x] 6.1.2 redis.server.ts auf `rediss://` und TLS-Config umstellen
  - [x] 6.1.3 docker-compose.yml mit TLS-Volumes erweitern (Port 6380)

- [x] 6.2 **Redis ACL/Authentifizierung** (CRITICAL)
  - [x] 6.2.1 Redis-User mit minimalen Rechten anlegen (`~session:* ~login_state:*`)
  - [x] 6.2.2 Redis-Passwort in .env.example dokumentieren
  - [x] 6.2.3 Connection-String mit Credentials aktualisieren

- [x] 6.3 **Token-Verschlüsselung** (CRITICAL)
  - [x] 6.3.1 AES-256-GCM Encryption/Decryption-Helper implementieren
  - [x] 6.3.2 Session-Storage: Tokens verschlüsseln (accessToken, refreshToken, idToken)
  - [x] 6.3.3 Encryption-Key in .env.example dokumentieren
  - [x] 6.3.4 Key-Rotation-Strategie dokumentieren

- [x] 6.4 **Cookie-Transport-Problem lösen** (CRITICAL)
  - [x] 6.4.1 Set-Cookie Reihenfolge korrigieren (Delete → Session)
  - [x] 6.4.2 Session-Cookie im Callback verifiziert

## 7. Compliance & Audit (VOR Production-Deployment)
**Ref:** security-compliance-review.md - Phase 2

- [ ] 7.1 **Audit-Logging**
  - [ ] 7.1.1 Audit-Log-Service implementieren (PostgreSQL/Supabase)
  - [ ] 7.1.2 Session-Events loggen (CREATE, ACCESS, DELETE, REVOKE)
  - [ ] 7.1.3 Login-State-Events loggen (CREATE, CONSUME, EXPIRE)
  - [ ] 7.1.4 Failed-Login-Events loggen
  - [ ] 7.1.5 Log-Retention konfigurieren (6-12 Monate)

- [ ] 7.2 **Session-Revocation-API**
  - [ ] 7.2.1 `revokeSession(sessionId, reason)` implementieren
  - [ ] 7.2.2 `revokeAllUserSessions(userId)` implementieren
  - [ ] 7.2.3 `logoutEverywhere(userId)` implementieren
  - [ ] 7.2.4 Admin-UI für Session-Management (optional)

- [ ] 7.3 **GDPR-Compliance**
  - [ ] 7.3.1 `deleteAllUserData(userId)` API implementieren
  - [ ] 7.3.2 Session-Deletion garantieren (nicht nur TTL)
  - [ ] 7.3.3 Login-State-Deletion
  - [ ] 7.3.4 Audit-Logs archivieren (nicht löschen!)
  - [ ] 7.3.5 GDPR-Deletion-Report generieren

- [ ] 7.4 **Session-TTL-Optimierung**
  - [ ] 7.4.1 Sliding-Window-TTL implementieren (30 Min Inaktivität)
  - [ ] 7.4.2 `refreshSessionActivity()` bei jedem Request
  - [ ] 7.4.3 Max-Session-Lifetime auf 24h reduzieren (statt 7 Tage)
  - [ ] 7.4.4 Inaktivitäts-Timeout konfigurierbar machen

## 8. Monitoring & Operations (VOR Production-Deployment)
**Ref:** security-compliance-review.md - Phase 2

- [ ] 8.1 **Health-Checks**
  - [ ] 8.1.1 `/health/redis` Endpoint implementieren
  - [ ] 8.1.2 Redis-Connection-Status prüfen
  - [ ] 8.1.3 Active-Sessions-Count im Health-Check
  - [ ] 8.1.4 Error-Reporting bei Health-Check-Failure

- [ ] 8.2 **Prometheus-Metriken** (optional, aber empfohlen)
  - [ ] 8.2.1 `sessions_created_total` Counter
  - [ ] 8.2.2 `sessions_active` Gauge
  - [ ] 8.2.3 `session_operation_duration_seconds` Histogram
  - [ ] 8.2.4 `redis_connection_errors_total` Counter

- [ ] 8.3 **Alerting-Regeln**
  - [ ] 8.3.1 Redis-Down-Alert konfigurieren
  - [ ] 8.3.2 High-Session-Creation-Rate-Alert (möglicher Angriff)
  - [ ] 8.3.3 Session-Operation-Latency-Alert
  - [ ] 8.3.4 SIEM-Integration dokumentieren (optional)

## 9. Dokumentation & Runbooks
- [ ] 9.1 Security-Best-Practices dokumentieren
- [ ] 9.2 Incident-Response-Runbook (Redis-Ausfall, Session-Leak)
- [ ] 9.3 Backup/Restore-Prozedur für Redis (AOF/RDB)
- [ ] 9.4 Disaster-Recovery-Plan
- [ ] 9.5 Compliance-Checkliste (BSI IT-Grundschutz, DSGVO)

## 10. Post-Launch-Optimierungen
- [ ] 10.1 Hybrid-Ansatz: Redis (Hot) + DB (Cold) für Audit-Trail
- [ ] 10.2 Token-Refresh-Strategie optimieren (Keycloak als Single Source)
- [ ] 10.3 Framework-Migration evaluieren (Cookie-Problem langfristig)
- [ ] 10.4 Penetration-Test durchführen
- [ ] 10.5 Performance-Tuning (Redis-Cluster, Connection-Pooling)n
- [ ] 5.2 Production-HA-Variante (Sentinel/Cluster) definieren
