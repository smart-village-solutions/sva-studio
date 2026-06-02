# Mainserver-Credentials auf Organisationsebene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bestehende `contentAuthorPolicy` soll zusätzlich die Auswahl der SVA-Mainserver-Credentials steuern, sodass Organisationen einen gemeinsamen Mainserver-Key und ein gemeinsames Secret in der Studio-Datenbank pflegen können und `org_or_personal` kontrolliert auf Benutzer-Credentials aus Keycloak zurückfällt.

**Architecture:** Die Änderung bleibt in den bestehenden Grenzen: Instanz-Endpunkte bleiben in `iam.instance_integrations`, organisationsgebundene Secrets werden als eigener DB-Speicher modelliert, und `@sva/auth-runtime` führt die Laufzeitauflösung anhand von `contentAuthorPolicy` und `activeOrganizationId` aus. `@sva/sva-mainserver` bleibt der einzige Mainserver-Client, bekommt aber den aktiven Organisationskontext in den Connection-Input und verschärfte Cache-Keys.

**Tech Stack:** OpenSpec, Nx, pnpm, TypeScript strict mode, Vitest, Postgres/Goose-Migrationen, React, TanStack Router, shadcn/ui, server-only Mainserver-Integration

---

## File Structure Map

### Referenzen und Vorbedingungen

- Reference: `docs/superpowers/specs/2026-06-01-mainserver-organization-shared-credentials-design.md`
- Reference: `openspec/AGENTS.md`
- Reference: `docs/adr/ADR-021-per-user-sva-mainserver-delegation.md`
- Reference: `docs/development/runbook-sva-mainserver.md`

### OpenSpec-Change

- Create: `openspec/changes/update-mainserver-organization-credentials/proposal.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/tasks.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/design.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/iam-core/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/iam-organizations/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/account-ui/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/sva-mainserver-integration/spec.md`

### Organisationsgebundener Credential-Speicher

- Create: `packages/data/migrations/0048_iam_organization_mainserver_credentials.sql`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Create: `packages/iam-admin/src/organization-mainserver-credentials.ts`
- Create: `packages/iam-admin/src/organization-mainserver-credentials.test.ts`
- Modify: `packages/iam-admin/src/index.ts`

### IAM-Organisationen und API-Vertrag

- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/iam-admin/src/organization-query.ts`
- Modify: `packages/iam-admin/src/organization-query.test.ts`
- Modify: `packages/iam-admin/src/organization-schemas.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-organizations/handlers.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`

### Laufzeitauflösung im Auth-Runtime-Paket

- Create: `packages/auth-runtime/src/mainserver-effective-credentials.ts`
- Create: `packages/auth-runtime/src/mainserver-effective-credentials.test.ts`
- Modify: `packages/auth-runtime/src/mainserver-credentials.ts`
- Modify: `packages/auth-runtime/src/mainserver-credentials.test.ts`
- Modify: `packages/auth-runtime/src/middleware.ts`
- Modify: `packages/auth-runtime/src/middleware.test.ts`
- Modify: `packages/auth-runtime/src/server.ts`
- Modify: `packages/auth-runtime/src/index.ts`

### Mainserver-Integration und Routen

- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.ts`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.test.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/credentials.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/access-token-provider.ts`
- Modify: `packages/sva-mainserver/src/server/service.test.ts`
- Modify: `packages/sva-mainserver/src/server/service.logging.test.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.test.ts`
- Modify: `packages/sva-mainserver/src/server/events-route.ts`
- Modify: `packages/sva-mainserver/src/server/poi-route.ts`
- Modify: `packages/sva-mainserver/src/server/events-poi-routes.test.ts`

### Studio-UI für Organisationsdetails

- Modify: `apps/sva-studio-react/src/lib/interfaces-api.ts`
- Modify: `apps/sva-studio-react/src/lib/interfaces-api.test.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

### Architektur- und Betriebsdokumentation

- Modify: `docs/adr/ADR-021-per-user-sva-mainserver-delegation.md`
- Modify: `docs/development/runbook-sva-mainserver.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/12-glossary.md`

## Task 1: OpenSpec-Change für organisationsgebundene Mainserver-Credentials anlegen

**Files:**
- Create: `openspec/changes/update-mainserver-organization-credentials/proposal.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/tasks.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/design.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/iam-core/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/iam-organizations/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/account-ui/spec.md`
- Create: `openspec/changes/update-mainserver-organization-credentials/specs/sva-mainserver-integration/spec.md`

- [ ] **Step 1: Proposal und technische Leitplanken ausschreiben**

