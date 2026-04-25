# @sva/core

Framework-agnostisches Kernpaket für SVA Studio. Stellt gemeinsame Typen, Routing-Registry, IAM-Autorisierungs-Engine und Field-Level-Verschlüsselung bereit – **ohne** Runtime-Abhängigkeiten.

## Architektur-Rolle

`@sva/core` ist das Fundament des Monorepos. Alle anderen Packages dürfen von `@sva/core` abhängen, aber `@sva/core` selbst hat keinerlei Workspace- oder Runtime-Abhängigkeiten. Dadurch bleibt die Kernlogik framework-agnostisch und testbar.

```
@sva/core (keine Abhängigkeiten)
  ↑
  ├── @sva/data-client / @sva/data-repositories
  ├── @sva/auth-runtime / @sva/iam-*
  ├── @sva/plugin-sdk / @sva/server-runtime
  ├── @sva/routing
  └── @sva/plugin-news
```

## Exports

| Pfad | Beschreibung |
| --- | --- |
| `@sva/core` | Routing-Registry, IAM-Typen, Claims, JWT, Authorization-Engine |
| `@sva/core/security` | AES-256-GCM Field-Level Encryption für PII-Daten |

## Module

### Routing-Registry

Generisches System zur code-basierten Route-Komposition – unabhängig vom verwendeten Router-Framework.

```ts
import { mergeRouteFactories, buildRouteTree } from '@sva/core';

// Route-Factories aus verschiedenen Quellen zusammenführen
const allFactories = mergeRouteFactories(coreFactories, pluginFactories);

// Route-Tree auf einer Root-Route aufbauen
const routeTree = buildRouteTree(rootRoute, allFactories);
```

**Typen:**
- `RouteFactory<TRoot, TRoute>` – Typ für eine Route-Factory-Funktion
- `mergeRouteFactories()` – Verschmilzt mehrere Factory-Arrays
- `buildRouteTree()` – Baut den Route-Tree aus Factories

### IAM (Identity & Access Management)

Vollständiges Typsystem und client-seitig auswertbare Autorisierungs-Engine.

```ts
import {
  evaluateAuthorizeDecision,
  extractRoles,
  resolveInstanceId,
  resolveUserName,
  parseJwtPayload,
} from '@sva/core';
```

**Authorization-Engine** – 5-stufige RBAC/ABAC-Hybrid-Evaluierung:
1. Instance-Scope-Prüfung
2. Hard-Deny-Regeln
3. RBAC-Baseline
4. ABAC-Regeln (Geo-Scoping, Org-Hierarchien, Zeit-Fenster, Acting-As)
5. Final-Entscheidung

**Typen:** `AuthorizeRequest`, `AuthorizeResponse`, `EffectivePermission`, `MePermissionsRequest`, `MePermissionsResponse`, `IamApiErrorResponse`, `IamUuid`, `IamAction`, `IamResourceRef`

**Claims-Verarbeitung:**
- `resolveUserName(claims)` – Display-Name aus OIDC-Claims (mit Fallbacks)
- `resolveInstanceId(claims)` – Instance-ID aus Token
- `extractRoles(claims)` – Rollen aus `realm_access`/`resource_access`

**Token:**
- `parseJwtPayload(token)` – Dekodiert JWT-Payload (ohne Signatur-Verifikation)

### Security – Field-Level Encryption

AES-256-GCM-Verschlüsselung für einzelne Datenbankfelder (PII-Schutz auf Application-Level).

```ts
import {
  encryptFieldValue,
  decryptFieldValue,
  parseFieldEncryptionConfigFromEnv,
} from '@sva/core/security';

const config = parseFieldEncryptionConfigFromEnv();
const ciphertext = encryptFieldValue('user@example.com', config);
const plaintext = decryptFieldValue(ciphertext, config);
```

**Features:**
- Versioniertes Ciphertext-Format (`enc:v1:keyId:iv:authTag:ciphertext`)
- Keyring-basiert mit Multi-Key-Support
- Key-Rotation ohne Downtime
- AAD (Additional Authenticated Data) Support

**Umgebungsvariablen:**
- `IAM_PII_ACTIVE_KEY_ID` – Aktiver Schlüssel für neue Verschlüsselungen
- `IAM_PII_KEYRING_JSON` – JSON-Keyring mit allen bekannten Schlüsseln

## Projektstruktur

```
src/
├── index.ts                         # Haupt-Export
├── routing/
│   └── registry.ts                  # Route-Komposition (mergeRouteFactories, buildRouteTree)
├── iam/
│   ├── index.ts                     # IAM Re-Exports
│   ├── authorization-contract.ts    # Vollständiges IAM-Typsystem
│   ├── authorization-engine.ts      # RBAC/ABAC-Hybrid-Engine (254 Zeilen)
│   ├── claims.ts                    # OIDC Claims Verarbeitung
│   └── token.ts                     # JWT-Parsing
└── security/
    ├── index.ts                     # Security Re-Exports
    ├── field-encryption.ts          # AES-256-GCM Feld-Verschlüsselung
    └── field-encryption.test.ts     # Verschlüsselungs-Tests
```

## Nx-Konfiguration

- **Name:** `core`
- **Tags:** `scope:core`, `type:lib`
- **Build:** `pnpm nx run core:build` (TypeScript-Compiler)
- **Lint:** `pnpm nx run core:lint`
- **Tests:** `pnpm nx run core:test:unit`

## Verwandte Dokumentation

- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [IAM-Datenklassifizierung](../../docs/architecture/iam-datenklassifizierung.md)
- [ADR-012: RBAC Permission-Komposition](../../docs/adr/ADR-012-permission-kompositionsmodell-rbac-v1.md)
- [ADR-010: Verschlüsselung IAM Core Data Layer](../../docs/adr/ADR-010-verschluesselung-iam-core-data-layer.md)
