# Session-ID Transport Design (Cookie-Workaround)

**Datum:** 4. Februar 2026  
**Status:** ✅ Design Complete - Ready for Implementation  
**Related:** Task 1.3, technical-findings.md, security-compliance-review.md

---

## Problem Statement

TanStack Router/Start blockiert `Set-Cookie` Headers aus SSR-Handlern, wodurch Cookie-basierte Sessions nicht funktionieren. Wir benötigen einen alternativen, **sicheren** Transport-Mechanismus für Session-IDs.

**Constraints:**
- ❌ Cookies funktionieren nicht (Framework-Limitation)
- ✅ Muss HTTPS-only sein
- ✅ Muss XSS-resistent sein
- ✅ Muss CSRF-geschützt sein
- ✅ Muss mit TanStack Router kompatibel sein

---

## Gewählte Lösung: SessionStorage + Custom Header + CSRF-Token

### Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│ OAuth Callback Flow                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Keycloak] ──auth_code──> [/auth/callback]                    │
│                                  │                              │
│                                  │ 1. Token-Exchange            │
│                                  │ 2. Session-ID erstellen      │
│                                  │ 3. Session in Redis          │
│                                  │                              │
│                                  v                              │
│                            [HTML Response]                      │
│                                  │                              │
│                    ┌─────────────┴─────────────┐               │
│                    │ <script>                   │               │
│                    │   sessionStorage.setItem(  │               │
│                    │     'sva_session_id',      │               │
│                    │     '${sessionId}'         │               │
│                    │   );                       │               │
│                    │   sessionStorage.setItem(  │               │
│                    │     'sva_csrf_token',      │               │
│                    │     '${csrfToken}'         │               │
│                    │   );                       │               │
│                    │   window.location = '/';   │               │
│                    │ </script>                  │               │
│                    └────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Subsequent API Requests                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Browser] ──────> [API Request]                               │
│       │                   │                                     │
│       │                   │ Headers:                            │
│       │                   │   X-Session-ID: <session-id>        │
│       │                   │   X-CSRF-Token: <csrf-token>        │
│       │                   │                                     │
│       │                   v                                     │
│       │            [Middleware]                                 │
│       │                   │                                     │
│       │                   │ 1. Session-ID aus Header            │
│       │                   │ 2. CSRF-Token validieren            │
│       │                   │ 3. Session aus Redis laden          │
│       │                   │ 4. User-Context setzen              │
│       │                   │                                     │
│       │                   v                                     │
│       │            [Protected Route]                            │
│       │                                                         │
│       └── sessionStorage ───┐                                   │
│             (Session-ID,    │                                   │
│              CSRF-Token)    │                                   │
│                             │                                   │
└─────────────────────────────┴─────────────────────────────────┘
```

---

## Komponenten-Details

### 1. OAuth Callback Handler (`/auth/callback`)

**Verantwortlichkeiten:**
- Token-Exchange mit Keycloak durchführen
- Session in Redis erstellen
- CSRF-Token generieren
- HTML-Response mit eingebettetem Script zurückgeben

**Implementation:**

```typescript
// packages/auth/src/routes.server.ts

export async function callbackHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    throw new Error('Missing OAuth parameters');
  }
  
  // 1. Token-Exchange
  const { sessionId, user } = await handleCallback({
    code,
    state,
    iss: url.searchParams.get('iss'),
  });
  
  // 2. CSRF-Token generieren
  const csrfToken = randomBytes(32).toString('base64url');
  
  // 3. CSRF-Token mit Session verknüpfen (in Redis)
  await updateSession(sessionId, { csrfToken });
  
  // 4. HTML-Response mit SessionStorage-Injection
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Login erfolgreich</title>
</head>
<body>
  <script>
    // Session-ID und CSRF-Token in SessionStorage
    sessionStorage.setItem('sva_session_id', ${JSON.stringify(sessionId)});
    sessionStorage.setItem('sva_csrf_token', ${JSON.stringify(csrfToken)});
    
    // User-Info (optional, für UI)
    sessionStorage.setItem('sva_user', ${JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
    })});
    
    // Redirect zur Haupt-App
    window.location.replace('/?auth=success');
  </script>
  <noscript>
    <p>JavaScript ist erforderlich. Bitte aktivieren Sie JavaScript und laden Sie die Seite neu.</p>
  </noscript>
</body>
</html>
  `;
  
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
    },
  });
}
```

### 2. Session-Middleware