```md
# Change: Mainserver-Credentials pro Organisation ermöglichen

## Why
Die aktuelle Mainserver-Integration geht normativ und technisch davon aus, dass API-Key und Secret immer im Benutzerprofil liegen. Für Organisationen mit gemeinsamem Mainserver-Zugang erzeugt das unnötigen Pflegeaufwand und verhindert eine organisationsbezogene Zugangshoheit.

## What Changes
- ergänzt einen organisationsgebundenen Mainserver-Credential-Speicher in der Studio-Datenbank
- erweitert die bestehende `contentAuthorPolicy` um die Credential-Semantik
- löst Mainserver-Credentials zur Laufzeit über aktiven Organisationskontext plus Fallback-Regel auf
- erweitert die Organisations-Detailansicht um write-only Mainserver-Credential-Pflege

## Impact
- Affected specs: `iam-core`, `iam-organizations`, `account-ui`, `sva-mainserver-integration`
- Affected code: `packages/iam-admin`, `packages/auth-runtime`, `packages/sva-mainserver`, `apps/sva-studio-react`, `packages/data/migrations`
- Affected arc42 sections: `03-context-and-scope`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `12-glossary`
```

- [ ] **Step 2: Spec-Deltas mit den freigegebenen Regeln eintragen**

```md
## ADDED Requirements
### Requirement: Organization-scoped Mainserver Credentials
The system SHALL allow an organization in the active instance context to store a Mainserver application ID and secret in the Studio database.

#### Scenario: Shared credentials are configured for the active organization
- **WHEN** an administrator saves Mainserver credentials on an organization detail page
- **THEN** the application ID is stored as organization-scoped data
- **AND** the secret is stored only as encrypted ciphertext
- **AND** the API response exposes only the application ID and a boolean secret state

### Requirement: Content author policy drives credential resolution
The system SHALL reuse `contentAuthorPolicy` for Mainserver credential resolution in the active organization context.

#### Scenario: org_only requires organization credentials
- **WHEN** `contentAuthorPolicy = org_only`
- **THEN** Mainserver calls use only the active organization's credentials
- **AND** the system does not fall back to user credentials

#### Scenario: org_or_personal falls back to the user profile
- **WHEN** `contentAuthorPolicy = org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **THEN** the system falls back to the current user's Keycloak-backed credentials
```

- [ ] **Step 3: Task-Liste für den OpenSpec-Change mitschreiben**

```md
## 1. Implementation
- [ ] 1.1 Organisationsgebundenen Mainserver-Credential-Speicher in DB und Schema-Doku ergänzen
- [ ] 1.2 IAM-Organisationen um Credential-State im Detailmodell und Update-Payload erweitern
- [ ] 1.3 Laufzeitauflösung in `@sva/auth-runtime` anhand `contentAuthorPolicy` und `activeOrganizationId` implementieren
- [ ] 1.4 `@sva/sva-mainserver` um Organisationskontext, neue Fehlercodes und Cache-Key-Isolation erweitern
- [ ] 1.5 Organisations-Detailseite um Mainserver-Credential-Pflege ergänzen
- [ ] 1.6 ADR, Runbook und betroffene arc42-Abschnitte aktualisieren
- [ ] 1.7 `openspec validate update-mainserver-organization-credentials --strict`
```

- [ ] **Step 4: OpenSpec-Change validieren**

Run:

```bash
openspec validate update-mainserver-organization-credentials --strict
```

Expected: PASS ohne fehlende Szenarien oder Formatfehler.

- [ ] **Step 5: OpenSpec-Change committen**

```bash
git add openspec/changes/update-mainserver-organization-credentials
git commit -m "spec: add org-level mainserver credential change"
```

## Task 2: Organisationsgebundenen Credential-Speicher und Hilfsmodul anlegen

**Files:**
- Create: `packages/data/migrations/0048_iam_organization_mainserver_credentials.sql`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Create: `packages/iam-admin/src/organization-mainserver-credentials.ts`
- Create: `packages/iam-admin/src/organization-mainserver-credentials.test.ts`
- Modify: `packages/iam-admin/src/index.ts`

- [ ] **Step 1: Failing Helper-Test für AAD, Statusprojektion und Persistenzpfad schreiben**

```ts
import { describe, expect, it } from 'vitest';

import {
  buildOrganizationMainserverSecretAad,
  projectOrganizationMainserverCredentialState,
} from './organization-mainserver-credentials.js';

