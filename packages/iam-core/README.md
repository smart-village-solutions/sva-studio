# @sva/iam-core

Kleines IAM-Kernpaket für gemeinsam genutzte Autorisierungsverträge im SVA-Workspace. Das Paket besitzt die öffentlichen Authorize-Typen und stellt die Entscheidungslogik für Autorisierungsprüfungen unter einem stabilen Paketnamen bereit.

## Architektur-Rolle

`@sva/iam-core` ist eine schlanke Bibliothek an der IAM-Grenze des Monorepos. Sie kapselt keine eigene Persistenz oder Framework-Bindings, sondern dient als fokussierter Einstiegspunkt für Autorisierungskontrakte, Permission-Auswertung und IAM-bezogene Invarianten.

## Öffentliche API

Die aktuelle API ist bewusst klein und framework-unabhängig:

- `evaluateAuthorizeDecision` ist die reine, synchrone Permission-Engine.
- Zentrale IAM-Typen wie `AuthorizeRequest`, `AuthorizeResponse`, `IamAction` und `EffectivePermission` werden als Typ-Exports bereitgestellt.
- Performance-Verträge für Authorize-Messungen werden als lokale Contract-Types und Helper bereitgestellt.
- `iamCoreVersion` dokumentiert die Paketversion im Code.
- `iamCorePackageRoles` und `IamCorePackageRole` markieren die beabsichtigten Rollen des Pakets: `authorization-contracts`, `permission-engine`, `pii-invariants`.
- Die Autorisierungsverträge umfassen additive Rollen-Scopes für Datensatzrechte (`accessScope = all|own|organization`) sowie die dafür benötigten Resource-/Context-Attribute.

## Nutzung und Integration

Das Paket wird als ESM-Bibliothek mit Export auf `dist/index.js` gebaut. Die Authorize-Engine hat keine Runtime-, Persistenz-, Redis-, Keycloak- oder React-Abhängigkeiten.

Typischer Einsatz:

```ts
import { evaluateAuthorizeDecision, type AuthorizeRequest } from '@sva/iam-core';

const request: AuthorizeRequest = {
  instanceId: 'inst-1',
  action: 'content.read',
  resource: {
    type: 'content',
    id: 'content-1',
    attributes: {
      createdByAccountId: 'account-1',
      organizationId: 'org-1',
    },
  },
  context: {
    organizationId: 'org-1',
    attributes: {
      actorAccountId: 'account-1',
    },
  },
};

const result = evaluateAuthorizeDecision(request, []);
```

Für serverseitige Nutzung gelten die Workspace-Regeln zu Node-ESM-Runtime-Imports. Relative Runtime-Imports und Re-Exports verwenden explizite `.js`-Endungen.

## Projektstruktur

```text
packages/iam-core/
├── src/
│   ├── index.ts
│   ├── authorization-contract.ts
│   ├── authorization-engine.ts
│   ├── authorize-performance-contract.ts
│   └── index.test.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```

- `src/index.ts` definiert die öffentlichen Exporte.
- `src/authorization-contract.ts` definiert Authorize-Verträge, Reason Codes und IAM-Ressourcen-Typen.
- `src/authorization-engine.ts` enthält die reine Entscheidungsfunktion.
- `src/authorize-performance-contract.ts` enthält Performance-Verträge und Report-Helper.
- `src/index.test.ts` prüft Paketrolle und lokale Ownership der Autorisierungsentscheidung.
- `project.json` enthält die Nx-Targets für Build, Runtime-Check, Linting und Tests.

## Nx-Konfiguration

Das Paket ist in Nx als Library `iam-core` mit den Tags `scope:iam-core` und `type:lib` registriert.

Verfügbare Targets:

- `pnpm nx run iam-core:build` kompiliert mit `tsc -p packages/iam-core/tsconfig.lib.json`.
- `pnpm nx run iam-core:check:runtime` prüft serverseitige Runtime-Regeln nach dem Build.
- `pnpm nx run iam-core:lint` lintet die Quelldateien unter `src/`.
- `pnpm nx run iam-core:test:unit` führt die Vitest-Unit-Tests aus.
- `pnpm nx run iam-core:test:types` prüft die Typkompilierung ohne Emit.
- `pnpm nx run iam-core:test:coverage` erzeugt einen Coverage-Lauf mit Vitest.

## Verwandte Dokumentation

- [packages/core](../core/README.md) für allgemeine IAM-Projektionen und Claim-Helfer
- [DEVELOPMENT_RULES.md](../../DEVELOPMENT_RULES.md) für verbindliche Entwicklungs- und Runtime-Regeln im Workspace
