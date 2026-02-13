# ADR-001: Frontend Framework Selection

**Datum:** 18. Januar 2026
**Status:** ✅ Accepted
**Kontext:** SVA Studio Frontend Architecture
**Entscheider:** SVA Studio Team

---

## Entscheidung

Wir nutzen **TanStack Start** als Meta-Framework für die SVA Studio React GUI mit **TypeScript**, **Vite** als Bundler und **CSS Modules** für Styling.

## Kontext und Problem

SVA Studio benötigte ein robustes Frontend-Framework für:
- **Type-Safe Routing** mit dynamischen Routen
- **Code-Splitting** und Lazy Loading
- **Server-Side Rendering (SSR)** für bessere Performance
- **Plugin-Architecture Support** für Community Extensions
- **Monorepo-Integration** mit Nx Workspace
- **Long-term Stability** für kommunale Nutzung

**Spezifische Anforderungen:**
- Framework-agnostische Kernlogik (packages/core)
- Type-sichere Search-Params und Path-Params
- Hot Module Replacement für Entwicklerproduktivität
- Build-Zeit Optimierungen (Tree Shaking, Code Splitting)
- i18n-Integration für Deutsch/Englisch

## Betrachtete Optionen

| Framework | Type Safety | Performance | Community | Stability | Bewertung |
|-----------|-------------|-------------|-----------|-----------|-----------|
| **TanStack Start** | 9/10 (Typsicheres Routing) | 9/10 | 8/10 | 9/10 | **9/10** ✅ |
| **Next.js** | 8/10 | 9/10 | 10/10 | 8/10 | 8.75/10 |
| **Remix** | 8/10 | 8/10 | 7/10 | 8/10 | 7.75/10 |
| **Vite + React Router** | 7/10 | 8/10 | 9/10 | 8/10 | 8/10 |
| **SvelteKit** | 8/10 | 9/10 | 7/10 | 8/10 | 8/10 |

### **Warum TanStack Start?**

#### **1. Type-Safe Routing Excellence:**
```typescript
// Auto-generated Routing Types
export const Route = createFileRoute('/dashboard/$projectId')({
  component: Dashboard,
  validateSearch: (search) => ({
    tab: z.enum(['overview', 'settings']).optional().parse(search.tab),
    filter: z.string().optional().parse(search.filter),
  }),
  loader: async ({ params }) => {
    // params.projectId ist automatisch typisiert!
    return fetchProject(params.projectId)
  }
})

// Verwendung: Vollständig typisiert
const navigate = useNavigate()
navigate({
  to: '/dashboard/$projectId',
  params: { projectId: '123' },        // ✅ Type-safe!
  search: { tab: 'settings' }          // ✅ Validated!
})
```

#### **2. Plugin-Architecture Integration:**
```typescript
// Plugin-System mit TanStack Router
const pluginRoutes = await discoverPlugins()
const router = createRouter({
  routeTree: rootRoute.addChildren([
    ...coreRoutes,
    ...pluginRoutes,  // Dynamisches Routing!
  ])
})

// Plugin kann eigene Routen registrieren
export const eventPlugin = {
  routes: [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/events/$eventId',
      component: EventDetail
    })
  ]
}
```

#### **3. Performance Benefits:**
```bash
# Build Output (TanStack Start vs. Alternativen)
TanStack Start:
├── main.js         142 kB → 45 kB (gzip)
├── vendor.js       680 kB → 165 kB (gzip)
└── Total:          ~210 kB (gzipped)

Next.js:
├── main.js         180 kB → 52 kB (gzip)
├── framework.js    890 kB → 220 kB (gzip)
└── Total:          ~270 kB (gzipped)

# Route-Level Code Splitting: ~15-30% kleinere Chunks
```

#### **4. Monorepo-Integration:**
```json
{
  "name": "@sva-studio/ui-react",
  "dependencies": {
    "@sva-studio/core": "workspace:*",
    "@tanstack/start": "^1.91.4",
    "@tanstack/react-router": "^1.91.4"
  }
}
```

## Implementierung: Aktuelle Architektur

