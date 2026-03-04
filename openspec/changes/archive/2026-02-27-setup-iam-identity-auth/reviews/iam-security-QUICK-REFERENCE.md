# 🚀 IAM-SECURITY: QUICK REFERENCE CARD

**Für Entwickler & Reviewers – Print & Pin an der Wand!**

---

## 🔐 TOKEN-SICHERHEIT

### ✅ RICHTIG

```typescript
// Token Storage: HttpOnly Cookies ONLY
response.cookie('access_token', token, {
  httpOnly: true,      // ✅ XSS-sicher
  secure: true,        // ✅ HTTPS-only
  sameSite: 'strict'   // ✅ CSRF-sicher
})

response.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 Tage
})
```

### ❌ FALSCH

```typescript
// ❌ NIEMALS localStorage!
localStorage.setItem('auth_token', token)

// ❌ NIEMALS im URL/Query-Param!
window.location = `/?token=${token}`

// ❌ NIEMALS unencrypted over HTTP!
```

---

## 🔑 SECRETS-MANAGEMENT

### ✅ RICHTIG

```typescript
// Production: Use Vault/AWS Secrets Manager
const secret = await getSecretFromVault('iam/keycloak-client-secret')

// Development: Use .env (mit .gitignore!)
process.env.KEYCLOAK_CLIENT_SECRET  // .gitignore ausgeschlossen
```

### ❌ FALSCH

```typescript
// ❌ NIEMALS hardcoded!
const clientSecret = "abc123defXYZ789"

// ❌ NIEMALS in Git!
// git add .env → commit → push

// ❌ NIEMALS in Frontend!
window.KEYCLOAK_SECRET = process.env.REACT_APP_SECRET
```

---

## 🛡️ AUTHENTICATION CHECKLIST

| Check | Status | Wert |
|-------|--------|------|
| **OIDC Flow** | MUST | Authorization Code + PKCE |
| **Token Signing** | MUST | RS256 (asymmetrisch) |
| **Token Validation** | MUST | `jwt.verify()` mit Public-Key |
| **Public-Key Cache** | MUST | TTL 24h + Stale-Fallback |
| **Token Refresh** | MUST | Auto-refresh bei expiry |
| **HTTPS** | MUST | Alle Endpoints |
| **MFA Admin** | MUST | 2FA mandatory für Admins |
| **Brute-Force** | MUST | 5 attempts → 30min lockout |

---

## ⚙️ SESSION-TIMEOUTS

```yaml
# Keycloak-Konfiguration

Access Token TTL: 15 minutes
Refresh Token TTL: 7 days (30 days mit MFA)
Idle Timeout: 30 minutes
Absolute Session Max: 8 hours

# Frontend Logic
if token expires in < 2 min:
  - Warn user: "Session läuft in 2 Min. ab"
  - Auto-refresh attempt
  if fails:
    - Redirect to login
    - Save current URL (for return)
```

---

## 🔍 PERMISSION-CHECKING TEMPLATE

```typescript
async function canUserPerformAction(
  userId: string,
  action: string,
  resourceType: string,
  context?: { organizationId?: string; time?: Date }
): Promise<boolean> {
  // 1. Check Cache (Redis)
  const cached = await redis.get(`perms:${userId}:${context?.organizationId}`)
  if (cached) return cached.includes(`${action}:${resourceType}`)

  // 2. Load Roles (with Org-Hierarchy)
  const roles = await loadRolesWithHierarchy(userId, context?.organizationId)

  // 3. Collect Permissions
  const perms = await aggregatePermissions(roles)

  // 4. Apply ABAC (attributes, time, etc.)
  for (const perm of perms) {
    if (matchesAction(perm, action, resourceType, context)) {
      // Cache for 1 hour
      await redis.setex(`perms:${userId}:${context?.organizationId}`, 3600, perms)
      return true
    }
  }

  return false
}
```

**⚠️ PERFORMANCE:** Must complete in < 50ms (Cache ist critical!)

---

## 📝 LOGGING ESSENTIALS

### ✅ MUSS geloggt werden

```sql
-- Immer ins iam.activity_logs:

INSERT INTO iam.activity_logs (event_type, actor_id, subject_id, timestamp, details)
VALUES
  ('login', 'user123', 'user123', NOW(), '{ip: "192.168.1.1", mfa: true}'),
  ('role_assigned', 'admin1', 'user456', NOW(), '{role: "Redakteur", org_id: "org-1"}'),
  ('permission_denied', 'user789', 'user789', NOW(), '{action: "publish", reason: "no_permission"}'),
  ('account_deleted', 'admin1', 'user999', NOW(), '{reason: "gdpr_request", scheduled_deletion: NOW() + 30d}')
```

### ❌ NIEMALS loggen

```
- Passwords (gehashed in Keycloak)
- Full tokens (nur token-id)
- Credit cards / SSN
- Biometrics
```

---

## 🔐 RLS (ROW-LEVEL-SECURITY)

### ✅ RICHTIG