**Verantwortlichkeiten:**
- Session-ID aus Custom Header extrahieren
- CSRF-Token validieren (für non-GET Requests)
- Session aus Redis laden
- User-Context in Request-Context setzen

**Implementation:**

```typescript
// packages/auth/src/middleware.server.ts

export async function sessionMiddleware(
  request: Request,
  next: () => Promise<Response>
): Promise<Response> {
  // 1. Session-ID aus Header
  const sessionId = request.headers.get('X-Session-ID');
  
  if (!sessionId) {
    // Kein Session-ID = Unauthorized (außer für Public-Routes)
    if (isPublicRoute(request.url)) {
      return next();
    }
    return new Response('Unauthorized', { status: 401 });
  }
  
  // 2. Session aus Redis laden
  const session = await getSession(sessionId);
  
  if (!session) {
    return new Response('Session expired', { status: 401 });
  }
  
  // 3. CSRF-Protection für State-Changing-Requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const csrfToken = request.headers.get('X-CSRF-Token');
    
    if (!csrfToken || csrfToken !== session.csrfToken) {
      console.warn('[AUTH] CSRF validation failed', {
        sessionId,
        userId: session.userId,
        method: request.method,
        url: request.url,
      });
      return new Response('CSRF validation failed', { status: 403 });
    }
  }
  
  // 4. Session-Activity aktualisieren (Sliding-Window)
  await refreshSessionActivity(sessionId);
  
  // 5. User-Context in Request setzen
  request.context = {
    ...request.context,
    sessionId,
    userId: session.userId,
    user: session.user,
  };
  
  return next();
}

function isPublicRoute(url: string): boolean {
  const publicRoutes = [
    '/auth/login',
    '/auth/callback',
    '/auth/logout',
    '/',
    '/public',
  ];
  
  const path = new URL(url).pathname;
  return publicRoutes.some(route => path.startsWith(route));
}
```

### 3. Client-Side Fetch-Wrapper

**Verantwortlichkeiten:**
- Session-ID und CSRF-Token automatisch an alle Requests anhängen
- Session-Expiration erkennen und Logout triggern
- Error-Handling für 401/403

**Implementation:**

```typescript
// apps/sva-studio-react/src/lib/api-client.ts

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 1. Session-ID und CSRF-Token aus SessionStorage
  const sessionId = sessionStorage.getItem('sva_session_id');
  const csrfToken = sessionStorage.getItem('sva_csrf_token');
  
  if (!sessionId) {
    throw new Error('Not authenticated');
  }
  
  // 2. Headers hinzufügen
  const headers = new Headers(options.headers);
  headers.set('X-Session-ID', sessionId);
  
  // CSRF-Token nur bei State-Changing-Requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET')) {
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    }
  }
  
  // 3. Request durchführen
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Falls doch Cookies verwendet werden
  });
  
  // 4. Session-Expiration-Handling
  if (response.status === 401) {
    console.warn('[AUTH] Session expired, triggering logout');
    
    // SessionStorage leeren
    sessionStorage.removeItem('sva_session_id');
    sessionStorage.removeItem('sva_csrf_token');
    sessionStorage.removeItem('sva_user');
    
    // Redirect zu Login
    window.location.href = '/auth/login?expired=true';
  }
  
  // 5. CSRF-Failure-Handling
  if (response.status === 403) {
    console.error('[AUTH] CSRF validation failed');
    // Ggf. CSRF-Token refreshen
  }
  
  return response;
}

// Convenience-Wrapper
export const api = {
  get: (url: string) => authenticatedFetch(url, { method: 'GET' }),
  post: (url: string, body?: unknown) => authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  put: (url: string, body?: unknown) => authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  delete: (url: string) => authenticatedFetch(url, { method: 'DELETE' }),
};
```

### 4. Logout-Handler

**Verantwortlichkeiten:**
- Session aus Redis löschen
- SessionStorage client-side leeren
- Keycloak-Logout durchführen

**Implementation:**

