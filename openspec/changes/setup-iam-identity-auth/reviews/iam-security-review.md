# 🔐 SECURITY & PRIVACY REVIEW: IAM-Proposal
## SVA Studio - Keycloak-Integration & Berechtigungssystem

**Reviewer:** SECURITY & PRIVACY OFFICER  
**Review-Datum:** 21. Januar 2026  
**Proposal:** setup-iam-identity-auth (Phase 1–3)  
**Status:** ⚠️ **CONDITIONAL APPROVAL** – Mit kritischen Auflagen

---

## 📋 Executive Summary

Das IAM-Proposal **adressiert fundamentale Sicherheitsanforderungen** und hat eine **solide Architektur**. Allerdings wurden **6 kritische Sicherheitslücken** identifiziert, die vor der Implementierung behoben werden müssen. Die DSGVO- und BSI-Compliance ist **teilweise gewährleistet**, erfordert aber Konkretisierung.

### Fazit für Kommunen:
✅ **Mit Auflagen umsetzbar** – Eine Kommune kann mit diesem System (nach Fixes) DSGVO-konform und sicher arbeiten.  
🟡 **Aber nicht im aktuellen Status.** Kritische Risiken müssen vor Go-Live adressiert werden.

---

## 🔴 KRITISCHE RISIKEN (Merge-Blocker)

### 1. ⚠️ **Token-Speicherung: LocalStorage vs. HttpOnly Cookies nicht klar definiert**

**Risiko:** High  
**Kontext:**
- Design.md erwähnt "HttpOnly Cookies" (korrekt) aber in tasks.md heißt es nur "Session/Token-Speicherung (Memory + localStorage strategy)"
- Keine explizite Entscheidung dokumentiert

**Impact:**
- 🚨 XSS-Attacke könnte Token aus LocalStorage stehlen
- 🚨 Sensitive Refresh-Token wäre kompromittiert
- 🚨 DSGVO-Verstoß: Unzureichende technische Schutzmaßnahmen (Art. 32)

**Lösung (MUSS vor Code-Review erfolgen):**
```typescript
// ✅ KORREKT:
// Access Token: Memory + 1 HttpOnly Cookie (SameSite=Strict)
// Refresh Token: HttpOnly Cookie nur (NIEMALS localStorage)

// ❌ FALSCH:
// localStorage.setItem('auth_token', accessToken)  // XSS-Anfälligkeit!
```

**ADR-Empfehlung:** ADR-IAM-001 – Token Storage Strategy (HttpOnly-Only, keine localStorage für Tokens)

---

### 2. ⚠️ **DSGVO-Löschung nicht adressiert – "Recht auf Vergessenheit"**

**Risiko:** Critical  
**Kontext:**
- Audit-Logs werden 2 Jahre gespeichert (spec.md)
- Keine Regelung für **Löschung personenbezogener Daten** nach DSGVO Art. 17
- Keine Cascade-Löschung für: Accounts, Org-Memberships, Rollen, Logs

**Impact:**
- 🚨 **Abmahnrisiko** bei Bürgern, die Löschung anfordern
- 🚨 **Bußgeldrisiko** (Art. 83 DSGVO, bis €20M)
- 🚨 Audit-Logs müssen **revisionssicher**, aber User-Daten **löschbar** sein

**Lösung (NEUE Task erforderlich):**
```
Phase 3.9: DSGVO-Data-Deletion-Management

- [ ] 3.9.1 Anonymisierungs-Strategie für Audit-Logs definieren
        * Event-Type: "user_deleted" → user_id → hash (irreversibel)
        * Personal data fields (email, name) → NULL/DELETED
        * Audit-Trail bleibt für Compliance, Personal-Data gelöscht

- [ ] 3.9.2 Cascade-Delete implementieren
        * iam.accounts → löschen
        * iam.account_roles → löschen
        * iam.account_organizations → löschen
        * iam.activity_logs → anonymisieren (nicht löschen!)

- [ ] 3.9.3 "Right to Erasure" Workflow
        * Admin/User fordert Löschung an
        * 30-Tage-Frist (legal hold)
        * Automatischer purge Job nach Frist
        * Bestätigung an User

- [ ] 3.9.4 Data-Deletion Logs
        * Separate Logs für löschvorgänge
        * Wer, wann, warum (Art. 5 Abs. 1 f DSGVO)
```

**ADR-Empfehlung:** ADR-IAM-002 – DSGVO-Compliance (Data-Deletion, Anonymization, Right-to-Erasure)

---

### 3. ⚠️ **Consent-Management nicht implementiert – DSGVO Art. 7, 21**

**Risiko:** High  
**Kontext:**
- Keine explizite Regelung, **wann und wie Nutzer-Daten verarbeitet werden dürfen**
- JWT Claims können beliebig viele Attribute enthalten (Role, Org, Email)
- Keine Einwilligung zur Datenverarbeitung dokumentiert

**Impact:**
- 🚨 **Rechtliche Grundlage unklar** für Keycloak-Integration
- 🚨 Bei "Datenschutzerklärung" können Bürger widersprechen
- 🚨 Zugriff auf Rollen/Org-Info muss **explizit eingewilligt** sein

