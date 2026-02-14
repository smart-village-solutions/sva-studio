# 🔧 IAM-SECURITY: IMPLEMENTATION GUIDE FOR FIXES

**Für:** Entwickler, die die kritischen Sicherheits-Auflagen implementieren  
**Zielgruppe:** Backend-Team  
**Estimated Effort:** 60 Task-Tage (verteilt über Phases 1-3)

---

## 🎯 Überblick der 6 kritischen Fixes

| # | Fix | Phase | Effort | Dependencies |
|---|-----|-------|--------|--------------|
| 1 | **Token-Speicherung** (HttpOnly-Only) | 1 | 5 Tage | - |
| 2 | **DSGVO-Löschung** (Right-to-Erasure) | 3 | 10 Tage | Phase 2 complete |
| 3 | **Consent-Management** | 1 | 5 Tage | Legal review |
| 4 | **Brute-Force-Schutz** | 1 | 7 Tage | - |
| 5 | **Secrets-Management** (Vault) | 1 | 4 Tage | Infra-Setup |
| 6 | **Public-Key-Caching** | 1 | 3 Tage | Keycloak config |

**Gesamtaufwand Phase 1:** ~24 Tage (parallel zu anderen Tasks)  
**Gesamtaufwand Phase 3:** ~10-15 Tage (DSGVO-Löschung)

---

## 🔐 FIX #1: Token-Speicherung (HttpOnly-Only)

### Ziel
Sicherstellen, dass Access- und Refresh-Token NIEMALS in localStorage oder URL landen.

### Implementation

#### Schritt 1: Backend – Token als HttpOnly Cookie setzen

**File:** `packages/core/src/iam/middleware/auth.middleware.ts`

```typescript
import { Response } from 'express'

interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export function setAuthCookies(
  res: Response,
  tokens: TokenResponse,
  secure: boolean = process.env.NODE_ENV === 'production'
) {
  // Access Token: HttpOnly, 15-min expiry
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,           // ✅ Nicht via JavaScript zugänglich
    secure: secure,           // ✅ HTTPS-only
    sameSite: 'strict',       // ✅ CSRF-Schutz
    maxAge: 15 * 60 * 1000,   // 15 Minuten
    path: '/'
  })

  // Refresh Token: HttpOnly, 7-Tage-Expiry
  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    secure: secure,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 Tage
    path: '/api/auth',  // Nur für Refresh-Endpoint
  })

  // Session Cookie: Signal dass User angemeldet ist (kein Token-Wert!)
  res.cookie('authenticated', 'true', {
    httpOnly: false,          // Frontend kann lesen (aber nicht ändern)
    secure: secure,
    sameSite: 'strict',
    maxAge: tokens.expiresIn,
    path: '/'
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' })
  res.clearCookie('refresh_token', { path: '/api/auth' })
  res.clearCookie('authenticated', { path: '/' })
}
```

#### Schritt 2: Frontend – Token extrahieren (NICHT speichern!)

**File:** `apps/studio/src/auth/OIDCProvider.tsx`

```typescript
import { ReactNode, useCallback, useEffect, useState } from 'react'

interface AuthContext {
  isAuthenticated: boolean
  user?: { id: string; email: string }
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
}

export function OIDCProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthContext['user']>()

  // ✅ Auf Page-Load: Cookies sind bereits gesetzt (von Backend)
  // ✅ Keine localStorage-Zugriffen für Tokens!

  const login = useCallback(async (credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',  // 👈 Cookies werden automatisch mitgesendet
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })

    if (response.ok) {
      // ✅ Token ist AUTOMATISCH in HttpOnly-Cookie
      // ✅ Frontend hat KEINEN Zugriff!
      const { user } = await response.json()
      setUser(user)
      setIsAuthenticated(true)
    }
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'  // Cookie wird mitgesendet
    })
    setUser(undefined)
    setIsAuthenticated(false)
  }, [])

  // ✅ Check Page-Load ob noch authenticated
  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
          setIsAuthenticated(true)
        }
      })
      .catch(() => setIsAuthenticated(false))
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

#### Schritt 3: API-Requests mit Credentials

**File:** `apps/studio/src/lib/api-client.ts`

```typescript
// ✅ KORREKT: credentials='include' für Cookie-Übertragung

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',  // 👈 Wichtig! Cookies werden mitgesendet
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  if (response.status === 401) {
    // Token expired, try refresh
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      // Retry original request
      return apiRequest<T>(path, options)
    }
    // Refresh failed, logout
    window.location.href = '/login'
  }

  return response.json()
}