```typescript
// packages/auth/src/routes.server.ts

export async function logoutHandler(request: Request): Promise<Response> {
  const sessionId = request.headers.get('X-Session-ID');
  
  if (sessionId) {
    // 1. Keycloak-Logout-URL generieren
    const logoutUrl = await logoutSession(sessionId);
    
    // 2. HTML mit SessionStorage-Cleanup + Redirect
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Logout</title>
</head>
<body>
  <script>
    // SessionStorage leeren
    sessionStorage.removeItem('sva_session_id');
    sessionStorage.removeItem('sva_csrf_token');
    sessionStorage.removeItem('sva_user');
    
    // Redirect zu Keycloak-Logout
    window.location.replace(${JSON.stringify(logoutUrl)});
  </script>
</body>
</html>
    `;
    
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  
  // Fallback: Direkt zu Keycloak
  const authConfig = getAuthConfig();
  return Response.redirect(authConfig.postLogoutRedirectUri);
}
```

---

## Sicherheits-Analyse

### ✅ Schutz gegen XSS

**Problem:** SessionStorage ist anfällig für XSS-Angriffe (JavaScript kann darauf zugreifen).

**Mitigation:**
1. **Content-Security-Policy (CSP):**
   ```
   Content-Security-Policy: 
     default-src 'self';
     script-src 'self';
     object-src 'none';
     base-uri 'self';
   ```

2. **Input-Sanitization:** Alle User-Inputs durch DOMPurify oder ähnliches

3. **Framework-Security:** React escapt automatisch, aber vorsichtig mit `dangerouslySetInnerHTML`

4. **Subresource Integrity (SRI):** Für externe Scripts

**Risiko-Level:** 🟡 MEDIUM (mit CSP akzeptabel)

### ✅ Schutz gegen CSRF

**Problem:** Custom Headers alleine schützen nicht vor CSRF (Simple-Requests ohne Preflight).

**Mitigation:**
1. **CSRF-Token:** Separate, unvorhersehbare Token-Validierung
2. **SameSite-Cookies (Fallback):** Falls Cookies doch funktionieren, `SameSite=Strict`
3. **Origin/Referer-Check:** Zusätzliche Server-Side-Validierung

**Implementation:**
```typescript
// CSRF-Validation in Middleware
function validateCSRF(request: Request, session: Session): boolean {
  // 1. Token-Check
  const csrfToken = request.headers.get('X-CSRF-Token');
  if (csrfToken !== session.csrfToken) {
    return false;
  }
  
  // 2. Origin-Check (Double-Submit-Pattern)
  const origin = request.headers.get('Origin');
  const allowedOrigins = [process.env.APP_URL, 'http://localhost:3000'];
  
  if (origin && !allowedOrigins.includes(origin)) {
    console.warn('[CSRF] Invalid origin:', origin);
    return false;
  }
  
  return true;
}
```

**Risiko-Level:** ✅ LOW (mit Token + Origin-Check)

### ✅ Schutz gegen Session-Hijacking

**Problem:** Session-ID könnte abgefangen werden (Man-in-the-Middle).

**Mitigation:**
1. **HTTPS-Only:** Alle Requests über TLS 1.3
2. **HSTS-Header:** `Strict-Transport-Security: max-age=31536000; includeSubDomains`
3. **Session-Binding:** IP-Address-Check (optional, aber problematisch bei mobilen Clients)
4. **User-Agent-Binding:** Session an User-Agent binden (leicht zu umgehen, aber zusätzliche Hürde)

**Implementation:**
```typescript
// Session-Creation mit Binding
await createSession(sessionId, {
  userId: user.id,
  csrfToken,
  userAgent: request.headers.get('User-Agent'),
  ipAddress: request.ip, // Optional
  // ...
});

