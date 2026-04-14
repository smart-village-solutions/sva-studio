# @sva/plugin-example

Beispiel-Plugin für SVA Studio. Demonstriert den Plugin-SDK-Vertrag v1: Ein externes Paket bringt eigene Routen, Navigation und Übersetzungen über ein einzelnes `PluginDefinition`-Objekt ein, ohne App-Interna zu importieren.

## Architektur-Rolle

Dieses Paket dient als **Referenzimplementierung** für das Plugin-System. Es zeigt:

- wie ein Plugin genau ein `PluginDefinition`-Objekt exportiert
- wie ein Plugin `@sva/sdk` als öffentliche Boundary nutzt
- wie Navigation, Routing und i18n ohne Host-Sonderlogik beschrieben werden
- wie `@tanstack/react-router`, `react` und `react-dom` als Peer Dependencies deklariert werden

```
@sva/sdk   ← öffentlicher Plugin-Vertrag
  ↑
@sva/plugin-example
  ↑
App (sva-studio-react) ← registriert Plugins statisch im Host
```

**Abhängigkeiten:**
- `@sva/sdk` (workspace) – öffentlicher Plugin-Vertrag
- **Peer:** `@tanstack/react-router`, `react`, `react-dom`

## Export

| Pfad | Beschreibung |
| --- | --- |
| `@sva/plugin-example` | `pluginExample` + Plugin-Version |

## Verwendung

### Plugin registrieren

```ts
import { pluginExample } from '@sva/plugin-example';
import {
  createPluginRegistry,
  mergePluginNavigationItems,
  mergePluginRouteDefinitions,
  mergePluginTranslations,
} from '@sva/sdk';

const plugins = [pluginExample] as const;

const registry = createPluginRegistry(plugins);
const routes = mergePluginRouteDefinitions(plugins);
const navigation = mergePluginNavigationItems(plugins);
const translations = mergePluginTranslations(plugins);
```

### Plugin-Objekt

Das Plugin stellt eine Demo-Route unter `/plugins/example` sowie eine Navigation und Übersetzungen bereit:

```tsx
import { pluginExample, pluginExampleVersion } from '@sva/plugin-example';

pluginExample.routes;
pluginExample.navigation;
pluginExample.translations;
```

## Eigenes Plugin erstellen

Nimm dieses Paket als Vorlage:

1. **Neues Package anlegen:** `packages/plugin-mein-feature/`
2. **Abhängigkeiten:** `@sva/sdk` als Workspace-Dep, Router + React als Peer-Deps
3. **Plugin exportieren:** genau ein `PluginDefinition`-Objekt
4. **In der App registrieren:** in die statische Plugin-Liste des Hosts aufnehmen

**`package.json`-Vorlage:**

```json
{
  "name": "@sva/plugin-mein-feature",
  "dependencies": { "@sva/sdk": "workspace:*" },
  "peerDependencies": {
    "@tanstack/react-router": "^1.166.3",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

**Plugin-Vorlage:**

```tsx
import type { PluginDefinition } from '@sva/sdk';

const MeinFeaturePage = () => <main>Mein Feature</main>;

export const meinFeaturePlugin: PluginDefinition = {
  id: 'mein-feature',
  displayName: 'Mein Feature',
  routes: [
    {
      id: 'mein-feature.list',
      path: '/plugins/mein-feature',
      component: MeinFeaturePage,
    },
  ],
  navigation: [
    {
      id: 'mein-feature.navigation',
      to: '/plugins/mein-feature',
      titleKey: 'mein-feature.navigation.title',
      section: 'applications',
    },
  ],
  translations: {
    de: {
      'mein-feature': {
        navigation: {
          title: 'Mein Feature',
        },
      },
    },
  },
};
```

## Projektstruktur

```
src/
├── index.ts      # Plugin-Re-Export
└── plugin.tsx    # React-Komponente + PluginDefinition
```

## Nx-Konfiguration

- **Name:** `plugin-example`
- **Tags:** `scope:plugin`, `type:lib`
- **Build:** `pnpm nx run plugin-example:build`
- **Lint:** `pnpm nx run plugin-example:lint`

## Verwandte Dokumentation

- [ADR-002: Plugin Architecture Pattern](../../docs/architecture/decisions/ADR-002-plugin-architecture-pattern.md)
- [ADR-034: Plugin-SDK-Vertrag v1](../../docs/adr/ADR-034-plugin-sdk-vertrag-v1.md)
- [Routing-Architektur](../../docs/architecture/routing-architecture.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Plugin-Entwicklung](../../docs/guides/plugin-development.md)
