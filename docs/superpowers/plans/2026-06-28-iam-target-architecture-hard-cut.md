# IAM-Zielarchitektur-Hard-Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@sva/iam-core` wird der zentrale Ort für Authorize-Verträge und die reine Permission-Engine, während `@sva/auth-runtime`, `@sva/iam-admin` und `@sva/iam-governance` auf klare Zielgrenzen mit harten Import-Migrationen gebracht werden.

**Architecture:** Die Umsetzung erfolgt als Hard Cut mit OpenSpec-Gate. Zuerst wird das Change Proposal erstellt und validiert, danach wandern Authorize-Contracts und Engine nach `iam-core`; Runtime-, Domain- und App-Consumer werden direkt auf Zielimporte migriert. Der Permission-Store bleibt in `auth-runtime`, weil Redis, DB-Recompute und Runtime-Kontext operative Infrastruktur sind.

**Tech Stack:** TypeScript strict mode, Node ESM, pnpm workspace, Nx, Vitest, OpenSpec, Fallow, `@sva/server-runtime`, `@sva/iam-core`, `@sva/auth-runtime`, `@sva/iam-admin`, `@sva/iam-governance`.

---

## File Structure

Create:
- `openspec/changes/refactor-iam-target-architecture-hard-cut/proposal.md`: OpenSpec-Begründung, Wirkung und betroffene arc42-Abschnitte.
- `openspec/changes/refactor-iam-target-architecture-hard-cut/design.md`: technische Entscheidungen für Package-Grenzen, Hard Cut und Performance-Schutz.
- `openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md`: OpenSpec-Taskliste für die Umsetzung.
- `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-core/spec.md`: Delta für `iam-core` als Authorize-Zentrum.
- `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-server-modularization/spec.md`: Delta für Runtime-Adapter und Domain-Package-Grenzen.
- `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-access-control/spec.md`: Delta für zentrale Authorize-Schnittstelle und Performance-Schutz.
- `packages/iam-core/src/authorization-contract.ts`: Authorize-Contracts, Reason Codes, Permission- und Resource-Typen.
- `packages/iam-core/src/authorization-engine.ts`: reine synchrone `evaluateAuthorizeDecision`-Engine.
- `packages/iam-core/src/authorize-performance-contract.ts`: Authorize-Performance-Verträge und Report-Helpers.
- `packages/iam-core/src/authorization-contract.test.ts`: Contract-Stabilitätstests.
- `packages/iam-core/src/authorization-engine.test.ts`: Engine-Entscheidungsmatrix.
- `packages/iam-core/src/authorize-performance-contract.test.ts`: Performance-Contract-Tests.

Modify:
- `packages/iam-core/src/index.ts`: exportiert Authorize-Engine, Contracts, Performance-Contracts und Package-Metadaten.
- `packages/iam-core/src/types.ts`: re-exportiert keine Authorize-Typen mehr aus `@sva/core`.
- `packages/iam-core/package.json`: entfernt `@sva/core`, wenn nach der Extraktion keine Runtime- oder Type-Abhängigkeit bleibt.
- `packages/iam-core/tsconfig.lib.json`: entfernt `@sva/core`-Path-Aliasse, wenn ungenutzt.
- `packages/core/src/iam/index.ts`: entfernt Authorize-Engine- und Authorize-Contract-Exports.
- `packages/core/src/iam/account-management.ts`: importiert `IamRolePermissionAssignmentScope` aus `@sva/iam-core`.
- `packages/core/src/iam/account-management-contract.ts`: importiert Authorize-nahe Typen aus `@sva/iam-core`.
- `packages/core/src/iam/transparency-contract.ts`: importiert `IamInstanceId` und `IamUuid` aus `@sva/iam-core`.
- `packages/core/src/index.ts`: entfernt Authorize-Exports, die aus `packages/core/src/iam/index.ts` entfallen.
- `packages/auth-runtime/src/iam-authorization/**`: importiert Authorize-Typen und `evaluateAuthorizeDecision` aus `@sva/iam-core`.
- `packages/auth-runtime/src/auth-route-handlers.ts`: importiert `IamUserGroupAssignment` weiter aus `@sva/core`, aber Authorize-Typen aus `@sva/iam-core`, sobald vorhanden.
- `packages/iam-admin/src/**`: importiert `IamRolePermissionAssignmentScope` und andere Authorize-nahe Typen aus `@sva/iam-core`.
- `packages/iam-governance/src/**`: importiert Authorize-nahe Typen aus `@sva/iam-core`, falls vorhanden.
- `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`: importiert `AuthorizeResponse` und `EffectivePermission` aus `@sva/iam-core`.
- `apps/sva-studio-react/src/routes/admin/-iam.models.ts`: importiert `AuthorizeResponse` und `EffectivePermission` aus `@sva/iam-core`.
- `apps/sva-studio-react/src/routes/admin/-iam.models.test.ts`: importiert Testtypen aus `@sva/iam-core`.
- `apps/sva-studio-react/src/lib/iam-api.ts`: importiert Authorize-Performance-Typen aus `@sva/iam-core`.
- `apps/sva-studio-react/package.json`: fügt `@sva/iam-core: "workspace:*"` hinzu, wenn App-Code direkt daraus importiert.
- `apps/sva-studio-react/tsconfig.json` und `apps/sva-studio-react/vite.config.ts`: ergänzen Alias für `@sva/iam-core`, falls lokale App-Tests ihn benötigen.
- `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/package-zielarchitektur.md`: aktualisieren die Zielgrenzen, falls die OpenSpec-Deltas eine Doku-Anpassung verlangen.

