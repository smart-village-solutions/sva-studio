# ADR-002: Plugin Architecture Pattern

**Datum:** 18. Januar 2026
**Status:** ✅ Accepted
**Kontext:** SVA Studio Extensibility & Community Development
**Entscheider:** SVA Studio Team, Community Input

---

## Entscheidung

Wir implementieren ein **Interface-Segregation Plugin System** mit **Type-Safe Plugin Contracts**, **Dynamic Route Registration** und **Isolated Plugin Sandboxes** für Community-entwickelte Extensions.

## Kontext und Problem

SVA Studio soll durch Community-Plugins erweiterbar sein für:
- **Kommune-spezifische Features** (Events, Bürgerservice, Tourismus)
- **Third-Party Integrations** (Payment, Analytics, CRM)
- **Custom Workflows** für verschiedene Verwaltungsebenen
- **Design System Extensions** (Custom Themes, Components)

**Technische Anforderungen:**
- Type-safe Plugin Interface
- Runtime Plugin Loading/Unloading
- Isolated Plugin Execution (Security)
- Hot Module Replacement für Development
- Plugin Dependency Management
- Version Compatibility Checks

**Sicherheitsanforderungen:**
- Sandbox-Isolation für untrusted Code
- Content Security Policy Integration
- Plugin Permission System
- Audit Trail für Plugin-Aktivitäten

## Betrachtete Architektur-Patterns

| Pattern | Type Safety | Performance | Security | Flexibility | Bewertung |
|---------|-------------|-------------|----------|-------------|-----------|
| **Interface Segregation** | 9/10 | 8/10 | 9/10 | 9/10 | **8.75/10** ✅ |
| **Event-Driven Architecture** | 7/10 | 9/10 | 7/10 | 8/10 | 7.75/10 |
| **Micro-Frontend Pattern** | 6/10 | 7/10 | 9/10 | 9/10 | 7.75/10 |
| **Shared Module System** | 8/10 | 9/10 | 5/10 | 7/10 | 7.25/10 |

## Entscheidung: Interface Segregation Plugin System

### **Core Plugin Interface:**

```typescript
// packages/core/src/plugin/types.ts
export interface PluginBase {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly dependencies?: PluginDependency[];
  readonly permissions?: PluginPermission[];
}

export interface PluginDependency {
  pluginId: string;
  version: string;
  optional?: boolean;
}

export interface PluginPermission {
  type: 'api' | 'storage' | 'navigation' | 'ui-modification';
  scope: string[];
  reason: string;  // User-visible explanation
}
```

### **Segregated Plugin Interfaces:**

#### **1. UI Plugin Interface:**
```typescript
export interface UIPlugin extends PluginBase {
  type: 'ui';

  // React Component Registration
  components?: Record<string, React.ComponentType>;

  // Custom Routes
  routes?: Array<{
    path: string;
    component: React.ComponentType;
    layout?: string;
    permissions?: string[];
  }>;

  // Navigation Items
  navigation?: Array<{
    label: string;
    path: string;
    icon?: React.ComponentType;
    position: 'sidebar' | 'header' | 'footer';
    order?: number;
  }>;

  // Theme Extensions
  theme?: {
    tokens?: Record<string, string>;
    components?: Record<string, object>;
  };
}

// Beispiel: Event-Management Plugin
const eventPlugin: UIPlugin = {
  id: 'sva-events',
  name: 'SVA Event Management',
  version: '1.0.0',
  description: 'Event planning and management for municipalities',
  author: 'SVA Community',
  type: 'ui',

  routes: [
    {
      path: '/events',
      component: EventListPage,
      permissions: ['events.read']
    },
    {
      path: '/events/create',
      component: EventCreatePage,
      permissions: ['events.write']
    }
  ],

  navigation: [
    {
      label: 'Events',
      path: '/events',
      icon: CalendarIcon,
      position: 'sidebar',
      order: 3
    }
  ],

  components: {
    EventCard: EventCardComponent,
    EventCalendar: CalendarComponent
  }
};
```

