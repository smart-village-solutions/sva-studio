# Account-Datenschutz und Kontoregeln Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Konto-Menü, das Datenschutz-Cockpit und die Kontoregeln sollen zu einer klar getrennten Account-Self-Service-Struktur mit eigener Regeln-Seite, tabellarischem Datenschutzverlauf, Self-Service-Detailpfaden und Export-Downloads ausgebaut werden.

**Architecture:** Die Umsetzung trennt Navigation, Datenvertrag und Seitenlogik sauber. Zuerst werden Routing und Shell-Navigation erweitert, danach der Self-Service-Datenvertrag um eine einheitliche Aktivitätsliste und einen eigenen `me`-Detailpfad ergänzt, und erst darauf aufbauend werden `/account/privacy` und `/account/rules` in fokussierte Seiten mit klaren Zuständigkeiten umgebaut. Bestehende Arrays im Self-Service-Overview bleiben während der Migration kompatibel, damit Frontend und Backend schrittweise umgestellt werden können.

**Tech Stack:** Nx, pnpm-Workspace, TypeScript Strict Mode, TanStack Router, React, Vitest, Playwright, auth-runtime, iam-governance, routing, studio-ui

**Archivstatus:** Inhaltlich umgesetzt in `48c2570a` (`Implement account privacy flows, DSR exports, and Keycloak theme`) und via `10d1c49c` nach `main` gemergt. Checkboxen wurden für die Archivierung auf den tatsächlichen Stand nachgezogen.

---

## File Structure Map

### Routing- und Shell-Vertrag

- Modify: `packages/routing/src/route-paths.ts`
- Modify: `packages/routing/src/account-ui.routes.ts`
- Modify: `packages/routing/src/account-ui.routes.test.ts`
- Modify: `packages/routing/src/app.routes.test.tsx`
- Modify: `packages/routing/src/app.routes.shared.ts`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.ts`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.test.ts`
- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Modify: `apps/sva-studio-react/src/components/Header.test.tsx`

### Self-Service-Datenvertrag und API

- Modify: `packages/core/src/iam/transparency-contract.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.mappers.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.self-service-queries.ts`
- Modify: `packages/iam-governance/src/index.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.test.ts`
- Modify: `packages/auth-runtime/src/routes.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/routing/src/auth.routes.server.handlers.ts`
- Modify: `packages/routing/src/auth.routes.server.test.ts`
- Modify: `packages/auth-runtime/src/iam-data-subject-rights/core.ts`
- Modify: `packages/auth-runtime/src/iam-data-subject-rights/core.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`

### Account-Regeln-Seite

- Create: `apps/sva-studio-react/src/routes/account/-account-rules-page.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-page.test.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-state.ts`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-summary-cards.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-settings-section.tsx`

### Datenschutz-Übersicht

- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-state.ts`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-shared.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-sections.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-activity-table.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-action-cards.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-dialogs.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-view-model.ts`

### Datenschutz-Detailseite und E2E

- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/e2e/account-admin-ui.spec.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

### Referenzen

- Reference: `docs/superpowers/specs/2026-06-03-account-privacy-navigation-design.md`
- Reference: `apps/sva-studio-react/src/routes/admin/-iam-dsr-detail-page.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.table-frame.tsx`
- Reference: `packages/plugin-waste-management/src/waste-management.tours.table.parts.tsx`

## Implementierungsregeln für diesen Plan

- Self-Service-Routen und Detailpfade müssen über `packages/routing` und `app-route-bindings` laufen; keine Direktverdrahtung nur im App-Layer.
- Die neue Privacy-Tabelle muss sich am Waste-Management-Muster orientieren: Top-Bar mit Filtern, feste Spalten, rechte Aktionsspalte, keine voll klickbaren Zeilen.
- Serverseitige Änderungen in `routing`, `auth-runtime` und `iam-governance` brauchen neben Unit-Tests jeweils den Runtime-Check.
- Die bestehenden `requests`, `exportJobs` und `legalHolds` im Self-Service-Overview bleiben während der Migration erhalten; die neue UI arbeitet zusätzlich mit einer einheitlichen Aktivitätsliste.
- `activityItems` sind in diesem Slice kein still aufgeweiteter DSR-Case-Typ, sondern ein breiter Self-Service-Privacy-/Transparenzverlauf, der DSR-Fälle und privacy-nahe Governance-/Transparenzereignisse vereinheitlichen darf.
- Die bisherige `checkOptionalProcessing`-API bleibt in diesem Slice unangetastet. Sie wird nicht als Top-Level-UI-Element weitergeführt, aber auch nicht entfernt.
- `Passwort ändern` und `E-Mail ändern` bleiben in diesem Slice bewusst deaktivierte Platzhalter im Header-Menü. Neue Routen oder Dialoge dafür sind Folgearbeit und nicht Teil dieses Plans.

### Task 1: Routing-Vertrag für Regeln- und Datenschutz-Detailrouten erweitern

**Files:**
- Modify: `packages/routing/src/route-paths.ts`
- Modify: `packages/routing/src/account-ui.routes.ts`
- Modify: `packages/routing/src/account-ui.routes.test.ts`
- Modify: `packages/routing/src/app.routes.test.tsx`
- Modify: `packages/routing/src/app.routes.shared.ts`

- [x] **Step 1: Fehlende Route-Guard- und zentrale Routing-Regressionstests zuerst schreiben**

Erweitere `packages/routing/src/account-ui.routes.test.ts` um die neuen geschützten Routen und ergänze in `packages/routing/src/app.routes.test.tsx` die neuen Binding-Keys und UI-Route-Erwartungen für `accountRules` und `accountPrivacyDetail`:

```ts
it('allows account rules route for authenticated users', async () => {
  await expect(invoke(accountUiRouteGuards.accountRules, ['editor'], '/account/rules')).resolves.toBeUndefined();
});