Remove:
- `packages/core/src/iam/authorization-contract.ts`
- `packages/core/src/iam/authorization-contract.test.ts`
- `packages/core/src/iam/authorization-engine.ts`
- `packages/core/src/iam/authorization-engine.test.ts`
- `packages/core/src/iam/authorize-performance-contract.ts`
- `packages/core/src/iam/authorize-performance-contract.test.ts`
- `packages/iam-core/src/authorization.ts`, sobald `index.ts` direkt aus `authorization-engine.ts` exportiert.

## Task 1: OpenSpec Change Proposal erstellen

**Files:**
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/proposal.md`
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/design.md`
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md`
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-core/spec.md`
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-server-modularization/spec.md`
- Create: `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-access-control/spec.md`

- [ ] **Step 1: Scaffold directories**

Run:

```bash
mkdir -p \
  openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-core \
  openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-server-modularization \
  openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-access-control
```

Expected: command exits with code 0.

- [ ] **Step 2: Write `proposal.md`**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/proposal.md` with this content:

```markdown
# Change: IAM-Zielarchitektur-Hard-Cut

## Why

Die dokumentierte Zielarchitektur nennt `@sva/iam-core` als zentralen Ort für Authorize-Verträge und Permission-Entscheidungen. Im aktuellen Code liegt die eigentliche Authorize-Engine noch in `@sva/core`, während `@sva/auth-runtime` neben Authentifizierung und Session auch breite IAM-Adapter- und Exportflächen hält.

## What Changes

- **BREAKING**: Authorize-Contracts, Reason Codes, `EffectivePermission`, `AuthorizeRequest`, `AuthorizeResponse`, `IamAction` und `evaluateAuthorizeDecision` werden aus `@sva/core` entfernt und nach `@sva/iam-core` migriert.
- **BREAKING**: Interne und package-public Consumer werden direkt auf Zielimporte migriert; es gibt keine Deprecation-Bridges.
- `@sva/auth-runtime` bleibt Owner von Auth, Session, OIDC, Cookies, Auth-Middleware, Runtime-Route-Wiring, Permission-Store und Redis-/DB-Snapshot-Infrastruktur.
- `@sva/iam-admin` und `@sva/iam-governance` konsumieren `@sva/iam-core` für Authorize-nahe Verträge und halten fachliche Use-Cases in ihren eigenen Package-Grenzen.
- Der `authorize`-Hot-Path darf keine zusätzlichen DB- oder Redis-Roundtrips erhalten.

## Impact

- Affected specs: `iam-core`, `iam-server-modularization`, `iam-access-control`
- Affected code: `packages/iam-core`, `packages/core/src/iam`, `packages/auth-runtime/src/iam-authorization`, `packages/iam-admin/src`, `packages/iam-governance/src`, `apps/sva-studio-react/src/routes/admin`, `apps/sva-studio-react/src/lib/iam-api.ts`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `package-zielarchitektur`
```

- [ ] **Step 3: Write `design.md`**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/design.md` with this content:

```markdown
## Context

`@sva/iam-core` ist bereits als Package vorhanden, re-exportiert Authorize-Logik aber noch aus `@sva/core`. Dieser Change macht `iam-core` zum echten Authorize-Zentrum und entfernt die alte Ownership aus `core`.

## Goals / Non-Goals

- Goals: Authorize-Contracts und Engine liegen in `iam-core`; Runtime-Infrastruktur bleibt in `auth-runtime`; Fachlogik bleibt in `iam-admin` und `iam-governance`; alle Consumer werden hart migriert.
- Non-Goals: keine neuen Dependencies, keine dauerhaften Bridge-Exports, keine fachliche Änderung an Permission-Snapshot-Persistenz.

## Decisions

- Decision: `evaluateAuthorizeDecision` bleibt eine reine synchrone Funktion in `@sva/iam-core`.
- Decision: Redis/L1/L2/DB-Recompute bleiben in `@sva/auth-runtime`, weil sie Runtime- und Infrastruktur-Abhängigkeiten besitzen.
- Decision: `@sva/core` re-exportiert die migrierten Authorize-Typen nicht weiter.
- Alternatives considered: Kompatibilitätsbrücken wurden verworfen, weil der Change bewusst ein Hard Cut sein soll.

## Risks / Trade-offs

- Breiter Compile-Radius durch entfernte Core-Exports → in Phasen migrieren und nach jeder Phase relevante Nx-Gates ausführen.
- Performance-Regression im Authorize-Pfad → Engine ohne Runtime-Abhängigkeiten halten und Permission-Store-Verhalten nicht gleichzeitig fachlich umbauen.
- Re-export-Zyklen durch neue Barrels → Fallow nach API-Cut auf Circular Dependencies und Re-export-Cycles ausführen.

## Migration Plan

1. OpenSpec-Deltas validieren.
2. Authorize-Contracts und Engine nach `iam-core` verschieben.
3. Runtime-Authorize-Consumer auf `iam-core` migrieren.
4. Domain- und App-Consumer auf Zielimporte migrieren.
5. Alte Core-Exports entfernen.
6. Unit-, Type-, Runtime- und Performance-Gates ausführen.
```

- [ ] **Step 4: Write `tasks.md`**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md` with this content:

```markdown
## 1. Implementation

- [ ] 1.1 Move Authorize contracts, engine and performance contracts from `packages/core/src/iam` to `packages/iam-core/src`.
- [ ] 1.2 Update `@sva/iam-core` package exports and tests.
- [ ] 1.3 Remove Authorize ownership from `@sva/core` exports.
- [ ] 1.4 Migrate `auth-runtime`, `iam-admin`, `iam-governance`, app, routing and script imports to `@sva/iam-core`.
- [ ] 1.5 Keep Permission Store, Redis snapshots and DB recompute in `auth-runtime` without additional DB or Redis roundtrips.
- [ ] 1.6 Update affected arc42 sections or document that no section text changed.
- [ ] 1.7 Run targeted unit, type, server-runtime and performance gates.
- [ ] 1.8 Run Fallow for circular dependencies and re-export cycles on affected IAM paths.
```

