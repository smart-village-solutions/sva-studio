## 0. Vorarbeit (Bereits erledigt ✅)
- [x] 0.1 Unit-Tests für Session-Management geschrieben (33 Tests, alle grün)
- [x] 0.2 Cookie-Handling und Serialisierung getestet
- [x] 0.3 TanStack Router Set-Cookie Problem identifiziert und dokumentiert
- [x] 0.4 Integration-Tests für OAuth-Callback-Flow
- [x] 0.5 Redis docker-compose.yml & Dokumentation erstellt
- [x] 0.6 Redis Session Adapter implementiert (redis-session.server.ts)
- [x] 0.7 Auth-API auf async migriert (auth.server.ts)
- [x] 0.8 17 Redis Unit-Tests geschrieben (alle grün)

## 1. Foundation
- [x] 1.1 Redis-Setup für lokale Entwicklung definieren (Compose/Docs)
- [x] 1.2 Konfigurationsparameter (REDIS_URL, TLS, TTL) festlegen
- [x] 1.3 Session-ID-Transportpfad für den bestehenden Framework-Stack festlegen und absichern

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

## 5. Rollout-Basis
- [x] 5.1 Staging-Konfiguration auf `Self-Hosted Redis` festlegen
- [x] 5.2 Erstes Production-Betriebsmodell als `Single Redis mit Backup/Restore` festlegen

---

## 6. Security-Hardening
**Ref:** security-compliance-review.md - Phase 1

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

## 7. OpenSpec-Konsolidierung
- [x] 7.1 Delta-Spec auf das heutige `iam-core`-Session-Modell ausrichten
- [x] 7.2 Audit, GDPR, Redis-Health/Alerting und betriebliche Folgearbeiten im selben Change weiterführen und konsistent halten
- [x] 7.3 `openspec validate add-redis-session-store --strict` erfolgreich ausführen

## 8. Compliance & Audit
- [x] 8.1 Audit-Log-Service implementieren oder verbindlich spezifizieren
- [x] 8.2 Session-Events loggen (CREATE, ACCESS, DELETE, REVOKE)
- [x] 8.3 Login-State-Events loggen (CREATE, CONSUME, EXPIRE)
- [x] 8.4 Failed-Login-Events loggen
- [x] 8.5 Log-Retention und Archivierungsregeln festlegen

## 9. Monitoring & Operations
- [x] 9.1 Redis-Health-Checks für den Session-Store definieren oder implementieren
- [x] 9.2 Betriebsmetriken für Sessions und Redis-Verfügbarkeit festlegen
- [x] 9.3 Alerting-Regeln für Redis-Ausfall und auffällige Session-Muster festlegen
- [x] 9.4 Incident-Response- und Restore-Abläufe für den Single-Redis-Betrieb dokumentieren

## 10. Datenschutz & Löschanforderungen
- [x] 10.1 GDPR-konforme Session-Deletion und Login-State-Deletion festlegen
- [x] 10.2 Audit-Archivierung vs. Löschung sauber trennen
- [x] 10.3 Lösch- oder Compliance-Report-Anforderungen festlegen

## 11. Weiterentwicklung
- [x] 11.1 Späteres HA-Zielbild als mögliche Nachfolgeoption dokumentieren
- [x] 11.2 Post-Launch-Optimierungen für Sessions und Redis dokumentieren