```sql
-- Postgres RLS Policy

CREATE POLICY org_isolation ON content
  USING (organization_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;

-- In Backend (before DB query):
db.execute("SET app.user_id = ?", [userId])
db.execute("SET app.current_org_id = ?", [organizationId])

// Now ALL queries auto-filter by org
```

### ❌ FALSCH

```typescript
// ❌ App-layer filtering nur!
const content = await db.query('SELECT * FROM content')
const filtered = content.filter(c => c.org_id === orgId)  // Nicht sicher!
```

---

## 🚨 ERROR-HANDLING

```typescript
// Token-Fehler

function handleTokenError(error: TokenError) {
  switch (error.code) {
    case 'INVALID_SIGNATURE':
      return { status: 401, message: 'Unauthorized' }
    
    case 'EXPIRED':
      // Try refresh
      const newToken = await refreshToken()
      if (newToken) return retry(request, newToken)
      return { status: 401, message: 'Session expired' }
    
    case 'NOT_BEFORE':
      return { status: 401, message: 'Token not yet valid' }
    
    case 'AUDIENCE_MISMATCH':
      return { status: 401, message: 'Invalid audience' }
    
    case 'ISSUER_MISMATCH':
      return { status: 401, message: 'Invalid issuer' }
    
    default:
      return { status: 500, message: 'Internal error' }
  }
}
```

---

## ✋ BRUTE-FORCE-PROTECTION

### Keycloak-Config

```
Failed Login Attempts: 5
Lockout Duration: 30 minutes
Max Temporary Lockouts: 3 (dann permanent)
```

### Backend Rate-Limiting

```typescript
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute
  max: 5,                    // 5 requests per window
  message: 'Too many login attempts',
  store: new RedisStore(),   // Redis für distributed systems
  keyGenerator: (req) => req.ip,
  skip: (req) => req.user   // Authenticated users exempt
})

app.post('/api/auth/login', authLimiter, (req, res) => {
  // Process login
})
```

---

## 🎯 DSGVO QUICK-CHECKLIST

| Recht | Implementation |
|------|-----------------|
| **Access** | GET `/api/user/export` → JSON dump |
| **Rectification** | PATCH `/api/user/profile` → update |
| **Erasure** | DELETE `/api/user` → 30-day hold → auto-delete |
| **Restrict** | PATCH `/api/user/restrict` → processing_restricted |
| **Portability** | GET `/api/user/export?format=json` |
| **Object** | PATCH `/api/user/object` → opt-out |
| **Consent** | UI on first login + activity_log |

---

## 🔒 CSRF-PROTECTION

```typescript
// Middleware

import { doubleCsrf } from 'csrf-csrf'

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-csrf-token'
})

// Frontend: Inject token in form/header
<input type="hidden" name="csrf-token" value={csrfToken} />

// Backend: Protected routes
app.post('/api/roles/assign', doubleCsrfProtection, (req, res) => {
  // req.body._csrf validated
})
```

---

## 📊 CACHING STRATEGY

```typescript
// Permission Cache

Key: `iam:perms:${userId}:${orgId}`
Value: Set<Permission>
TTL: 1 hour

// Invalidation Triggers
- User role changes → DELETE key
- Permission updated → DELETE key  
- Org hierarchy changed → DELETE key
- Via Redis Pub/Sub → All instances invalidate

// Fallback
- Cache miss → Query DB + recompute + cache
- Redis down → Query DB (slower but works)
```

---

## 🧪 TEST-CASES TO REMEMBER

```
NEVER skip these tests:

✅ Token with invalid signature → 401
✅ Token with wrong audience → 401
✅ User A (Org A) queries Org B → No results
✅ RLS bypass attempt → No results
✅ Redakteur tries to publish → 403 + logged
✅ Admin assigns role → Audit-log created
✅ 6 failed logins → Account locked 30min
✅ Token expires → Auto-refresh attempt
✅ Refresh token expired → 401 forced logout
✅ CSRF token missing → 403 + logged
```

---

## 📞 EMERGENCY CONTACTS

```
🚨 Security Incident?
  1. Contact security-team@sva-studio.dev
  2. Rotate compromised secrets
  3. Check audit-logs for breaches
  4. Notify datenschutz@kommune.de

🔧 Performance Issue?
  1. Check cache hit-rate (target: > 80%)
  2. Check slow query log (Postgres)
  3. Monitor permission-check duration (target: < 50ms)

🔐 Token Validation Failing?
  1. Check Keycloak public-key (may have rotated)
  2. Force public-key refresh (clear cache)
  3. Verify OIDC client config (issuer, aud)
```

---

## 🎓 Key Principles

1. **Defense in Depth:** Multiple layers (HTTPS, HttpOnly, RLS, Audit-Logs)
2. **Fail Secure:** Default DENY, then ALLOW with evidence
3. **Least Privilege:** Minimal permissions, hierarchical override
4. **Zero Trust:** Validate every token, every time
5. **Audit Everything:** Immutable logs for forensics
6. **User Privacy:** Minimize data collection, DSGVO-first

---

**Print this card and put it in your IDE!**  
**Questions? See full review at: `.github/agents/iam-security-review.md`**

---

*Zuletzt aktualisiert: 21. Januar 2026*