// Validation bei jedem Request
if (session.userAgent !== request.headers.get('User-Agent')) {
  console.warn('[AUTH] User-Agent mismatch, possible session hijacking');
  await revokeSession(sessionId, 'User-Agent mismatch');
  return new Response('Session invalid', { status: 401 });
}
```

**Risiko-Level:** ✅ LOW (mit HTTPS + User-Agent-Binding)

### ⚠️ Einschränkungen vs. Cookie-basierte Sessions

| Aspekt | Cookies (Standard) | SessionStorage (Workaround) |
|--------|-------------------|----------------------------|
| **HttpOnly** | ✅ Ja (XSS-sicher) | ❌ Nein (JavaScript-Zugriff) |
| **SameSite** | ✅ Ja (CSRF-Schutz) | ❌ N/A |
| **Automatisch** | ✅ Browser sendet automatisch | ❌ Manuell per Fetch-Wrapper |
| **Sub-Domains** | ✅ Domain-Sharing möglich | ❌ Same-Origin-Only |
| **CORS** | ✅ Credentials-Support | ⚠️ Preflight für Custom Headers |
| **Standards** | ✅ RFC 6265 | ⚠️ Non-Standard |
| **CSP** | ✅ Keine Konflikte | ⚠️ Erfordert strikte CSP |

**Fazit:** SessionStorage ist **weniger sicher** als HttpOnly-Cookies, aber mit strikter CSP und CSRF-Token **akzeptabel** als temporärer Workaround.

---

## Migration-Strategie

### Phase 1: SessionStorage-Implementierung (Sofort)

1. OAuth-Callback auf HTML-Response mit `<script>` umstellen
2. Session-Middleware implementieren
3. `authenticatedFetch` Client-Wrapper erstellen
4. Alle API-Calls auf Wrapper umstellen

### Phase 2: Security-Härtung (Vor Staging)

5. CSP-Header konfigurieren
6. CSRF-Token-Validierung testen
7. User-Agent-Binding hinzufügen
8. E2E-Tests für Session-Flow

### Phase 3: Cookie-Fallback (Future)

9. Framework-Update auf TanStack Router-Version mit Cookie-Support abwarten
10. Feature-Flag für Cookie vs. SessionStorage
11. Schrittweise Migration zurück zu Cookies
12. SessionStorage-Code als Legacy deprecaten

---

## Testing-Strategie

### Unit-Tests

```typescript
describe('Session Transport', () => {
  it('should inject session-id and csrf-token into SessionStorage', () => {
    const html = generateCallbackHTML(sessionId, csrfToken, user);
    expect(html).toContain('sessionStorage.setItem');
    expect(html).toContain(sessionId);
    expect(html).toContain(csrfToken);
  });
  
  it('should validate CSRF-Token for POST requests', async () => {
    const request = new Request('https://example.com/api/data', {
      method: 'POST',
      headers: {
        'X-Session-ID': sessionId,
        'X-CSRF-Token': 'invalid-token',
      },
    });
    
    const response = await sessionMiddleware(request, () => Promise.resolve(new Response('OK')));
    expect(response.status).toBe(403);
  });
});
```

### Integration-Tests

```typescript
describe('Session Flow E2E', () => {
  it('should complete OAuth flow and store session', async () => {
    // 1. Simulate Keycloak redirect
    const callbackUrl = '/auth/callback?code=abc&state=xyz';
    const response = await fetch(callbackUrl);
    
    // 2. Parse HTML and extract sessionStorage-calls
    const html = await response.text();
    const sessionId = extractSessionId(html);
    const csrfToken = extractCsrfToken(html);
    
    // 3. Simulate authenticated request
    const apiResponse = await fetch('/api/data', {
      headers: {
        'X-Session-ID': sessionId,
        'X-CSRF-Token': csrfToken,
      },
    });
    
    expect(apiResponse.status).toBe(200);
  });
  
  it('should reject request with invalid CSRF token', async () => {
    const response = await authenticatedFetch('/api/data', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'wrong' },
    });
    
    expect(response.status).toBe(403);
  });
});
```

### E2E-Tests (Playwright)

```typescript
test('complete login flow with SessionStorage', async ({ page }) => {
  // 1. Navigate to login
  await page.goto('/auth/login');
  
  // 2. Click Keycloak login
  await page.click('text=Mit Keycloak anmelden');
  
  // 3. Fill credentials in Keycloak
  await page.fill('input[name=username]', 'testuser');
  await page.fill('input[name=password]', 'testpass');
  await page.click('input[type=submit]');
  
  // 4. Wait for redirect and SessionStorage injection
  await page.waitForURL('/');
  
  // 5. Verify SessionStorage
  const sessionId = await page.evaluate(() => sessionStorage.getItem('sva_session_id'));
  const csrfToken = await page.evaluate(() => sessionStorage.getItem('sva_csrf_token'));
  
  expect(sessionId).toBeTruthy();
  expect(csrfToken).toBeTruthy();
  
  // 6. Verify authenticated API call
  const response = await page.evaluate(async () => {
    const res = await fetch('/api/me', {
      headers: {
        'X-Session-ID': sessionStorage.getItem('sva_session_id')!,
      },
    });
    return res.json();
  });
  
  expect(response.user.name).toBe('Test User');
});
```

---

## Dokumentation & Developer-Experience

### 1. API-Client-Docs

```typescript
/**
 * Authenticated API Client
 * 
 * Automatically includes Session-ID and CSRF-Token headers.
 * Handles session expiration and redirects to login.
 * 
 * @example
 * ```typescript
 * import { api } from '@/lib/api-client';
 * 
 * // GET request
 * const user = await api.get('/api/me').then(r => r.json());
 * 
 * // POST request
 * await api.post('/api/posts', { title: 'Hello', content: '...' });
 * ```
 */