#### **2. API Plugin Interface:**
```typescript
export interface APIPlugin extends PluginBase {
  type: 'api';

  // API Route Handlers
  handlers?: Record<string, APIHandler>;

  // Middleware Functions
  middleware?: Array<{
    path: string;
    handler: MiddlewareFunction;
    priority: number;
  }>;

  // Database Schema Extensions
  schema?: {
    tables?: TableDefinition[];
    migrations?: Migration[];
  };

  // Background Jobs
  jobs?: Array<{
    name: string;
    schedule: string;  // Cron-like
    handler: JobHandler;
  }>;
}

type APIHandler = (req: APIRequest, res: APIResponse) => Promise<void>;

// Beispiel: Payment Gateway Plugin
const paymentPlugin: APIPlugin = {
  id: 'sva-payments',
  name: 'Payment Gateway',
  version: '2.1.0',
  type: 'api',

  handlers: {
    '/api/payments/process': processPaymentHandler,
    '/api/payments/webhook': webhookHandler
  },

  middleware: [
    {
      path: '/api/payments/*',
      handler: authenticationMiddleware,
      priority: 1
    }
  ],

  schema: {
    tables: [
      {
        name: 'payment_transactions',
        columns: [
          { name: 'id', type: 'uuid', primary: true },
          { name: 'amount', type: 'decimal', precision: 10, scale: 2 },
          { name: 'status', type: 'enum', values: ['pending', 'completed', 'failed'] }
        ]
      }
    ]
  }
};
```

#### **3. Integration Plugin Interface:**
```typescript
export interface IntegrationPlugin extends PluginBase {
  type: 'integration';

  // External Service Connectors
  connectors?: Record<string, ServiceConnector>;

  // Data Synchronization
  sync?: Array<{
    source: string;
    target: string;
    schedule: string;
    transform?: DataTransform;
  }>;

  // Webhook Endpoints
  webhooks?: Array<{
    url: string;
    events: string[];
    security: WebhookSecurity;
  }>;
}

// Beispiel: CRM Integration
const crmPlugin: IntegrationPlugin = {
  id: 'sva-crm-hubspot',
  name: 'HubSpot CRM Integration',
  version: '1.3.0',
  type: 'integration',

  connectors: {
    contacts: new HubSpotContactConnector(),
    companies: new HubSpotCompanyConnector()
  },

  sync: [
    {
      source: 'sva.citizens',
      target: 'hubspot.contacts',
      schedule: '0 */6 * * *',  // Every 6 hours
      transform: citizenToContactTransform
    }
  ]
};
```

## Plugin Lifecycle Management

### **1. Plugin Discovery & Loading:**
```typescript
// packages/core/src/plugin/manager.ts
export class PluginManager {
  private plugins = new Map<string, LoadedPlugin>();
  private dependencies = new DependencyGraph();

  async discoverPlugins(): Promise<PluginManifest[]> {
    const manifestPaths = await glob('plugins/*/plugin.json');
    return Promise.all(
      manifestPaths.map(path => this.loadManifest(path))
    );
  }

  async loadPlugin(manifest: PluginManifest): Promise<void> {
    // 1. Dependency Resolution
    await this.resolveDependencies(manifest);

    // 2. Security Validation
    await this.validatePermissions(manifest);

    // 3. Dynamic Import
    const plugin = await this.dynamicImport(manifest);

    // 4. Type Validation
    this.validatePluginInterface(plugin);

    // 5. Registration
    await this.registerPlugin(plugin);

    // 6. Initialization
    await this.initializePlugin(plugin);
  }

  private async dynamicImport(manifest: PluginManifest) {
    // Hot Module Replacement Support
    if (process.env.NODE_ENV === 'development') {
      return await import(`${manifest.entrypoint}?t=${Date.now()}`);
    }

    return await import(manifest.entrypoint);
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;

    // 1. Cleanup Resources
    await plugin.cleanup?.();

    // 2. Remove Routes
    this.routingManager.removePluginRoutes(pluginId);

    // 3. Unregister Components
    this.componentRegistry.unregister(pluginId);

    // 4. Memory Cleanup
    this.plugins.delete(pluginId);
  }
}
```