**Lösung (NEUE Task erforderlich):**
```
Phase 3.10: Consent Management

- [ ] 3.10.1 Legal Basis definieren
        * Rechtsgrundlage: Art. 6 (b/c/f DSGVO)?
        * b = Vertragserfüllung (Nutzer nutzt CMS)
        * c = Rechtliche Verpflichtung (Keycloak muss User-ID kennen)
        * f = Berechtigtes Interesse (Governance)

- [ ] 3.10.2 Consent-Flow für Datenschutzerklärung
        * Upon first login: "Diese Daten werden verarbeitet: Email, Name, Rollen, Orgs"
        * Checkbox: "Ich akzeptiere die Datenschutzerklärung"
        * Wird in iam.activity_logs geloggt (consent_given)

- [ ] 3.10.3 Widerspruchsrecht implementieren
        * User kann widersprechen → "Meine Rolle offenlegen? Nein"
        * Claims werden reduziert (nur sub + email)
```

**ADR-Empfehlung:** ADR-IAM-003 – Legal Basis & Consent Management

---

### 4. ⚠️ **Brute-Force-Schutz: Nur in Keycloak, nicht im Frontend-Fallback**

**Risiko:** High  
**Kontext:**
- Design.md: "Rate-Limiting auf Auth-Endpoints" (?)
- Keine Implementierungsdetails für:
  - Account Lockout nach N Fehlversuchen
  - Exponential Backoff
  - Captcha bei wiederholten Versuchen

**Impact:**
- 🚨 **Brute-Force-Angriffe** auf Keycloak-Admin-Accounts
- 🚨 **Denial-of-Service** gegen Nutzer (Account-Lockout durch Angreifer)
- 🚨 BSI-Empfehlung: Account-Lockout **muss implementiert sein** (BSI C5:4.3)

**Lösung (NEUE Task erforderlich):**
```
Phase 3.11: Brute-Force Protection

- [ ] 3.11.1 Keycloak Brute-Force Policy konfigurieren
        * Failed login attempts: track in Keycloak
        * Lock after 5 attempts × 30 minutes
        * Exponential backoff: 30m → 2h → permanent (manual unlock)

- [ ] 3.11.2 Backend Rate-Limiting
        * /api/auth/login: max 5 reqs/minute per IP
        * /api/auth/refresh: max 10 reqs/minute per IP
        * Implement with express-rate-limit + Redis

- [ ] 3.11.3 Monitoring & Alerting
        * Alert if > 10 failed logins in 1 hour
        * Log failed attempts + IP in audit_logs
        * Admin-Dashboard zeigt "Failed Login Attempts"

- [ ] 3.11.4 Captcha Integration
        * After 3 failed attempts: Recaptcha v3
        * User muss lösen vor erneutem Attempt
```

**ADR-Empfehlung:** ADR-IAM-004 – Brute-Force Protection & Account Lockout

---

### 5. ⚠️ **Secrets-Management: Keycloak-Client-Secret nicht adressiert**

**Risiko:** Critical  
**Kontext:**
- OIDC-Client im Keycloak benötigt Client-Secret
- Keine Regelung, **wie Secret im Code/Infra gespeichert wird**
- tasks.md: "Keycloak-Config-Management" (1.2.4) – zu vague

**Impact:**
- 🚨 **Secret im Source-Code** → Git-Leak → Angreifer kann Tokens forgen
- 🚨 **Secret im .env-File** → Deployment-Issue
- 🚨 **Keine Secret-Rotation** → Single Point of Failure

**Lösung (MUSS konkretisiert werden):**
```typescript
// ❌ FALSCH:
process.env.KEYCLOAK_CLIENT_SECRET  // in .env? in Git?

// ✅ KORREKT:
// Gehört in: AWS Secrets Manager / Azure Key Vault / HashiCorp Vault
// Environment-Variable zeigt NUR auf Vault-URL

// Beispiel (AWS Secrets Manager):
const secret = await secretsClient.getSecretValue({
  SecretId: 'iam/keycloak-client-secret'
}).promise()

const clientSecret = JSON.parse(secret.SecretString).clientSecret
```

**Task-Konkretisierung:**
```
Phase 1.2.4 (überarbeitet): Keycloak-Config-Management mit Secrets

- [ ] 1.2.4a Secrets-Storage wählen (AWS Secrets Manager? Vault?)
- [ ] 1.2.4b Client-Secret NIEMALS in Source-Code
- [ ] 1.2.4c Secret-Rotation Policy (z.B. 90 Tage)
- [ ] 1.2.4d Environment-Variablen (nur URLs zu Vault, nicht Secrets selbst)
- [ ] 1.2.4e Secret-Audit-Logging (wer hat Secret zugegriffen?)
```

**ADR-Empfehlung:** ADR-IAM-005 – Secrets Management & Rotation

---

### 6. ⚠️ **Token-Signing & Public-Key-Caching: Keine Refresh-Policy**

**Risiko:** High  
**Kontext:**
- Task 1.2.2: "JWT-Verifizierung mit Keycloak Public Key"
- Keine Regelung:
  - **Wie oft wird Public-Key von Keycloak abgerufen?**
  - **Was, wenn Public-Key rotiert wird?** (z.B. im Keycloak neu generiert)
  - **Cache TTL für Public-Key?**

**Impact:**
- 🚨 **Token-Validation schlägt nach Key-Rotation fehl** (bis Cache invalidiert)
- 🚨 **Service-Outage**, bis Public-Key neu geladen wird
- 🚨 **Man-in-the-Middle**: Wenn Public-Key gehackt → gefälschte Tokens akzeptiert