describe('organization mainserver credentials', () => {
  it('builds a stable AAD path for organization secrets', () => {
    expect(buildOrganizationMainserverSecretAad('org-1')).toBe(
      'iam.organization_mainserver_credentials.mainserver_application_secret:org-1'
    );
  });

  it('projects a write-safe credential state without exposing the secret', () => {
    expect(
      projectOrganizationMainserverCredentialState({
        mainserver_application_id: 'org-app-1',
        mainserver_application_secret_ciphertext: 'enc:v1:payload',
      })
    ).toEqual({
      mainserverApplicationId: 'org-app-1',
      mainserverApplicationSecretSet: true,
    });
  });
});
```

- [ ] **Step 2: Den schmalen IAM-Admin-Testlauf rot verifizieren**

Run:

```bash
pnpm nx run iam-admin:test:unit --testFiles=src/organization-mainserver-credentials.test.ts
```

Expected: FAIL, weil das neue Modul noch nicht existiert.

- [ ] **Step 3: Migration und Hilfsmodul minimal implementieren**

```sql
CREATE TABLE IF NOT EXISTS iam.organization_mainserver_credentials (
  instance_id text NOT NULL,
  organization_id uuid NOT NULL,
  mainserver_application_id text,
  mainserver_application_secret_ciphertext text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_account_id uuid,
  PRIMARY KEY (instance_id, organization_id),
  CONSTRAINT organization_mainserver_credentials_org_fk
    FOREIGN KEY (instance_id, organization_id)
    REFERENCES iam.organizations (instance_id, id)
    ON DELETE CASCADE,
  CONSTRAINT organization_mainserver_credentials_updated_by_fk
    FOREIGN KEY (updated_by_account_id)
    REFERENCES iam.accounts (id)
    ON DELETE SET NULL
);
```

```ts
export const buildOrganizationMainserverSecretAad = (organizationId: string) =>
  `iam.organization_mainserver_credentials.mainserver_application_secret:${organizationId}`;

export const projectOrganizationMainserverCredentialState = (row: {
  readonly mainserver_application_id: string | null;
  readonly mainserver_application_secret_ciphertext: string | null;
}) => ({
  mainserverApplicationId: row.mainserver_application_id ?? undefined,
  mainserverApplicationSecretSet: Boolean(row.mainserver_application_secret_ciphertext),
});
```

- [ ] **Step 4: Schema-Snapshot und Schema-Doku parallel nachziehen**

```sql
CREATE TABLE iam.organization_mainserver_credentials (
    instance_id text NOT NULL,
    organization_id uuid NOT NULL,
    mainserver_application_id text,
    mainserver_application_secret_ciphertext text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_account_id uuid
);
```

```md
### `iam.organization_mainserver_credentials`

Speichert organisationsgebundene Mainserver-Zugangsdaten pro `instance_id` und `organization_id`.
`mainserver_application_secret_ciphertext` enthält ausschließlich verschlüsselte Werte; API- und UI-Modelle geben nur einen booleschen Status aus.
```

- [ ] **Step 5: Den Testlauf wiederholen und das neue Hilfsmodul exportieren**

Run:

```bash
pnpm nx run iam-admin:test:unit --testFiles=src/organization-mainserver-credentials.test.ts
```

Expected: PASS. Danach `packages/iam-admin/src/index.ts` um den Export ergänzen:

```ts
export {
  buildOrganizationMainserverSecretAad,
  projectOrganizationMainserverCredentialState,
} from './organization-mainserver-credentials.js';
```

- [ ] **Step 6: Den DB-/Helper-Slice committen**

```bash
git add packages/data/migrations/0048_iam_organization_mainserver_credentials.sql docs/development/studio-db-schema-final.sql docs/development/studio-db-schema.md packages/iam-admin/src/organization-mainserver-credentials.ts packages/iam-admin/src/organization-mainserver-credentials.test.ts packages/iam-admin/src/index.ts
git commit -m "feat: add org-scoped mainserver credential storage"
```

## Task 3: Organisations-Detailmodell und Admin-Mutationen um Credential-State erweitern

**Files:**
- Modify: `packages/core/src/iam/account-management-contract.ts`
- Modify: `packages/iam-admin/src/organization-query.ts`
- Modify: `packages/iam-admin/src/organization-query.test.ts`
- Modify: `packages/iam-admin/src/organization-schemas.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.ts`
- Modify: `packages/iam-admin/src/organization-mutation-handlers.test.ts`
- Modify: `packages/auth-runtime/src/iam-organizations/handlers.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`

- [ ] **Step 1: Failing Query- und Mutation-Tests mit dem neuen Read-/Write-Vertrag ergänzen**

```ts
await expect(loadOrganizationDetail(client, { instanceId: 'de-musterhausen', organizationId: 'org-1' })).resolves.toEqual(
  expect.objectContaining({
    mainserverApplicationId: 'org-app-1',
    mainserverApplicationSecretSet: true,
  })
);
```

```ts
expect(updateOrganization).toHaveBeenCalledWith('org-1', {
  organizationKey: 'landkreis-alpha-neu',
  displayName: 'Landkreis Alpha Neu',
  organizationType: 'district',
  parentOrganizationId: 'parent-2',
  contentAuthorPolicy: 'org_or_personal',
  mainserverApplicationId: 'org-app-1',
  mainserverApplicationSecret: 'org-secret-1',
});
```

- [ ] **Step 2: Den schmalen Testlauf rot ziehen**

Run:

```bash
pnpm nx run iam-admin:test:unit --testFiles=src/organization-query.test.ts --testFiles=src/organization-mutation-handlers.test.ts
```

Expected: FAIL, weil Read-Model und Payloads die neuen Felder noch nicht kennen.

- [ ] **Step 3: Core-, Query- und Payload-Typen ergänzen**

```ts
export type IamOrganizationDetail = IamOrganizationListItem & {
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly memberships: readonly IamOrganizationMembership[];
  readonly children: readonly IamOrganizationChildItem[];
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecretSet: boolean;
};
```

```ts
export type CreateOrganizationPayload = {
  readonly organizationKey: string;
  readonly displayName: string;
  readonly parentOrganizationId?: string;
  readonly organizationType: IamOrganizationType;
  readonly contentAuthorPolicy: 'org_only' | 'org_or_personal';
  readonly mainserverApplicationId?: string;
  readonly mainserverApplicationSecret?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};
