# @sva/core

Framework-agnostisches Kernpaket von SVA Studio. `@sva/core` bündelt die stabilen Domänenbausteine, die in mehreren Laufzeitkontexten wiederverwendet werden: Content-Management-Grundtypen, Routing-Komposition, IAM-Entscheidungslogik, Instanz-Registry-Regeln, Runtime-Profile sowie sicherheitsnahe Hilfsfunktionen.

## Architektur-Rolle

`@sva/core` bildet die fachliche Unterkante des Workspaces: Das Paket exportiert ausschließlich TypeScript- und Node-kompatible Kernlogik ohne Workspace-Abhängigkeiten und kann deshalb sowohl von Frontend- als auch von serverseitigen Paketen konsumiert werden.

Konkret kapselt das Paket Regeln und Datenträgerformate, die nicht an React, Router-Bindings oder konkrete Infrastrukturadapter gebunden sein sollen:

- Content-spezifische Status-, Capability- und Zugriffsauswertung für IAM-nahe Inhalte
- Generische Route-Factory-Komposition über `mergeRouteFactories()` und `buildRouteTree()`
- IAM-Hilfen für Claim-Auswertung, JWT-Payload-Parsing, Autorisierungsentscheidung und Runtime-Diagnostik
- Instanz- und Host-Regeln für Mandantenbetrieb einschließlich Keycloak-Readiness-Checkliste
- Sicherheitsfunktionen für Feldverschlüsselung und E-Mail-Redaction
- Runtime-Profil-Definitionen inklusive Pflicht- und abgeleiteter Umgebungsvariablen

## Öffentliche API

`package.json` exportiert zwei Einstiegspunkte:

| Einstiegspunkt | Inhalt |
| --- | --- |
| `@sva/core` | Root-API für Content-Management, Routing, IAM, Instanz-Registry, Runtime-Profile und `maskEmailAddresses()` |
| `@sva/core/security` | Sicherheits-Subpath für Feldverschlüsselung und E-Mail-Redaction |

Die Root-API ist in sechs klar abgegrenzte Bereiche aufgeteilt:

| Bereich | Zentrale Exporte | Zweck |
| --- | --- | --- |
| Content-Management | `GENERIC_CONTENT_TYPE`, `iamContentStatuses`, `iamContentCapabilityMappings`, `summarizeContentAccess()`, `validateCreateIamContentInput()` | Normiert Content-Status, Primitive Actions, Domain-Capabilities und validiert Eingaben bzw. Zugriffszustände |
| Routing | `RouteFactory`, `mergeRouteFactories()`, `buildRouteTree()` | Führt Core- und Plugin-Route-Factories zu einem deterministischen Route-Tree zusammen |
| IAM | `extractRoles()`, `resolveInstanceId()`, `resolveUserName()`, `parseJwtPayload()`, `evaluateAuthorizeDecision()`, `deriveIamRuntimeDiagnostics()` sowie Vertrags-Typen | Kapselt OIDC-/JWT-Auswertung, hybride RBAC-/ABAC-Entscheidung und typisierte IAM-Verträge |
| Instanzen | `buildPrimaryHostname()`, `classifyHost()`, `canTransitionInstanceStatus()`, `isValidInstanceId()`, `isValidParentDomain()` | Validiert Tenant-Hosts, Statusübergänge und Registry-Metadaten |
| Keycloak-Checkliste | `INSTANCE_KEYCLOAK_REQUIREMENTS`, `isInstanceKeycloakRequirementSatisfied()`, `areAllInstanceKeycloakRequirementsSatisfied()` | Beschreibt, welche Registry-, Secret- und Realm-Voraussetzungen für eine betriebsbereite Tenant-Instanz erfüllt sein müssen |
| Runtime-Profile | `RUNTIME_PROFILES`, `parseRuntimeProfile()`, `getRuntimeProfileDefinition()`, `validateRuntimeProfileEnv()` | Definiert die Profile `local-keycloak`, `local-builder` und `studio` samt Pflichtvariablen und Validierungslogik |

Der Sicherheits-Subpath `@sva/core/security` exportiert:

- `encryptFieldValue()` und `decryptFieldValue()` für versionierte AES-256-GCM-Feldverschlüsselung
- `parseFieldEncryptionConfigFromEnv()` zum Einlesen von `IAM_PII_ACTIVE_KEY_ID` und `IAM_PII_KEYRING_JSON`
- `maskEmailAddresses()` zur Redaction von E-Mail-Adressen in Log- oder Diagnose-Strings

## Nutzung und Integration

