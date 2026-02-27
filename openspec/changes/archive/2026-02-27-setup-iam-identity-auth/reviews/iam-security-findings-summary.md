# Security Review Findings: IAM-System

## 📋 Review Metadata

| Feld | Wert |
|------|------|
| **Review-Datum** | 21. Januar 2026 |
| **Proposal** | setup-iam-identity-auth |
| **Reviewer** | Security & Privacy Officer |
| **Gesamtstatus** | ⚠️ CONDITIONAL APPROVAL |
| **Kritische Risiken** | 6 |
| **Mittlere Risiken** | 6 |
| **Minor Issues** | 10+ |

---

## 🔴 KRITISCHE RISIKEN (Merge-Blocker)

### 🚨 Risiko #1: Token-Speicherung nicht konkretisiert

**Severity:** CRITICAL  
**Category:** Authentication / XSS-Prevention  
**CVSS Score:** 7.5 (High)

**Beschreibung:**
Design.md erwähnt korrekt "HttpOnly Cookies", aber tasks.md sagt nur vage "Memory + localStorage strategy". Dies ist ein kritischer Sicherheitsriss:
- XSS-Attacke könnte Token aus localStorage stehlen
- Refresh-Token wäre kompromittiert
- Session könnte von Angreifer übernommen werden

**Acceptance Criteria:**
```markdown
- [ ] Task 1.2.3 konkretisiert: "HttpOnly-Only" für beide Token
- [ ] localStorage ist BANNED (Code-Review prüft)
- [ ] Unit-Test: `test('Token not accessible via JavaScript')`
- [ ] Security-Team approved
```

**Referenzen:**
- OWASP: https://owasp.org/www-community/attacks/xss/
- Design.md Line 156: "HttpOnly Cookies"
- tasks.md Line 1.3.3: Vague wording

**ADR:** ADR-IAM-001 – Token Storage Strategy

---

### 🚨 Risiko #2: DSGVO Art. 17 – Recht auf Vergessenheit nicht adressiert

**Severity:** CRITICAL  
**Category:** Data Protection / DSGVO-Compliance  
**Legal Risk:** Bußgeld bis €20.000.000

**Beschreibung:**
Keine Regelung für Löschung personenbezogener Daten nach DSGVO Art. 17. Kommune kann Bürger-Löschanfragen nicht erfüllen:
- Accounts können nicht gelöscht werden
- Rollen/Org-Memberships bleiben erhalten
- Audit-Logs werden nicht anonymisiert

**Acceptance Criteria:**
```markdown
- [ ] Phase 3.9 Task erstellt: "DSGVO-Data-Deletion-Management"
- [ ] API-Endpoint: DELETE /api/user (mit 30-Tage-Hold)
- [ ] Cascade-Delete für: accounts, roles, org_memberships
- [ ] Audit-Logs: Anonymisierung (personal data → NULL/hash)
- [ ] Legal-Team reviewed & approved
```

**Referenzen:**
- DSGVO Art. 17: Right to Erasure
- spec.md (auditing): "2 years retention" – aber keine Löschung
- tasks.md: Kein Task für Löschung

**ADR:** ADR-IAM-002 – DSGVO-Compliance (Data-Deletion & Anonymization)

---

### 🚨 Risiko #3: Consent-Management nicht implementiert

**Severity:** CRITICAL  
**Category:** Data Protection / Legal Basis  
**Legal Risk:** DSGVO-Verstoß Art. 6, 7

**Beschreibung:**
Keine explizite Einwilligung zur Datenverarbeitung definiert:
- Rechtliche Grundlage unklar (Art. 6 welcher Buchstabe?)
- JWT-Claims können beliebig viele Attribute enthalten
- Nutzer hat kein Widerspruchsrecht (Art. 21)

**Acceptance Criteria:**
```markdown
- [ ] Phase 3.10 Task erstellt: "Consent Management"
- [ ] Legal Basis dokumentiert (Art. 6(c) + Art. 6(f))
- [ ] First-Login UI: "Ich stimme Datenschutzerklärung zu"
- [ ] Consent-Event in activity_logs geloggt
- [ ] Widerspruchsrecht implementiert (Opt-out)
- [ ] Datenschutzerklärung aktualisiert
```

**Referenzen:**
- DSGVO Art. 6: Legal Basis
- DSGVO Art. 7: Consent
- Design.md: Keine Erwähnung von Consent

**ADR:** ADR-IAM-003 – Legal Basis & Consent Management

---

### 🚨 Risiko #4: Brute-Force-Schutz nicht konkretisiert

**Severity:** CRITICAL  
**Category:** Authentication / Account Lockout  
**BSI-Compliance:** C5:4.3

**Beschreibung:**
Tasks.md sagt "Rate-Limiting" aber keine konkreten Zahlen/Implementation:
- Wie viele failed attempts bis lockout?
- Wie lange ist lockout?
- Exponential backoff implementiert?
- Captcha geplant?