**Lösung (NEUE Task erforderlich):**
```typescript
// ✅ Sichere Public-Key-Caching-Strategie

class KeycloakTokenValidator {
  private publicKeyCache: Map<string, { key: string; expiresAt: number }> = new Map()
  private readonly PUBLIC_KEY_TTL = 24 * 60 * 60 * 1000  // 24h

  async getPublicKey(): Promise<string> {
    const cacheKey = 'keycloak_public_key'
    
    // Check cache
    const cached = this.publicKeyCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.key
    }

    // Fetch from Keycloak
    const response = await fetch(`${KEYCLOAK_URL}/.well-known/openid-configuration`)
    const config = await response.json()
    const jwksResponse = await fetch(config.jwks_uri)
    const jwks = await jwksResponse.json()
    
    // Extract & cache
    const publicKey = jwks.keys[0]  // First key (current)
    this.publicKeyCache.set(cacheKey, {
      key: publicKey,
      expiresAt: Date.now() + this.PUBLIC_KEY_TTL
    })

    return publicKey
  }

  async validateToken(token: string): Promise<TokenClaims> {
    const key = await this.getPublicKey()
    
    try {
      return jwt.verify(token, key)
    } catch (error) {
      // Token verification failed - could be due to stale public key
      // Force refresh and retry once
      this.publicKeyCache.delete('keycloak_public_key')
      const freshKey = await this.getPublicKey()
      return jwt.verify(token, freshKey)
    }
  }
}
```

**Task-Addition:**
```
Phase 1.2.2 (erweitert): Token-Validator mit Public-Key-Management

- [ ] 1.2.2a Public-Key-Caching implementieren (24h TTL)
- [ ] 1.2.2b Stale-Key-Fallback: Bei Fehler → Fresh-Fetch + Retry
- [ ] 1.2.2c Key-Rotation-Monitoring (alert wenn neuer Key)
- [ ] 1.2.2d Keycloak-Konfiguration: Key-Rotation-Policy (90 Tage)
```

**ADR-Empfehlung:** ADR-IAM-006 – Token-Validation & Public-Key-Management

---

## 🟡 MITTLERE RISIKEN (Müssen vor Phase 3 adressiert werden)

### 1. 🟡 **CSRF-Protection: Token erwähnt, aber nicht implementiert**

**Risiko:** Medium  
**Kontext:**
- Design.md: "CSRF-Token für state-changing operations" (erwähnt)
- tasks.md: **Kein Task für CSRF-Implementation**

**Impact:**
- 🚨 Cross-Site Request Forgery möglich bei:
  - Rollenänderung
  - Org-Zuweisung
  - Permission-Änderung
- ⚠️ **BSI-Compliance-Issue** (Empfehlung C5:2.2)

**Lösung:**
```typescript
// ✅ CSRF-Middleware

import { doubleCsrf } from 'csrf-csrf'

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-psifi.x-csrf-token',  // Secure prefix
  cookieOptions: {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
})

// In Express:
app.post('/api/roles/assign', doubleCsrfProtection, async (req, res) => {
  // req.headers['x-csrf-token'] validated
  // Proceed with role assignment
})
```

**Task-Addition:**
```
Phase 3.12: CSRF-Protection Implementation

- [ ] 3.12.1 Double-Submit-Cookie Pattern implementieren
- [ ] 3.12.2 CSRF-Token für alle state-changing API-Endpoints
- [ ] 3.12.3 Frontend: Token extrahieren + an Header senden
- [ ] 3.12.4 Unit-Tests für CSRF-Bypass-Versuche
```

---

### 2. 🟡 **Session-Timeout: Nicht spezifiziert**

**Risiko:** Medium  
**Kontext:**
- tasks.md: "Session expiration" erwähnt
- Keine konkreten Timeout-Werte definiert

**Recommended Policy:**
- Access Token: **15 Minuten**
- Refresh Token: **7 Tage** (oder 30 Tage mit MFA)
- Idle Timeout: **30 Minuten**
- Absolute Session Max: **8 Stunden**

**Task-Addition:**
```
Phase 1.5.6: Session Timeout Policy

- [ ] 1.5.6a Define token lifespans in Keycloak config
- [ ] 1.5.6b Implement idle-timeout warning (refresh before expiry)
- [ ] 1.5.6c Auto-logout on absolute session max
- [ ] 1.5.6d Configurable per organization (?)
```

---

### 3. 🟡 **MFA (2FA) nicht zwingend vorgegeben**

**Risiko:** Medium  
**Kontext:**
- Design.md: "SSO/2FA-Aktivierung" (optional)
- tasks.md: 1.1.5 erwähnt 2FA aber nicht als **Muss** für sensitive Rollen

**Empfehlung:**
- ✅ MFA **Muss** für System-Administratoren
- ✅ MFA **Empfohlen** für App-Manager, Prüfer
- ⚠️ MFA **Optional** für Redakteure

**Task-Addition:**
```
Phase 1.5.7: Mandatory MFA for Sensitive Roles

- [ ] 1.5.7a MFA-Requirement per Persona definieren
- [ ] 1.5.7b Keycloak: TOTP/OTP-Provider konfigurieren
- [ ] 1.5.7c Backup-Codes generieren beim ersten Login
- [ ] 1.5.7d Admin-Override-Capability (mit Audit-Log)
```

---

### 4. 🟡 **RLS-Policy Testing: Nicht konkretisiert**

**Risiko:** Medium  
**Kontext:**
- spec.md (Organizations): "RLS policy validation in tests"
- tasks.md: 2.3.5 "Tests für Org-Isolation" (zu vague)