`@sva/core` ist für gemeinsam genutzte Fachlogik gedacht, nicht für an Frameworks gebundene UI- oder Infrastrukturintegration.

Typische Integrationspunkte im Workspace:

- Routing-Pakete kombinieren Core- und Plugin-Routen über `mergeRouteFactories()` und materialisieren sie über `buildRouteTree()`.
- IAM-nahe Server- und Client-Pfade nutzen die Vertrags-Typen, `extractRoles()` und `evaluateAuthorizeDecision()`, damit Berechtigungsentscheidungen und Claim-Auswertung zentral bleiben.
- Tenant- und Provisioning-Pfade validieren Hosts, Instanz-IDs, Statusübergänge und Keycloak-Readiness gegen die Registry- und Checklist-Helfer.
- Runtime-Startpfade lesen `SVA_RUNTIME_PROFILE` oder `VITE_SVA_RUNTIME_PROFILE` über `getRuntimeProfileFromEnv()` und prüfen Pflicht-Env mit `validateRuntimeProfileEnv()`.
- Sicherheitsnahe Pakete importieren Feldverschlüsselung gezielt über `@sva/core/security`, während die generische E-Mail-Maskierung auch über den Root-Export verfügbar ist.

Wichtige Integrationsdetails aus dem Code:

- Die Autorisierungslogik wertet nicht nur RBAC-Basisrechte, sondern auch Scope-, Geo-, Hierarchie- und Acting-as-Regeln aus.
- `summarizeContentAccess()` verdichtet rohe `content.*`-Permissions in UI-taugliche Zustände wie `editable`, `read_only`, `blocked` und `server_denied`.
- `validateCreateIamContentInput()` akzeptiert nur registrierte `contentType`s, valide JSON-Payloads und für `published` einen gültigen Zeitstempel.
- `validateRuntimeProfileEnv()` erkennt neben fehlenden Variablen auch Platzhalterwerte und ungültiges `IAM_PII_KEYRING_JSON`.

## Projektstruktur

```text
packages/core/
├── package.json
├── project.json
├── src/
│   ├── index.ts
│   ├── content-management.ts
│   ├── runtime-profile.ts
│   ├── routing/
│   │   └── registry.ts
│   ├── iam/
│   │   ├── index.ts
│   │   ├── claims.ts
│   │   ├── token.ts
│   │   ├── authorization-contract.ts
│   │   ├── authorization-engine.ts
│   │   ├── account-management-contract.ts
│   │   ├── account-management.ts
│   │   ├── runtime-diagnostics.ts
│   │   └── transparency-contract.ts
│   ├── instances/
│   │   ├── registry.ts
│   │   └── keycloak-checklist.ts
│   └── security/
│       ├── index.ts
│       ├── email-redaction.ts
│       └── field-encryption.ts
└── vitest.config.ts
```

Tests liegen co-lokal in `src/` und decken die Kernbereiche Content-Management, Runtime-Profile, Instanz-Registry, Keycloak-Checkliste, Claims, Authorization-Engine und Security ab.

## Nx-Konfiguration

Das Paket ist in Nx als Library `core` mit den Tags `scope:core` und `type:lib` registriert.

Verfügbare Targets aus [project.json](./project.json):

- `pnpm nx run core:build` kompiliert das Paket mit `tsc -p packages/core/tsconfig.lib.json`.
- `pnpm nx run core:check:runtime` baut zuerst das Paket und prüft anschließend die Server-Runtime-Konformität über `scripts/ci/check-server-package-runtime.ts --package core`.
- `pnpm nx run core:lint` lintet `packages/core/src/**/*.{ts,tsx,js,jsx}`.
- `pnpm nx run core:test:unit` führt die Vitest-Unit-Tests in `packages/core` aus.
- `pnpm nx run core:test:coverage` startet dieselben Tests mit Coverage-Erhebung.
- `pnpm nx run core:test:integration` ist aktuell ein Platzhalter-Target und meldet, dass für `@sva/core` keine Integrationstests konfiguriert sind.

## Verwandte Dokumentation

- [Bausteinsicht](../../docs/architecture/05-building-block-view.md)
- [Laufzeitsicht](../../docs/architecture/06-runtime-view.md)
- [IAM-Service-Architektur](../../docs/architecture/iam-service-architektur.md)
- [ADR-010: Verschlüsselung IAM Core Data Layer](../../docs/adr/ADR-010-verschluesselung-iam-core-data-layer.md)
- [ADR-012: Permission-Kompositionsmodell RBAC v1](../../docs/adr/ADR-012-permission-kompositionsmodell-rbac-v1.md)