**Acceptance Criteria:**
```markdown
- [ ] Phase 3.11 Task erstellt: "Brute-Force Protection"
- [ ] Keycloak-Config: 5 attempts → 30min lockout
- [ ] Backend: Rate-limit 5 reqs/min per IP
- [ ] Exponential Backoff: 30m → 2h → permanent
- [ ] Captcha nach 3. Attempt
- [ ] Failed-Login Monitoring + Alerting
- [ ] Unit-Tests für Lockout-Szenarien
```

**Referenzen:**
- BSI C5: 4.3 Account-Lockout
- OWASP: Brute-Force Prevention
- tasks.md 1.5.1: Nur "Rate-Limiting" erwähnt

**ADR:** ADR-IAM-004 – Brute-Force Protection & Account Lockout

---

### 🚨 Risiko #5: Client-Secret-Management nicht definiert

**Severity:** CRITICAL  
**Category:** Secrets Management / OIDC  
**CVSS Score:** 9.0 (Critical)

**Beschreibung:**
Keycloak-Client-Secret kann unsicher gespeichert werden:
- In Source-Code (Git-Leak möglich)
- In .env-File (Deployment-Fehler)
- Keine Rotation definiert
- Keine Audit-Logging für Secret-Access

**Acceptance Criteria:**
```markdown
- [ ] Phase 1.2.4 überarbeitet: "Secrets-Management Policy"
- [ ] Dev: .env (mit .gitignore)
- [ ] Prod: AWS Secrets Manager / Vault / Azure Key Vault
- [ ] Rotation: 90-Tage-Zyklus
- [ ] Audit-Logging: Wer hat Secret zugegriffen?
- [ ] Code-Review: Keine Secrets in Source-Code
- [ ] CI/CD-Gate: Secret-Scanning
```

**Referenzen:**
- BSI C5: 4.6 Secrets Management
- OWASP: Secrets Management
- Design.md: Keine Erwähnung von Secret-Storage

**ADR:** ADR-IAM-005 – Secrets Management & Rotation

---

### 🚨 Risiko #6: Public-Key-Caching-Policy nicht definiert

**Severity:** CRITICAL  
**Category:** Token-Validation / Key-Rotation  
**CVSS Score:** 6.5 (Medium-High)

**Beschreibung:**
Was passiert, wenn Keycloak seinen Public-Key rotiert?
- Token-Validierung könnte fehlschlagen
- Service-Outage bis Cache invalidiert
- Keine Fallback-Strategie

**Acceptance Criteria:**
```markdown
- [ ] Phase 1.2.2 erweitert: "Public-Key-Management"
- [ ] Public-Key-Caching: TTL 24h
- [ ] Stale-Key-Fallback: Bei Fehler → Fresh-Fetch + Retry
- [ ] Key-Rotation-Monitoring: Alert bei neuem Key
- [ ] Keycloak-Config: 90-Tage Key-Rotation
- [ ] Unit-Tests für Key-Rotation-Szenarien
```

**Referenzen:**
- JWT.io: Best Practices
- Design.md Line 190: "Public-Key-Caching" erwähnt, aber zu vage
- tasks.md 1.2.2: "Token-Validator" ohne Key-Refresh-Logic

**ADR:** ADR-IAM-006 – Token-Validation & Public-Key-Management

---

## 🟡 MITTLERE RISIKEN

### ⚠️ Risiko #7: CSRF-Protection erwähnt aber nicht implementiert

**Severity:** MEDIUM  
**Category:** Web Security / CSRF  
**BSI-Compliance:** C5:2.2

**Problem:**  
Design.md: "CSRF-Token für state-changing operations" – aber kein Task

**Solution:**
```yaml
Phase 3.12: CSRF-Protection Implementation
  - [ ] Double-Submit-Cookie Pattern
  - [ ] Middleware: doubleCsrfProtection
  - [ ] Frontend: Token in Header für POST/PUT/DELETE
  - [ ] Unit-Tests für CSRF-Bypass-Versuche
```

**Referenzen:** OWASP CSRF, Design.md Line 248

---

### ⚠️ Risiko #8: Session-Timeout nicht spezifiziert

**Severity:** MEDIUM  
**Category:** Authentication / Session-Management  
**BSI-Compliance:** C5:4.4

**Problem:**  
Keine konkreten Timeout-Werte definiert

**Solution:**
```yaml
Access Token: 15 Minuten
Refresh Token: 7 Tage (30 Tage mit MFA)
Idle Timeout: 30 Minuten
Absolute Session Max: 8 Stunden
```

**Referenzen:** NIST SP 800-53, tasks.md 1.5

---

### ⚠️ Risiko #9: MFA nicht zwingend für Admins

**Severity:** MEDIUM  
**Category:** Authentication / Multi-Factor-Auth

**Problem:**  
Design.md: "2FA-Aktivierung" (optional) – sollte für Admins MANDATORY sein

**Solution:**
```yaml
System-Administrator: Mandatory MFA (TOTP/OTP)
App-Manager: Recommended MFA
Redakteur: Optional MFA
```