```

### 2. Migration-Guide für Entwickler

```markdown
# Migration: Cookie → SessionStorage

## Vorher (funktioniert nicht)
```typescript
// Browser sendet Cookies automatisch
const response = await fetch('/api/data');
```

## Nachher (SessionStorage-Workaround)
```typescript
import { api } from '@/lib/api-client';

// api-client fügt automatisch X-Session-ID Header hinzu
const response = await api.get('/api/data');
```

## Breaking Changes
- Alle `fetch()`-Calls müssen durch `api.*` Wrapper ersetzt werden
- `credentials: 'include'` hat keine Wirkung mehr
- Cross-Origin-Requests benötigen CORS-Preflight
```

### 3. Security-Best-Practices

```markdown
# Session-Security Checklist

✅ CSP konfiguriert (`default-src 'self'`)  
✅ HTTPS-Only in Production  
✅ HSTS-Header aktiv  
✅ CSRF-Token bei State-Changing-Requests  
✅ User-Agent-Binding aktiviert  
✅ Session-Timeout: 30 Minuten Inaktivität  
✅ E2E-Tests für Session-Flow  
❌ IP-Address-Binding (zu restriktiv für Mobile)  
```

---

## Performance-Überlegungen

### 1. Overhead durch Custom Headers

**Preflight-Requests bei CORS:**
```
OPTIONS /api/data HTTP/1.1
Access-Control-Request-Headers: X-Session-ID, X-CSRF-Token

→ +1 Roundtrip bei jedem Cross-Origin-Request
```

**Mitigation:**
- Caching von Preflight-Responses: `Access-Control-Max-Age: 86400`
- Same-Origin-Deployment bevorzugen

### 2. SessionStorage-Größenlimit

**Limit:** ~5-10 MB (Browser-abhängig)

**Current Usage:**
- Session-ID: ~32 Bytes
- CSRF-Token: ~32 Bytes
- User-Info (JSON): ~500 Bytes

**Total:** < 1 KB ✅ Kein Problem

### 3. Middleware-Latency

**Redis-Lookup bei jedem Request:**
- Typ: 1-3 ms (lokal), 5-10 ms (remote)
- Caching: In-Memory-Cache für aktive Sessions (optional)

---

## Offene Fragen & TODOs

### Entscheidungen erforderlich:

1. **User-Agent-Binding aktivieren?**
   - ✅ PRO: Zusätzliche Sicherheit gegen Session-Hijacking
   - ❌ CONTRA: Probleme bei Browser-Updates, Fingerprinting-Privacy-Concerns
   - **Empfehlung:** Ja, aber mit Opt-Out-Möglichkeit

2. **IP-Address-Binding aktivieren?**
   - ✅ PRO: Starker Schutz gegen Session-Hijacking
   - ❌ CONTRA: Mobile-Clients wechseln IPs, VPN-Probleme, Carrier-Grade-NAT
   - **Empfehlung:** Nein (zu restriktiv)

3. **Session-Lifetime?**
   - **Aktuell:** 7 Tage
   - **Sicherheit:** 24 Stunden empfohlen
   - **UX:** Längere Lifetime gewünscht
   - **Empfehlung:** 24h mit "Remember Me" Option (separate Refresh-Token-Handling)

### Implementierungs-TODOs:

- [ ] CSP-Header in Vite/Production-Config
- [ ] HSTS-Header in Production
- [ ] Rate-Limiting für Session-Creation (Anti-Brute-Force)
- [ ] Monitoring: Session-Creation-Rate, CSRF-Failures
- [ ] Documentation: API-Client-Usage, Migration-Guide

---

## Fazit

**Status:** ✅ **Design Complete**

SessionStorage + Custom Header ist ein **valider Workaround** für das Cookie-Problem, mit **akzeptablen Sicherheitsrisiken** bei korrekter Implementierung (CSP, CSRF-Token, HTTPS).

**Nächste Schritte:**
1. ✅ Design-Review mit Team
2. → Implementation (Task 2.3)
3. → E2E-Tests (Task 3.4)
4. → Security-Audit vor Staging

**Langfristig:** Migration zurück zu Cookies, sobald TanStack Router das Problem behebt oder Framework-Wechsel erfolgt.