**Risiko:**
- RLS kann leicht misconfiguriert werden
- Cross-org data leak möglich

**Lösung:**
```typescript
// ✅ Explizite RLS-Test-Cases

test('RLS prevents User A (Org A) from querying Org B data', async () => {
  const userA = { id: 'user-a', currentOrg: 'org-a' }
  
  // Set up RLS context
  await db.execute('SET app.user_id = ?', [userA.id])
  await db.execute('SET app.current_org_id = ?', ['org-a'])
  
  // Try to query Org B data
  const result = await db.query('SELECT * FROM content WHERE organization_id = ?', ['org-b'])
  
  // Assertion: RLS should filter out all rows
  expect(result).toEqual([])  // Empty, not forbidden
})
```

**Task-Konkretisierung:**
```
Phase 2.3.5 (überarbeitet): Org-Isolation Testing

- [ ] 2.3.5a Unit-Test: RLS-Policy-Logic
- [ ] 2.3.5b Integration-Test: Cross-org Query Prevention
- [ ] 2.3.5c Scenario: User mit 2 Orgs wechselt Context
- [ ] 2.3.5d Scenario: Direct SQL Injection Attempt (RLS should block)
```

---

### 5. 🟡 **Audit-Log Integrity: Hash-Chaining nicht erwähnt**

**Risiko:** Medium  
**Kontext:**
- spec.md: "Immutable Activity Logs"
- Keine Regelung für **Tamper-Detection**

**Empfehlung:**
```sql
-- ✅ Hash-Chaining für Audit-Log-Integrität

ALTER TABLE iam.activity_logs ADD COLUMN (
  hash_current VARCHAR(64),           -- SHA256(this record)
  hash_previous VARCHAR(64),          -- SHA256(previous record)
  CONSTRAINT chained_hash CHECK (
    -- Ensures chronological integrity
  )
);

-- Trigger beim Insert:
CREATE OR REPLACE FUNCTION iam_activity_log_hash()
RETURNS TRIGGER AS $$
BEGIN
  SELECT hash_current INTO NEW.hash_previous
  FROM iam.activity_logs
  ORDER BY created_at DESC
  LIMIT 1;
  
  NEW.hash_current := sha256(
    NEW.event_type || NEW.actor_id || NEW.created_at || NEW.hash_previous
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Task-Addition:**
```
Phase 3.13: Audit-Log Hash-Chaining