// ✅ Refresh-Token ist in HttpOnly-Cookie (automatisch mitgesendet)
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'  // Refresh-Token in Cookie
    })
    return response.ok
  } catch {
    return false
  }
}
```

#### Schritt 4: Security-Tests

**File:** `packages/core/src/iam/middleware/__tests__/auth.middleware.test.ts`

```typescript
import { setAuthCookies } from '../auth.middleware'

describe('Token Storage Security', () => {
  it('should set access token as HttpOnly cookie', () => {
    const res = mockResponse()
    const tokens = {
      accessToken: 'jwt-token-123',
      refreshToken: 'refresh-token-456',
      expiresIn: 900
    }

    setAuthCookies(res, tokens)

    // Verify HttpOnly flag
    const cookieCall = res.cookie.mock.calls[0]
    expect(cookieCall[2]).toEqual(
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: 'strict'
      })
    )
  })

  it('should NOT store tokens in localStorage', () => {
    // This test runs in Node.js (no localStorage available)
    // But E2E test in browser should verify this:
    // 
    // browser.executeScript("return localStorage.getItem('auth_token')") 
    // → Should return null
  })
})
```

#### Schritt 5: E2E-Test (Browser)

**File:** `e2e/auth.e2e.test.ts`

```typescript
import { browser, by, element, ExpectedConditions as EC } from 'protractor'

describe('Token Storage Security (E2E)', () => {
  it('should not expose token in localStorage', async () => {
    // Login
    await element(by.id('email')).sendKeys('user@example.com')
    await element(by.id('password')).sendKeys('password123')
    await element(by.id('login-btn')).click()

    // Wait for redirect
    await browser.wait(EC.urlContains('/dashboard'), 5000)

    // ✅ Verify localStorage is empty
    const tokenInLocalStorage = await browser.executeScript(
      'return localStorage.getItem("auth_token")'
    )
    expect(tokenInLocalStorage).toBeNull()

    // ✅ Verify sessionStorage is empty
    const tokenInSessionStorage = await browser.executeScript(
      'return sessionStorage.getItem("auth_token")'
    )
    expect(tokenInSessionStorage).toBeNull()

    // ✅ Verify cookies are HttpOnly (can't read from JS)
    const cookieJs = await browser.executeScript(
      'return document.cookie'
    )
    expect(cookieJs).not.toContain('auth_token')
    expect(cookieJs).not.toContain('refresh_token')
  })

  it('should still send cookies in requests', async () => {
    // Login
    await login()

    // Make API request
    const response = await apiRequest('/api/user')

    // ✅ Should be 200 (cookie was sent)
    expect(response.status).toBe(200)

    // ✅ Response should contain user data
    expect(response.body).toHaveProperty('user')
  })
})
```

### Checklist

- [ ] `setAuthCookies()` implementiert mit HttpOnly + Secure + SameSite
- [ ] `clearAuthCookies()` implementiert
- [ ] Frontend: credentials='include' für alle API-Requests
- [ ] Unit-Tests grün
- [ ] E2E-Tests: localStorage/sessionStorage ist leer
- [ ] Code-Review bestätigt: Keine localStorage-Zugriffe auf Tokens
- [ ] HTTPS in allen Umgebungen erzwungen
- [ ] Security-Team Sign-Off

---

## 🔑 FIX #2: Secrets-Management (Vault Integration)

### Ziel
Client-Secret sicher speichern (nicht in Code/Env-Dateien).

### Implementation

#### Schritt 1: Development – .env mit .gitignore

**File:** `.env.example`

```bash
# NEVER commit actual secrets!
KEYCLOAK_CLIENT_SECRET=<get from 1Password/Vault>
```

**File:** `.gitignore`

```bash
# ✅ Environment variables (Development)
.env
.env.local
.env.*.local

# ✅ NO .env.example – it has examples only!
```

**File:** `.env` (Development only, NEVER commit)

```bash
KEYCLOAK_CLIENT_ID=sva-studio-dev
KEYCLOAK_CLIENT_SECRET=xxxx-yyyy-zzzz  # Real secret
KEYCLOAK_REALM=development
```

#### Schritt 2: Production – AWS Secrets Manager

**File:** `packages/core/src/iam/config/secrets-manager.ts`

```typescript
import { SecretsManager } from '@aws-sdk/client-secrets-manager'

