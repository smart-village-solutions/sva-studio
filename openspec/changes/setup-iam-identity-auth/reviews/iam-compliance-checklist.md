# 🔍 COMPLIANCE-CHECKLIST: IAM-System für Kommunen

**Verwendung:** Vor jeder Phase-Freigabe diese Checkliste durchgehen.  
**Gültig für:** DSGVO, BSI C5:2020, CRA (Cyber Resilience Act)  
**Zuletzt aktualisiert:** 21. Januar 2026

---

## 📋 DSGVO-COMPLIANCE

### Phase 1: Authentifizierung

#### Rechtliche Grundlage (Art. 6 DSGVO)

- [ ] **Art. 6(c)** dokumentiert: "Rechtliche Verpflichtung – Identitätsverwaltung ist Aufgabe der Kommune"
- [ ] **Art. 6(f)** dokumentiert: "Berechtigtes Interesse – CMS-Betrieb und Governance erfordern Benutzer-Authentifizierung"
- [ ] **Datenschutzerklärung** nennt explizit: "Bei Login werden folgende Daten verarbeitet: Email, Name, Benutzer-ID, Rollen"

#### Einwilligung (Art. 7 DSGVO)

- [ ] **First-Login-Consent:** Nutzer sieht "Ich stimme der Datenschutzerklärung zu"
- [ ] **Consent-Logging:** Akzeptanz wird in `iam.activity_logs` mit Timestamp geloggt
- [ ] **Widerrufsrecht:** Nutzer kann Consent widerrufen (→ Minimal-Modus: nur sub + email)
- [ ] **Consent-Ablauf:** Alle 12 Monate muss Nutzer neu zustimmen

#### Datenminimierung (Art. 5 Abs. 1 b DSGVO)

- [ ] **JWT-Claims:** Nur notwendige Daten im Token (sub, email, roles, org_id)
- [ ] **Keine Tracking-Daten:** Browser-History, Geolocation NOT im Token
- [ ] **Optionale Claims:** Role/Org können opt-out werden (für datenschutzbewusste Nutzer)

---

### Phase 2: Organisationen & Multi-Tenancy

#### Datenschutz durch Technik (Art. 32 DSGVO)

- [ ] **Row-Level-Security** auf alle CMS-Tabellen angewendet (organisationId-Filter)
- [ ] **RLS-Tests:** Integration-Tests prüfen, dass User A keine Daten von Org B sieht
- [ ] **Encryption in Transit:** HTTPS erzwungen (Strict-Transport-Security Header)
- [ ] **Encryption at Rest:** Supabase-Konfiguration hat "Encryption at Rest" enabled

#### Datenexport (Art. 15, 20 DSGVO – Betroffenenrechte)

- [ ] **API-Endpoint:** `GET /api/user/export` liefert alle persönlichen Daten
- [ ] **Format:** JSON oder CSV, maschinenlesbar
- [ ] **Inhalt:** Alle Accounts, Org-Memberships, Roles, Activity-Logs des Benutzers
- [ ] **Zeitlimit:** Export innerhalb 30 Tagen verfügbar

#### Datenlöschung (Art. 17 DSGVO – Recht auf Vergessenheit)

- [ ] **Self-Service:** Nutzer kann über `DELETE /api/user/me` Löschung anfordern
- [ ] **Admin-Interface:** Admin kann Nutzer löschen (mit Audit-Log)
- [ ] **30-Tage-Frist:** Löschung findet mit 30-Tagen-Verzögerung statt (Widerrufs-Möglichkeit)
- [ ] **Cascade-Löschung:**
  - [ ] `iam.accounts` → gelöscht
  - [ ] `iam.account_roles` → gelöscht
  - [ ] `iam.account_organizations` → gelöscht
  - [ ] `iam.activity_logs` → anonymisiert (user_id → NULL, email → "deleted-<hash>")
- [ ] **Löschbestätigung:** Email an Nutzer mit Bestätigung

#### Beschränkung der Verarbeitung (Art. 18 DSGVO)

- [ ] **Opt-Out-Option:** Nutzer kann "Verarbeitung einschränken" (→ Account bleibt, aber inaktiv)
- [ ] **Flagging:** `iam.accounts.processing_restricted = true`
- [ ] **Enforcement:** Inaktive Accounts können sich nicht anmelden

#### Widerspruchsrecht (Art. 21 DSGVO)

- [ ] **Widerspruch zur Verarbeitung:** Nutzer kann widersprechen (ähnlich wie Opt-Out)
- [ ] **Rechtliche Prüfung:** Wenn Widerspruch, kann Benutzer dennoch CMS nutzen (Art. 6(c) = zwingende Rechtsgrundlage)?
  - [ ] Falls JA: Verarbeitung erzwungen (dokumentieren)
  - [ ] Falls NEIN: Verarbeitung gestoppt, Account inaktiv