- [ ] **Step 5: Write `iam-core` spec delta**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-core/spec.md` with this content:

```markdown
## MODIFIED Requirements

### Requirement: Zentrale Autorisierungsinvariante
Das System MUST zentrale Autorisierungsentscheidungen ausschließlich über `@sva/iam-core` treffen. `@sva/iam-core` MUST die Authorize-Verträge, Reason Codes, Permission-/Resource-Typen und die reine synchrone `evaluateAuthorizeDecision`-Engine besitzen. Fachpackages MUST diesen Vertrag konsumieren und dürfen keine zweite Berechtigungsauflösung gegen eigene Tabellen, Keycloak-Rollen oder kopierte Rollenlogik einführen.

#### Scenario: Fachpackage prüft Berechtigung
- **WHEN** `@sva/iam-admin`, `@sva/iam-governance` oder `@sva/instance-registry` eine geschützte Operation ausführt
- **THEN** konsumiert es Authorize-nahe Verträge aus `@sva/iam-core`
- **AND** fehlender oder unvollständiger Autorisierungskontext führt fail-closed zu einer Ablehnung

#### Scenario: Authorize-Engine bleibt rein
- **WHEN** `evaluateAuthorizeDecision` ausgeführt wird
- **THEN** benötigt die Funktion keine DB-, Redis-, Keycloak-, React- oder Runtime-Abhängigkeiten
- **AND** die Funktion liefert bei gleichem Request und gleicher Permission-Liste dieselbe Entscheidung
```

- [ ] **Step 6: Write `iam-server-modularization` spec delta**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-server-modularization/spec.md` with this content:

```markdown
## MODIFIED Requirements

### Requirement: IAM-Server-Hard-Cut in Zielpackages
Der IAM-Server MUST von einer internen Modulstruktur in getrennte Zielpackages überführt werden. Authentifizierung, zentrale Autorisierung, IAM-Administration, IAM-Governance und Instanz-Control-Plane MUST getrennte Package-Verantwortlichkeiten erhalten. Alte Importpfade für verschobene Authorize-Verträge und Authorize-Engine-Funktionen MUST im Hard Cut entfernt werden.

#### Scenario: Authentifizierungslogik wird migriert
- **WHEN** Login, Logout, OIDC, Cookies, Session oder Auth-Middleware geändert werden
- **THEN** liegt die Implementierung in `@sva/auth-runtime`
- **AND** sie importiert keine IAM-Admin-, Governance- oder Instanz-Implementierungsdetails

#### Scenario: IAM-Admin-Logik wird migriert
- **WHEN** Benutzer, Rollen, Gruppen, Organisationen oder Reconcile-Logik geändert werden
- **THEN** liegt die fachliche Implementierung in `@sva/iam-admin`
- **AND** Authorize-nahe Verträge werden über `@sva/iam-core` konsumiert

#### Scenario: Runtime-Adapter bleibt schmal
- **WHEN** ein Runtime-Handler in `@sva/auth-runtime` fachliche IAM-Admin- oder Governance-Funktionalität verdrahtet
- **THEN** beschränkt sich der Runtime-Code auf Session, Request-Kontext, Auth-Guard, Dependency-Wiring und Response-Mapping
- **AND** fachliche Entscheidungen liegen im zuständigen Zielpackage
```

- [ ] **Step 7: Write `iam-access-control` spec delta**

Create `openspec/changes/refactor-iam-target-architecture-hard-cut/specs/iam-access-control/spec.md` with this content:

```markdown
## MODIFIED Requirements

### Requirement: Zentrale Authorize-Schnittstelle (RBAC v1)
Das System SHALL eine zentrale Autorisierungsschnittstelle bereitstellen, die pro Anfrage eine deterministische Entscheidung mit Begründung liefert und Diagnoseinformationen für Admin-Transparenz bereitstellen kann. Die reine Entscheidung MUST über `@sva/iam-core` laufen; Runtime-nahe Snapshot-, Redis- und DB-Recompute-Pfade MAY in `@sva/auth-runtime` bleiben.

#### Scenario: Autorisierungsentscheidung mit Begründung
- **WHEN** ein Modul `POST /iam/authorize` mit `instanceId`, `action` und `resource` aufruft
- **THEN** liefert das System eine Antwort mit `allowed` und `reason`
- **AND** die Entscheidung ist bei identischem Kontext reproduzierbar

#### Scenario: Request-Input wird schema-validiert
- **WHEN** ein `POST /iam/authorize`-Request eingeht
- **THEN** wird der Request-Body gegen ein Zod-Schema validiert
- **AND** bei ungültigem Input wird ein strukturierter 400-Fehler zurückgegeben

#### Scenario: Authorize-Hot-Path bleibt performant
- **WHEN** die Authorize-Engine nach `@sva/iam-core` migriert wurde
- **THEN** verursacht die Migration keine zusätzlichen DB- oder Redis-Roundtrips im Cache-Hit-Pfad
- **AND** bestehende Cache-Hit-SLOs und Performance-Baselines bleiben maßgeblich
```

- [ ] **Step 8: Validate OpenSpec**

Run:

```bash
openspec validate refactor-iam-target-architecture-hard-cut --strict
```

Expected: output contains `Change 'refactor-iam-target-architecture-hard-cut' is valid`.

- [ ] **Step 9: Commit OpenSpec proposal**

Run:

```bash
git add openspec/changes/refactor-iam-target-architecture-hard-cut
git commit -m "docs: propose iam target architecture hard cut"
```