class SecretsProvider {
  private client: SecretsManager
  private cache: Map<string, { value: string; expiresAt: number }> = new Map()

  constructor() {
    this.client = new SecretsManager({
      region: process.env.AWS_REGION || 'eu-central-1'
    })
  }

  async getSecret(secretName: string): Promise<string> {
    // Check cache (5-min TTL)
    const cached = this.cache.get(secretName)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }

    try {
      const response = await this.client.getSecretValue({
        SecretId: secretName
      })

      let secretValue: string

      if ('SecretString' in response) {
        const secret = JSON.parse(response.SecretString!)
        secretValue = secret[secretName] || response.SecretString!
      } else {
        secretValue = Buffer.from(
          response.SecretBinary as string,
          'base64'
        ).toString('utf-8')
      }

      // Cache for 5 minutes
      this.cache.set(secretName, {
        value: secretValue,
        expiresAt: Date.now() + 5 * 60 * 1000
      })

      return secretValue
    } catch (error) {
      console.error(`Failed to retrieve secret: ${secretName}`, error)
      throw new Error('Secret retrieval failed')
    }
  }

  async rotateSecret(secretName: string): Promise<void> {
    // Trigger rotation in AWS (manual or Lambda)
    console.log(`Secret rotation triggered: ${secretName}`)
    // Clear cache on rotation
    this.cache.delete(secretName)
  }
}

export const secretsProvider = new SecretsProvider()
```

#### Schritt 3: Keycloak-Config laden

**File:** `packages/core/src/iam/config/keycloak.ts`

```typescript
import { secretsProvider } from './secrets-manager'

export interface KeycloakConfig {
  url: string
  realm: string
  clientId: string
  clientSecret: string
}

export async function loadKeycloakConfig(): Promise<KeycloakConfig> {
  const environment = process.env.NODE_ENV || 'development'

  if (environment === 'development') {
    // Development: Use .env (loaded by dotenv)
    return {
      url: process.env.KEYCLOAK_URL!,
      realm: process.env.KEYCLOAK_REALM!,
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!
    }
  }

  // Production: Use AWS Secrets Manager
  const clientSecret = await secretsProvider.getSecret('iam/keycloak-client-secret')

  return {
    url: process.env.KEYCLOAK_URL!,
    realm: process.env.KEYCLOAK_REALM!,
    clientId: process.env.KEYCLOAK_CLIENT_ID!,
    clientSecret: clientSecret
  }
}
```

#### Schritt 4: Environment-Setup (Infra)

**File:** `infrastructure/terraform/secrets.tf`

```hcl
# Create secret in AWS Secrets Manager
resource "aws_secretsmanager_secret" "keycloak_client_secret" {
  name                    = "iam/keycloak-client-secret"
  description             = "Keycloak OIDC Client Secret"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Service     = "iam"
  }
}

resource "aws_secretsmanager_secret_version" "keycloak_client_secret" {
  secret_id     = aws_secretsmanager_secret.keycloak_client_secret.id
  secret_string = jsonencode({
    "iam/keycloak-client-secret" = var.keycloak_client_secret
  })
}

# Rotation (optional)
resource "aws_secretsmanager_secret_rotation" "keycloak_rotation" {
  secret_id = aws_secretsmanager_secret.keycloak_client_secret.id

  rotation_rules {
    automatically_after_days = 90
  }
}

# IAM Policy für Service
resource "aws_iam_policy" "secrets_access" {
  name   = "iam-service-secrets-access"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.keycloak_client_secret.arn]
    }]
  })
}
```

#### Schritt 5: CI/CD-Pipeline

**File:** `.github/workflows/secrets-check.yml`

```yaml
name: Secrets Management Check

on: [pull_request, push]

jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # ✅ Check für hardcoded secrets
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

      # ✅ Check für .env commits
      - name: Verify .env not committed
        run: |
          if git show HEAD:.env &>/dev/null; then
            echo "❌ ERROR: .env file should not be in git!"
            exit 1
          fi

      # ✅ Check .env.example exists
      - name: Verify .env.example exists
        run: test -f .env.example
