# SVA Studio - Aktueller Status und Architekturübersicht
**Stand: 10. Februar 2026**

---

## 1. Was funktioniert ✅

### Server & Build
- ✅ **Production Build** ist stabil und lauffähig (vollständig getestet)
- ✅ **Alle 5 Workspace-Packages** kompilieren ohne Fehler
  - `@sva/auth` - OIDC/Keycloak Integration
  - `@sva/routing` - Zentrale Route-Definitionen
  - `@sva/core` - Shared Utilities & Router-Factory-Pattern
  - `@sva/sdk` - Logging, Middleware, OpenTelemetry
  - `@sva/monitoring-client` - OTEL SDK Integration
- ✅ **Package.json Exports** korrekt auf `/dist` Compilate konfiguriert
- ✅ **Dev-Server** lädt auf Port 3000 ohne Fehler
  - Vite Virtual Module Plugin wurde optimiert (`enforce: 'pre'`)
  - Tailwind Config ist korrekt (alle patterns spezifisch zu packages)
- ✅ **Redis** verbindet sich (Session Store funktioniert)

### OAuth/Authentication
- ✅ **`/auth/login`** → HTTP 302 Redirect zu Keycloak OAuth
  - PKCE Challenge korrekt generiert
  - Authorization URL korrekt konstruiert
- ✅ **`/auth/callback`** → Verarbeitet OAuth Code + State
  - Session wird in Redis erstellt (Log: "Auth callback successful")
  - Cookies werden korrekt gesetzt (`sva_auth_state`)
  - Redirect zu `/?auth=ok` funktioniert
- ✅ **`/auth/logout`** → HTTP 200 Logout-Route existiert

### Architektur
- ✅ **Factory-Pattern für Routes** ist implementiert
  - `coreRouteFactories` aus `@sva/routing/server/authServerRouteFactories`
  - Server-Side Handler via TanStack Start integral
- ✅ **Vite Alias-Mappings** zu TypeScript Sources für Dev-SSR
  - Workspace-Packages werden direkt aus source geladen
  - Keine TypeScript-Resolver-Fehler mehr

---

## 2. Was nicht funktioniert ❌

### Session Loading nach Login
**Problem:** Nach erfolgreichem OAuth-Login (`http://localhost:3000/?auth=ok`) bleibt die UI in "Lade Session..." Zustand stecken.

**Symptome:**
- Server antwortet auf HTTP 200 für HTML
- `/auth/me` wird vom Browser **nicht aufgerufen** (kein XHR-Request)
- JavaScript-Hydration lädt nicht fehlerfrei
- User-Daten werden nicht angezeigt

**Ursache (wahrscheinlich):**
- TanStack Start Client-Entry rendering hat einen **Fehler** nach Env-Var-Fix
- Der virtuelle Module-Error ist weg, aber JavaScript führt nicht aus
- Eventuell liegt es daran dass `TSS_DEV_SERVER=false` andere Optionen blockiert

### Session-Daten nicht sichtbar
- Admin/Editor-Bereiche bleiben leer (rollenbasierte Inhalte nicht sichtbar)
- Header zeigt "Login" statt Benutzer-Info

---

## 3. Aktuelle Architektur 🏗️