Expected: commit succeeds and includes only `openspec/changes/refactor-iam-target-architecture-hard-cut/**`.

## Task 2: Authorize-Contracts und Engine nach `iam-core` verschieben

**Files:**
- Create: `packages/iam-core/src/authorization-contract.ts`
- Create: `packages/iam-core/src/authorization-engine.ts`
- Create: `packages/iam-core/src/authorize-performance-contract.ts`
- Create: `packages/iam-core/src/authorization-contract.test.ts`
- Create: `packages/iam-core/src/authorization-engine.test.ts`
- Create: `packages/iam-core/src/authorize-performance-contract.test.ts`
- Modify: `packages/iam-core/src/index.ts`
- Modify: `packages/iam-core/src/types.ts`
- Modify: `packages/iam-core/src/index.test.ts`
- Modify: `packages/iam-core/package.json`
- Modify: `packages/iam-core/tsconfig.lib.json`

- [ ] **Step 1: Copy files into `iam-core`**

Run:

```bash
cp packages/core/src/iam/authorization-contract.ts packages/iam-core/src/authorization-contract.ts
cp packages/core/src/iam/authorization-engine.ts packages/iam-core/src/authorization-engine.ts
cp packages/core/src/iam/authorize-performance-contract.ts packages/iam-core/src/authorize-performance-contract.ts
cp packages/core/src/iam/authorization-contract.test.ts packages/iam-core/src/authorization-contract.test.ts
cp packages/core/src/iam/authorization-engine.test.ts packages/iam-core/src/authorization-engine.test.ts
cp packages/core/src/iam/authorize-performance-contract.test.ts packages/iam-core/src/authorize-performance-contract.test.ts
```

Expected: all six files exist under `packages/iam-core/src`.

- [ ] **Step 2: Fix local relative imports in copied files**

Edit `packages/iam-core/src/authorization-engine.ts` so the import block is:

```ts
import type {
  AuthorizeRequest,
  AuthorizeResponse,
  EffectivePermission,
  IamPermissionProvenance,
  IamPermissionSourceKind,
  MatchedPermissionSummary,
} from './authorization-contract.js';
```

Edit `packages/iam-core/src/authorization-engine.test.ts` so the imports are:

```ts
import { describe, expect, it } from 'vitest';
import type { AuthorizeRequest, EffectivePermission } from './authorization-contract.js';
import { evaluateAuthorizeDecision } from './authorization-engine.js';
```

Edit `packages/iam-core/src/authorize-performance-contract.ts` so the first line is:

```ts
import type { ApiItemResponse } from '@sva/core';
```

Rationale: only `ApiItemResponse` remains in `@sva/core`; Authorize-specific types are local to `iam-core`.

- [ ] **Step 3: Replace `packages/iam-core/src/index.ts`**

Set `packages/iam-core/src/index.ts` to:

```ts
export {
  evaluateAuthorizeDecision,
} from './authorization-engine.js';

export {
  allowReasonCodes,
  denyReasonCodes,
  iamApiErrorCodes,
  iamRolePermissionAssignmentScopes,
} from './authorization-contract.js';

export type {
  AllowReasonCode,
  AuthorizeRequest,
  AuthorizeReasonCode,
  AuthorizeResponse,
  DenyReasonCode,
  EffectivePermission,
  HealthReadyResponse,
  IamApiErrorCode,
  IamApiErrorResponse,
  IamAction,
  IamGeoHierarchyEntry,
  IamGeoNode,
  IamGeoNodeType,
  IamGroupDetail,
  IamGroupListItem,
  IamGroupMembership,
  IamGroupMembershipOrigin,
  IamGroupType,
  IamInstanceId,
  IamPermissionProvenance,
  IamPermissionSourceKind,
  IamResourceRef,
  IamRolePermissionAssignmentScope,
  IamUuid,
  LegalAcceptanceActionType,
  LegalConsentExportRecord,
  MatchedPermissionSummary,
  MePermissionsRequest,
  MePermissionsResponse,
  MePermissionsSubject,
  ReadinessStatus,
  RuntimeDependencyHealth,
  RuntimeDependencyKey,
  RuntimeDependencyStatus,
  RuntimeHealthResponse,
  RuntimeHealthServices,
  SnapshotCacheStatus,
} from './authorization-contract.js';

export {
  authorizePerformanceScenarios,
  buildAuthorizePerformancePayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeAuthorizePerformanceDurations,
} from './authorize-performance-contract.js';

export type {
  AuthorizePerformanceDurationSummary,
  AuthorizePerformanceEvaluation,
  AuthorizePerformancePayload,
  AuthorizePerformanceReportReference,
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResponse,
  AuthorizePerformanceRunResult,
  AuthorizePerformanceScenario,
  AuthorizePerformanceScenarioResult,
} from './authorize-performance-contract.js';

export * from './package-metadata.js';
```

- [ ] **Step 4: Replace `packages/iam-core/src/types.ts`**

Set `packages/iam-core/src/types.ts` to:

```ts
export type {
  AllowReasonCode,
  AuthorizeRequest,
  AuthorizeResponse,
  AuthorizeReasonCode,
  DenyReasonCode,
  EffectivePermission,
  IamAction,
  IamResourceRef,
  MatchedPermissionSummary,
} from './authorization-contract.js';
```

- [ ] **Step 5: Update scaffold test**