### **2. Type-Safe Plugin Registration:**
```typescript
// packages/core/src/plugin/registry.ts
export class PluginRegistry {
  private uiPlugins = new Map<string, UIPlugin>();
  private apiPlugins = new Map<string, APIPlugin>();
  private integrationPlugins = new Map<string, IntegrationPlugin>();

  register<T extends PluginBase>(plugin: T): void {
    switch (plugin.type) {
      case 'ui':
        this.registerUIPlugin(plugin as UIPlugin);
        break;
      case 'api':
        this.registerAPIPlugin(plugin as APIPlugin);
        break;
      case 'integration':
        this.registerIntegrationPlugin(plugin as IntegrationPlugin);
        break;
      default:
        throw new Error(`Unknown plugin type: ${(plugin as any).type}`);
    }
  }

  private registerUIPlugin(plugin: UIPlugin): void {
    // Route Registration
    plugin.routes?.forEach(route => {
      this.routingManager.addRoute({
        ...route,
        pluginId: plugin.id,
        permissions: route.permissions || []
      });
    });

    // Component Registration
    if (plugin.components) {
      Object.entries(plugin.components).forEach(([name, component]) => {
        this.componentRegistry.register(
          `${plugin.id}.${name}`,
          component
        );
      });
    }

    // Theme Registration
    if (plugin.theme?.tokens) {
      this.themeManager.registerPluginTokens(plugin.id, plugin.theme.tokens);
    }

    this.uiPlugins.set(plugin.id, plugin);
  }
}
```

### **3. Plugin Sandbox Security:**
```typescript
// packages/core/src/plugin/sandbox.ts
export class PluginSandbox {
  private allowedAPIs: Set<string>;
  private permissions: PluginPermission[];

  constructor(plugin: PluginBase) {
    this.permissions = plugin.permissions || [];
    this.allowedAPIs = this.computeAllowedAPIs();
  }

  createSandboxedContext(): PluginContext {
    const restrictedFetch = this.createRestrictedFetch();
    const restrictedStorage = this.createRestrictedStorage();

    return {
      // Core APIs
      fetch: restrictedFetch,
      localStorage: restrictedStorage,

      // SVA-specific APIs
      sva: {
        ui: this.hasPermission('ui-modification') ? this.uiAPI : undefined,
        data: this.hasPermission('storage') ? this.dataAPI : undefined,
        navigation: this.hasPermission('navigation') ? this.navigationAPI : undefined,
      },

      // Utility Functions
      logger: this.createLogger(),

      // Plugin Communication
      events: this.eventBus,
    };
  }

  private createRestrictedFetch(): typeof fetch {
    return async (input: RequestInfo, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.url);

      if (!this.isAllowedDomain(url.hostname)) {
        throw new SecurityError(`Fetch to ${url.hostname} not permitted`);
      }

      return fetch(input, init);
    };
  }

  private hasPermission(type: PluginPermission['type']): boolean {
    return this.permissions.some(p => p.type === type);
  }
}
```

## Plugin Development Experience

### **1. TypeScript Plugin Template:**
```bash
# Plugin Generator
npx @sva-studio/create-plugin my-event-plugin --type=ui

# Generiert:
my-event-plugin/
├── plugin.json           # Plugin Manifest
├── src/
│   ├── index.ts          # Plugin Entry Point
│   ├── components/       # React Components
│   ├── routes/           # Route Definitions
│   └── types/            # TypeScript Definitions
├── package.json
├── tsconfig.json         # Pre-configured
└── README.md
```

### **2. Plugin Manifest:**
```json
{
  "id": "sva-events",
  "name": "Event Management",
  "version": "1.0.0",
  "description": "Comprehensive event planning and management",
  "author": "Municipality of Example City",
  "type": "ui",
  "entrypoint": "./dist/index.js",
  "dependencies": [
    {
      "pluginId": "sva-auth",
      "version": ">=1.0.0"
    }
  ],
  "permissions": [
    {
      "type": "storage",
      "scope": ["events.*"],
      "reason": "Store and retrieve event data"
    },
    {
      "type": "api",
      "scope": ["/api/events/*"],
      "reason": "Manage event API endpoints"
    }
  ],
  "compatibility": {
    "svaStudio": ">=1.0.0",
    "node": ">=18.0.0"
  }
}
```