```

- [ ] **Step 4: Query und Mutationspfad mit dem neuen Credential-Speicher verdrahten**

```ts
const credentials = await loadOrganizationMainserverCredentialState(client, {
  instanceId: input.instanceId,
  organizationId: input.organizationId,
});

return {
  ...mapOrganizationListItem(organization),
  metadata: organization.metadata ?? {},
  memberships: membershipsResult.rows.map(mapMembershipRow),
  children: childrenResult.rows.map(mapChildRow),
  mainserverApplicationId: credentials.mainserverApplicationId,
  mainserverApplicationSecretSet: credentials.mainserverApplicationSecretSet,
};
```

```ts
export const updateOrganizationSchema = z.object({
  organizationKey: nonEmptyString.optional(),
  displayName: nonEmptyString.optional(),
  parentOrganizationId: z.uuid().nullable().optional(),
  organizationType: organizationTypeSchema.optional(),
  contentAuthorPolicy: contentAuthorPolicySchema.optional(),
  mainserverApplicationId: z.string().trim().optional(),
  mainserverApplicationSecret: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

- [ ] **Step 5: Auth-Runtime-Handler und API-Typen auf den erweiterten Handler-Vertrag bringen**

```ts
const organizationMutationHandlers = createOrganizationMutationHandlers({
  ...existingDeps,
  loadOrganizationMainserverCredentialState,
  upsertOrganizationMainserverCredentials,
});
```

```ts
export type UpdateOrganizationPayload = Partial<CreateOrganizationPayload> & {
  readonly parentOrganizationId?: string | null;
  readonly isActive?: boolean;
};
```

- [ ] **Step 6: Den fokussierten Testlauf wiederholen**

Run:

```bash
pnpm nx run iam-admin:test:unit --testFiles=src/organization-query.test.ts --testFiles=src/organization-mutation-handlers.test.ts
```

Expected: PASS. Danach den kleinsten serverrelevanten Gate ergänzen:

```bash
pnpm check:server-runtime
```

Expected: PASS, weil neue Runtime-Imports weiterhin explizite `.js`-Endungen verwenden.

- [ ] **Step 7: Den Admin-/API-Vertrag committen**

```bash
git add packages/core/src/iam/account-management-contract.ts packages/iam-admin/src/organization-query.ts packages/iam-admin/src/organization-query.test.ts packages/iam-admin/src/organization-schemas.ts packages/iam-admin/src/organization-mutation-handlers.ts packages/iam-admin/src/organization-mutation-handlers.test.ts packages/auth-runtime/src/iam-organizations/handlers.ts apps/sva-studio-react/src/lib/iam-api.ts
git commit -m "feat: expose org mainserver credential state"
```

## Task 4: Effektive Mainserver-Credential-Auflösung in `@sva/auth-runtime` implementieren

**Files:**
- Create: `packages/auth-runtime/src/mainserver-effective-credentials.ts`
- Create: `packages/auth-runtime/src/mainserver-effective-credentials.test.ts`
- Modify: `packages/auth-runtime/src/mainserver-credentials.ts`
- Modify: `packages/auth-runtime/src/mainserver-credentials.test.ts`
- Modify: `packages/auth-runtime/src/middleware.ts`
- Modify: `packages/auth-runtime/src/middleware.test.ts`
- Modify: `packages/auth-runtime/src/server.ts`
- Modify: `packages/auth-runtime/src/index.ts`

- [ ] **Step 1: Failing Resolver-Tests für `org_only`, `org_or_personal` und fehlenden Kontext schreiben**

```ts
await expect(
  readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: 'de-musterhausen',
    keycloakSubject: 'subject-1',
    activeOrganizationId: 'org-1',
  })
).resolves.toEqual({
  status: 'ok',
  source: 'organization',
  credentials: { apiKey: 'org-app-1', apiSecret: 'org-secret-1' },
  organizationId: 'org-1',
});
```

```ts
await expect(
  readEffectiveSvaMainserverCredentialsWithStatus({
    instanceId: 'de-musterhausen',
    keycloakSubject: 'subject-1',
    activeOrganizationId: undefined,
  })
).resolves.toEqual({
  status: 'organization_context_required',
});
```

- [ ] **Step 2: Den Auth-Runtime-Testlauf rot verifizieren**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/mainserver-effective-credentials.test.ts --testFiles=src/mainserver-credentials.test.ts
```

Expected: FAIL, weil es noch keinen effektiven Resolver und keine Kontextweitergabe gibt.

- [ ] **Step 3: Den neuen Resolver mit expliziten Statuswerten implementieren**

```ts
export type EffectiveSvaMainserverCredentialsResult =
  | { readonly status: 'ok'; readonly source: 'organization' | 'user'; readonly credentials: SvaMainserverCredentials; readonly organizationId?: string }
  | { readonly status: 'organization_context_required' }
  | { readonly status: 'organization_credentials_missing'; readonly organizationId: string; readonly policy: IamContentAuthorPolicy }
  | { readonly status: 'missing_credentials' }
  | { readonly status: 'identity_provider_unavailable' }
  | { readonly status: 'database_unavailable' };
```

```ts
if (!input.activeOrganizationId) {
  return { status: 'organization_context_required' };
}

if (organization.contentAuthorPolicy === 'org_only') {
  return organizationCredentials
    ? { status: 'ok', source: 'organization', credentials: organizationCredentials, organizationId: input.activeOrganizationId }
    : { status: 'organization_credentials_missing', organizationId: input.activeOrganizationId, policy: 'org_only' };
}
```

- [ ] **Step 4: `AuthenticatedRequestContext` um `activeOrganizationId` aus der Session erweitern**

```ts
export type AuthenticatedRequestContext = {
  sessionId: string;
  sessionExpiresAt?: number;
  freshReauthAt?: number;
  isLocalDevelopmentAuth?: boolean;
  activeOrganizationId?: string;
  user: SessionUser;
};
```

```ts
return {
  kind: 'authenticated',
  sessionId,
  sessionExpiresAt: session.expiresAt,
  freshReauthAt: session.freshReauthAt,
  activeOrganizationId: session.activeOrganizationId,
  user,
};
```

- [ ] **Step 5: Resolver exportieren, ohne den bestehenden per-user Reader zu brechen**

```ts
export {
  readEffectiveSvaMainserverCredentialsWithStatus,
  resolveEffectiveSvaMainserverCredentialState,
} from './mainserver-effective-credentials.js';
```

```ts
export {
  readEffectiveSvaMainserverCredentialsWithStatus,
} from './mainserver-effective-credentials.js';
```

- [ ] **Step 6: Fokus-Tests und Middleware-Slice grün ziehen**

Run:

```bash
pnpm nx run auth-runtime:test:unit --testFiles=src/mainserver-effective-credentials.test.ts --testFiles=src/mainserver-credentials.test.ts --testFiles=src/middleware.test.ts
```

Expected: PASS mit grünem Resolver-Verhalten für `org_only`, `org_or_personal` und fehlenden Organisationskontext.

- [ ] **Step 7: Den Runtime-Resolver committen**

```bash
git add packages/auth-runtime/src/mainserver-effective-credentials.ts packages/auth-runtime/src/mainserver-effective-credentials.test.ts packages/auth-runtime/src/mainserver-credentials.ts packages/auth-runtime/src/mainserver-credentials.test.ts packages/auth-runtime/src/middleware.ts packages/auth-runtime/src/middleware.test.ts packages/auth-runtime/src/server.ts packages/auth-runtime/src/index.ts
git commit -m "feat: resolve mainserver credentials from org context"
```

## Task 5: Mainserver-Service und Content-Routen auf den Organisationskontext umstellen

**Files:**
- Modify: `packages/sva-mainserver/src/types.ts`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.ts`
- Modify: `packages/sva-mainserver/src/server/interfaces-contract.test.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/credentials.ts`
- Modify: `packages/sva-mainserver/src/server/service-internals/access-token-provider.ts`
- Modify: `packages/sva-mainserver/src/server/service.test.ts`
- Modify: `packages/sva-mainserver/src/server/service.logging.test.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.ts`
- Modify: `packages/sva-mainserver/src/server/news-route.test.ts`
- Modify: `packages/sva-mainserver/src/server/events-route.ts`
- Modify: `packages/sva-mainserver/src/server/poi-route.ts`
- Modify: `packages/sva-mainserver/src/server/events-poi-routes.test.ts`

- [ ] **Step 1: Failing Service- und Route-Tests für `activeOrganizationId` und neue Fehlercodes ergänzen**

```ts
expect(state.listSvaMainserverNews).toHaveBeenCalledWith({
  instanceId: 'de-musterhausen',
  keycloakSubject: 'subject-1',
  activeOrganizationId: 'org-1',
  page: 1,
  pageSize: 25,
});
```

```ts
await expect(upstream?.json()).resolves.toEqual({
  error: 'organization_mainserver_credentials_missing',
  message: 'Für die aktive Organisation fehlen Mainserver-Credentials.',
});
```

- [ ] **Step 2: Den Mainserver-Testlauf rot verifizieren**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service.test.ts --testFiles=src/server/service.logging.test.ts --testFiles=src/server/news-route.test.ts --testFiles=src/server/events-poi-routes.test.ts
```

Expected: FAIL, weil Connection-Input, Cache-Keys und Routen den Organisationskontext noch nicht propagieren.

- [ ] **Step 3: Connection-Input und Fehlercodes erweitern**

```ts
export type SvaMainserverErrorCode =
  | 'config_not_found'
  | 'integration_disabled'
  | 'invalid_config'
  | 'database_unavailable'
  | 'identity_provider_unavailable'
  | 'missing_credentials'
  | 'organization_context_required'
  | 'organization_mainserver_credentials_missing'
  | 'token_request_failed'
  | 'unauthorized'
  | 'forbidden'
  | 'network_error'
  | 'graphql_error'
  | 'invalid_response'
  | 'not_found';

export type SvaMainserverConnectionInput = {
  readonly instanceId: string;
  readonly keycloakSubject: string;
  readonly activeOrganizationId?: string;
};
```

```ts
const ERROR_CODES = new Set<SvaMainserverConnectionStatus['errorCode']>([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'database_unavailable',
  'identity_provider_unavailable',
  'missing_credentials',
  'organization_context_required',
  'organization_mainserver_credentials_missing',
  'token_request_failed',
  'unauthorized',
  'forbidden',
  'network_error',
  'graphql_error',
  'invalid_response',
]);
```

- [ ] **Step 4: Credential-Reader und Token-Cache auf effektive Auflösung umstellen**

```ts
const result = await readEffectiveSvaMainserverCredentialsWithStatus({
  instanceId: input.instanceId,
  keycloakSubject: input.keycloakSubject,
  activeOrganizationId: input.activeOrganizationId,
});
```

```ts
const tokenCacheKey =
  `${connection.instanceId}:${connection.keycloakSubject}:${connection.activeOrganizationId ?? 'none'}:` +
  `${credentials.apiKey}:${config.oauthTokenUrl}:${config.graphqlBaseUrl}`;
```

- [ ] **Step 5: News-, Event- und POI-Routen den aktiven Organisationskontext weiterreichen lassen**

```ts
return {
  instanceId: result.actor.instanceId,
  keycloakSubject: result.actor.keycloakSubject,
  activeOrganizationId: ctx.activeOrganizationId,
};
```

```ts
if (error.code === 'organization_mainserver_credentials_missing') {
  return errorJson(409, error.code, error.message);
}
```

- [ ] **Step 6: Fokus-Tests und Server-Runtime-Check wiederholen**

Run:

```bash
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/interfaces-contract.test.ts --testFiles=src/server/service.test.ts --testFiles=src/server/service.logging.test.ts --testFiles=src/server/news-route.test.ts --testFiles=src/server/events-poi-routes.test.ts
pnpm check:server-runtime
```

Expected: beide PASS; besonders wichtig ist, dass neue Runtime-Imports aus `@sva/auth-runtime/server` und relative `.js`-Pfade Node-ESM-konform bleiben.

- [ ] **Step 7: Den Mainserver-Integrationsslice committen**

```bash
git add packages/sva-mainserver/src/types.ts packages/sva-mainserver/src/server/interfaces-contract.ts packages/sva-mainserver/src/server/interfaces-contract.test.ts packages/sva-mainserver/src/server/service-internals/credentials.ts packages/sva-mainserver/src/server/service-internals/access-token-provider.ts packages/sva-mainserver/src/server/service.test.ts packages/sva-mainserver/src/server/service.logging.test.ts packages/sva-mainserver/src/server/news-route.ts packages/sva-mainserver/src/server/news-route.test.ts packages/sva-mainserver/src/server/events-route.ts packages/sva-mainserver/src/server/poi-route.ts packages/sva-mainserver/src/server/events-poi-routes.test.ts
git commit -m "feat: pass active organization to mainserver service"
```

## Task 6: Organisations-Detailseite um Mainserver-Credential-Pflege ergänzen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/interfaces-api.ts`
- Modify: `apps/sva-studio-react/src/lib/interfaces-api.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [ ] **Step 1: Failing UI-Test für Anzeige, Status und Payload ergänzen**

```tsx
expect(screen.getByLabelText('Mainserver Application-ID')).toHaveValue('org-app-1');
expect(screen.getByText('Ein Secret ist bereits hinterlegt.')).toBeTruthy();
```

```ts
expect(updateOrganization).toHaveBeenCalledWith('org-1', {
  organizationKey: 'landkreis-alpha-neu',
  displayName: 'Landkreis Alpha Neu',
  organizationType: 'district',
  parentOrganizationId: 'parent-2',
  contentAuthorPolicy: 'org_or_personal',
  mainserverApplicationId: 'org-app-2',
  mainserverApplicationSecret: 'org-secret-2',
});
```

- [ ] **Step 2: Den UI-Slice rot verifizieren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/organizations/-organization-detail-page.test.tsx
```

Expected: FAIL, weil Detailansicht und Form-Values noch keine Mainserver-Felder rendern.

- [ ] **Step 3: Formwerte, i18n und Detailseite minimal erweitern**

```ts
export type OrganizationFormValues = {
  organizationKey: string;
  displayName: string;
  organizationType: IamOrganizationType;
  parentOrganizationId: string;
  contentAuthorPolicy: OrganizationContentAuthorPolicy;
  mainserverApplicationId: string;
  mainserverApplicationSecret: string;
  mainserverApplicationSecretSet: boolean;
};
```

```tsx
<Label htmlFor="organization-mainserver-app-id">{t('admin.organizations.form.mainserverApplicationIdLabel')}</Label>
<Input
  id="organization-mainserver-app-id"
  value={formValues.mainserverApplicationId}
  onChange={(event) => setFormValues((current) => ({ ...current, mainserverApplicationId: event.target.value }))}
/>
<Label htmlFor="organization-mainserver-app-secret">{t('admin.organizations.form.mainserverApplicationSecretLabel')}</Label>
<Input
  id="organization-mainserver-app-secret"
  type="password"
  value={formValues.mainserverApplicationSecret}
  placeholder={t('admin.organizations.form.mainserverApplicationSecretPlaceholder')}
  onChange={(event) => setFormValues((current) => ({ ...current, mainserverApplicationSecret: event.target.value }))}
/>
```

- [ ] **Step 4: API-Payload und Test-Fixtures synchronisieren**

```ts
export const toOrganizationMutationPayload = (values: OrganizationFormValues) => ({
  organizationKey: values.organizationKey.trim(),
  displayName: values.displayName.trim(),
  organizationType: values.organizationType,
  parentOrganizationId: values.parentOrganizationId || undefined,
  contentAuthorPolicy: values.contentAuthorPolicy,
  mainserverApplicationId: values.mainserverApplicationId.trim() || undefined,
  mainserverApplicationSecret: values.mainserverApplicationSecret.trim() || undefined,
});
```

```ts
const organizationFixture = {
  ...baseFixture,
  mainserverApplicationId: 'org-app-1',
  mainserverApplicationSecretSet: true,
};
```

```ts
const ERROR_CODES = new Set<string>([
  'config_not_found',
  'integration_disabled',
  'invalid_config',
  'database_unavailable',
  'identity_provider_unavailable',
  'missing_credentials',
  'organization_context_required',
  'organization_mainserver_credentials_missing',
  'token_request_failed',
  'unauthorized',
  'forbidden',
  'network_error',
  'graphql_error',
  'invalid_response',
]);
```

- [ ] **Step 5: Den fokussierten UI-Testlauf wiederholen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/interfaces-api.test.ts --testFiles=src/routes/admin/organizations/-organization-detail-page.test.tsx
```

Expected: PASS mit write-only Secret-Feld und boolescher Statusanzeige.

- [ ] **Step 6: Den UI-Slice committen**

```bash
git add apps/sva-studio-react/src/lib/interfaces-api.ts apps/sva-studio-react/src/lib/interfaces-api.test.ts apps/sva-studio-react/src/lib/iam-api.ts apps/sva-studio-react/src/routes/admin/organizations/-organization-shared.tsx apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.tsx apps/sva-studio-react/src/routes/admin/organizations/-organization-detail-page.test.tsx apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: edit org mainserver credentials in admin ui"
```

## Task 7: Architektur- und Betriebsdokumentation abschließen und die relevanten Gates ausführen

**Files:**
- Modify: `docs/adr/ADR-021-per-user-sva-mainserver-delegation.md`
- Modify: `docs/development/runbook-sva-mainserver.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `docs/architecture/12-glossary.md`

- [ ] **Step 1: ADR und Runbook auf das neue Primärmodell aktualisieren**

```md
### 2. Credential-Quellen

Die Mainserver-Integration nutzt primär organisationsgebundene Credentials der aktiven Organisation, wenn `contentAuthorPolicy = org_only` oder `org_or_personal` dies verlangt. Persönliche Benutzer-Credentials in Keycloak bleiben für Bestandsdaten und den Fallback-Fall `org_or_personal` erhalten.
```

```md
| `organization_mainserver_credentials_missing` | Der aktive Organisationskontext verlangt Organisations-Credentials, aber Key oder Secret fehlen | unvollständige Pflege auf der Organisation | Organisation öffnen und Mainserver Application-ID plus Secret nachpflegen |
| `organization_context_required` | Kein aktiver Organisationskontext für die Credential-Auflösung vorhanden | fehlende oder ungültige Org-Kontext-Session | Organisationskontext neu setzen und Request wiederholen |
```

- [ ] **Step 2: arc42-Abschnitte mit dem neuen Laufzeitpfad ergänzen**

```md
- `contentAuthorPolicy` steuert nicht nur die Autorenschaft, sondern auch die Mainserver-Credential-Auflösung im aktiven Organisationskontext.
- `@sva/auth-runtime` liest dafür organisationsgebundene Credentials aus der Studio-Datenbank und fällt nur bei `org_or_personal` auf Keycloak-Benutzerattribute zurück.
```

- [ ] **Step 3: Die kleinsten relevanten Gates für den gesamten Change ausführen**

Run:

```bash
pnpm nx run iam-admin:test:unit --testFiles=src/organization-mainserver-credentials.test.ts --testFiles=src/organization-query.test.ts --testFiles=src/organization-mutation-handlers.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/mainserver-effective-credentials.test.ts --testFiles=src/mainserver-credentials.test.ts --testFiles=src/middleware.test.ts
pnpm nx run sva-mainserver:test:unit --testFiles=src/server/interfaces-contract.test.ts --testFiles=src/server/service.test.ts --testFiles=src/server/service.logging.test.ts --testFiles=src/server/news-route.test.ts --testFiles=src/server/events-poi-routes.test.ts
pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/interfaces-api.test.ts --testFiles=src/routes/admin/organizations/-organization-detail-page.test.tsx
pnpm check:server-runtime
pnpm nx affected --target=test:types --base=origin/main
```

Expected: alle Läufe PASS. Wenn `test:types` wegen frischer OpenSpec-/Docs-Änderungen keine Projekte betrifft, soll Nx `No tasks were run` oder eine leere Affected-Menge melden.

- [ ] **Step 4: Abschlusscommit für Doku und Verifikation erstellen**

```bash
git add docs/adr/ADR-021-per-user-sva-mainserver-delegation.md docs/development/runbook-sva-mainserver.md docs/architecture/03-context-and-scope.md docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md docs/architecture/08-cross-cutting-concepts.md docs/architecture/12-glossary.md
git commit -m "docs: document org-scoped mainserver credentials"
```