### Monorepo-Struktur (Nx 22.3.3 + pnpm Workspace)
```
sva-studio/
├── apps/
│   └── sva-studio-react/          # TanStack Start Full-Stack App
│       ├── src/routes/             # TanStack Router route definitions
│       │   ├── -core-routes.server.tsx   # Server-side factories (factory pattern)
│       │   ├── -core-routes.tsx          # Client-side route structure
│       │   ├── __root.tsx                # Root layout
│       │   ├── index.tsx                 # Home page (with session loading)
│       │   └── auth/                     # Auth routes (delegated to @sva/routing/server)
│       └── vite.config.ts          # Vite + TanStack Start config
│
├── packages/
│   ├── auth/                       # @sva/auth - Keycloak OIDC
│   │   ├── src/
│   │   │   ├── auth.server.ts    # getCookie, getSessionUser
│   │   │   ├── routes.server.ts  # HTTP handlers (login, callback, /auth/me, logout)
│   │   │   └── config.ts         # OIDC config
│   │   └── dist/                  # Compiled JS (package.json points here)
│   │
│   ├── routing/                    # @sva/routing - Route Factories
│   │   ├── src/
│   │   │   ├── auth.routes.ts              # Client-safe route definitions
│   │   │   ├── auth.routes.server.ts      # Server-side factories with handlers
│   │   │   └── core.routes.ts             # (unused, for future use)
│   │   └── exports:
│   │       └── ./server → dist/index.server.js (authServerRouteFactories)
│   │
│   ├── core/                       # @sva/core - Router Utilities
│   │   └── buildRouteTree, mergeRouteFactories helpers
│   │
│   ├── sdk/                        # @sva/sdk - Logging & Middleware
│   │   ├── logger/index.server.ts
│   │   ├── middleware/request-context.server.ts
│   │   └── observability/context.server.ts
│   │
│   └── monitoring-client/          # @sva/monitoring-client - OTEL
│       └── OpenTelemetry SDK integration
```

### Package.json Exports Pattern
```json
// packages/routing/package.json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": { "default": "./dist/index.js" },
    "./server": { "default": "./dist/index.server.js" },
    "./auth": { "default": "./dist/auth.routes.js" }
  }
}
```
- **Dev:** Vite-Alias mapped auf `src/*.ts`
- **Prod:** Node.js lädt `/dist/*.js`

---

## 4. Zielbild: Factory-basiertes Routing 🎯

### Ursprüngliches Problem
**File-based Routes + Wildcard Imports** waren Antipattern:
- Jede `auth/*.server.tsx` erzeugte separate Route-Handler
- Manuelle Array-Konstruktion in `router.tsx` → Error-prone
- Keine zentrale Kontrolle über Route-Struktur
- TypeScript Sources wurden direkt geladen (Node.js nicht kompatibel)

### Neu: Factory-Pattern mit Type-Safety
```tsx
// Define routes once in @sva/routing/server
export const authServerRouteFactories = [
  createAuthServerRouteFactory('/auth/login'),     // handler: loginHandler
  createAuthServerRouteFactory('/auth/callback'),  // handler: callbackHandler
  createAuthServerRouteFactory('/auth/me'),        // handler: meHandler
  createAuthServerRouteFactory('/auth/logout'),    // handler: logoutHandler
];

// In app: simply use them
const coreRouteFactories = [
  ...coreRouteFactoriesBase,
  ...authServerRouteFactories,  // ← auto-included, no manual wiring
];
```

### Vorteile dieses Patterns
| Aspekt | Vorher | Nachher |
|--------|--------|---------|
| Route-Definition | Verteilt auf 4 `.server.tsx` Files | Zentral in `@sva/routing/server` |
| Maintenance | Fehlerträglich | Typsicher, One Source of Truth |
| Erweiterbarkeit | Feature = neue Datei + Manual-Register | Feature = neues Factory in Paket |
| Package-Struktur | TypeScript Sources in Prod | Compiled JS in `/dist` |
| Deployment | Problematisch (Node.js kann kein TS) | Clean (ESM-Modules) |

### Ziel für Zukunft
- **Plugin-System:** Externe Pakete können Routes via `authServerRouteFactories` injizieren
- **Zero-Config Routes:** Apps nur noch `coreRouteFactories` importieren, keine manuellen Imports
- **Schema-Registry:** Alle Routes self-documented (wie OpenAPI, aber für TanStack)

---

## 5. Was bringen die einzelnen Tools? 🛠️

### **TanStack Start (v1.159+)**
- **Was:** Full-Stack React Framework mit Server-Side Rendering
- **Bietet:**
  - Embedded Node.js Server für Server Functions & SSR
  - `getCookie(), setCookie(), getResponseHeaders()` für HTTP-APIs
  - Type-safe Server Functions via RPC
  - Automatic code-splitting & hydration