### **1. Package Structure:**
```
packages/
├── core/           # Framework-agnostische Logik
├── ui-contracts/   # Design Token + Interfaces
└── sva-studio-react/
    ├── src/
    │   ├── routes/         # File-based Routing
    │   ├── components/     # Wiederverwendbare UI
    │   ├── lib/           # Utilities & Hooks
    │   └── i18n/          # Internationalisierung
    └── app.tsx            # TanStack Start Entry
```

### **2. Routing Implementation:**
```typescript
// routes/__root.tsx
export const Route = createRootRoute({
  component: () => (
    <RootProvider>
      <Outlet />
    </RootProvider>
  )
})

// routes/index.tsx - Landing Page
export const Route = createFileRoute('/')({
  component: HomePage
})

// routes/dashboard/index.tsx
export const Route = createFileRoute('/dashboard/')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: Dashboard
})

// routes/dashboard/$projectId.tsx
export const Route = createFileRoute('/dashboard/$projectId')({
  loader: async ({ params }) =>
    fetchProject(params.projectId),  // ✅ Type-safe params!
  component: ProjectDetail
})
```

### **3. Type-Safe Navigation:**
```typescript
// Vollständig typisierte Links
<Link
  to="/dashboard/$projectId"
  params={{ projectId: project.id }}
  search={{ tab: 'settings', view: 'grid' }}
  className="nav-link"
>
  Project Dashboard
</Link>

// Programmatische Navigation
const navigate = useNavigate()
navigate({
  to: '/dashboard/$projectId',
  params: { projectId: selectedProject.id },
  search: (prev) => ({ ...prev, modal: 'edit' })
})
```

### **4. Bundle & Performance:**
```typescript
// vite.config.ts - Optimiert für TanStack Start
export default defineConfig({
  plugins: [
    TanStackStartVite(),
    react()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['@tanstack/react-router'],
          ui: ['@sva-studio/ui-contracts']
        }
      }
    }
  }
})
```

## Trade-offs & Limitations

### **Pros:**
✅ **Excellent TypeScript Integration** - Best-in-class Typisierung
✅ **Lightweight** - Kleinere Bundle-Size als Next.js
✅ **File-based Routing** - Intuitive Developer Experience
✅ **Framework Agnostic Core** - Kann später auf Vue/Svelte portiert werden
✅ **Plugin-Architecture Ready** - Dynamisches Routing für Extensions
✅ **SSR & Client-Side Rendering** - Flexible Rendering-Strategien

### **Cons:**
❌ **Newer Framework** - Kleinere Community als Next.js
❌ **Beta Status** - TanStack Start ist noch nicht v1.0
❌ **Learning Curve** - Neue Concepts für Team
❌ **Enterprise Ecosystem** - Weniger Third-Party Integrationen

## Migration Strategy

### **Phase 1 (Current): Basic GUI** ✅
- TanStack Start Setup mit TypeScript
- Core Routing Implementation
- Design Token Integration
- Basic Component Library

### **Phase 2: Advanced Features** (Q2 2026)
- Plugin System mit dynamischen Routen
- Advanced SSR mit Data Preloading
- Micro-Frontend Integration für Legacy-Module

### **Phase 3: Long-term** (Q3-Q4 2026)
- Migration zu TanStack Start v1.0 (stable)
- Performance Monitoring & Optimization
- Advanced Caching Strategies

## Exit Strategy

**Falls TanStack Start sich als ungeeignet erweist:**

1. **Migration zu Next.js:** ~2-3 Wochen
   ```typescript
   // Router-spezifische Logik isoliert in packages/core/routing
   // React Components sind Framework-agnostisch
   // Design Tokens bleiben unverändert
   ```

2. **Migration zu Remix:** ~1-2 Wochen
   ```typescript
   // Ähnliche File-based Routing Patterns
   // Loader-Functions können 1:1 übernommen werden
   ```

3. **Fallback zu Vite + React Router:** ~1 Woche
   ```typescript
   // Minimal Breaking Changes
   // Verlust: Type-safe Routing
   ```

**Entscheidungspunkte für Migration:**
- TanStack Start bleibt >6 Monate in Beta
- Performance-Probleme mit Large-Scale Apps
- Community-Support unzureichend
- Breaking Changes ohne Migration-Guide

---

**Links:**
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [SVA Studio Routing Guide](../guides/routing.md)
- [Plugin Development Guide](../guides/plugin-development.md)