---

### Phase 3: Rollen, Permissions & Audit

#### Audit-Logging (Art. 5 Abs. 1 f DSGVA – Rechenschaftspflicht)

- [ ] **Immutable Logs:** `iam.activity_logs` hat `ADD CONSTRAINT no_update` (nur INSERT/SELECT)
- [ ] **Audit-Trail:** Alle IAM-Events geloggt:
  - [ ] Login/Logout
  - [ ] Role-Assignment
  - [ ] Permission-Changes
  - [ ] Account-Creation/Deletion
  - [ ] Organization-Changes
  - [ ] Consent-Events
  - [ ] Export/Deletion-Requests
- [ ] **Zeitstempel:** Alle Events mit UTC-Timestamp
- [ ] **Actor-Tracking:** Wer hat was getan (actor_id + email)
- [ ] **Context:** IP-Adresse, User-Agent (optional, für Sicherheits-Analyse)

#### Datenschutz-Folgenabschätzung (Art. 35 DSGVO – DPIA)

- [ ] **DPIA durchgeführt:** Risiken für Betroffenenrechte bewertet
- [ ] **High-Risk-Mitigation:** Wenn High-Risk, wurden Maßnahmen definiert
- [ ] **Documentation:** DPIA-Report existiert, Datenschutzbehörde notifiziert (wenn erforderlich)

#### Datenverarbeitungsvertrag (Art. 28 DSGVO)

- [ ] **DPA mit Keycloak-Hoster:** Wenn Keycloak hosted (z.B. Cloud-Provider)
- [ ] **DPA mit DB-Provider:** Wenn Supabase/Cloud-Postgres
- [ ] **Subprocessor-Addendum:** Alle Drittanbieter gelistet

#### Datenschutzmitteilungen (Art. 33, 34 DSGVO)

- [ ] **Incident-Response-Plan:** Falls Sicherheitsvorfall:
  - [ ] Meldung an Datenschutzbehörde innerhalb 72h
  - [ ] Benachrichtigung Betroffener "ohne ungebührliche Verzögerung"
- [ ] **Sicherheitsteam:** Hat Kontakt zu Datenschutzbeauftragten

#### Retention-Policy (Art. 5 Abs. 1 e DSGVA – Speicherbegrenzung)

- [ ] **Audit-Log-Retention:** 2 Jahre (für Forensics, dann anonymisiert/gelöscht)
- [ ] **Session-Logs:** 90 Tage (dann gelöscht)
- [ ] **Backup-Retention:** Altes Backups nach 2 Jahren löschen
- [ ] **Automation:** Cron-Job führt `DELETE FROM iam.activity_logs WHERE created_at < now() - interval '2 years'` aus

#### Transparenz & Info-Pflichten (Art. 13, 14 DSGVO)

- [ ] **Datenschutzerklärung:** Enthält Punkt "IAM-System"
  - [ ] Was wird verarbeitet? (Email, Name, Rollen, Orgs)
  - [ ] Wer verarbeitet? (Kommune, Keycloak-Hoster, DB-Provider)
  - [ ] Warum? (Betrieb des CMS, Governance)
  - [ ] Wie lange? (Retention-Policy)
  - [ ] Welche Rechte? (Access, Rectification, Erasure, etc.)

---

## 🛡️ BSI C5:2020 COMPLIANCE

### C5:2.2 – CSRF-Protection

- [ ] **Double-Submit-Cookie:** CSRF-Token in Cookie + Header
- [ ] **State-Changing Operations:** POST/PUT/DELETE haben CSRF-Checks
  - [ ] Role-Assignment
  - [ ] Permission-Changes
  - [ ] Organization-Management
  - [ ] Account-Updates
- [ ] **Exception:** GET-Requests haben keine CSRF-Checks (read-only)
- [ ] **Tests:** Explizite Tests für CSRF-Bypass-Versuche

### C5:2.3 – Authentifizierung (Authentication)

- [ ] **Multi-Factor-Auth (MFA):**
  - [ ] System-Administratoren: **Mandatory MFA** (TOTP or SMS)
  - [ ] App-Manager: **Recommended MFA**
  - [ ] Redakteur: Optional MFA
- [ ] **OIDC mit PKCe:** Implementiert (nicht Implicit Flow)
- [ ] **Token-Validation:** RS256-Signatur prüft Keycloak-Public-Key
- [ ] **Token-Storage:** HttpOnly Cookies (nicht localStorage)

### C5:4.3 – Account Lockout (Brute-Force-Schutz)

