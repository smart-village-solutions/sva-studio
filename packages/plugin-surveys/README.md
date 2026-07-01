# @sva/plugin-surveys

`@sva/plugin-surveys` ist ein Plugin-Paket fuer die Survey-Verwaltung im SVA Studio.

## Architektur-Rolle

Das Paket ist eine fachliche Plugin-Bibliothek im Scope `scope:plugin`. Es registriert den Inhaltstyp `surveys.survey` und erweitert den Standard-Content-Pfad um Survey-spezifische Moderations- und Exportrechte.

## Oeffentliche API

Der Einstiegspunkt ist [`src/index.ts`](./src/index.ts). Exportiert werden in der Grundstruktur zunaechst:

- `pluginSurveys` als `PluginDefinition`
- `SURVEYS_CONTENT_TYPE` als kanonischer Content-Type
- Survey-spezifische Action- und Permission-Definitionen
- minimale Survey-Grundtypen fuer den weiteren Ausbau

## Nutzung und Integration

Die Integration erfolgt ueber die Plugin-Definition:

```ts
import { pluginSurveys } from '@sva/plugin-surveys';
```

Das Paket nutzt den bestehenden Standard-Content-Vertrag aus `@sva/plugin-sdk` und bleibt fuer die UI an `@sva/studio-ui-react` gebunden.

## Projektstruktur

```text
packages/plugin-surveys/
├── src/
│   ├── index.ts
│   ├── plugin.tsx
│   ├── plugin.translations.ts
│   ├── surveys.constants.ts
│   └── surveys.types.ts
├── tests/
│   ├── plugin.test.ts
│   └── index.type-test.ts
├── package.json
├── plugin.manifest.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```