Replace `packages/iam-core/src/index.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import {
  allowReasonCodes,
  evaluateAuthorizeDecision,
  iamCorePackageRoles,
  iamCoreVersion,
  type AuthorizeRequest,
} from './index.js';

describe('@sva/iam-core', () => {
  it('declares the target package role', () => {
    expect(iamCoreVersion).toBe('0.0.1');
    expect(iamCorePackageRoles).toContain('authorization-contracts');
    expect(iamCorePackageRoles).toContain('permission-engine');
  });

  it('owns authorization reason codes and decision engine', () => {
    const request: AuthorizeRequest = {
      instanceId: 'inst-1',
      action: 'content.read',
      resource: { type: 'content', id: 'content-1' },
    };

    expect(allowReasonCodes).toEqual(['allowed_by_rbac', 'allowed_by_abac']);
    expect(evaluateAuthorizeDecision(request, [])).toMatchObject({
      allowed: false,
      reason: 'permission_missing',
    });
  });
});
```

- [ ] **Step 6: Run `iam-core` tests and type gate**

Run:

```bash
pnpm nx run iam-core:test:unit
pnpm nx run iam-core:test:types
```

Expected: both commands pass. If `authorize-performance-contract.ts` fails because `ApiItemResponse` imports from `@sva/core` through a not-built dist path, run `pnpm nx run core:build` once and rerun the two commands.

- [ ] **Step 7: Commit `iam-core` extraction**

Run:

```bash
git add packages/iam-core
git commit -m "refactor: move authorize engine into iam-core"
```

Expected: commit includes only `packages/iam-core/**`.

## Task 3: `@sva/core` Authorize-Ownership entfernen

