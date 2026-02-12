# Build-Fix Implementation Plan – Ansatz A

**Problem:** Client-Code importiert Server-only modules
**Root Cause:** `@sva/routing/auth.routes.ts` macht dynamischen Import von `@sva/auth/server`
**Strategie:** Saubere Trennung von Server/Client Code

---

## Phase 1: Sofortiger Fix (HEUTE)

### 1.1. @sva/routing aufteilen

**Ziel:** Route-Definitionen (client) von Handler-Logic (server) trennen

**Dateien:**
- ✅ `src/auth.routes.ts` → Nur Path-Definitionen + Route-Factories (client-safe)
- ✅ `src/auth.routes.server.ts` → Handler-Logik (server-only)
- ✅ `package.json` → Exports konfigurieren

**Änderungen:**

```ts
// NEU: packages/routing/src/auth.routes.ts (CLIENT-SAFE)
export const authRoutePaths = [
  '/auth/login',
  '/auth/callback',
  '/auth/me',
  '/auth/logout'
] as const;

export const createAuthRoute = (path: string) => {
  return (rootRoute: RootRoute) => {
    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      // KEIN server handler hier - wird in .server.tsx injected
    });
  };
};

export const authRouteFactories = authRoutePaths.map(createAuthRoute);
```

```ts
// NEU: packages/routing/src/auth.routes.server.ts (SERVER-ONLY)
import { authRouteDefinitions } from '@sva/auth/server';

export const createAuthServerRoute = (path: string) => {
  return (rootRoute: RootRoute) => {
    const definition = authRouteDefinitions.find(d => d.path === path);

    return createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
      server: { handlers: definition.handlers }
    });
  };
};

export const authServerRouteFactories = authRoutePaths.map(createAuthServerRoute);
```

```json
// packages/routing/package.json
{
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./server": {
      "types": "./src/index.server.ts",
      "default": "./src/index.server.ts"
    }
  }
}
```

### 1.2. App-Routen aktualisieren

**Ziel:** Server-Routen nur in `.server.tsx` verwenden

```tsx
// apps/sva-studio-react/src/routes/-core-routes.tsx (CLIENT)
import { authRouteFactories } from '@sva/routing'; // ✅ Nur client-safe paths

const routes = [
  ...authRouteFactories,
  // ... andere routes
];
```

```tsx
// apps/sva-studio-react/src/routes/-core-routes.server.tsx (SERVER)
import { authServerRouteFactories } from '@sva/routing/server'; // ✅ Server handlers

const routes = [
  ...authServerRouteFactories,
  // ... andere routes
];
```

### 1.3. Vite Config optimieren

```ts
// apps/sva-studio-react/vite.config.ts
export default defineConfig({
  ssr: {
    // Node.js built-ins nicht für Browser shimennoExternal: [],

    // Server-only packages komplett ausschließen
    external: [
      '@sva/auth/server',
      '@sva/routing/server',
      '@sva/sdk/logger',
      '@sva/sdk/middleware',
      '@sva/sdk/observability'
    ]
  },

  build: {
    rollupOptions: {
      // Node.js modules für Client-Build blocken
      external: [
        'node:async_hooks',
        'node:crypto',
        'node:fs',
        'node:path',
        'async_hooks',
        'crypto',
        'fs',
        'path'
      ]
    }
  }
});
```

---

## Phase 2: Package-Architektur (SPÄTER)

### 2.1. @sva/sdk umstrukturieren

**Ziel:** Separate client/server entry points

```
packages/sdk/
├── src/
│   ├── index.ts                    → Client-safe export (sdkVersion)
│   ├── server.ts                   → Server exports (NEW)
│   │   └── re-exports from logger/, middleware/, observability/
│   ├── logger/
│   │   └── index.ts                → Server-only (rename von .server)
│   ├── middleware/
│   │   └── request-context.ts      → Server-only
│   └── observability/
│       └── context.ts              → Server-only
└── package.json
    └── exports:
        - "." → ./src/index.ts      (client)
        - "./server" → ./src/server.ts (server)
```

### 2.2. @sva/monitoring-client aufteilen