- [ ] **Fehlgeschlagene Login-Attempts:** Gezählt im Keycloak
- [ ] **Account-Lockout-Policy:**
  - [ ] 5 failed attempts → 30-Minuten-Lockout
  - [ ] Nach 30m: Automatisch unlock (oder exponential: 2h, permanent)
- [ ] **Captcha:** Nach 3 failed attempts
- [ ] **Alerting:** Alert wenn > 10 failed attempts in 1h
- [ ] **Logging:** Alle fehlgeschlagenen Versuche in activity_logs

### C5:4.4 – Session Timeout

- [ ] **Access-Token-Lifespan:** 15 Minuten
- [ ] **Refresh-Token-Lifespan:** 7 Tage (oder 30 Tage mit MFA)
- [ ] **Idle-Session-Timeout:** 30 Minuten (auto-logout)
- [ ] **Absolute-Session-Max:** 8 Stunden
- [ ] **Warning:** 2 Minuten vor Ablauf: "Session läuft ab" Nachricht
- [ ] **UI-Handling:** Nach Logout: Cookies gelöscht, User auf Login-Page

### C5:4.5 – Encryption in Transit

- [ ] **HTTPS:** Auf allen Endpoints erzwungen (HTTP → 301 zu HTTPS)
- [ ] **TLS-Version:** Minimum TLS 1.2 (besser 1.3)
- [ ] **Certificate:** Gültig, nicht selbst-signiert (außer Dev)
- [ ] **Security-Headers:**
  - [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-XSS-Protection: 1; mode=block` (veraltet, aber harmlos)

### C5:4.6 – Secrets Management

- [ ] **Client-Secret-Storage:** NIEMALS im Source-Code
- [ ] **Development:** .env (mit .gitignore)
- [ ] **Production:** AWS Secrets Manager / HashiCorp Vault / Azure Key Vault
- [ ] **Env-Vars:** Zeigen nur auf Vault-URL, nicht auf Secret
- [ ] **Rotation:** Alle 90 Tage (automatisiert)
- [ ] **Audit-Logging:** Wer hat Secret zugegriffen? (Access-Logs)

### C5:5.1 – Audit Logging

- [ ] **Immutable Logs:** `iam.activity_logs` mit Constraints gegen Updates
- [ ] **Logging-Scope:**
  - [ ] Authentifizierungsereignisse (Login, Logout, 2FA)
  - [ ] Autorisierungsereignisse (Permission-Checks, Denials)
  - [ ] Administrative Aktionen (Role-Assignment, Account-Deletion)
  - [ ] Sicherheitsereignisse (Failed Logins, Account-Lockout)
- [ ] **Log-Inhalte:** timestamp, event_type, actor, subject, result, details
- [ ] **Retention:** Mindestens 1 Jahr (empfohlen: 2 Jahre)

### C5:5.2 – Integrity Monitoring (Log-Tamper-Detection)

- [ ] **Hash-Chaining:** Jeder Log-Entry hat SHA256-Hash des vorherigen
- [ ] **Verification-Function:** `SELECT verify_audit_log_integrity()` prüft Kette
- [ ] **Alerts:** Bei Mismatch sofort Alert an Security-Team
- [ ] **Backup:** Audit-Logs in unveränderliches Backup (z.B. AWS S3 mit MFA-Delete)

---

## 🔐 CRA (CYBER RESILIENCE ACT) – EU 2024

### Secure by Design

- [ ] **Threat-Modelling:** STRIDE-Analyse für IAM durchgeführt
  - [ ] Spoofing: Token-Forging (mitigiert durch RS256)
  - [ ] Tampering: Log-Modification (mitigiert durch Immutability)
  - [ ] Repudiation: Denial of Action (mitigiert durch Audit-Logs)
  - [ ] Information Disclosure: Token-Leak (mitigiert durch HttpOnly)
  - [ ] Denial of Service: Account-Lockout (mitigiert durch Brute-Force-Schutz)
  - [ ] Elevation of Privilege: Admin-Impersonation (mitigiert durch 2FA)

- [ ] **Security-by-Default:** Sichere Konfiguration aus der Box
  - [ ] HttpOnly Cookies standard
  - [ ] HTTPS erzwungen
  - [ ] CSRF-Schutz aktiv
  - [ ] MFA für Admins erforderlich

- [ ] **Secure Update-Mechanism:** Keycloak-Updates können installiert werden
  - [ ] Version-Tracking
  - [ ] Update-Notifications
  - [ ] Rollback-Mechanik

### Vulnerability Management

- [ ] **Dependency-Scanning:** NPM-Pakete auf Vulns geprüft
  - [ ] Automatisiert via `npm audit`
  - [ ] CI/CD-Gate: Keine high-severity-Vulns

- [ ] **Security-Testing:** 
  - [ ] Unit-Tests für Sicherheits-Logik
  - [ ] Integration-Tests für Token-Flows
  - [ ] E2E-Tests für Permission-Checks
  - [ ] Penetration-Testing vor Go-Live

- [ ] **Bug-Bounty / Responsible Disclosure:** 
  - [ ] Kontakt für Security-Reports
  - [ ] Response-SLA (z.B. 48h)

### Supply-Chain Security

- [ ] **Third-Party-Components:**
  - [ ] Keycloak: Version-Audit, Security-Updates
  - [ ] Supabase/Postgres: Patch-Management
  - [ ] Node.js-Dependencies: `npm audit`, regular updates

- [ ] **Provenance:** Checksum-Verification für kritische Komponenten

### Incident Response

- [ ] **Incident-Response-Plan:**
  - [ ] Detection: Monitoring + Alerting
  - [ ] Containment: Sofortiges Handeln (z.B. Account-Lockout)
  - [ ] Investigation: Audit-Log-Analyse
  - [ ] Recovery: Restore, Verify, Release
  - [ ] Communication: Stakeholders notifizieren

- [ ] **Contact:** Security-Kontakt bekannt (Email, Hotline)

- [ ] **Post-Incident:** Root-Cause-Analysis, Lessons Learned

---

## 🧪 SECURITY-TESTING-COMPLIANCE

### Unit-Tests (Phase 1)

- [ ] Token-Validator:
  - [ ] ✅ Valid token → Parsed claims
  - [ ] ✅ Invalid signature → Error
  - [ ] ✅ Expired token → Error
  - [ ] ✅ Tampered claims → Error
  - [ ] ✅ Token replay → Denied (optional nonce)

### Integration-Tests (Phase 2)

- [ ] RLS-Policies:
  - [ ] ✅ User A (Org A) queries Org B → Empty result
  - [ ] ✅ Direct SQL injection → RLS blocks
  - [ ] ✅ User switches org → New context enforced

### E2E-Tests (Phase 3)

- [ ] Authorization:
  - [ ] ✅ Redakteur creates news → OK
  - [ ] ✅ Redakteur publishes → Denied (403)
  - [ ] ✅ Denied action → Logged with denial reason
  - [ ] ✅ Admin bulk-assigns 100 users → All logged

### Security-Audit (before Go-Live)

- [ ] Penetration-Testing:
  - [ ] Token-Tampering
  - [ ] Brute-Force-Attacks
  - [ ] CSRF-Exploits
  - [ ] RLS-Bypasses
  - [ ] XSS-Cookie-Stealing
  - [ ] SQL-Injection

- [ ] Code-Review:
  - [ ] No secrets in code
  - [ ] Secure headers present
  - [ ] Input validation
  - [ ] Output encoding

---

## 📋 PRE-PHASE SIGN-OFF TEMPLATE

```
PHASE: [1/2/3]
DATE: _____________
REVIEWED BY: _____________

DSGVO-COMPLIANCE:
  ☐ Legal basis documented
  ☐ Consent management working
  ☐ Data minimization verified
  ☐ Audit-logging enabled
  ☐ Retention policy configured
  ☐ Export/Deletion functionality tested

BSI C5 COMPLIANCE:
  ☐ CSRF protection active
  ☐ Authentication secure
  ☐ Account-lockout working
  ☐ Session timeouts set
  ☐ HTTPS enforced
  ☐ Secrets securely managed
  ☐ Audit-logging operational

SECURITY-TESTING:
  ☐ Unit-tests green (100% IAM-tests)
  ☐ Integration-tests green
  ☐ E2E-tests green
  ☐ No high-severity vulnerabilities
  ☐ Code-review passed

RISK-ASSESSMENT:
  ☐ No critical risks remaining
  ☐ All medium risks mitigated
  ☐ Incident-Response ready

SIGN-OFF:
  Security Lead: _______________ Date: ___
  Project Lead: _______________ Date: ___
  Legal/Compliance: _______________ Date: ___

NOTES:
_____________________________________
_____________________________________
```

---

## 🔗 Verweise & Standards

- **DSGVO:** https://gdpr-info.eu
- **BSI C5:** https://www.bsi.bund.de/c5
- **CRA:** https://digital-strategy.ec.europa.eu/en/library/cyber-resilience-act
- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **NIST:** https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final

---

**Dieser Checklist sollte von Security-Team + Compliance-Team gemeinsam durchgangen werden.**  
**Zuletzt aktualisiert:** 21. Januar 2026  
**Nächster Review:** 21. März 2026