- **Problem jetzt:** v1.149-1.159 hat Bug mit virtuellem Modul `tanstack-start-injected-head-scripts:v`
  - **Workaround:** `TSS_DEV_SERVER=false` in dev script
  - Erwartet Fix in v1.160 (Upstream PR pending)

### **TanStack Router (v1.132+)**
- **Was:** Type-safe routing für React
- **Bietet:**
  - Search Params mit Full Type-Safety
  - Route-Level Code-Splitting
  - Deferred Data Loading (via loaders)
  - HMR-Support in Dev
- **Integration:** Basis für all unsere Route-Factories

### **Vite (v7.3.1)**
- **Was:** Frontend Build Tool + Dev Server
- **Bietet:**
  - Sub-millisecond HMR (Hot Module Replacement)
  - TypeScript + JSX ohne Config
  - SSR Mode (renders server components)
  - Module Aliasing für Workspace-Packages
- **Problem:** SSR Mode kann package.json `exports` nicht immer auflösen
  - **Lösung:** Explicit Alias-Mappings zu TypeScript Sources in Dev

### **Nx (v22.3.3)**
- **Was:** Monorepo Build System & Workspace Manager
- **Bietet:**
  - `nx build` für alle Packages
  - `nx affected` für CI optimization
  - Workspace-Protokoll (`workspace:*` dependencies)
  - Caching & parallel execution
- **Nutzen:** Build cycle für alle Packages in ~2s

### **pnpm v9**
- **Was:** Package Manager mit Workspace-Support
- **Bietet:**
  - Workspace-native Symlinks (schneller als npm/yarn)
  - Lock-file mit Dependencies graph
  - Disk-Space efficient
- **Warum nicht npm/yarn:** Workspace-Symlinking ist besser

### **Redis** (Session Store)
- **Was:** In-Memory Data Store für Sessions
- **Bietet:**
  - Fast Session Lookup (`@sva/auth` → `getSessionUser(sessionId)`)
  - TLS Support für sichere Verbindungen
  - Persistence (RDB/AOF)
- **Status:** ✅ Läuft, Sessions werden gespeichert

### **Keycloak** (OAuth Provider)
- **Was:** Identity & Access Management Server
- **Bietet:**
  - OAuth 2.0 + OIDC
  - User Directory / Roles
  - SSO für integrations
- **Status:** ✅ Externa Staging Server, korrekte Redirects

### **OpenTelemetry (OTEL)**
- **Was:** Observability SDK für Logging/Tracing/Metrics
- **Bietet:**
  - Structured Logging (JSON format)
  - Distributed Tracing Context
  - Metrics Collection
- **Integration:** `@sva/sdk/logger` für alle Components

---

## 6. Nächste Schritte (Priorisierung) 🚀

### **PHASE 1: Fix Client-Side Session Loading (P0 - BLOCKING)**

**Problem:** `/auth/me` wird nicht aufgerufen nach OAuth Callback

**Ursachen (wahrscheinlich):**
1. `TSS_DEV_SERVER=false` blockiert bestimmte Client-Scripts
2. HyDration-Error macht JavaScript nicht ausführbar
3. React Query / Fetch-Wrapper hat einen Bug

**Lösungsansätze (Priorität):**
```
P1. Browser DevTools öffnen → Console nach Errors prüfen
P2. Netzwerk-Tab prüfen → warum wird /auth/me nicht gesendet?
P3. React-DevTools prüfen → useState(user) wurde initialisiert?
P4. Fallback: TSS_DEV_SERVER wegmachen, aber Virtual Module manuell implementieren
P5. Letztes Resort: TanStack Start auf v1.160+ updaten (sobald released)
```

**Action:**
```bash
# 1. Browser öffnen
open http://localhost:3000

# 2. Nach Login auf /auth/callback klicken
# 3. DevTools (F12) → Console Tab
# 4. Schauen nach Fehlern wie:
#    - "Failed to fetch /auth/me"
#    - "Uncaught Error in React render"
#    - "Hydration mismatch"
```

### **PHASE 2: Eliminate TanStack Start Bug (P1 - WORKAROUND)**

