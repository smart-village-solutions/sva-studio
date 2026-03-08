# Production Build Problem – Systematische Analyse

**Erstellt:** 8. Februar 2026
**Status:** 🔴 Kritisch – Production Build schlägt fehl

---

## 1. Problem-Zusammenfassung

### Kernproblem
```
"AsyncLocalStorage" is not exported by "__vite-browser-external"
```

**Root Cause:** Node.js-spezifischer Server-Code wird von Vite in das Browser-Bundle eingeschlossen.

### Betroffene Dateien
- `packages/sdk/src/observability/context.server.ts` → `AsyncLocalStorage` (node:async_hooks)
- `packages/sdk/src/middleware/request-context.server.ts` → `randomUUID` (node:crypto)
- `packages/sdk/src/logger/index.server.ts` → Winston + OpenTelemetry
- `packages/monitoring-client/src/otel.server.ts` → OpenTelemetry SDK

---

## 2. Architektur-Überblick

### Nx Workspace-Struktur

```
sva-studio (Nx Monorepo)
├── apps/
│   └── sva-studio-react/      ← TanStack Start App (SSR)
│       ├── vite.config.ts
│       └── src/routes/
└── packages/
    ├── sdk/                    ← Server+Client Code
    │   ├── src/
    │   │   ├── index.ts        ← Client-safe exports
    │   │   ├── logger/index.server.ts
    │   │   ├── middleware/request-context.server.ts
    │   │   └── observability/context.server.ts
    │   └── package.json        ← Exports-Konfiguration
    ├── auth/                   ← Auth-System
    │   ├── src/
    │   │   ├── index.ts
    │   │   └── index.server.ts
    │   └── package.json
    └── monitoring-client/      ← OTEL Integration
        └── src/otel.server.ts
```

### Dependency-Graph

```
sva-studio-react (TanStack Start App)
    ↓
@sva/auth
    ↓
@sva/sdk ← Problem hier!
    ↓
Node.js APIs (async_hooks, crypto)
```

---

## 3. TanStack Start Konventionen

### Server vs. Client Code

TanStack Start nutzt **file naming conventions**:

1. **`.server.ts`** → Nur auf dem Server ausführbar
2. **`.client.ts`** → Nur im Browser ausführbar
3. **`.ts`** → Universal (Server + Browser)

### Vite SSR-Modus

Build erstellt **zwei separate Bundles**:
- **Client Bundle** → Läuft im Browser
- **Server Bundle** → Läuft in Node.js (SSR)

**Das Problem:** Vite erkennt `.server.ts` nicht automatisch. Server-Code muss explizit excluded werden.

---

## 4. Aktueller Zustand

### ✅ Was bereits funktioniert

1. **Naming Convention**
   - Dateien korrekt auf `.server.ts` umbenannt
   - `context.ts` → `context.server.ts`
   - `request-context.ts` → `request-context.server.ts`

2. **Package Exports**
   ```json
   // packages/sdk/package.json
   "exports": {
     "./logger/index.server": "./src/logger/index.server.ts",
     "./observability/context.server": "./src/observability/context.server.ts"
   }
   ```

3. **Import Updates (teilweise)**
   - Auth-Package imports aktualisiert
   - Von `@sva/sdk` → `@sva/sdk/logger/index.server`

### ❌ Was NICHT funktioniert

1. **Vite Build Configuration**
   - Keine SSR-spezifische Externals-Konfiguration
   - `.server.ts` wird trotzdem in Client-Bundle verarbeitet

2. **Transitive Dependencies**
   - Wenn `index.ts` (client) intern `.server` imports → Problem
   - Vite kann nicht zwischen Server/Client-Imports differenzieren

---

## 5. Lösungs-Strategie

### Ansatz A: Saubere Package-Trennung (EMPFOHLEN)

#### Prinzip: Zwei separate Exports
```
@sva/sdk
├── /client  → Browser-safe exports
└── /server  → Node.js-only exports
```

**Vorteile:**
- ✅ Klare Trennung
- ✅ Tree-shaking funktioniert
- ✅ Keine Bundler-Magie nötig

**Nachteile:**
- ⚠️ Refactoring erforderlich
- ⚠️ Imports müssen angepasst werden

---

### Ansatz B: Vite SSR Externals (SCHNELLER)

#### Prinzip: Vite konfigurieren, Server-Code zu ignorieren

```ts
// vite.config.ts
export default {
  ssr: {
    noExternal: [],
    external: [
      // Server-only packages
      '@sva/sdk/logger/index.server',
      '@sva/sdk/observability/context.server',
      '@sva/sdk/middleware/request-context.server'
    ]
  }
}
```

**Vorteile:**
- ✅ Schnelle Lösung
- ✅ Kein Refactoring