- [ ] 3.13.1 Add hash columns to iam.activity_logs
- [ ] 3.13.2 Implement hash-chaining trigger in DB
- [ ] 3.13.3 Verification function: audit_log_verify()
- [ ] 3.13.4 Monitoring: Alert on hash-mismatch
```

---

### 6. 🟡 **Logging von gescheiterten Authorization-Checks**

**Risiko:** Medium  
**Kontext:**
- spec.md: Nur erfolgreiche Ereignisse geloggt (Login, Role-Assign)
- Keine Regelung für **Denied Access-Attempts**

**Empfehlung:**
```
Definiere separat loggbare Events:
- permission_denied
- role_check_failed
- org_isolation_denied
```

---

## 🟢 OK / ERFÜLLT

### ✅ 1. **Keycloak als IdP – Gute Wahl**
- Separates Identity Layer
- Unterstützt zukünftige SAML/LDAP/AD-Integration
- Open Source, aktiv gepflegt
- ✅ No vendor lock-in

---

### ✅ 2. **Postgres + RLS für Multi-Tenancy**
- Database-level Enforcement (nicht nur App-layer)
- ACID-Transaktionen für kritische Ops
- Revisionssicher (Audit-Logs)
- ✅ Performance-optimiert

---

### ✅ 3. **Permission-Caching mit Redis**
- < 50ms Performance-Anforderung erreichbar
- Cache-Invalidation via Pub/Sub (gut)
- Fallback zu DB bei Miss (resilient)
- ✅ Scalable

---

### ✅ 4. **OIDC Authorization Code Flow + PKCE**
- Moderne Best-Practice (nicht Implicit)
- Token bleibt Backend-side (sicher)
- PKCE schützt vor Code-Interception
- ✅ Secure Architecture

---

### ✅ 5. **7-Personas-System**
- Klar definierte Rollen mit Permissions
- Hierarchisch vererbbar (gut für County/Municipality/District)
- ✅ DSGVO-freundlich (klare Verantwortlichkeiten)

---

### ✅ 6. **Audit-Logging Foundation**
- Immutability erwähnt (wichtig)
- Event-Types definiert (Login, Role-Assign, etc.)
- Retention-Policy (2 Jahre) ist reasonable
- ✅ Compliance-ready

---

### ✅ 7. **Error-Handling für Tokens**
- INVALID, EXPIRED, NOTBEFORE, AUDIENCE, ISSUER klar definiert
- Retry-Strategie vorhanden
- ✅ Robust

---

### ✅ 8. **RBAC + ABAC Hybrid**
- RBAC für 80% (einfach, performant)
- ABAC für komplexe Policies (flexibel)
- ✅ Gut balanced

---

## 📋 COMPLIANCE-CHECKLISTE

### DSGVO (Datenschutz-Grundverordnung)

| Anforderung | Status | Notizen |
|-------------|--------|---------|
| **Art. 5 – Lawfulness** | 🟡 Partial | Legal Basis unklar, Consent nicht implementiert |
| **Art. 5 – Data Minimization** | 🟢 OK | JWT-Claims können konfiguriert werden |
| **Art. 6 – Legal Basis** | 🔴 MISSING | Muss definiert werden (b/c/f?) |
| **Art. 7 – Consent** | 🔴 MISSING | Muss implementiert werden |
| **Art. 13/14 – Privacy Policy** | 🟡 Partial | Datenschutzerklärung muss aktualisiert werden |
| **Art. 15 – Right of Access** | 🟡 Partial | API für Datenexport muss implementiert werden |
| **Art. 17 – Right to Erasure** | 🔴 MISSING | Data-Deletion nicht adressiert |
| **Art. 20 – Data Portability** | 🟡 Partial | Export-Format unklar |
| **Art. 21 – Right to Object** | 🟡 Partial | Opt-out-Optionen unklar |
| **Art. 28 – Data Processing Addendum** | 🟡 Partial | DPA mit Keycloak-Hoster unklar |
| **Art. 32 – Security Measures** | 🟡 Partial | Encryption, MFA, Secrets-Mgmt unklar |
| **Art. 33/34 – Breach Notification** | 🟡 Partial | Incident-Response-Plan nicht adressiert |

### BSI C5:2020 (Katalog Vertrauenswürdiger Technologien)

| Anforderung | Status | Notizen |
|-------------|--------|---------|
| **C5:2.2 – CSRF-Protection** | 🟡 Partial | Erwähnt, aber nicht implementiert |
| **C5:2.3 – Authentication** | 🟢 OK | OIDC + Keycloak erfüllt Anforderung |
| **C5:4.3 – Account Lockout** | 🟡 Partial | Brute-Force-Schutz nicht konkretisiert |
| **C5:4.4 – Session Timeout** | 🟡 Partial | Keine Timeout-Werte definiert |
| **C5:4.5 – Encryption in Transit** | 🟢 OK | HTTPS erwähnt |
| **C5:4.6 – Secrets Management** | 🔴 MISSING | Client-Secret nicht adressiert |
| **C5:5.1 – Audit Logging** | 🟢 OK | Immutable Logs definiert |
| **C5:5.2 – Integrity Monitoring** | 🟡 Partial | Hash-Chaining nicht erwähnt |

### CRA (Cyber Resilience Act)

| Anforderung | Status | Notizen |
|-------------|--------|---------|
| **Secure by Design** | 🟡 Partial | Security-Defaults teilweise vorhanden |
| **Threat Modeling** | 🔴 MISSING | Keine Threat-Analyse durchgeführt |
| **Vulnerability Management** | 🟡 Partial | Security-Testing erwähnt, Details fehlen |
| **Supply-Chain Security** | 🟡 Partial | Keycloak-Updates, Patch-Management? |
| **Incident Response** | 🔴 MISSING | Kein Incident-Response-Plan |

---

## 🎯 KONKRETE VERBESSERUNGSVORSCHLÄGE

### A. Sofort (vor Code-Start) umsetzbar

1. **Token-Storage dokumentieren:**
   ```markdown
   # Token Storage Decision
   
   - Access Token: HttpOnly, Secure, SameSite=Strict Cookie
   - Refresh Token: HttpOnly, Secure, SameSite=Strict Cookie (NIEMALS localStorage)
   - Memory-basierter State für aktuelle Session (vor Page-Reload)
   ```

2. **Secrets-Management konkretisieren:**
   ```yaml
   # In Phase 1.2.4 konkretisieren:
   Environment: Development
   Secret Storage: .env (mit .gitignore)
   
   Environment: Staging/Production
   Secret Storage: AWS Secrets Manager / HashiCorp Vault
   Rotation: 90 days
   ```

3. **Security-Testing Matrix erstellen:**
   ```yaml
   Phase 1 Tests:
     - ✅ Valid Token → Access granted
     - ✅ Invalid Token → 401 Unauthorized
     - ✅ Expired Token → 401 + Refresh attempt
     - ✅ Tampered Token → 401
     - ✅ Token Replay → 401 (nonce check)
   
   Phase 2 Tests:
     - ✅ User A (Org A) queries Org B → RLS blocks
     - ✅ User A switches to Org C → Cookies/Context updated
   
   Phase 3 Tests:
     - ✅ Redakteur tries to publish → Permission denied + logged
     - ✅ Admin bulk-assigns 100 users → Audit-logged
   ```

---

### B. Neue Phasen-Tasks

```markdown
## Phase 1 (erweitert)

### 1.2.5a: Token-Storage Policy
- [ ] Dokumentation: HttpOnly-Only für Tokens
- [ ] Unit-Tests: Token-Leak-Prevention (kein localStorage Access)
- [ ] Security-Review: CSP-Headers gegen XSS

### 1.2.4b: Secrets-Management Policy
- [ ] Define secret storage per environment
- [ ] Rotation policy (90 days)
- [ ] Audit-logging for secret access

### 1.5.8: Security-Headers
- [ ] Content-Security-Policy (CSP)
- [ ] Strict-Transport-Security (HSTS)
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff

---

## Phase 3 (erweitert)

### 3.9: DSGVO-Data-Deletion
- [ ] Anonymization strategy for audit logs
- [ ] Cascade-delete for personal data
- [ ] Right-to-Erasure workflow
- [ ] Legal-hold mechanism

### 3.10: Consent Management
- [ ] Legal-basis definition (Art. 6)
- [ ] Consent-UI on first login
- [ ] Consent-logging
- [ ] Opt-out mechanism