it('allows account privacy detail route for authenticated users', async () => {
  await expect(
    invoke(accountUiRouteGuards.accountPrivacyDetail, ['editor'], '/account/privacy/case-1')
  ).resolves.toBeUndefined();
});
```

- [x] **Step 2: Routing-Vertrag minimal um die zwei neuen Routen erweitern**

Passe `packages/routing/src/route-paths.ts`, `packages/routing/src/account-ui.routes.ts` und `packages/routing/src/app.routes.shared.ts` konsistent an:

```ts
export const uiRoutePaths = {
  account: '/account',
  accountPrivacy: '/account/privacy',
  accountPrivacyDetail: '/account/privacy/$caseId',
  accountRules: '/account/rules',
} as const;
```

```ts
export type AccountUiRouteGuardKey =
  | 'account'
  | 'accountPrivacy'
  | 'accountPrivacyDetail'
  | 'accountRules';
```

```ts
accountPrivacyDetail: { kind: 'protected', route: uiRoutePaths.accountPrivacyDetail },
accountRules: { kind: 'protected', route: uiRoutePaths.accountRules },
```

- [x] **Step 3: Den Routing-Testlauf gezielt ausführen**

Run:

```bash
pnpm nx run routing:test:unit --testFiles=src/account-ui.routes.test.ts
pnpm nx run routing:test:unit --testFiles=src/app.routes.test.tsx
```

Expected: Zuerst FAIL wegen unbekannter Guard-Keys/Pfade, nach der Implementierung PASS.

- [x] **Step 4: Types und Runtime-Regeln für das Routing-Paket verifizieren**

Run:

```bash
pnpm nx run routing:test:types
pnpm nx run routing:check:runtime
```

Expected: Beide Läufe PASS; keine endungslosen Runtime-Import-Probleme.

- [x] **Step 5: Commit**

```bash
git add packages/routing/src/route-paths.ts \
  packages/routing/src/account-ui.routes.ts \
  packages/routing/src/account-ui.routes.test.ts \
  packages/routing/src/app.routes.test.tsx \
  packages/routing/src/app.routes.shared.ts
git commit -m "feat: add account rules and privacy detail routes"
```

### Task 2: Header-Menü, Breadcrumbs und App-Bindings auf die neue Account-IA umstellen

**Files:**
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.test.tsx`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.ts`
- Modify: `apps/sva-studio-react/src/lib/breadcrumbs.test.ts`
- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Modify: `apps/sva-studio-react/src/components/Header.test.tsx`

- [x] **Step 1: Fehlende Frontend-Binding- und Navigations-Tests ergänzen**

Erweitere `app-route-bindings.test.tsx`, `breadcrumbs.test.ts` und `Header.test.tsx` um die neue IA:

```tsx
render(<appRouteBindings.accountRules />);
expect(screen.getByTestId('account-rules-page')).toBeTruthy();

render(<appRouteBindings.accountPrivacyDetail />);
expect(screen.getByTestId('account-privacy-detail-page')).toBeTruthy();
```

```ts
expect(resolveBreadcrumbItems('/account/rules')).toEqual([
  { href: '/', label: 'Übersicht' },
  { href: '/account', label: 'Mein Konto' },
  { label: 'Kontoregeln' },
]);

expect(resolveBreadcrumbItems('/account/privacy/case-1')).toEqual([
  { href: '/', label: 'Übersicht' },
  { href: '/account', label: 'Mein Konto' },
  { href: '/account/privacy', label: 'Datenschutz & Transparenz' },
  { label: 'Datenschutzfall-Detail' },
]);
```

```tsx
expect(screen.getByRole('menuitem', { name: 'Datenschutz' }).getAttribute('href')).toBe('/account/privacy');
expect(screen.getByRole('menuitem', { name: 'Kontoregeln' }).getAttribute('href')).toBe('/account/rules');
expect(screen.getByRole('menuitem', { name: 'Passwort ändern' }).getAttribute('aria-disabled')).toBe('true');
expect(screen.getByRole('menuitem', { name: 'E-Mail ändern' }).getAttribute('aria-disabled')).toBe('true');
```

- [x] **Step 2: App-Bindings und Breadcrumbs um die neuen Seiten ergänzen**

Füge in `app-route-bindings.tsx` die neuen Seitenimporte und Bindings hinzu und ergänze `breadcrumbs.ts` um die neuen Pfadmuster:

```tsx
import { AccountRulesPage } from '../routes/account/-account-rules-page';
import { AccountPrivacyDetailPage } from '../routes/account/-account-privacy-detail-page';