**Referenzen:** BSI, NIST Best Practices

---

### ⚠️ Risiko #10: RLS-Testing nicht konkretisiert

**Severity:** MEDIUM  
**Category:** Multi-Tenancy / RLS-Validation  
**CVSS Score:** 7.0

**Problem:**  
Task 2.3.5: "Tests für Org-Isolation" – aber keine Szenarien definiert

**Solution:**
```typescript
// Test-Matrix für RLS:
test('User A (Org A) cannot query Org B data')
test('RLS blocks direct SQL injection attempts')
test('User switches org context → Data isolation maintained')
```

**Referenzen:** spec.md (Organizations): "RLS policy validation in tests"

---

### ⚠️ Risiko #11: Audit-Log-Integrität (Hash-Chaining)

**Severity:** MEDIUM  
**Category:** Immutable Logging / Tamper-Detection

**Problem:**  
spec.md (Auditing): "Immutable Activity Logs" – aber keine Hash-Chaining erwähnt

**Solution:**
```sql
-- Hash-Chaining für Tamper-Detection:
ALTER TABLE iam.activity_logs ADD (
  hash_current VARCHAR(64),
  hash_previous VARCHAR(64),
  CONSTRAINT chained_hash CHECK (...)
);

-- Trigger: Berechnet SHA256-Kette
```

**Referenzen:** NIST: Audit-Log Integrity, spec.md

---

### ⚠️ Risiko #12: Failed Authorization nicht geloggt

**Severity:** MEDIUM  
**Category:** Audit-Logging / Security-Monitoring

**Problem:**  
Nur erfolgreiche Events werden geloggt (Login, Role-Assign) – denied Access-Attempts fehlen

**Solution:**
```
Neue Event-Types:
  - permission_denied
  - role_check_failed
  - org_isolation_denied
```

---

## 🟢 OK / ERFÜLLT

### ✅ Keycloak als IdP – Gute Wahl
- Separates Identity Layer ✓
- SAML/LDAP/AD-Integration möglich ✓
- Open Source, aktiv gepflegt ✓
- Kein Vendor-Lock-In ✓

### ✅ Postgres + RLS für Multi-Tenancy
- Database-level Enforcement ✓
- ACID-Transaktionen ✓
- Revisionssicher ✓

### ✅ Permission-Caching mit Redis
- < 50ms Performance-Anforderung erreichbar ✓
- Cache-Invalidation via Pub/Sub ✓
- Fallback zu DB ✓

### ✅ OIDC Authorization Code Flow + PKCE
- Modern Best-Practice ✓
- Token bleibt Backend-side ✓
- Sicher vor Code-Interception ✓

### ✅ 7-Personas-System
- Klar definiert ✓
- Hierarchisch vererbbar ✓

### ✅ Audit-Logging Foundation
- Immutability erwähnt ✓
- Event-Types definiert ✓
- Retention-Policy (2 Jahre) ✓

---

## 📝 SUMMARY

| Kategorie | Count | Status |
|-----------|-------|--------|
| **Kritische Risiken** | 6 | 🔴 BLOCKER |
| **Mittlere Risiken** | 6 | 🟡 MUSS adressieren |
| **Minor Issues** | 10+ | 🟢 Nice-to-have |
| **OK / Erfüllt** | 6 | ✅ |

**Gesamturteil:** ⚠️ **CONDITIONAL APPROVAL**

---

## 🚀 NEXT STEPS

### Phase 1: Stakeholder-Approval (1 Woche)
- [ ] Alle 6 ADRs approved
- [ ] Budget für 60 zusätzliche Task-Tage genehmigt
- [ ] Timeline angepasst

### Phase 2: Security-Konkretisierung (2-3 Wochen)
- [ ] Tasks für alle 12 mittleren/kritischen Risiken erstellt
- [ ] Threat-Modelling durchgeführt
- [ ] Security-Testing-Matrix definiert

### Phase 3: Implementation (Phases 1-3)
- [ ] Security-Defaults parallel zur Entwicklung
- [ ] Code-Reviews mit Security-Focus
- [ ] Security-Testing vor jeder Phase-Freigabe

### Phase 4: Pre-Go-Live (2-3 Wochen)
- [ ] Penetration-Testing
- [ ] Compliance-Audit (DSGVO, BSI, CRA)
- [ ] Incident-Response-Training

---

## 📚 Referenzen

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **DSGVO:** https://gdpr-info.eu
- **BSI C5:** https://www.bsi.bund.de/c5
- **NIST SP 800-53:** https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- **JWT Best Practices:** https://tools.ietf.org/html/rfc8949

---

**Status:** Ready for Stakeholder Review  
**Reviewer:** Security & Privacy Officer  
**Date:** 21. Januar 2026  
**Valid Until:** 20. Februar 2026

---

**Alle Findings sollten als GitHub-Issues erstellt werden mit Label `security` + `iam-initiative` + Priority-Labels.**