```

### Checklist

- [ ] .env.example erstellt (ohne echte Secrets)
- [ ] .gitignore aktualisiert (*.env, .env.local)
- [ ] AWS Secrets Manager konfiguriert
- [ ] `secretsProvider` implementiert
- [ ] `loadKeycloakConfig()` von Backend aufgerufen
- [ ] Terraform/IaC für Secret-Rotation
- [ ] CI/CD Secret-Scanning aktiv
- [ ] Code-Review: Keine Secrets in History
- [ ] Security-Team Sign-Off

---

## 🚨 FIX #3: Brute-Force-Protection

### Ziel
Account-Lockout nach N failed attempts, Captcha, Rate-limiting.

### Implementation

#### Schritt 1: Keycloak-Konfiguration

**Admin-Dashboard:**

1. Realm → Threads & Login Flow
2. Brute Force Protection:
   - Max Login Failures: 5
   - Temporary Lockout: 30 minutes
   - Permanent Lockout: After 3 temporary lockouts
   - Wait Increment: 2 minutes (exponential)

#### Schritt 2: Backend Rate-Limiting

**File:** `packages/core/src/iam/middleware/rate-limiter.ts`

```typescript
import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { redis } from '@/shared/redis'

// ✅ 5 attempts per minute
export const loginLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:login:',
  }),
  windowMs: 60 * 1000,  // 1 minute
  max: 5,               // 5 attempts
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,  // Return RateLimit-* headers
  skip: (req) => {
    // Skip for authenticated users
    return !!req.user
  },
  keyGenerator: (req) => {
    // Rate-limit by IP + email (more targeted)
    const email = req.body?.email || 'unknown'
    return `${req.ip}:${email}`
  }
})

// ✅ 10 refresh attempts per minute
export const refreshLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:refresh:',
  }),
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip
})
```

#### Schritt 3: Login-Endpoint mit Captcha

**File:** `packages/core/src/iam/routes/auth.routes.ts`

```typescript
import express from 'express'
import { loginLimiter } from '../middleware/rate-limiter'
import { verifyCaptcha } from '../middleware/captcha'

const router = express.Router()