export const appRouteBindings = {
  account: AccountProfilePage,
  accountPrivacy: AccountPrivacyPage,
  accountPrivacyDetail: () => {
    const { caseId = '' } = useParams({ strict: false });
    return <AccountPrivacyDetailPage caseId={readStringParam(caseId)} />;
  },
  accountRules: AccountRulesPage,
} as const;
```

```ts
{
  pattern: /^\/account\/privacy\/[^/]+$/,
  build: () => [
    overviewBreadcrumb(),
    { href: '/account', label: t('account.profile.title') },
    { href: '/account/privacy', label: t('account.privacy.title') },
    { label: t('account.privacy.detail.title') },
  ],
},
{
  pattern: /^\/account\/rules$/,
  build: () => [
    overviewBreadcrumb(),
    { href: '/account', label: t('account.profile.title') },
    { label: t('account.rules.title') },
  ],
},
```

- [x] **Step 3: Das Header-Dropdown auf die freigegebene Gruppierung umbauen**

Strukturiere die Account-Menüpunkte in `Header.tsx` nach den drei Gruppen aus der Spec. Nutze im vorhandenen `HeaderDropdownMenu` gerenderte Trenner statt einer zweiten Menükomponente. `Passwort ändern` und `E-Mail ändern` bleiben in diesem Slice bewusst deaktivierte Platzhalter:

```tsx
const logoutItem: HeaderDropdownItem = isDevAuthAvailable
  ? { id: 'logout', label: t('shell.header.logout'), onSelect: () => void logout() }
  : {
      id: 'logout',
      label: t('shell.header.logout'),
      render: (
        <form action="/auth/logout" method="post">
          <input type="hidden" name="logoutIntent" value="user" />
          <button type="submit" role="menuitem" className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground">
            <span className="block text-sm font-medium">{t('shell.header.logout')}</span>
          </button>
        </form>
      ),
    };

const accountMenuItems: readonly HeaderDropdownItem[] = [
  { id: 'account', label: t('account.profile.title'), href: '/account' },
  { id: 'password', label: t('shell.header.changePassword'), disabled: true },
  { id: 'email', label: t('shell.header.changeEmail'), disabled: true },
  { id: 'divider-privacy', render: <div role="separator" className="my-1 border-t border-border" /> },
  { id: 'privacy', label: t('account.privacy.navLabel'), href: '/account/privacy' },
  { id: 'rules', label: t('account.rules.navLabel'), href: '/account/rules' },
  { id: 'divider-session', render: <div role="separator" className="my-1 border-t border-border" /> },
  logoutItem,
];
```

- [x] **Step 4: Die schmalen Frontend-Tests und Typechecks laufen lassen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx --testFiles=src/lib/breadcrumbs.test.ts
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Header.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: Erst rote Tests, danach grüne Tests; Typecheck PASS.

- [x] **Step 5: Commit**

```bash
git add apps/sva-studio-react/src/routing/app-route-bindings.tsx \
  apps/sva-studio-react/src/routing/app-route-bindings.test.tsx \
  apps/sva-studio-react/src/lib/breadcrumbs.ts \
  apps/sva-studio-react/src/lib/breadcrumbs.test.ts \
  apps/sva-studio-react/src/components/Header.tsx \
  apps/sva-studio-react/src/components/Header.test.tsx
git commit -m "feat: add account menu entries and breadcrumbs for privacy routes"
```

### Task 3: Self-Service-Datenvertrag um Aktivitätsliste, Detailpfad und Download-Helfer erweitern

**Files:**
- Modify: `packages/core/src/iam/transparency-contract.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.mappers.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.self-service-queries.ts`
- Modify: `packages/iam-governance/src/index.ts`
- Modify: `packages/iam-governance/src/dsr-read-models.test.ts`
- Modify: `packages/auth-runtime/src/routes.ts`
- Modify: `packages/auth-runtime/src/runtime-routes.ts`
- Modify: `packages/routing/src/auth.routes.server.handlers.ts`
- Modify: `packages/routing/src/auth.routes.server.test.ts`
- Modify: `packages/auth-runtime/src/iam-data-subject-rights/core.ts`
- Modify: `packages/auth-runtime/src/iam-data-subject-rights/core.test.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.ts`
- Modify: `apps/sva-studio-react/src/lib/iam-api.test.ts`

- [x] **Step 1: Die neuen Contract-Erwartungen als Tests zuerst festziehen**

Erweitere `packages/iam-governance/src/dsr-read-models.test.ts` und `packages/auth-runtime/src/iam-data-subject-rights/core.test.ts` um die neue Self-Service-Sicht. Ergänze zusätzlich `packages/routing/src/auth.routes.server.test.ts`, damit der neue `me`-Detailpfad in der zentralen Handler-Coverage mitgeführt wird:

```ts
it('builds a unified self-service privacy activity list ordered by newest activity first', async () => {
  const overview = await loadDsrSelfServiceOverview(client as never, {
    instanceId: 'de-test',
    accountId: 'account-1',
  });

  expect(overview.activityItems.map((item) => item.id)).toEqual([
    'req-2',
    'export-1',
    'consent-1',
  ]);
});
```

```ts
it('returns a self-service privacy activity detail for the authenticated account', async () => {
  const response = await getMyDataSubjectRightsCaseHandler(
    new Request('http://localhost/iam/me/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000')
  );

  expect(response.status).toBe(200);
});
```

Erweitere zusätzlich `apps/sva-studio-react/src/lib/iam-api.test.ts` um:

```ts
await getMyDataSubjectRightsCase('case-1');
expect(fetchMock).toHaveBeenCalledWith('/iam/me/data-subject-rights/cases/case-1', expect.any(Object));

expect(buildMyDataExportDownloadUrl('job-1', 'csv')).toBe('/iam/me/data-export/status?jobId=job-1&download=csv');
```

- [x] **Step 2: Den Core- und Read-Model-Vertrag kompatibel zu einem breiteren Aktivitätsmodell erweitern**

Führe in `packages/core/src/iam/transparency-contract.ts` einen separaten Aktivitätsvertrag für den Self-Service-Verlauf ein. Die bestehenden DSR-Typen bleiben für `requests`, `exportJobs` und `legalHolds` unverändert; nur `activityItems` werden breiter modelliert:

```ts
export type IamSelfServiceActivityType =
  | IamDsrCaseType
  | 'legal_acceptance';

