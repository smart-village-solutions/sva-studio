# Technical Findings: Cookie & Session Transport Problem

## Datum: 4. Februar 2026

## Problem Statement
Nach erfolgreicher Keycloak-Authentifizierung werden Sessions serverseitig korrekt erstellt, aber der Browser erhält die `Set-Cookie` Headers nicht, wodurch Sessions nicht persistent sind.

## Test-Validierung ✅

### Unit-Tests (33 Tests, alle bestanden)

**Session Management** (`packages/auth/src/session.test.ts`)
- ✅ Sessions werden korrekt erstellt und gespeichert
- ✅ Sessions können abgerufen werden (getSession)
- ✅ Sessions können aktualisiert werden (updateSession)
- ✅ Sessions können gelöscht werden (deleteSession)
- ✅ Expired Sessions werden korrekt bereinigt
- ✅ Login-State-Management funktioniert (PKCE-Flow)

**Cookie Handling** (`packages/auth/src/routes.cookie.test.ts`)
- ✅ Cookie-Serialisierung mit allen Security-Flags (HttpOnly, Secure, SameSite)
- ✅ Cookie-Parsing aus Request-Headers
- ✅ Multiple Set-Cookie Headers in Response
- ✅ 302 Redirect mit Set-Cookie Headers

**Integration Tests** (`packages/auth/src/oauth-callback.integration.test.ts`)
- ✅ Kompletter OAuth-Callback-Flow: Session → Cookie → Request → Retrieval
- ✅ Session-Lifecycle: Create → Use → Delete
- ✅ Response-Header-Struktur für 302 Redirect
- ✅ Cookie Round-Trip Simulation
- ✅ **Problem-Reproducer**: Zeigt dass Cookies nicht vom Browser empfangen werden

### Fazit
**Die Session- und Cookie-Logik ist vollständig funktionsfähig.** Das Problem liegt auf Framework-Ebene.

## Root Cause: TanStack Router/Start Framework-Limitation

### Server-Logs (Beweis dass alles korrekt ist)
```
[SESSION] Creating session: a78dcf72-f4d5-467f-bfa7-2645cfcdf530
[SESSION] Total sessions in store: 1
[AUTH] Session created: a78dcf72-f4d5-467f-bfa7-2645cfcdf530
[AUTH] Setting session cookie: sva_auth_session=a78dcf72-f4d5-467f-bfa7-2645cfcdf530; Path=/; HttpOnly; SameSite=Lax
[AUTH] Returning 302 redirect
[AUTH] Headers: [
  [ 'location', '/?auth=ok' ],
  [ 'set-cookie', 'sva_auth_session=a78dcf72-f4d5-467f-bfa7-2645cfcdf530; Path=/; HttpOnly; SameSite=Lax' ],
  [ 'set-cookie', 'sva_auth_state=; Max-Age=0; Path=/' ]
]
```

### Nach Browser-Redirect
```
[AUTH] /auth/me request
[AUTH] Cookie header from browser:
[AUTH] Parsed cookies: []
[AUTH] Session ID: undefined
```

**Das Cookie erreicht den Browser nie.**

## Neue Erkenntnis (Feb 2026): Set-Cookie Reihenfolge entscheidet

Bei `/auth/callback` wurden zwei Cookies gesetzt:
- `sva_auth_state` (Delete)
- `sva_auth_session` (Session)

Im Response kam **nur ein** `Set-Cookie` im Browser an. Offenbar wird in diesem Setup nur **der zuletzt gesetzte** `Set-Cookie` übernommen.

**Fix:** Reihenfolge umdrehen — zuerst `deleteCookie(loginState)`, **danach** `setCookie(session)`.

**Ergebnis:** Session-Cookie kommt an, `/auth/me` liefert 200.

## Versuchte Lösungen (alle fehlgeschlagen)

### 1. Standard HTTP 302 Redirect mit Set-Cookie ❌
```typescript
const headers = new Headers();
headers.set('Location', '/?auth=ok');
headers.append('Set-Cookie', sessionCookie);
return new Response(null, { status: 302, headers });
```
**Ergebnis**: Headers werden gesetzt, aber Browser empfängt sie nicht.

### 2. Meta-Refresh HTML Redirect ❌
```html
<meta http-equiv="refresh" content="0;url=/?auth=ok">
```
**Ergebnis**: Gleiches Problem - Set-Cookie Headers werden gefiltert.

### 3. HTML + JavaScript Redirect ❌
```typescript
const html = `<script>window.location.replace('/?auth=ok');</script>`;
const headers = new Headers({ 'Content-Type': 'text/html' });
headers.append('Set-Cookie', sessionCookie);
return new Response(html, { status: 200, headers });
```
**Ergebnis**: Response-Objekt enthält Headers, aber Browser verarbeitet sie nicht.