### **3. Plugin Development Workflow:**
```bash
# Development Setup
cd plugins/my-event-plugin
npm install
npm run dev          # Hot reload mit SVA Studio

# Type Checking
npm run type-check   # Plugin interface validation

# Testing
npm run test         # Unit tests
npm run test:integration  # Integration mit SVA Studio

# Building
npm run build        # Production bundle
npm run package      # .sva plugin archive

# Publishing
npm publish          # NPM registry
# oder: SVA Plugin Marketplace
```

## Performance Optimizations

### **1. Lazy Plugin Loading:**
```typescript
// Nur laden wenn Route besucht wird
const EventManagementPage = lazy(() =>
  import('@sva-plugins/events').then(m => ({ default: m.EventManagementPage }))
);

// Plugin-spezifische Chunks
const pluginChunks = {
  'sva-events': () => import('@sva-plugins/events'),
  'sva-payments': () => import('@sva-plugins/payments'),
  'sva-tourism': () => import('@sva-plugins/tourism'),
};
```

### **2. Plugin Bundle Analysis:**
```typescript
// vite.config.ts Plugin-optimiert
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@sva-plugins/')) {
            const pluginName = id.split('@sva-plugins/')[1].split('/')[0];
            return `plugin-${pluginName}`;
          }

          if (id.includes('node_modules')) {
            return 'vendor';
          }

          return 'main';
        }
      }
    }
  }
});

// Bundle Size Monitoring
// main.js: ~45 kB gzipped
// plugin-events.js: ~15 kB gzipped (lazy loaded)
// plugin-payments.js: ~22 kB gzipped (lazy loaded)
```

### **3. Plugin Communication:**
```typescript
// Event-driven Plugin Communication
export class PluginEventBus {
  private listeners = new Map<string, Set<EventListener>>();

  emit(event: string, data: any, source: string): void {
    const listeners = this.listeners.get(event) || new Set();

    listeners.forEach(listener => {
      // Async execution, non-blocking
      setImmediate(() => {
        try {
          listener(data, source);
        } catch (error) {
          console.error(`Plugin event error in ${event}:`, error);
        }
      });
    });
  }

  on(event: string, listener: EventListener, pluginId: string): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const wrappedListener = (data: any, source: string) => {
      // Plugin sandbox check
      if (this.hasPermission(pluginId, event)) {
        listener(data, source);
      }
    };

    this.listeners.get(event)!.add(wrappedListener);
  }
}

// Plugin Usage
const eventPlugin = {
  init(context: PluginContext) {
    // Listen for citizen registrations
    context.events.on('citizen.registered', (citizen) => {
      // Auto-create default event preferences
      this.createDefaultEventPreferences(citizen);
    });

    // Emit event when new event created
    context.events.emit('event.created', newEvent, 'sva-events');
  }
};
```

## Security & Compliance

### **DSGVO-konforme Plugin-Isolation:**
```typescript
// packages/core/src/plugin/privacy.ts
export class PluginPrivacyManager {
  trackDataAccess(pluginId: string, dataType: string, purpose: string): void {
    // Audit Trail für DSGVO-Compliance
    this.auditLogger.log({
      timestamp: new Date(),
      pluginId,
      action: 'data.access',
      dataType,
      purpose,
      legalBasis: this.getLegalBasis(dataType),
    });
  }

  requestDataProcessing(
    pluginId: string,
    citizenId: string,
    dataTypes: string[]
  ): Promise<boolean> {
    // User Consent Management
    return this.consentManager.requestConsent({
      pluginId,
      citizenId,
      dataTypes,
      purpose: this.getPluginPurpose(pluginId),
    });
  }
}
```

### **Content Security Policy:**
```typescript
// Plugin-spezifische CSP Rules
const pluginCSP = {
  'sva-payments': {
    'script-src': ['https://js.stripe.com'],
    'connect-src': ['https://api.stripe.com'],
    'frame-src': ['https://js.stripe.com']
  },
  'sva-maps': {
    'script-src': ['https://maps.googleapis.com'],
    'img-src': ['https://maps.gstatic.com'],
  }
};
```

---

**Links:**
- [Plugin Development Guide](../guides/plugin-development.md)
- [Plugin Security Guidelines](../security/plugin-security.md)
- [Plugin Marketplace](https://plugins.sva-studio.org)