export type IamSelfServiceActivityItem = {
  readonly id: IamUuid;
  readonly source: 'dsr' | 'governance';
  readonly type: IamSelfServiceActivityType;
  readonly canonicalStatus: IamDsrCanonicalStatus;
  readonly rawStatus: string;
  readonly title: string;
  readonly summary: string;
  readonly format?: string;
  readonly createdAt: string;
  readonly updatedAt?: string;
  readonly completedAt?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
};

export type IamDsrSelfServiceOverview = {
  readonly instanceId: IamInstanceId;
  readonly accountId: IamUuid;
  readonly nonEssentialProcessingAllowed: boolean;
  readonly processingRestrictedAt?: string;
  readonly processingRestrictionReason?: string;
  readonly nonEssentialProcessingOptOutAt?: string;
  readonly legalHolds: readonly IamDsrCaseListItem[];
  readonly requests: readonly IamDsrCaseListItem[];
  readonly exportJobs: readonly IamDsrCaseListItem[];
  readonly activityItems: readonly IamSelfServiceActivityItem[];
};
```

Baue in `packages/iam-governance/src/dsr-read-models.ts` eine Self-Service-Detailfunktion auf einer expliziten `caseId`-basierten Query auf. Kein Lookup über `loadDsrSelfServiceOverview()`, weil die Overview weiterhin bewusst limitiert bleibt:

```ts
export const getSelfServiceActivityItem = async (
  client: QueryClient,
  input: { instanceId: string; accountId: string; caseId: string }
): Promise<IamSelfServiceActivityItem | null> =>
  findSelfServiceActivityItemByCaseId(client, input);
```

Erweitere zusätzlich `packages/iam-governance/src/dsr-read-models.self-service-queries.ts` und `packages/iam-governance/src/dsr-read-models.mappers.ts`, damit akzeptierte Rechtstexte als `legal_acceptance`-Aktivitäten in `activityItems` landen und die Detailabfrage auch Fälle außerhalb des aktuellen Overview-Limits zuverlässig auflösen kann.

- [x] **Step 3: Den neuen `me`-Endpoint vom Runtime-Export bis zum Handler verdrahten**

Ergänze den Pfad in `packages/auth-runtime/src/routes.ts`, exportiere den Handler in `runtime-routes.ts` und registriere ihn in `packages/routing/src/auth.routes.server.handlers.ts`:

```ts
| '/iam/me/data-subject-rights/cases/$caseId'
```

```ts
export {
  getMyDataSubjectRightsCaseHandler,
  getMyDataSubjectRightsHandler,
  listAdminDataSubjectRightsCasesHandler,
  optionalProcessingExecuteHandler,
} from './iam-data-subject-rights/core.js';
```

```ts
'/iam/me/data-subject-rights/cases/$caseId': {
  GET: routeHandler(authRuntimeRoutes.getMyDataSubjectRightsCaseHandler),
},
```

Implementiere den Handler in `packages/auth-runtime/src/iam-data-subject-rights/core.ts` parallel zum bestehenden Overview-Handler:

```ts
export const getMyDataSubjectRightsCaseHandler = async (request: Request): Promise<Response> => {
  return withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () =>
    withAuthenticatedUser(request, async ({ user }) => {
      const caseId = readPathUuidParam(request, '$caseId');
      if (!caseId) {
        return createApiError(400, 'invalid_case_id', 'Fall-ID ist ungültig.', getRequestId());
      }

      return withResolvedSelfServiceAccount(request, user, async ({ client, instanceId, accountId }) => {
        const item = await getSelfServiceActivityItem(client, { instanceId, accountId, caseId });
        return item
          ? jsonResponse(200, asApiItem(item, getWorkspaceContext().requestId))
          : createApiError(404, 'not_found', 'Datenschutzfall nicht gefunden.', getRequestId());
      });
    })
  );
};
```

- [x] **Step 4: Frontend-API-Helfer für Self-Detail und Export-Download ergänzen**

Erweitere `apps/sva-studio-react/src/lib/iam-api.ts` um die zwei neuen Helfer:

```ts
export const getMyDataSubjectRightsCase = async (
  caseId: string,
  options?: IamRequestOptions
): Promise<ApiItemResponse<IamSelfServiceActivityItem>> =>
  requestJson<ApiItemResponse<IamSelfServiceActivityItem>>(
    `/iam/me/data-subject-rights/cases/${encodeURIComponent(caseId)}`,
    { signal: options?.signal },
    { signal: options?.signal, timeoutMs: HEAVY_IAM_REQUEST_TIMEOUT_MS }
  );

export const buildMyDataExportDownloadUrl = (
  jobId: string,
  format: 'json' | 'csv' | 'xml'
) => `/iam/me/data-export/status?jobId=${encodeURIComponent(jobId)}&download=${encodeURIComponent(format)}`;
```

- [x] **Step 5: Den schmalen Server-/API-Gate-Pfad laufen lassen**

Run:

```bash
pnpm nx run iam-governance:test:unit --testFiles=src/dsr-read-models.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-data-subject-rights/core.test.ts
pnpm nx run auth-runtime:test:types
pnpm nx run auth-runtime:check:runtime
pnpm nx run iam-governance:test:types
pnpm nx run iam-governance:check:runtime
pnpm nx run routing:test:unit --testFiles=src/auth.routes.server.test.ts
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/lib/iam-api.test.ts
```

Expected: Die neuen Tests schlagen vor der Umsetzung fehl und sind danach grün; Runtime-Checks PASS.

- [x] **Step 6: Commit**

```bash
git add packages/core/src/iam/transparency-contract.ts \
  packages/iam-governance/src/dsr-read-models.ts \
  packages/iam-governance/src/dsr-read-models.mappers.ts \
  packages/iam-governance/src/dsr-read-models.self-service-queries.ts \
  packages/iam-governance/src/index.ts \
  packages/iam-governance/src/dsr-read-models.test.ts \
  packages/auth-runtime/src/routes.ts \
  packages/auth-runtime/src/runtime-routes.ts \
  packages/routing/src/auth.routes.server.handlers.ts \
  packages/routing/src/auth.routes.server.test.ts \
  packages/auth-runtime/src/iam-data-subject-rights/core.ts \
  packages/auth-runtime/src/iam-data-subject-rights/core.test.ts \
  apps/sva-studio-react/src/lib/iam-api.ts \
  apps/sva-studio-react/src/lib/iam-api.test.ts
