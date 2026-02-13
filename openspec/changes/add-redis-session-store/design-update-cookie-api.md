# Design-Update: TanStack Start Cookie-API prüfen

**Datum:** 4. Februar 2026
**Status:** 🔴 KRITISCHE ERKENNTNIS - Design muss überarbeitet werden

---

## Neue Erkenntnisse

Laut TanStack Start Dokumentation gibt es **offizielle Cookie-APIs**:
- `setCookie()` - Zum Setzen von Cookies
- `setResponseHeaders()` - Zum Setzen von Response-Headers
- `getRequest()` - Zugriff auf Request-Objekt in Server-Functions

**Unsere bisherige Implementation:**
```typescript
// packages/auth/src/routes.server.ts, Zeile 145
const headers = new Headers();
headers.set('Location', '/?auth=ok');
headers.append('Set-Cookie', sessionCookie);  // ❌ Direkt headers.append()
return new Response(null, { status: 302, headers });
```

**Wir haben NICHT verwendet:**
- ❌ `setCookie()` von TanStack Start
- ❌ `setResponseHeaders()` von TanStack Start
- ❌ Server-Functions (`createServerFn`)

## Mögliche Root Cause

**Hypothese:** TanStack Start erwartet, dass Cookies über die offiziellen APIs gesetzt werden, nicht direkt über Response-Headers!

Das würde erklären, warum:
1. Die Headers im Response-Objekt vorhanden sind (Server-Logs zeigen sie)
2. Der Browser sie aber nicht empfängt (Framework filtert "unsichere" Header-Manipulation)

## Was wir noch nicht probiert haben

### Option 1: `setCookie()` API verwenden

```typescript
import { setCookie } from '@tanstack/start';

export const callbackHandler = createServerFn('GET', async (ctx) => {
  const { sessionId } = await handleCallback({ code, state, iss });

  // ✅ TanStack Start offizielle API
  setCookie('sva_session_id', sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });

  // Redirect
  return redirect('/?auth=ok');
});
```

### Option 2: Better Auth Plugin nutzen

Better Auth bietet `reactStartCookies()` Plugin:
```typescript
import { betterAuth } from 'better-auth';
import { reactStartCookies } from 'better-auth/plugins/react-start-cookies';

const auth = betterAuth({
  database: { /* ... */ },
  plugins: [reactStartCookies()],
});
```

Dieses Plugin übernimmt das Cookie-Handling automatisch.

## Aktualisierter Untersuchungsplan

**Phase 1: TanStack Start APIs testen (PRIORITÄT 1)**
1. [ ] `setCookie()` API importieren und verwenden
2. [ ] `createServerFn()` für Callback-Handler nutzen
3. [ ] Testen ob Cookies jetzt im Browser ankommen
4. [ ] Network-Tab prüfen: Werden Set-Cookie Headers jetzt übertragen?

**Phase 2: Server-Function-Integration (falls Phase 1 funktioniert)**
5. [ ] Alle Auth-Handler auf `createServerFn` umstellen
6. [ ] Request-Context korrekt durchreichen
7. [ ] Middleware-Integration mit Server-Functions

**Phase 3: Fallback (falls Phase 1 fehlschlägt)**
8. [ ] Better Auth evaluieren (großer Rewrite!)
9. [ ] Oder: SessionStorage-Workaround implementieren (aktuelles Design)

## Warum das wichtig ist

**Wenn `setCookie()` funktioniert:**
- ✅ Können wir HttpOnly-Cookies nutzen (viel sicherer!)
- ✅ Kein XSS-Risiko durch SessionStorage
- ✅ Standard-konforme Lösung
- ✅ Kein Custom-Header-CORS-Overhead
- ❌ Müssen Code umschreiben (createServerFn statt direkte Handlers)

**Wenn `setCookie()` NICHT funktioniert:**
- ✅ SessionStorage-Design bleibt valide
- ✅ Wir haben eine fundierte Begründung
- ❌ Müssen mit Sicherheits-Trade-offs leben

## Nächster Schritt

**STOP Implementation von SessionStorage-Transport!**

**ERST testen:**
1. `setCookie()` API implementieren
2. Testen ob Browser Cookies empfängt
3. Wenn ja: Design verwerfen, Cookie-basiert bleiben
4. Wenn nein: SessionStorage-Design fortsetzen

## Code-Beispiel für Test

```typescript
// packages/auth/src/routes.server.ts
import { createServerFn, setCookie, redirect } from '@tanstack/start';
import { handleCallback } from './auth.server';

export const callbackHandler = createServerFn('GET', async (ctx) => {
  const url = new URL(ctx.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    throw new Error('Missing OAuth parameters');
  }

  try {
    const { sessionId } = await handleCallback({
      code,
      state,
      iss: url.searchParams.get('iss'),
    });

    console.log('[AUTH] Session created:', sessionId);

    // ✅ TanStack Start offizielle Cookie-API
    setCookie('sva_session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 Tage
    });

    console.log('[AUTH] Cookie set via setCookie() API');

    // Redirect
    return redirect('/?auth=ok');

  } catch (error) {
    console.error('Auth callback error:', error);
    return redirect('/?auth=error');
  }
});
```

## Offene Fragen

1. **Ist `setCookie()` in separaten Packages verfügbar?**
   - Wir verwenden `packages/auth/` (separate Library)
   - TanStack Start könnte erwarten, dass alles im App-Root ist

2. **Funktioniert `createServerFn` außerhalb von Route-Definitionen?**
   - Unsere Handler werden direkt von Router aufgerufen
   - Ggf. Integration-Problem

3. **Gibt es andere Auth-Beispiele mit TanStack Start?**
   - Better Auth funktioniert → also MUSS es gehen
   - Clerk, Lucia Auth → Beispiele finden

## Fazit

**Status:** ⚠️ Design auf HOLD

**Risiko:** Wir bauen einen komplexen SessionStorage-Workaround, obwohl es vielleicht eine einfache Cookie-Lösung gibt!

**Empfehlung:**
1. 🔴 **STOP** SessionStorage-Implementation
2. ✅ **TEST** `setCookie()` API von TanStack Start
3. ⏸️ **HOLD** Design-Review bis Test-Ergebnisse vorliegen

**Zeit-Investment:** 2-4 Stunden für Test, könnte Wochen Workaround-Code sparen!