### 3.11: Brute-Force Protection
- [ ] Keycloak brute-force policy
- [ ] Backend rate-limiting
- [ ] Account-lockout after N attempts
- [ ] Captcha on repeated failures

### 3.12: CSRF-Protection
- [ ] Double-submit-cookie pattern
- [ ] CSRF-token validation middleware
- [ ] Frontend token injection

### 3.13: Audit-Log Integrity
- [ ] Hash-chaining for tamper-detection
- [ ] Verification function
- [ ] Anomaly-detection on hash-mismatches
```

---

## 🔐 NOTWENDIGE ZUSÄTZLICHE MASSNAHMEN

### 1. **Threat-Modelling durchführen**

Erstelle ein STRIDE-Modell für IAM:
- **Spoofing:** Token-Forging? (mitigiert durch RS256-Signature)
- **Tampering:** Audit-Log-Manipulation? (mitigiert durch Immutability, Hash-Chaining)
- **Repudiation:** Admin denkt Rollenänderung nicht zu? (mitigiert durch Audit-Logs)
- **Information Disclosure:** Token-Leak? (mitigiert durch HttpOnly)
- **Denial of Service:** Account-Lockout durch Angreifer? (mitigiert durch Brute-Force-Schutz)
- **Elevation of Privilege:** Admin-Impersonation? (mitigiert durch 2FA, Session-Binding)

**Task:** `Phase 3.14: Threat-Modeling & Risk-Assessment`

---

### 2. **Incident-Response-Plan entwickeln**

```markdown
# IAM Incident-Response

## Szenario 1: Token-Leak
1. Detect: Monitoring auf abnormal token usage
2. Respond: Revoke all tokens für betroffenen User
3. Investigate: Audit-Logs durchsuchen
4. Communicate: Betroffenen User notifizieren

## Szenario 2: Unauthorized Role-Assignment
1. Detect: Admin-Dashboard alert on unusual changes
2. Respond: Rolle sofort revoke + new audit-log
3. Investigate: Wer hat geändert? (audit_logs.actor_id)
4. Communicate: Admin + security team

## Szenario 3: Account-Compromise
1. Detect: Failed login attempts → Brute-Force-Alert
2. Respond: Account locken, Email an User senden
3. Investigate: IP-Adressen, User-Agent, Geografische Anomalien
4. Communicate: Password-Reset-Flow anbieten
```

**Task:** `Phase 3.15: Incident-Response-Plan`

---

### 3. **Monitoring & Alerting**

```yaml
Prometheus Metrics:
  - authentication_attempts_total
  - authentication_failures_total
  - token_refresh_requests
  - permission_checks_duration_ms
  - cache_hit_rate
  - audit_log_writes_total

Alerts:
  - Failed login attempts > 5 in 1m → Page on-call
  - Token validation errors > 10 in 5m → Investigation
  - Cache hit rate < 80% → Performance degradation
  - RLS policy violations → Critical alert
```

**Task:** `Phase 3.16: Monitoring & Alerting Setup`

---

### 4. **Security-Schulungen**

```
Für Administratoren:
  - Keycloak-Sicherheitsmanagement
  - Best-Practices für Rollenzuweisung
  - Audit-Log-Analyse

Für Entwickler:
  - Sichere Token-Handling
  - CSRF-Protection
  - RLS-Policy-Troubleshooting
  - Secrets-Management
```

**Task:** `Phase 3.17: Security-Training & Documentation`

---

### 5. **Penetration-Testing**

```
Scope:
  - Token-Tampering
  - Brute-Force-Attacks
  - CSRF-Exploits
  - RLS-Bypasses
  - XSS-Vulnerabilities (Cookie-Stealing)
  