git commit -m "feat: add self-service privacy case detail contract"
```

### Task 4: Kontoregeln in eine eigene Route mit Regel-Kacheln und Einstellungssektion auslagern

**Files:**
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-page.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-page.test.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-state.ts`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-summary-cards.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-rules-settings-section.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Die neue Regeln-Seite testgetrieben festzurren**

Lege `-account-rules-page.test.tsx` mit den zentralen Anforderungen an:

```tsx
it('renders summary cards and the personal content rule dropdown', async () => {
  render(<AccountRulesPage />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Kontoregeln' })).toBeTruthy();
  });

  expect(screen.getByText('Deaktivierung nach')).toBeTruthy();
  expect(screen.getByText('Pseudonymisierung nach')).toBeTruthy();
  expect(screen.getByText('Löschung nach')).toBeTruthy();
  expect(screen.getByLabelText('Regel für eigene Inhalte')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Inhaltsregel speichern' })).toBeTruthy();
});
```

```tsx
it('hides the personal settings section when the tenant disables overrides', async () => {
  getMyDeletionRulesMock.mockResolvedValue({
    instanceId: 'de-test',
    lastLoginAt: '2026-06-03T10:00:00.000Z',
    lifecycleState: 'active',
    rules: {
      instanceId: 'de-test',
      allowContentPreferenceOverride: false,
      defaultContentStrategy: 'retain',
      deactivateAfterDays: 90,
      pseudonymizeAfterDays: 180,
      deleteAfterDays: 365,
      canEdit: false,
    },
    contentPreference: { isOverridden: false, effectiveStrategy: 'retain' },
  });

  render(<AccountRulesPage />);

  await waitFor(() => {
    expect(screen.queryByLabelText('Regel für eigene Inhalte')).toBeNull();
  });
});
```

- [x] **Step 2: Den Löschregel-State aus der Privacy-Seite in einen eigenen Regeln-State ziehen**

Baue `-account-rules-state.ts` auf Basis des bisherigen Löschregel-Teils aus `-account-privacy-state.ts`:

```ts
export const useAccountRulesState = () => {
  const [deletionRules, setDeletionRules] = React.useState<IamMyDeletionRulesOverview | null>(null);
  const [contentPreferenceDraft, setContentPreferenceDraft] =
    React.useState<IamDeletionContentStrategy>('retain');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const saveContentPreference = async () => {
    const response = await saveMyDeletionRulesContentPreference({
      strategy:
        deletionRules && contentPreferenceDraft === deletionRules.rules.defaultContentStrategy
          ? undefined
          : contentPreferenceDraft,
    });

    setDeletionRules(response);
    setContentPreferenceDraft(response.contentPreference.effectiveStrategy);
    setStatusMessage(t('account.rules.messages.saveSuccess'));
  };

  return {
    deletionRules,
    contentPreferenceDraft,
    isLoading,
    isSaving,
    errorMessage,
    statusMessage,
    setContentPreferenceDraft,
    saveContentPreference,
  };
};
```

- [x] **Step 3: Die Regeln-Seite als Drei-Ebenen-Layout umsetzen**

Implementiere `-account-rules-page.tsx` mit den freigegebenen Ebenen:

```tsx
export const AccountRulesPage = () => {
  const state = useAccountRulesState();

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('account.rules.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('account.rules.subtitle')}</p>
      </header>

      <AccountRulesSummaryCards deletionRules={state.deletionRules} />
      <Card>
        <CardHeader>
          <CardTitle>{t('account.rules.sections.global.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('account.rules.sections.global.deactivateAfterDays')}</p>
          <p>{t('account.rules.sections.global.pseudonymizeAfterDays')}</p>
          <p>{t('account.rules.sections.global.deleteAfterDays')}</p>
          <p>{t('account.rules.sections.global.defaultContentStrategy')}</p>
        </CardContent>
      </Card>
      <AccountRulesSettingsSection
        deletionRules={state.deletionRules}
        contentPreferenceDraft={state.contentPreferenceDraft}
        isLoading={state.isLoading}
        isSaving={state.isSaving}
        errorMessage={state.errorMessage}
        statusMessage={state.statusMessage}
        onContentPreferenceChange={state.setContentPreferenceDraft}
        onSave={() => void state.saveContentPreference()}
      />
    </section>
  );
};
```

Nutze im Settings-Abschnitt das eine Dropdown-plus-Speichern-Muster statt separater “aktueller Status”-Karte.

- [x] **Step 4: Rules-Route binden und die alten Löschregeln aus Privacy konsistent entfernen**