router.post(
  '/login',
  loginLimiter,
  async (req, res) => {
    try {
      const { email, password, captchaToken } = req.body

      // Track failed attempts
      const failedKey = `auth:failed:${email}`
      const failedAttempts = await redis.get(failedKey)

      // After 3 failed attempts, require captcha
      if (failedAttempts && parseInt(failedAttempts) >= 3) {
        if (!captchaToken) {
          return res.status(403).json({
            error: 'CAPTCHA_REQUIRED',
            message: 'Please complete the CAPTCHA'
          })
        }

        // Verify captcha
        const isCaptchaValid = await verifyCaptcha(captchaToken)
        if (!isCaptchaValid) {
          return res.status(403).json({
            error: 'CAPTCHA_FAILED',
            message: 'Invalid CAPTCHA'
          })
        }
      }

      // Attempt login via Keycloak
      const tokens = await authenticateWithKeycloak(email, password)

      if (!tokens) {
        // Increment failed attempts
        const currentCount = parseInt(failedAttempts || '0')
        await redis.setex(failedKey, 30 * 60, currentCount + 1)  // 30 min TTL

        // Log failed attempt
        await logAuthEvent('login_failed', {
          email,
          reason: 'invalid_credentials',
          attempt: currentCount + 1,
          ip: req.ip
        })

        // Check if locked out
        if (currentCount + 1 >= 5) {
          return res.status(429).json({
            error: 'ACCOUNT_LOCKED',
            message: 'Account is temporarily locked. Try again in 30 minutes.',
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
          })
        }

        return res.status(401).json({
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          attemptsRemaining: 5 - (currentCount + 1)
        })
      }

      // Successful login: Clear failed attempts
      await redis.del(failedKey)

      // Set cookies
      setAuthCookies(res, tokens)

      // Log successful login
      await logAuthEvent('login', {
        email,
        ip: req.ip,
        userAgent: req.get('user-agent')
      })

      res.json({ success: true })
    } catch (error) {
      console.error('Login error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

export default router
```

#### Schritt 4: Monitoring & Alerting

**File:** `infrastructure/prometheus/alerts.yml`

```yaml
groups:
  - name: iam-security
    rules:
      # Alert if > 10 failed logins per minute
      - alert: HighFailedLoginRate
        expr: rate(auth_login_failures_total[1m]) > 10
        for: 5m
        annotations:
          summary: "High rate of failed login attempts"
          action: "Check for brute-force attack, consider blocking IP"

      # Alert if account is locked > 5 times in 1 hour
      - alert: AccountLockoutSpike
        expr: increase(auth_account_locked_total[1h]) > 5
        for: 5m
        annotations:
          summary: "Multiple account lockouts detected"

      # Alert if response time > 5s (possible DoS)
      - alert: SlowAuthEndpoint
        expr: auth_endpoint_duration_seconds{endpoint="/login"} > 5
        for: 5m
        annotations:
          summary: "Authentication endpoint is slow"
```

### Checklist

- [ ] Keycloak Brute-Force-Policy konfiguriert (5 attempts, 30min)
- [ ] `loginLimiter` implementiert (Express)
- [ ] Failed-Attempt-Tracking in Redis
- [ ] Exponential Backoff implementiert
- [ ] Captcha nach 3. Attempt
- [ ] `logAuthEvent()` für alle Versuche
- [ ] Prometheus Metrics
- [ ] Alerts konfiguriert
- [ ] E2E-Tests für Lockout-Szenarien
- [ ] Security-Team Sign-Off

---

## 🔐 FIX #4: DSGVO-Löschung (Right-to-Erasure)

### Ziel
Implementiere DELETE /api/user mit 30-Tage-Hold und anonymisiertem Audit-Log.

### Implementation Phase 3

*Siehe separate Dokumentation: `DSGVO-Data-Deletion-Implementation-Guide.md`*

(Wird in Phase 3 erstellt)

### Checklist

- [ ] User-Deletion API (`DELETE /api/user`)
- [ ] 30-Tage Legal-Hold
- [ ] Cascade-Delete für accounts, roles, org_memberships
- [ ] Audit-Log Anonymisierung
- [ ] Deletion-Confirmation Email
- [ ] Admin-Dashboard für Deletion-Requests
- [ ] Tests für Datenschutz-Szenarien
- [ ] Legal-Team Review
- [ ] GDPR-Compliance-Check

---

## 🧪 TESTING CHECKLIST FOR ALL FIXES

```bash
# Unit Tests
pnpm test:unit packages/core --grep "token|secret|auth"

# Integration Tests
pnpm test:integration --grep "brute-force|rate-limit"

# E2E Tests
pnpm test:e2e auth

# Security Tests
pnpm test:security:token-storage
pnpm test:security:secrets
pnpm test:security:brute-force

# Static Analysis
pnpm lint packages/core --fix
pnpm test:types

# Secret Scanning
npm audit
npx trufflehog filesystem . --json > trufflehog.json

# HTTPS/Security Headers
curl -I https://dev.sva-studio.local/
# Verify: Strict-Transport-Security, X-Frame-Options, etc.
```

---

## 🚀 ROLLOUT PLAN

### Week 1: Token-Speicherung + Secrets

```
Day 1-2: Token-Speicherung Implementation
  - Backend: setAuthCookies()
  - Frontend: OIDC-Flow, credentials='include'
  - Unit-Tests

Day 3: Security-Tests
  - E2E: localStorage is empty
  - E2E: Cookies are sent
  - Code-Review

Day 4: Secrets-Vault Integration
  - AWS Secrets Manager Setup
  - secretsProvider implementiert
  - CI/CD Secret-Scanning

Day 5: Code-Review + Sign-Off
```

### Week 2: Brute-Force + Consent

```
Day 6-7: Brute-Force-Protection
  - Keycloak Config
  - Rate-Limiter Express Middleware
  - Captcha Integration
  - Prometheus/Alerting

Day 8: Consent-Management
  - Consent-UI auf First-Login
  - Legal-Basis-Documentation
  - Consent-Logging

Day 9-10: Testing + Integration
```

### Week 3: Public-Key-Caching

```
Day 11-13: Public-Key Management
  - Caching-Strategie
  - Stale-Key-Fallback
  - Key-Rotation-Handling

Day 14: Final Tests + Sign-Off
```

---

**Status:** Ready for Implementation  
**Next:** Schedule Kickoff Meeting with Development Team