Timing: Nach Phase 3, vor Production-Rollout
```

**Task:** `Phase 3.18: Penetration-Testing`

---

## 🏗️ ARCHITECTURE DECISION RECORDS (ADRs)

### ADR-IAM-001: Token Storage Strategy

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:** All tokens (access + refresh) MUST be stored in HttpOnly, Secure, SameSite=Strict cookies. LocalStorage is FORBIDDEN.

**Rationale:**
- XSS-Schutz: HttpOnly verhindert JavaScript-Zugriff
- CSRF-Schutz: SameSite=Strict verhindert Cross-site-requests
- HTTPS-only: Secure-Flag erzwingt verschlüsselte Übertragung

**Consequences:**
- Frontend kann Tokens nicht direkt lesen (aber kann Requests senden)
- Session-Persistence über Page-Reload erfordert Backend-Cookies
- Mobile-Apps müssen andere Strategie verwenden (WebView vs. Native)

---

### ADR-IAM-002: DSGVO-Compliance (Data-Deletion & Anonymization)

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:** 
1. Audit-Logs werden NICHT gelöscht, aber anonymisiert (personal data → NULL/hash)
2. Account-Daten werden kaskadierend gelöscht nach 30-Tage-Frist
3. "Right to Erasure" ist über Admin-UI + API verfügbar

**Rationale:**
- Audit-Logs müssen erhalten bleiben für forensics
- Personal-Data muss anonymisiert sein für DSGVO-Compliance
- 30-Tage-Frist erlaubt Widerrufs-Optionen

**Consequences:**
- Zusätzliche Complexity in Datenbank-Migrationen
- Audit-Log-Queries müssen anonymisierte Daten berücksichtigen

---

### ADR-IAM-003: Legal Basis & Consent Management

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:**
- Legal Basis: Art. 6(c) – Rechtliche Verpflichtung (Municipality muss Identitäten verwalten)
- Zusätzlich: Art. 6(f) – Berechtigtes Interesse (CMS-Betrieb)
- Consent nicht erforderlich für Basis-Login, aber für "Rollen-Offenlegung" in JWT

**Rationale:**
- Kommune hat rechtliche Verpflichtung, Bürger-Identitäten zu verwalten
- Consent für granulare Datenverarbeitung (wer sieht meine Rolle?)

**Consequences:**
- Privacy-Erklärung muss aktualisiert werden
- Nutzer können "minimale Claims" wählen (nur sub + email)

---

### ADR-IAM-004: Brute-Force Protection & Account Lockout

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:**
- Keycloak: 5 failed attempts → 30-min lockout
- Backend: Rate-limit 5 reqs/min per IP
- Exponential Backoff: 30m → 2h → permanent (manual unlock)
- Captcha nach 3 failed attempts

**Rationale:**
- Brute-Force-Angriffe gegen Kommunen sind häufig
- BSI-Empfehlung: Account-Lockout ist Standard

**Consequences:**
- Benutzer können accounts temporär sperren lassen (DoS-Anfälligkeit)
- Mitigation: IP-Whitelist für Admin-Accounts

---

### ADR-IAM-005: Secrets Management & Rotation

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:**
- Secrets NIEMALS in Source-Code oder .env-Files
- Production: AWS Secrets Manager / HashiCorp Vault
- Rotation: 90-Tage-Zyklus
- Audit-Logging: Wer hat Secret zugegriffen?

**Rationale:**
- Keycloak-Client-Secret ist kritisch
- Kompromittiertes Secret → Angreifer kann Tokens forgen

**Consequences:**
- Deployment-Pipeline muss Secrets-Integration unterstützen
- Developers haben direkten Zugriff auf Secrets (für Debugging)

---

### ADR-IAM-006: Token-Validation & Public-Key-Management

**Status:** PROPOSED  
**Date:** 21. Januar 2026

**Decision:**
- Public-Key wird lokal gecacht (TTL: 24h)
- Bei Token-Validation-Fehler: Fresh-Fetch + Retry (1x)
- Keycloak-Key-Rotation: 90-Tage-Zyklus

**Rationale:**
- Caching reduziert Keycloak-Abhängigkeit
- Stale-Key-Fallback erhöht Resilienz
- 90-Tage-Rotation ist Security-Best-Practice

**Consequences:**
- Kann zu temporären Validierungs-Fehlern führen (mitigiert durch Retry)

---

## 📊 RISK-MATRIX

| Risiko | Severity | Likelihood | Mitigation | Status |
|--------|----------|------------|-----------|--------|
| Token-Speicherung (LocalStorage) | Critical | High | HttpOnly-Only Policy | 🔴 BLOCKER |
| DSGVO-Löschung fehlend | Critical | High | Data-Deletion-Phase | 🔴 BLOCKER |
| Consent nicht implementiert | High | High | Consent-UI + Legal-Basis | 🔴 BLOCKER |
| Brute-Force-Schutz unklar | High | High | Explicit Task + Config | 🟡 MEDIUM |
| Client-Secret unsicher | Critical | Medium | Vault-Integration | 🔴 BLOCKER |
| Public-Key-Rotation fehlt | High | Medium | Caching-Policy + Retry | 🟡 MEDIUM |
| CSRF nicht implementiert | Medium | High | Middleware + Tests | 🟡 MEDIUM |
| Session-Timeout unklar | Medium | Medium | Explicit Policy | 🟡 MEDIUM |
| RLS-Testing nicht konkretisiert | Medium | Medium | Test-Matix | 🟡 MEDIUM |
| Audit-Log-Integrität (Hash) | Medium | Low | Hash-Chaining | 🟡 MEDIUM |

---

## ✅ EMPFOHLENE GATING-KRITERIEN

Vor **Code-Review**:
- [ ] ADR-IAM-001 bis ADR-IAM-006 sind approved
- [ ] Alle 6 kritischen Risiken haben Mitigations-Plan
- [ ] Threat-Modelling ist durchgeführt

Vor **Phase 1 Start**:
- [ ] Keycloak-Instanz + Admin-Zugriff verfügbar
- [ ] Secrets-Management (Vault/AWS SM) konfiguriert
- [ ] Security-Header-Policy definiert (CSP, HSTS, etc.)
- [ ] HTTPS für alle Environments erzwungen

Vor **Phase 2 Start**:
- [ ] Phase 1 Unit- & E2E-Tests grün
- [ ] Security-Audit für Phase 1 bestanden
- [ ] RLS-Policies peer-reviewed

Vor **Phase 3 Start**:
- [ ] Phase 2 Compliance-Tests grün
- [ ] Multi-Tenant-Isolation-Tests erfolgreich
- [ ] Audit-Log-Schema approved

Vor **Production-Rollout**:
- [ ] Penetration-Testing erfolgreich
- [ ] Incident-Response-Plan trainiert
- [ ] Monitoring & Alerting live
- [ ] Security-Team sign-off

---

## 🎓 ZUSAMMENFASSUNG FÜR ENTSCHEIDER

### Kann eine Kommune mit diesem System DSGVO-konform und sicher arbeiten?

**Antwort: BEDINGT JA – Mit den folgenden Auflagen:**

#### ✅ Was funktioniert gut:

1. **Keycloak als IdP:** Solide Wahl, separates Identity Layer
2. **OIDC + PKCE:** Modern, sichere Authentifizierung
3. **Postgres + RLS:** Database-level Multi-Tenancy-Enforcement
4. **Audit-Logging:** Foundation für Compliance vorhanden
5. **7-Personas:** Klare Governance-Struktur
6. **Permission-Caching:** Performance-Anforderung erreichbar

#### 🔴 Was MUSS vor Go-Live behoben werden:

1. **Token-Speicherung:** HttpOnly-Only (nicht localStorage)
2. **DSGVO-Löschung:** Right-to-Erasure implementieren
3. **Consent-Management:** Legal-Basis + Consent-UI
4. **Brute-Force-Schutz:** Explicit Policy + Implementation
5. **Secrets-Management:** Vault-Integration, keine Secrets im Code
6. **Public-Key-Caching:** TTL + Stale-Key-Fallback

#### 🟡 Was noch konkretisiert werden muss:

1. CSRF-Protection (erwähnt, nicht implementiert)
2. Session-Timeouts (keine Werte definiert)
3. MFA (für sensitive Rollen)
4. RLS-Testing (Matrix erforderlich)
5. Incident-Response-Plan

#### 📈 Geschätzter Effort für Korrektionen:

- **Kritische Risiken:** ~60-80 Task-Punkte
- **Mittlere Risiken:** ~40-60 Task-Punkte
- **Gesamter Effort:** +25-35% zu ursprünglichen Estimate

#### 🎯 Fazit:

**Das System ist architektonisch sicher und kann DSGVO-konform umgesetzt werden. Allerdings sind die Implementierungsdetails (insbesondere Security-Defaults) NICHT ausreichend konkretisiert. Vor Code-Start MÜSSEN die 6 kritischen Risiken und 6 ADRs approved sein.**

---

## 📝 CHECKLISTE FÜR NEXT-STEPS

- [ ] Alle ADRs (IAM-001 bis IAM-006) sind approved
- [ ] Alle 6 kritischen Risiken haben konkrete Tasks
- [ ] Security-Tests (Token, RLS, CSRF, etc.) sind geplant
- [ ] Threat-Modelling durchgeführt
- [ ] Legal-Team hat Consent-Anforderungen reviewed
- [ ] IT-Sicherheit hat Keycloak-Sicherheitsconfig approved
- [ ] Incident-Response-Plan ist Draft
- [ ] Penetration-Testing ist geplant (vor Go-Live)

---

**Reviewed by:** SECURITY & PRIVACY OFFICER  
**Review-Datum:** 21. Januar 2026  
**Status:** ⚠️ **CONDITIONAL APPROVAL** – Subject to ADR-IAM-001 bis ADR-IAM-006 Approval

**Unterschrift:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
**Datum:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Anhang: Security-Testing-Matrix

### Phase 1: Authentication & Token

```gherkin
Feature: Token Security

  Scenario: Valid token grants access
    Given a valid JWT token from Keycloak
    When a request is made with this token
    Then the request is processed
    And User-Context is injected

  Scenario: Invalid token is rejected
    Given a malformed JWT token
    When a request is made with this token
    Then the response is 401 Unauthorized
    And no User-Context is injected

  Scenario: Tampered token is rejected
    Given a valid JWT token
    When the token payload is modified
    And the request is made with tampered token
    Then the response is 401 Unauthorized

  Scenario: Expired token triggers refresh
    Given an expired access token
    And a valid refresh token
    When a request is made with expired token
    Then the backend attempts token refresh
    And the request is retried with new token

  Scenario: Token in localStorage is not accessible via JavaScript
    Given a stored JWT token
    When JavaScript code attempts: localStorage.getItem('auth_token')
    Then the result is null or secure (not exposed)

  Scenario: Refresh token is HttpOnly-only
    Given a logout operation
    When the browser console is inspected
    Then no token is visible in Application/Cookies (HttpOnly)