Ersetze in `app-route-bindings.tsx` die provisorische Binding-Zuordnung aus Task 2 durch `AccountRulesPage` und entferne in demselben Slice die direkte `AccountDeletionRulesCard`-Einbettung aus `-account-privacy-page.tsx`. Ziehe den zugehörigen Privacy-Test in `-account-privacy-page.test.tsx` mit, damit die alte Regeln-Sektion dort nicht versehentlich weitergerendert wird.

- [x] **Step 5: UI-Test und Typecheck verifizieren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/account/-account-rules-page.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/account/-account-privacy-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: Regeln-Seiten-Tests PASS; App-Typecheck PASS.

- [x] **Step 6: Commit**

```bash
git add apps/sva-studio-react/src/routes/account/-account-rules-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-rules-page.test.tsx \
  apps/sva-studio-react/src/routes/account/-account-rules-state.ts \
  apps/sva-studio-react/src/routes/account/-account-rules-summary-cards.tsx \
  apps/sva-studio-react/src/routes/account/-account-rules-settings-section.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts \
  apps/sva-studio-react/src/routing/app-route-bindings.tsx
git commit -m "feat: add dedicated account rules page"
```

### Task 5: Datenschutz-Übersicht in 2x3-Aktionskarten und Waste-Management-orientierte Tabelle umbauen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-state.ts`
- Modify: `apps/sva-studio-react/src/routes/account/-account-privacy-shared.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-action-cards.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-activity-table.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-dialogs.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-view-model.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Die neue Privacy-Übersicht erst im Test festklopfen**

Baue die bisherigen Privacy-Tests auf die neue Struktur um:

```tsx
it('renders six action cards with title description and CTA', async () => {
  render(<AccountPrivacyPage />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Datenschutz & Transparenz' })).toBeTruthy();
  });

  expect(screen.getByRole('button', { name: 'Rechteänderung beantragen' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Auskunft anfordern' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Datenexport anfordern' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Widerspruch einreichen' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Löschanfrage anfordern' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Einschränkung der Verarbeitung anfordern' })).toBeTruthy();
});
```

```tsx
it('renders a privacy activity table sorted by newest activity first', async () => {
  render(<AccountPrivacyPage />);

  await waitFor(() => {
    expect(screen.getByRole('table', { name: 'Datenschutzvorgänge' })).toBeTruthy();
  });

  const rows = screen.getAllByRole('row');
  expect(rows[1]?.textContent).toContain('req-2');
});
```

- [x] **Step 2: Einen stabilen View-Model-Layer für die neue Tabelle einführen**

Lege `-account-privacy-view-model.ts` an, damit die UI nicht direkt auf drei separaten Listen operiert:

```ts
export type PrivacyActivityRow = IamSelfServiceActivityItem & {
  readonly activityAt: string;
};

export const buildPrivacyActivityRows = (
  overview: IamDsrSelfServiceOverview | null
): readonly PrivacyActivityRow[] =>
  (overview?.activityItems ?? [])
    .map((item) => ({
      ...item,
      activityAt: item.completedAt ?? item.updatedAt ?? item.createdAt,
    }))
    .sort((left, right) => right.activityAt.localeCompare(left.activityAt));
```

Passe `-account-privacy-state.ts` an, damit `overview`, Filterzustand, Pagination und Dialogzustände an einer Stelle liegen.

- [x] **Step 3: Die 2x3-Aktionskarten und Dialogpfade bauen**

Implementiere `-account-privacy-action-cards.tsx` und `-account-privacy-dialogs.tsx` gemäß Spec:

```tsx
<article className="rounded-xl border border-border bg-card p-4">
  <h2 className="text-base font-semibold text-foreground">{t('account.privacy.cards.permissionChange.title')}</h2>
  <p className="mt-1 text-sm text-muted-foreground">{t('account.privacy.cards.permissionChange.body')}</p>
  <Button className="mt-4" type="button" onClick={onOpenPermissionChange}>
    {t('account.privacy.cards.permissionChange.cta')}
  </Button>
</article>
```

Für den Datenexport nutze einen kleinen Format-Dialog statt eines still verdrahteten JSON-Calls:

```tsx
await requestDataExport({ format: selectedExportFormat, async: true });
```

Auskunft bleibt der direkte Pfad:

```tsx
await createDataSubjectRequest({ type: 'access' });
```

- [x] **Step 4: Die Activity-Tabelle am Waste-Management-Muster ausrichten**

Baue `-account-privacy-activity-table.tsx` mit klaren Spalten und rechter Aktionsspalte:

```tsx
<table className="min-w-full border-collapse" aria-label={t('account.privacy.table.ariaLabel')}>
  <thead className="bg-muted/20 text-left text-[13px] text-foreground">
    <tr className="border-b border-border/70">
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.subject')}</th>
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.status')}</th>
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.type')}</th>
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.createdAt')}</th>
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.updatedAt')}</th>
      <th scope="col" className="px-3 py-3">{t('account.privacy.table.columns.details')}</th>
      <th scope="col" className="px-3 py-3 text-right">{t('account.privacy.table.columns.actions')}</th>
    </tr>
  </thead>
</table>
```

In der rechten Spalte:

```tsx
<Button asChild type="button" variant="outline" size="sm">
  <Link to="/account/privacy/$caseId" params={{ caseId: row.id }}>
    {t('account.privacy.table.actions.details')}
  </Link>
</Button>
{row.type === 'export_job' && row.canonicalStatus === 'completed' && row.format ? (
  <Button type="button" variant="ghost" size="sm" onClick={() => onDownload(row.id, row.format as 'json' | 'csv' | 'xml')}>
    {t('account.privacy.table.actions.download')}
  </Button>
) : null}
```

- [x] **Step 5: Privacy-Page zusammensetzen und die alte Mischlogik entfernen**

Ersetze in `-account-privacy-page.tsx` die alte Grid-Struktur mit `PrivacyProcessingCard`, `PrivacyCasesSection` und `AccountDeletionRulesCard` durch:

```tsx
<section className="space-y-6">
  <header className="space-y-2">
    <h1 className="text-3xl font-semibold text-foreground">{t('account.privacy.title')}</h1>
    <p className="max-w-3xl text-sm text-muted-foreground">{t('account.privacy.subtitle')}</p>
  </header>
  <PrivacyActionCards
    disabled={isSubmitting}
    onOpenPermissionChange={openPermissionChangeDialog}
    onRequestAccess={handleAccessRequest}
    onOpenExportDialog={openExportDialog}
    onOpenObjectionDialog={openObjectionDialog}
    onOpenDeletionDialog={openDeletionDialog}
    onOpenRestrictionDialog={openRestrictionDialog}
  />
  {statusMessage ? <Alert role="status"><AlertDescription>{statusMessage}</AlertDescription></Alert> : null}
  {errorMessage ? <Alert><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
  <PrivacyActivityTable
    rows={visibleRows}
    filters={filters}
    onFilterChange={setFilters}
    onDownload={(jobId, format) => window.location.assign(buildMyDataExportDownloadUrl(jobId, format))}
  />
  <PrivacyDialogs
    isSubmitting={isSubmitting}
    permissionChange={permissionChangeDialog}
    exportDialog={exportDialog}
    objectionDialog={objectionDialog}
    deletionDialog={deletionDialog}
    restrictionDialog={restrictionDialog}
  />
</section>
```

`PrivacyProcessingCard` und die kartenbasierte Fallliste werden in diesem Slice nicht mehr auf der Seite verwendet.

- [x] **Step 6: Den kleinsten echten Frontend-Gate-Pfad laufen lassen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/account/-account-privacy-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: Privacy-UI-Tests PASS; Typecheck PASS.

- [x] **Step 7: Commit**

```bash
git add apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-page.test.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-state.ts \
  apps/sva-studio-react/src/routes/account/-account-privacy-shared.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-action-cards.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-activity-table.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-dialogs.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-view-model.ts \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: redesign account privacy overview"
```

### Task 6: Datenschutz-Detailseite, Doku-Prüfung und Abschluss-Gates vervollständigen

**Files:**
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.tsx`
- Create: `apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
- Modify: `apps/sva-studio-react/e2e/account-admin-ui.spec.ts`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Die Detailseite mit einem fokussierten Routen-Test beschreiben**

Lege `-account-privacy-detail-page.test.tsx` mit diesem Grundgerüst an:

```tsx
it('loads the self-service privacy case detail and offers a back link', async () => {
  getMyDataSubjectRightsCaseMock.mockResolvedValue({
    data: {
      id: 'case-1',
      type: 'request',
      canonicalStatus: 'in_progress',
      rawStatus: 'processing',
      title: 'Rechteänderung',
      summary: 'Mehr Rechte für Veranstaltungsfreigaben',
      createdAt: '2026-06-03T10:00:00.000Z',
      metadata: { origin: 'self_service' },
    },
  });

  render(<AccountPrivacyDetailPage caseId="case-1" />);

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Rechteänderung' })).toBeTruthy();
  });

  expect(screen.getByRole('button', { name: 'Zurück zur Datenschutzübersicht' })).toBeTruthy();
});
```

- [x] **Step 2: Die Detailseite am vorhandenen Admin-Detailmuster ausrichten**

Baue `-account-privacy-detail-page.tsx` analog zum Admin-DSR-Detail, aber mit Self-Service-Ton und Back-Link auf `/account/privacy`:

```tsx
export function AccountPrivacyDetailPage({ caseId }: Readonly<{ caseId: string }>) {
  const navigate = useNavigate();
  const [item, setItem] = React.useState<IamSelfServiceActivityItem | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    getMyDataSubjectRightsCase(caseId, { signal: controller.signal })
      .then((response) => setItem(response.data))
      .catch((currentError) => setError(currentError instanceof Error ? currentError.message : String(currentError)))
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [caseId]);

  return (
    <StudioDetailPageTemplate
      title={item?.title ?? t('account.privacy.detail.title')}
      description={t('account.privacy.detail.subtitle')}
      actions={
        <Button type="button" variant="outline" onClick={() => void navigate({ to: '/account/privacy' })}>
          {t('account.privacy.detail.back')}
        </Button>
      }
    >
      {isLoading ? <p className="text-sm text-muted-foreground">{t('account.privacy.detail.loading')}</p> : null}
      {error ? <Alert><AlertDescription>{error}</AlertDescription></Alert> : null}
      {item ? (
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>{item.title}</CardTitle>
            <Badge className={mapDsrStatusTone(item)} variant="outline">
              {t(mapDsrStatusKey(item))}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <DetailField label={t('account.privacy.table.columns.type')} value={item.type} />
            <DetailField label={t('account.privacy.table.columns.status')} value={item.rawStatus} />
            <DetailField label={t('account.privacy.shared.createdAt', { value: '' }).replace(': ', '')} value={formatPrivacyDateTime(item.createdAt)} />
            <DetailField label={t('account.privacy.shared.completedAt', { value: '' }).replace(': ', '')} value={formatPrivacyDateTime(item.completedAt ?? item.updatedAt)} />
            <DetailField label={t('account.privacy.table.columns.details')} value={item.summary} />
            {item.type === 'export_job' && item.canonicalStatus === 'completed' && item.format ? (
              <Button type="button" variant="outline" onClick={() => window.location.assign(buildMyDataExportDownloadUrl(item.id, item.format as 'json' | 'csv' | 'xml'))}>
                {t('account.privacy.table.actions.download')}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </StudioDetailPageTemplate>
  );
}
```

- [x] **Step 3: Den bestehenden E2E-Fall auf Menü, Privacy-Tabelle und Rules-Seite erweitern**

Erweitere `apps/sva-studio-react/e2e/account-admin-ui.spec.ts` in kleinen Schritten:

```ts
await page.getByRole('button', { name: /Admin One/ }).click();
await page.getByRole('menuitem', { name: 'Datenschutz' }).click();
await expect(page).toHaveURL(/\/account\/privacy$/);
await expect(page.getByRole('table', { name: 'Datenschutzvorgänge' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Rechteänderung beantragen' })).toBeVisible();
```

```ts
await page.getByRole('button', { name: /Admin One/ }).click();
await page.getByRole('menuitem', { name: 'Kontoregeln' }).click();
await expect(page).toHaveURL(/\/account\/rules$/);
await expect(page.getByRole('heading', { name: 'Kontoregeln' })).toBeVisible();
await expect(page.getByLabel('Regel für eigene Inhalte')).toBeVisible();
```

Füge zusätzlich einen Klick auf `Details` in der Privacy-Tabelle mit erfolgreicher Detailnavigation hinzu.

- [x] **Step 4: Doku- und Architekturfolgen für den Slice explizit prüfen**

Prüfe die neue Verantwortungsaufteilung von `/account`, `/account/privacy` und `/account/rules` sowie den neuen Self-Service-Detailfluss gegen die betroffenen Architekturstellen:

- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`

Aktualisiere die betroffenen Dateien, wenn die neue Account-Self-Service-Struktur dort nachvollziehbar dokumentiert werden muss. Falls keine Änderung nötig ist, dokumentiere die begründete Nicht-Änderung explizit im PR-Kontext und im Arbeitsprotokoll zu diesem Task.

- [x] **Step 5: Den kleinsten vollständigen Gate-Pfad für den Slice fahren**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/account/-account-privacy-detail-page.test.tsx --testFiles=src/routes/account/-account-rules-page.test.tsx --testFiles=src/routes/account/-account-privacy-page.test.tsx
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routing/app-route-bindings.test.tsx --testFiles=src/lib/breadcrumbs.test.ts --testFiles=src/lib/iam-api.test.ts
pnpm nx run routing:test:unit --testFiles=src/account-ui.routes.test.ts
pnpm nx run routing:test:unit --testFiles=src/app.routes.test.tsx --testFiles=src/auth.routes.server.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/iam-data-subject-rights/core.test.ts
pnpm nx run iam-governance:test:unit --testFiles=src/dsr-read-models.test.ts
pnpm nx run sva-studio-react:test:types
pnpm nx run routing:test:types
pnpm nx run auth-runtime:test:types
pnpm nx run iam-governance:test:types
pnpm nx run routing:check:runtime
pnpm nx run auth-runtime:check:runtime
pnpm nx run iam-governance:check:runtime
pnpm nx affected --target=test:types --base=origin/main
pnpm nx affected --target=test:unit --base=origin/main
```

Expected: Alle gezielten Unit-/Type-/Runtime-Läufe PASS; die abschließenden affected-Type- und affected-Unit-Läufe PASS.

- [x] **Step 6: Den E2E-Pfad für die neue Account-Navigation verifizieren**

Run:

```bash
pnpm nx run sva-studio-react:test:e2e --testFiles=apps/sva-studio-react/e2e/account-admin-ui.spec.ts --grep="header menu opens privacy cockpit, detail view, and account rules" --workers=1
```

Expected: PASS mit Menü-Einstieg, Privacy-Tabelle, Detailzugang und Rules-Seite.

- [x] **Step 7: Commit**

```bash
git add apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.tsx \
  apps/sva-studio-react/src/routes/account/-account-privacy-detail-page.test.tsx \
  apps/sva-studio-react/e2e/account-admin-ui.spec.ts \
  docs/architecture/05-building-block-view.md \
  docs/architecture/06-runtime-view.md \
  docs/architecture/08-cross-cutting-concepts.md \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: add account privacy detail flow"
```

## Spec Coverage Self-Check

- Navigation, Header-Dropdown und getrennte Routen werden durch Task 1 und Task 2 abgedeckt.
- `/account/rules` mit Kacheln, globaler Erklärung und persönlicher Einstellung wird durch Task 4 abgedeckt.
- `/account/privacy` mit sechs Karten, Tabelle, Reihenfolge-Priorisierung und Waste-Management-Tabellenmuster wird durch Task 5 abgedeckt.
- Drilldown pro Datenschutzvorgang wird durch Task 1, Task 3 und Task 6 abgedeckt.
- Exportformat-Auswahl und Export-Download werden durch Task 3, Task 5 und Task 6 abgedeckt.
- Die Lücke `deletion`/`restriction` wird in Task 5 über zusätzliche Karten und Dialogpfade geschlossen.
- Historische Datenschutznachweise bleiben nicht implizit: Task 3 fordert ihre Aufnahme in `activityItems`.

## Plan-Selbstprüfung

- Keine Platzhalter wie `TODO`, `später`, `geeignete Tests` oder `ähnlich wie`.
- Alle Tasks nennen konkrete Dateien, Commands und Testziele.
- Serverseitige Änderungen enthalten früh einen Runtime-Check.
- Die neue UI entfernt keine Backend-Fähigkeit; sie verteilt sie neu und ergänzt fehlende Zugänge.