**Kurzfristig (diese Woche):**
- Entweder: `TSS_DEV_SERVER=false` ist OK (minimal impact)
- Oder: Virtual Module manuell mocking (vite.config.ts plugin)

**Mittelfristig (nächste 2 Wochen):**
- Monitor TanStack Start upstream for v1.160 release
- Update auf v1.160+ sobald available
- Remove TSS_DEV_SERVER workaround

### **PHASE 3: Plugin Architecture (P2 - Infrastructure)**

**Ziel:** Externe Packages können Routes injizieren ohne app-Code zu ändern

**Umsetzung:**
1. `@sva/routing` → Plugin Registry System
   ```tsx
   export const registerRoutePlugin = (factory: RouteFactory) => {
     plugins.push(factory);
   };
   export const getPluginRoutes = () => plugins;
   ```
2. App importiert zentral:
   ```tsx
   const pluginRoutes = getPluginRoutes();
   const coreRouteFactories = [...base, ...authFactories, ...pluginRoutes];
   ```
3. Dokumentation für Plugin-Entwickler erstellen

**Benefit:** Reduziert boilerplate, ermöglicht Community-Erweiterungen

### **PHASE 4: Session & Role-Based UI (P2 - Feature)**

**Nach Phase 1 Fix:**
1. User-Daten in React Context (z.B. via TanStackQuery)
2. `<AdminSection>` Component mit Role-Check
3. Header mit User-Menu (Name, Avatar, Logout)
4. Redux/Zustand für Client State (optional, TanStackQuery kann reichen)

### **PHASE 5: Monitoring & Observability (P3 - Ops)**

**Konfigurieren:**
1. OTEL Collector für Logs zu Loki
2. Prometheus Metrics exportieren
3. Grafana Dashboards (request rate, auth failures, session lifetime)
4. Alerts für Auth-Fehler konfigurieren

---

## 7. Technische Schulden & Known Issues 🔴

| Issue | Severity | Status |
|-------|----------|--------|
| TanStack Start v1.149-1.159 Virtual Module Bug | P1 | ✅ Workaround implementiert (Vite Plugin mit `enforce: 'pre'`) |
| `/auth/me` wird nicht aufgerufen nach Login | P1 | ⏳ Debugging erforderlich |
| Keine Rollenisolation in UI | P2 | 📋 Phase 4 implementation |
| Package.json main/types/module Duplizierung | P3 | 📋 Später optimieren |

---

## 8. Abhängigkeiten & Blockers 🚧

```
✅ Redis Setup
✅ Keycloak OAuth Staging
✅ All Packages Compiling
⚠️ TanStack Start v1.149 Bug (Workaround: TSS_DEV_SERVER=false)
❌ Client-Side Session Loading (BLOCKER für Phase 1)
❌ Plugin Architecture Design (Ready nach Phase 1)
```

---

## 9. Code Quality & Standards 📋

**Eingehalten:**
- ✅ TypeScript Strict Mode
- ✅ Framework-agnostische Core-Packages
- ✅ Type-safe Routing
- ✅ Workspace-Protokoll Dependencies
- ✅ Logger statt console.*
- ✅ OTEL Structured Logging

**Zu prüfen:**
- Unit Tests für `@sva/routing` factories
- E2E Tests für OAuth Flow
- Accessibility Audit für UI

---

## 10. Empfohlener Wochenplan 📅

**Diese Woche:**
- Mo-Di: **Phase 1** - Client Session Loading debuggen
- Mi: **Phase 2** - TSS_DEV_SERVER Decision treffen
- Do-Fr: **Phase 3** - Plugin Architecture Design

**Nächste Woche:**
- **Phase 4** - Session UI & Role-Based Components
- **Phase 5** - Monitoring setup

---

**Fazit:**
Die **Architektur ist sauber und modern**, aber wir haben einen **Single Blocker auf Session-Loading**. Nach Phase 1 Fix können wir schnell vorankommen mit Plugin-System und Feature-Development. Die **TanStack-Kombination (Router + Start) ist ideal** für unsere Use-Case, erfordert aber Geduld beim Upstream-Bug-Fixing.