**Nachteile:**
- ⚠️ Manuell pflegen
- ⚠️ Kann fragil sein

---

### Ansatz C: Hybrid-Lösung (BESTE BALANCE)

Kombination aus A und B:

1. **Phase 1 (sofort):** Vite Config + Exports bereinigen
2. **Phase 2 (nach Launch):** Package-Architektur überarbeiten

---

## 6. Implementierungs-Plan

### 🎯 Phase 1: Sofortige Fixes (heute)

#### Schritt 1: Bereinige `@sva/sdk` Exports

**Problem:** `src/index.ts` exportiert möglicherweise Server-Code
**Lösung:** Audit der Exports

```bash
# Alle Exports in index.ts prüfen
cat packages/sdk/src/index.ts
```

**Regel:** `index.ts` darf NUR browser-safe Code exportieren.

#### Schritt 2: Vite SSR Configuration

```ts
// apps/sva-studio-react/vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  ssr: {
    // Node.js Built-ins nicht shimen
    noExternal: [],

    // Server-only packages explizit ausschließen
    external: [
      '@sva/sdk/logger',
      '@sva/sdk/middleware',
      '@sva/sdk/observability',
    ]
  },

  build: {
    rollupOptions: {
      external: [
        // Node.js modules für Client-Build excluden
        'async_hooks',
        'crypto',
        'fs',
        'path',
      ]
    }
  }
})
```

#### Schritt 3: Package.json Conditions

```json
// packages/sdk/package.json
{
  "exports": {
    ".": {
      "worker": "./src/index.ts",
      "browser": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./server": {
      "types": "./src/index.server.ts",
      "default": "./src/index.server.ts"
    }
  }
}
```

#### Schritt 4: Import Audit

```bash
# Finde alle Imports von Server-Code im Client
grep -r "from '@sva/sdk'" apps/sva-studio-react/src \
  | grep -v ".server"
```

**Regel:** Client-Code darf NIEMALS Server-Exports importieren.

---

### 🔬 Phase 2: Architektur-Verbesserung (später)

#### Ziel: Separate Client/Server Packages

```
packages/
├── sdk-client/          ← Browser-safe
│   └── src/index.ts
├── sdk-server/          ← Node.js-only
│   ├── src/logger/
│   ├── src/middleware/
│   └── src/observability/
└── sdk-shared/          ← Types + Utils
    └── src/types/
```

**Migration:**
```bash
@sva/sdk          → @sva/sdk-client
@sva/sdk/server   → @sva/sdk-server
```

---

## 7. Validierung & Tests

### Build-Test

```bash
# 1. Clean
rm -rf dist .vinxi apps/sva-studio-react/dist

# 2. Build
npx nx run sva-studio-react:build

# 3. Erwartetes Ergebnis
# ✅ Client bundle ohne Node.js modules
# ✅ Server bundle mit vollständigem Code
# ❌ KEINE "AsyncLocalStorage" errors
```

### Bundle-Analyse

```bash
# Client bundle inspizieren
ls -lh apps/sva-studio-react/dist/client/*.js

# Sollte NICHT enthalten:
# - async_hooks
# - node:crypto
# - winston
```

---

## 8. Risiken & Absicherung

### Risiko 1: Breaking Changes
**Mitigation:** Feature-Branch + ausführliche Tests

### Risiko 2: Runtime Errors
**Mitigation:** E2E-Tests vor Deployment

### Risiko 3: Transitive Dependencies
**Mitigation:** `pnpm why <package>` für Dependency-Analyse

---

## 9. Nächste Schritte

### Sofort (heute):

1. ✅ Index.ts Exports bereinigen
2. ✅ Vite Config aktualisieren
3. ✅ Build testen
4. ✅ Dev-Server testen
5. ✅ E2E-Tests durchführen

### Short-term (diese Woche):

6. Documentation Update
7. CI/CD Build-Tests

### Long-term (Q1):

8. Package-Architektur überarbeiten
9. Automatische Export-Validierung

---

## 10. Referenzen

- [TanStack Start Docs - Server vs Client](https://tanstack.com/start)
- [Vite SSR Configuration](https://vitejs.dev/guide/ssr.html)
- [Nx Module Federation](https://nx.dev/concepts/module-federation)
- [Package.json Exports](https://nodejs.org/api/packages.html#exports)

---

## Appendix A: Wichtige Commands

```bash
# Workspace-Struktur anzeigen
npx nx show projects

# Build einzelnes Package
npx nx run sdk:build

# Build App
npx nx run sva-studio-react:build

# Dependency-Graph visualisieren
npx nx graph

# Import-Analyse
grep -r "from '@sva" apps/sva-studio-react/src
```

---

**Nächster Schritt:** Erstelle separates Dokument `BUILD-FIX-IMPLEMENTATION.md` mit konkreten Code-Changes.