```

### Phase 2: Multi-Tenancy & RLS

```gherkin
Feature: Org-Isolation

  Scenario: User can only see own organization data
    Given User A is member of Org A only
    When User A queries for content
    Then only Org A content is returned
    And Org B, C content is filtered

  Scenario: RLS blocks direct SQL injection
    Given a malicious SQL injection attempt
    When executed directly against DB (bypassing app)
    Then RLS policy prevents access
    And no data is returned

  Scenario: User switches organization context
    Given User A with membership in Org A and Org B
    When User A switches to Org B
    And makes a query
    Then Org B data is returned
    And Org A data is hidden
```

### Phase 3: Authorization & Audit

```gherkin
Feature: Permission Checking

  Scenario: Redakteur can create content
    Given a user with Redakteur role
    When they attempt to create news
    Then the operation succeeds
    And an audit log entry is created

  Scenario: Redakteur cannot publish content
    Given a user with Redakteur role
    When they attempt to publish news
    Then the operation fails with 403 Forbidden
    And the denial is logged

  Scenario: Admin can assign roles
    Given an admin user
    When they assign Redakteur role to another user
    Then the role is assigned
    And an audit log entry shows: actor=admin, subject=user, event=role_assigned

  Scenario: Permission cache is invalidated on role change
    Given a cached permission set for User A
    When User A's role is changed
    Then the cache entry is invalidated
    And the next permission check recomputes
```

---

**END OF REVIEW**