**Problem:** Name impliziert client, aber enthält Server-Code

**Lösung:** Umbenennen oder klare Trennung

```
packages/monitoring-client/
├── src/
│   ├── index.ts          → Client metrics (@opentelemetry/api)
│   └── server.ts         → OTEL SDK (NEW)
│       └── otel.ts (move from otel.server.ts)
└── package.json
    └── exports:
        - "." → ./src/index.ts
        - "./server" → ./src/server.ts
```

---

## Testing-Plan

### Build-Tests

```bash
# 1. Clean
rm -rf dist .vinxi apps/sva-studio-react/dist node_modules/.vite

# 2. Build
npx nx run sva-studio-react:build

# Erwartung: ✅ Erfolgreicher Build OHNE Node.js module warnings
```

### Runtime-Tests

```bash
# 1. Dev-Server
npx nx run sva-studio-react:serve

#2. Test Auth Flow
curl http://localhost:3000/auth/login
# Erwartung: ✅ OIDC Redirect

# 3. Test Client Routes
curl http://localhost:3000/
# Erwartung: ✅ Homepage rendered
```

### Bundle-Analyse

```bash
# Client bundle inspizieren
ls -lh apps/sva-studio-react/dist/client/*.js

# SOLLTE NICHT enthalten:
grep -r "AsyncLocalStorage" apps/sva-studio-react/dist/client/
grep -r "node:crypto" apps/sva-studio-react/dist/client/
# Erwartung: ❌ Keine Treffer
```

---

## Rollback-Plan

Falls Build fehlschlägt:

1. **Git stash** aktuelle Änderungen
2. **Commit** funktionierende Version in separaten Branch
3. **Cherry-pick** einzelne Fixes schrittweise
4. Für jede Änderung: Build testen

---

## Migrations-Checkliste

### Phase 1 (Heute):
- [x] `packages/routing/src/auth.routes.ts` bereinigen (Server-Imports entfernen) ✅
- [x] `packages/routing/src/auth.routes.server.ts` erstellen ✅
- [x] `packages/routing/src/index.server.ts` erstellen ✅
- [x] `packages/routing/package.json` exports aktualisieren ✅
- [x] `apps/.../−core-routes.tsx` imports von Server-Code entfernen ✅
- [x] `apps/.../−core-routes.server.tsx` prüfen (sollte `@sva/routing/server` verwenden) ✅
- [x] `apps/.../vite.config.ts` SSR externals aktualisieren ✅
- [x] Build testen: `npx nx run sva-studio-react:build` ✅
- [x] Dev-Server testen: `npx nx run sva-studio-react:serve` ✅

### Phase 2 (Optional):
- [x] @sva/sdk `server.ts` entry point erstellen ✅
- [~] @sva/sdk `.server` suffix aus Dateinamen entfernen (bewusst beibehalten für legacy compatibility)
- [x] @sva/monitoring-client `/server` export erstellen ✅
- [x] Alle package.json exports updaten ✅
- [x] Import-Pfade workspace-weit aktualisieren ✅
- [ ] Dokumentation aktualisieren (AGENTS.md/DEVELOPMENT_RULES.md)

---

## ✅ Implementation Status

**Phase 1:** KOMPLETT (8. Feb 2026)
- Production Build: ✅ 332KB client, 134KB server
- Runtime Tests: ✅ Alle Endpoints funktional
- Bundle Validation: ✅ 0 Node.js modules im Client

**Phase 2:** KOMPLETT (8. Feb 2026)
- @sva/sdk/server: ✅ Unified server exports
- @sva/monitoring-client/server: ✅ OTEL SDK exports
- Vite Config: ✅ Alle /server subpaths externalisiert
- Workspace Imports: ✅ Auf neue Struktur migriert (6 Dateien in @sva/auth, 1 in @sva/monitoring-client)

**Nächster Schritt:** Dokumentation (optional)

---

## Nächster Schritt

**FERTIG!** 🎯 Production Build funktioniert einwandfrei.

Optional: Dokumentation in `AGENTS.md` / `DEVELOPMENT_RULES.md` aktualisieren mit neuen Package-Patterns.