**Files:**
- Delete: `packages/core/src/iam/authorization-contract.ts`
- Delete: `packages/core/src/iam/authorization-contract.test.ts`
- Delete: `packages/core/src/iam/authorization-engine.ts`
- Delete: `packages/core/src/iam/authorization-engine.test.ts`
- Delete: `packages/core/src/iam/authorize-performance-contract.ts`
- Delete: `packages/core/src/iam/authorize-performance-contract.test.ts`
- Modify: `packages/core/src/iam/index.ts`
- Modify: `packages/core/src/iam/account-management.ts`
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/core/src/iam/transparency-contract.ts`
- Modify: `packages/core/package.json`
- Modify: `packages/core/tsconfig.lib.json`
- Modify: `packages/core/README.md`

- [ ] **Step 1: Add temporary dependency from `core` to `iam-core` only for remaining shared contracts**

Edit `packages/core/package.json` and add:

```json
"dependencies": {
  "@sva/iam-core": "workspace:*"
}
```

Use this exact shape only if `packages/core/package.json` has no `dependencies` block. If a `dependencies` block exists by the time this task runs, add only the `@sva/iam-core` entry inside it.

- [ ] **Step 2: Add TypeScript path for `@sva/iam-core` in `core`**

Edit `packages/core/tsconfig.lib.json` and add this `paths` entry under `compilerOptions`:

```json
"paths": {
  "@sva/iam-core": ["packages/iam-core/dist/index.d.ts"]
}
```

If `paths` exists, merge the `@sva/iam-core` entry into the existing object.

- [ ] **Step 3: Replace Authorize-near internal imports**

Edit `packages/core/src/iam/account-management.ts` to import:

```ts
import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
```

Edit `packages/core/src/iam/account-management-contract.ts` to import:

```ts
import type {
  IamLegalTextTargeting,
  IamRolePermissionAssignmentScope,
  IamUuid,
} from '@sva/iam-core';
```

Edit `packages/core/src/iam/transparency-contract.ts` to import:

```ts
import type { IamInstanceId, IamUuid } from '@sva/iam-core';
```

- [ ] **Step 4: Remove Authorize exports from `core` IAM barrel**

Edit `packages/core/src/iam/index.ts` and remove:

```ts
export { evaluateAuthorizeDecision } from './authorization-engine.js';
```

Remove the type export block that exports these names from `./authorization-contract.js`:

```ts
AllowReasonCode,
AuthorizeRequest,
AuthorizeReasonCode,
AuthorizeResponse,
DenyReasonCode,
EffectivePermission,
HealthReadyResponse,
IamApiErrorCode,
IamApiErrorResponse,
IamAction,
IamGeoHierarchyEntry,
IamGeoNode,
IamGeoNodeType,
IamInstanceId,
IamRolePermissionAssignmentScope,
IamPermissionProvenance,
IamPermissionSourceKind,
IamResourceRef,
IamUuid,
LegalAcceptanceActionType,
LegalConsentExportRecord,
MatchedPermissionSummary,
MePermissionsRequest,
MePermissionsSubject,
MePermissionsResponse,
ReadinessStatus,
RuntimeDependencyHealth,
RuntimeDependencyKey,
RuntimeDependencyStatus,
RuntimeHealthResponse,
RuntimeHealthServices,
SnapshotCacheStatus
```

Remove these runtime exports:

```ts
export { allowReasonCodes, denyReasonCodes, iamApiErrorCodes } from './authorization-contract.js';
export { iamRolePermissionAssignmentScopes } from './authorization-contract.js';
```

Remove the performance-contract exports from `./authorize-performance-contract.js`.

- [ ] **Step 5: Delete moved files from `core`**

Run:

```bash
rm packages/core/src/iam/authorization-contract.ts
rm packages/core/src/iam/authorization-contract.test.ts
rm packages/core/src/iam/authorization-engine.ts
rm packages/core/src/iam/authorization-engine.test.ts
rm packages/core/src/iam/authorize-performance-contract.ts
rm packages/core/src/iam/authorize-performance-contract.test.ts
```

Expected: files are removed from `packages/core/src/iam`.

- [ ] **Step 6: Update `packages/core/README.md`**

Edit `packages/core/README.md` so the IAM row no longer claims ownership of `evaluateAuthorizeDecision` or Authorize contracts. Use this wording in the IAM description:

```markdown
| IAM | `extractRoles()`, `resolveInstanceId()`, `resolveUserName()`, `parseJwtPayload()`, `deriveIamRuntimeDiagnostics()` sowie nicht-Authorize-spezifische IAM-Projektionen | Kapselt OIDC-/JWT-Auswertung und allgemeine IAM-Verträge; Authorize-Engine und Authorize-Verträge liegen in `@sva/iam-core` |
```

- [ ] **Step 7: Run core gates**

Run:

```bash
pnpm nx run iam-core:build
pnpm nx run core:test:unit
pnpm nx run core:test:types
pnpm nx run core:check:runtime
```

Expected: all commands pass. If tests fail because consumers still import moved Authorize types from `@sva/core`, record the failing files and continue to Task 4 before rerunning full core gates.

- [ ] **Step 8: Commit core removal**

Run:

```bash
git add packages/core packages/iam-core
git commit -m "refactor: remove authorize ownership from core"
```

Expected: commit succeeds after either all core gates pass or the only failures are known downstream imports fixed in Task 4. Do not commit with TypeScript syntax errors in files already edited in this task.

## Task 4: Runtime-Authorize-Consumer auf `@sva/iam-core` migrieren

**Files:**
- Modify: `packages/auth-runtime/src/iam-authorization/authorize.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize-runtime.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/authorize-performance*.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/me-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/permission-store.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/shared*.ts`
- Modify: `packages/auth-runtime/src/iam-authorization/root-only-permissions.ts`
- Modify: `packages/auth-runtime/src/iam-contents/**`
- Modify: `packages/auth-runtime/src/instance-permission-authorization.ts`
- Modify: related tests under `packages/auth-runtime/src/**`
- Modify: `packages/auth-runtime/package.json`
- Modify: `packages/auth-runtime/tsconfig.lib.json`

- [ ] **Step 1: Find all `auth-runtime` Authorize-near imports from `@sva/core`**

Run:

```bash
rg -n "AuthorizeRequest|AuthorizeResponse|EffectivePermission|IamAction|IamResourceRef|IamRolePermissionAssignmentScope|evaluateAuthorizeDecision|AuthorizePerformance" packages/auth-runtime/src
```

Expected: output lists all files to migrate.

- [ ] **Step 2: Replace imports with `@sva/iam-core`**

For every `packages/auth-runtime/src/**` file importing Authorize-near symbols from `@sva/core`, split mixed imports. Example replacement:

```ts
import type { EffectivePermission } from '@sva/iam-core';
import type { IamContentListQuery } from '@sva/core';
```

For runtime values, use:

```ts
import { evaluateAuthorizeDecision } from '@sva/iam-core';
```

Keep non-Authorize types such as `IamUserDetail`, `IamContentListItem`, `ApiErrorCode`, `ApiItemResponse` and content contracts in `@sva/core`.

- [ ] **Step 3: Ensure `auth-runtime` package dependency is present**

Confirm `packages/auth-runtime/package.json` contains:

```json
"@sva/iam-core": "workspace:*"
```

Expected: dependency already exists. If absent, add it under `dependencies`.

- [ ] **Step 4: Run targeted runtime tests**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/authorize.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/shared-effective-permissions.test.ts --testFiles=src/iam-authorization/shared.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
```

Expected: all commands pass. If the first command reports an unsupported `--testFiles` fanout, run the same files through the package wrapper:

```bash
cd packages/auth-runtime
pnpm exec tsx ../../scripts/ci/run-vitest-target.ts --reporter=verbose --config vitest.config.ts --passWithNoTests --testFiles=src/iam-authorization/authorize.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/shared-effective-permissions.test.ts --testFiles=src/iam-authorization/shared.test.ts
```

- [ ] **Step 5: Commit runtime migration**

Run:

```bash
git add packages/auth-runtime
git commit -m "refactor: consume authorize contracts from iam-core"
```

Expected: commit succeeds with `auth-runtime` changes only.

## Task 5: Domain- und App-Consumer migrieren

**Files:**
- Modify: `packages/iam-admin/src/**`
- Modify: `packages/iam-governance/src/**`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/-iam.models.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/package.json`
- Modify: `apps/sva-studio-react/tsconfig.json`
- Modify: `apps/sva-studio-react/vite.config.ts`

- [ ] **Step 1: Find remaining moved symbols imported from `@sva/core`**

Run:

```bash
rg -n "from '@sva/core'|from \"@sva/core\"" packages/iam-admin/src packages/iam-governance/src apps/sva-studio-react/src/routes/admin apps/sva-studio-react/src/lib/iam-api.ts
```

Expected: output shows mixed imports. Only moved Authorize-near symbols should be changed.

- [ ] **Step 2: Update `iam-admin` imports**

For files importing `IamRolePermissionAssignmentScope` from `@sva/core`, replace with:

```ts
import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
```

If a file imports both `IamRolePermissionAssignmentScope` and core-owned types, split imports:

```ts
import type { IamRolePermissionAssignmentScope } from '@sva/iam-core';
import type { IamRoleListItem, IamRoleSyncState } from '@sva/core';
```

- [ ] **Step 3: Update App admin imports**

In `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`, `apps/sva-studio-react/src/routes/admin/-iam.models.ts` and `apps/sva-studio-react/src/routes/admin/-iam.models.test.ts`, import Authorize types from `@sva/iam-core`:

```ts
import type { AuthorizeResponse, EffectivePermission } from '@sva/iam-core';
```

Keep non-Authorize types from `@sva/core`.

- [ ] **Step 4: Update `iam-api.ts` performance imports**

In `apps/sva-studio-react/src/lib/iam-api.ts`, move these types from `@sva/core` to `@sva/iam-core`:

```ts
import type {
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResponse,
  AuthorizePerformanceRunResult,
} from '@sva/iam-core';
```

Keep all non-Authorize response and IAM admin projection types in the existing `@sva/core` import.

- [ ] **Step 5: Add app dependency and aliases**

Add this dependency to `apps/sva-studio-react/package.json`:

```json
"@sva/iam-core": "workspace:*"
```

Add this path to `apps/sva-studio-react/tsconfig.json`:

```json
"@sva/iam-core": ["../../packages/iam-core/src/index.ts"]
```

Add this alias to `apps/sva-studio-react/vite.config.ts` near the other workspace aliases:

```ts
'@sva/iam-core': resolveAppPath('../../packages/iam-core/src/index.ts'),
```

- [ ] **Step 6: Run domain and app gates**

Run:

```bash
pnpm nx run iam-admin:test:unit
pnpm nx run iam-admin:test:types
pnpm nx run iam-governance:test:unit
pnpm nx run iam-governance:test:types
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/-iam.models.test.ts
```

Expected: all commands pass.

- [ ] **Step 7: Commit domain and app migration**

Run:

```bash
git add packages/iam-admin packages/iam-governance apps/sva-studio-react
git commit -m "refactor: migrate iam consumers to iam-core"
```

Expected: commit succeeds with domain and app import changes.

## Task 6: Public API Hard Cut und stale imports absichern

**Files:**
- Modify: `packages/iam-core/src/index.ts`
- Modify: `packages/core/src/iam/index.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/iam-admin/src/index.ts`
- Modify: `packages/iam-governance/src/index.ts`
- Modify: package READMEs that mention old ownership

- [ ] **Step 1: Verify no moved symbol remains exported from `@sva/core`**

Run:

```bash
rg -n "AuthorizeRequest|AuthorizeResponse|EffectivePermission|IamAction|evaluateAuthorizeDecision|authorizePerformanceScenarios|iamRolePermissionAssignmentScopes" packages/core/src packages/core/README.md
```

Expected: no hits in `packages/core/src/index.ts` or `packages/core/src/iam/index.ts`. Hits in text that explicitly say these now live in `@sva/iam-core` are acceptable.

- [ ] **Step 2: Verify no consumer imports moved symbols from `@sva/core`**

Run:

```bash
rg -n "import \\{[^\\n]*(AuthorizeRequest|AuthorizeResponse|EffectivePermission|IamAction|evaluateAuthorizeDecision|AuthorizePerformance|iamRolePermissionAssignmentScopes)|import type \\{[^\\n]*(AuthorizeRequest|AuthorizeResponse|EffectivePermission|IamAction|AuthorizePerformance|IamRolePermissionAssignmentScope)" apps packages scripts -g '!**/dist/**'
```

Expected: any hits for moved symbols import from `@sva/iam-core`, not `@sva/core`.

- [ ] **Step 3: Run Fallow structural check**

Run:

```bash
pnpm exec fallow analyze --file packages/iam-core/src --file packages/core/src/iam --file packages/auth-runtime/src/iam-authorization --file packages/iam-admin/src --file packages/iam-governance/src --issue-types circular-deps,re-export-cycles,duplicate-exports,unresolved-imports,unlisted-deps
```

Expected: no issues. If local CLI options differ, use MCP/Fallow equivalent:

```text
analyze(root=".", file=[...], issue_types=["circular-deps","re-export-cycles","duplicate-exports","unresolved-imports","unlisted-deps"])
```

- [ ] **Step 4: Commit API hard cut checks**

Run:

```bash
git add packages apps scripts
git commit -m "refactor: enforce iam-core public api hard cut"
```

Expected: commit succeeds if previous commits did not already capture all changes. If `git diff --cached --quiet` returns 0, skip this commit and note that Task 6 was verification-only.

## Task 7: Architektur- und Package-Dokumentation aktualisieren

**Files:**
- Modify: `docs/architecture/package-zielarchitektur.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/09-architecture-decisions.md`
- Modify: `docs/architecture/10-quality-requirements.md`
- Modify: `docs/architecture/11-risks-and-technical-debt.md`
- Modify: `packages/core/README.md`
- Modify: `packages/iam-core/README.md`
- Modify: `packages/iam-admin/README.md`

- [ ] **Step 1: Update package target architecture wording**

In `docs/architecture/package-zielarchitektur.md`, ensure the `@sva/iam-core` row says:

```markdown
| `@sva/iam-core` | Permission Engine, Authorize-Verträge, Reason Codes und reine Authorize-Entscheidung | `packages/iam-core` | Fachliche Entscheidung bleibt zentral; Fachmodule duplizieren keine Berechtigungsauflösung. Runtime-nahe Snapshot-, Redis- und DB-Recompute-Pfade bleiben in `@sva/auth-runtime`. |
```

- [ ] **Step 2: Update building block view references**

In `docs/architecture/05-building-block-view.md`, replace old references that say `packages/core/src/iam/authorization-engine.ts` is the implementation owner with:

```markdown
- `packages/iam-core/src/authorization-engine.ts` hält die reine Authorize-Engine.
- `packages/iam-core/src/authorization-contract.ts` hält Authorize-Verträge, Reason Codes und Permission-Typen.
- `packages/auth-runtime/src/iam-authorization/permission-store.ts` hält Runtime-nahe Snapshot-, Redis- und DB-Recompute-Infrastruktur.
```

- [ ] **Step 3: Update runtime view performance note**

In `docs/architecture/06-runtime-view.md`, add or update the Authorize flow wording:

```markdown
Die Runtime lädt effektive Permissions über `packages/auth-runtime/src/iam-authorization/permission-store.ts`. Die eigentliche Entscheidung wird anschließend synchron über `@sva/iam-core` ausgeführt. Der Package-Cut darf den Cache-Hit-Pfad nicht um zusätzliche Redis- oder Datenbankzugriffe erweitern.
```

- [ ] **Step 4: Update package READMEs**

In `packages/iam-core/README.md`, ensure it states:

```markdown
Die Authorize-Engine und die Authorize-Verträge liegen in diesem Package. `@sva/core` ist kein Owner dieser Entscheidung mehr.
```

In `packages/core/README.md`, ensure it states:

```markdown
Authorize-Engine und Authorize-Verträge liegen in `@sva/iam-core`; `@sva/core` hält weiterhin allgemeine Kernverträge und nicht-Authorize-spezifische IAM-Helfer.
```

In `packages/iam-admin/README.md`, ensure it states:

```markdown
Authorize-nahe Verträge werden aus `@sva/iam-core` konsumiert. Benutzer-, Rollen-, Gruppen- und Organisationslogik bleiben fachliche Ownership von `@sva/iam-admin`.
```

- [ ] **Step 5: Run file placement and docs-adjacent checks**

Run:

```bash
pnpm check:file-placement
pnpm nx run iam-core:test:types
pnpm nx run core:test:types
```

Expected: all commands pass.

- [ ] **Step 6: Commit documentation**

Run:

```bash
git add docs/architecture packages/core/README.md packages/iam-core/README.md packages/iam-admin/README.md
git commit -m "docs: update iam target package ownership"
```

Expected: commit succeeds with docs and README changes.

## Task 8: Performance- und Final-Gates ausführen

**Files:**
- No planned source edits.
- Generated performance reports, if created, must go under `docs/reports/`.

- [ ] **Step 1: Run minimal package gates**

Run:

```bash
pnpm nx run iam-core:test:unit
pnpm nx run iam-core:test:types
pnpm nx run iam-core:check:runtime
pnpm nx run core:test:unit
pnpm nx run core:test:types
pnpm nx run core:check:runtime
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
```

Expected: all commands pass.

- [ ] **Step 2: Run targeted Authorize runtime unit tests**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/authorize.test.ts --testFiles=src/iam-authorization/me-permissions.test.ts --testFiles=src/iam-authorization/permission-store.test.ts --testFiles=src/iam-authorization/redis-permission-snapshot.server.test.ts --testFiles=src/iam-authorization/snapshot-invalidation.server.test.ts --testFiles=src/iam-authorization/shared-effective-permissions.test.ts --testFiles=src/iam-authorization/shared.test.ts --testFiles=src/iam-authorization/shared-cache-health.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 3: Run affected gates**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
```

Expected: both commands pass.

- [ ] **Step 4: Run Authorize performance evidence if environment supports it**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-authorization/authorize-performance.test.ts --testFiles=src/iam-authorization/authorize-performance.server.test.ts
```

Expected: performance test files pass. If the environment lacks required runtime services for endpoint-level benchmarking, record the skipped endpoint benchmark in the final PR notes and keep unit-level performance tests as the local evidence.

- [ ] **Step 5: Run broad PR gate when practical**

Run:

```bash
pnpm test:pr
```

Expected: pass. If the run is not practical due to time or resources, record the reason and include results from Steps 1-4 in the handoff.

- [ ] **Step 6: Commit final verification metadata if reports changed**

Run:

```bash
git status --short docs/reports
```

If new performance report files exist under `docs/reports`, commit them:

```bash
git add docs/reports
git commit -m "docs: record iam authorize performance evidence"
```

Expected: commit succeeds if reports were generated. If no report files changed, skip this commit.

## Task 9: OpenSpec checklist und finaler Arbeitsbaum

**Files:**
- Modify: `openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md`

- [ ] **Step 1: Mark OpenSpec tasks complete**

Edit `openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md` so all checklist items are checked:

```markdown
## 1. Implementation

- [x] 1.1 Move Authorize contracts, engine and performance contracts from `packages/core/src/iam` to `packages/iam-core/src`.
- [x] 1.2 Update `@sva/iam-core` package exports and tests.
- [x] 1.3 Remove Authorize ownership from `@sva/core` exports.
- [x] 1.4 Migrate `auth-runtime`, `iam-admin`, `iam-governance`, app, routing and script imports to `@sva/iam-core`.
- [x] 1.5 Keep Permission Store, Redis snapshots and DB recompute in `auth-runtime` without additional DB or Redis roundtrips.
- [x] 1.6 Update affected arc42 sections or document that no section text changed.
- [x] 1.7 Run targeted unit, type, server-runtime and performance gates.
- [x] 1.8 Run Fallow for circular dependencies and re-export cycles on affected IAM paths.
```

- [ ] **Step 2: Validate OpenSpec and workspace status**

Run:

```bash
openspec validate refactor-iam-target-architecture-hard-cut --strict
git status --short
```

Expected: OpenSpec validation passes. `git status --short` may show pre-existing unrelated worktree changes; new changes from this plan should be committed or intentionally staged for the next PR commit.

- [ ] **Step 3: Commit OpenSpec task completion**

Run:

```bash
git add openspec/changes/refactor-iam-target-architecture-hard-cut/tasks.md
git commit -m "docs: complete iam target architecture hard cut tasks"
```

Expected: commit succeeds.

## Self-Review Checklist

- Spec coverage: Tasks cover OpenSpec proposal, `iam-core` extraction, `core` ownership removal, runtime migration, domain/app migration, public API hard cut, docs, performance gates and final OpenSpec checklist.
- Placeholder scan: this plan uses concrete file paths, command lines, expected outcomes and code snippets. It does not rely on deferred placeholders.
- Type consistency: moved Authorize-near names consistently come from `@sva/iam-core`; non-Authorize projection and response types stay in `@sva/core`.
- Performance coverage: Task 8 explicitly runs Authorize unit/performance evidence and preserves Redis/DB roundtrip behavior by keeping Permission Store infrastructure in `auth-runtime`.