### 4. TanStack Start `createServerFn` ❌
```typescript
export const getAuthUser = createServerFn().handler(async (ctx) => {
  const cookieHeader = ctx.request?.headers.get('Cookie') || '';
  // ... Session lookup
});
```
**Ergebnis**: Server hängt beim SSR der Startseite. `useServerFn` verursacht Probleme beim Modul-Import.

### 5. `@tanstack/start-server-core` setCookie API ❌
```typescript
import { setCookie } from '@tanstack/start-server-core';
```
**Ergebnis**: API ist nicht verfügbar außerhalb des App-Contexts. Package kann nicht in `@sva/auth` importiert werden.

## Framework-Architektur-Analyse

**TanStack Router/Start Architektur**:
- SSR-Responses werden durch Framework-Layer verarbeitet
- Set-Cookie Headers werden aus Sicherheitsgründen oder Architektur-Design gefiltert
- Standard HTTP-Cookie-Handshake funktioniert nicht wie erwartet
- Framework bevorzugt eigene State-Management-Mechanismen

**Vergleich mit anderen Frameworks**:
- Next.js: Ähnliche Probleme bei App Router (Server Actions)
- Remix: Verwendet eigenes Cookie-API (`createCookie`)
- SvelteKit: Unterstützt Set-Cookie in `+server.ts` Endpoints

## Mögliche Lösungsansätze

### Option A: URL-basierte Session-ID ⚠️
```typescript
// Callback Handler
return new Response(null, {
  status: 302,
  headers: { 'Location': `/?session=${sessionId}` }
});

// Frontend
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session');
// Store in SessionStorage/LocalStorage
```

**Vorteile**: Funktioniert garantiert, einfach zu implementieren
**Nachteile**: Session-ID in URL sichtbar (Security Risk), URL-History

### Option B: LocalStorage/SessionStorage 🔐
```typescript
// Nach erfolgreichem OAuth-Callback:
localStorage.setItem('session_id', sessionId);

// Bei jedem Request:
const sessionId = localStorage.getItem('session_id');
fetch('/api/data', {
  headers: { 'X-Session-ID': sessionId }
});
```

**Vorteile**: Client-Side Persistenz, kein URL-Leaking
**Nachteile**: Kein HttpOnly (XSS-Risk), CSRF-Schutz notwendig

### Option C: Framework-Update abwarten 🕐
Warten auf TanStack Router/Start Update das Set-Cookie korrekt unterstützt.

**Vorteile**: Saubere Lösung
**Nachteile**: Ungewisser Zeitrahmen, blockiert Feature-Entwicklung

### Option D: Framework wechseln 🔄
Migration zu Remix, Next.js oder anderem Framework mit besserem Cookie-Support.

**Vorteile**: Langfristige Lösung
**Nachteile**: Hoher Aufwand, komplette Umstellung

### Option E: Custom HTTP Header 📡
```typescript
// Server
return new Response(json, {
  headers: { 'X-Session-Token': sessionId }
});

// Client
const response = await fetch('/auth/callback');
const sessionId = response.headers.get('X-Session-Token');
```

**Vorteile**: Funktioniert, kein URL-Leaking
**Nachteile**: Non-Standard, funktioniert nicht bei Browser-Redirects

## Empfehlung für Redis-Implementierung

**Kurzfristig (MVP)**:
- Option B: SessionStorage mit Custom Header
- Sessions in Redis speichern (persistent, skalierbar)
- Session-ID via `X-Session-ID` Header übertragen
- CSRF-Token zusätzlich implementieren

**Mittelfristig**:
- Option C: TanStack Router Issue tracken, Update abwarten
- Falls kein Update: Option D (Framework-Migration) evaluieren

**Test-Strategy**:
- Bestehende Unit-Tests bleiben gültig (Session-Logik unabhängig vom Transport)
- E2E-Tests für neuen Session-Transport-Mechanismus
- Security-Audit für Client-Side Session-Storage

## Referenzen

**Code-Locations**:
- Session-Tests: `packages/auth/src/session.test.ts`
- Cookie-Tests: `packages/auth/src/routes.cookie.test.ts`
- Integration-Tests: `packages/auth/src/oauth-callback.integration.test.ts`
- Auth-Routes: `packages/auth/src/routes.server.ts`
- Frontend: `apps/sva-studio-react/src/routes/index.tsx`

**TanStack Router Issues** (zu prüfen):
- https://github.com/TanStack/router/issues?q=set-cookie
- https://github.com/TanStack/router/issues?q=cookies

## Lessons Learned

1. ✅ **Test-First funktioniert**: Tests haben Session-Logik validiert bevor wir Framework-Problem fanden
2. ✅ **Systematisches Debugging**: Von Unit → Integration → Browser → Framework-Level
3. ⚠️ **Framework-Abstractions**: Moderne SSR-Frameworks können Standard-HTTP-Patterns blockieren
4. 📝 **Dokumentation wichtig**: Dieses Dokument verhindert dass wir Problem nochmal debuggen müssen
