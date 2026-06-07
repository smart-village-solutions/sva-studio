# Public Waste PDF Export Shift Implementation Plan

**Status 2026-06-07:** Implementiert. Studio erzeugt keine Waste-PDFs mehr, `public-waste-calendar-web` erzeugt PDFs ad hoc serverseitig, die OpenSpec-Änderung ist strikt valide, und die relevanten Unit-/Type-/Build-Gates wurden im Arbeitsverlauf grün nachgewiesen.

**Abschlussnachweise:**
- `openspec validate refactor-public-waste-pdf-export-responsibility --strict`
- `pnpm nx run plugin-waste-management:test:unit`
- `pnpm nx run auth-runtime:test:unit`
- `pnpm nx run routing:test:unit`
- `pnpm nx run core:test:types`
- `pnpm nx run plugin-waste-management:test:types`
- `pnpm nx run auth-runtime:test:types`
- `pnpm nx run routing:test:types`
- `pnpm check:server-runtime`
- `pnpm nx run public-waste-calendar-web:test:types`
- `pnpm nx run public-waste-calendar-web:build`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move waste-calendar PDF generation out of Studio and into the public waste web app as an ad hoc export, while turning Studio `Ausgabe` into a pure configuration area for static PDF content.

**Architecture:** The change is split into two bounded tracks. First, update contracts and Studio so the admin UI stops generating or listing PDFs and instead edits PDF-specific static inputs plus fraction abbreviations. Second, add a server-side PDF export endpoint to `public-waste-calendar-web` that reuses the existing PDF core renderer, applies location inheritance and fraction filtering, and returns a direct download without persistence.

**Tech Stack:** OpenSpec, TypeScript strict mode, Nx, Vitest, React, TanStack Router, zod, existing `@sva/core` waste PDF renderer, `@sva/auth-runtime`, `@sva/plugin-waste-management`, `apps/public-waste-calendar-web`

---

## File Map

- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/proposal.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/tasks.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/design.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/specs/waste-management/spec.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/specs/public-waste-calendar/spec.md`
- Modify: `openspec/specs/waste-management/spec.md`
- Modify: `openspec/specs/public-waste-calendar/spec.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`
- Modify: `packages/core/src/waste-management/master-data-addresses.ts`
- Modify: `packages/core/src/waste-management-output.types.ts`
- Modify: `packages/core/src/waste-management-output.document.ts`
- Modify: `packages/core/src/waste-management-output.render.ts`
- Modify: `packages/core/src/waste-management-output.test.ts`
- Create: `packages/core/src/public-waste-pdf-export.ts`
- Create: `packages/core/src/public-waste-pdf-export.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/master-data-branches.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.master-data-inputs.fractions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.read.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.data.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.forms.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-create.parts.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.output.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.output.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-locations-table.views.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.master-data-fractions-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-api.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-api.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-page.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-page.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-app.tsx`
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-app.test.tsx`
- Modify: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Modify: `apps/public-waste-calendar-web/src/routes/index.test.tsx`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

### Task 1: Create the OpenSpec change set

**Files:**
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/proposal.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/tasks.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/design.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/specs/waste-management/spec.md`
- Create: `openspec/changes/refactor-public-waste-pdf-export-responsibility/specs/public-waste-calendar/spec.md`

- [ ] **Step 1: Write the failing proposal/spec delta files**

```md
# Change: Verlagerung der Waste-PDF-Erzeugung in die öffentliche Web-App

## Why
Die PDF-Erzeugung soll nicht mehr im Studio erfolgen, sondern als öffentlicher Ad-hoc-Export mit Fraktions- und Jahreswahl.

## What Changes
- Studio `Ausgabe` wird Konfigurationsbereich statt Exportbereich
- `public-waste-calendar` erhält serverseitigen PDF-Export ohne Persistenz
- bestehende statische PDF-Linkableitung entfällt
```

- [ ] **Step 2: Validate the change in the expected red/iterative state**

Run: `openspec validate refactor-public-waste-pdf-export-responsibility --strict`
Expected: PASS after deltas are complete, or targeted validation errors while authoring that must be resolved before code work starts.

- [ ] **Step 3: Write the two capability deltas with explicit removals and additions**

```md
## REMOVED Requirements
### Requirement: Die PDF-Erzeugung erfolgt serverseitig im Instanzkontext
**Reason**: PDF-Erzeugung wandert aus dem Studio in die öffentliche Web-App.

## ADDED Requirements
### Requirement: Öffentliche App erzeugt PDF-Exporte ad hoc
Das System SHALL einen serverseitigen PDF-Export für vollständig aufgelöste Standorte bereitstellen.
```

- [ ] **Step 4: Re-run strict validation**

Run: `openspec validate refactor-public-waste-pdf-export-responsibility --strict`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openspec/changes/refactor-public-waste-pdf-export-responsibility
git commit -m "spec: define public waste pdf export responsibility shift"
```

### Task 2: Refactor Studio output from generation to configuration

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.output-panel.data.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.output.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.output.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-locations-table.views.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`

- [ ] **Step 1: Write the failing Studio tests for the new output tab behavior**

```tsx
it('shows branding/contact configuration instead of a pdf generation form', () => {
  render(<WasteOutputPanel />);
  expect(screen.queryByRole('button', { name: 'PDF erzeugen' })).toBeNull();
  expect(screen.getByLabelText('Branding-Grafik')).toBeTruthy();
  expect(screen.getByLabelText('Kontaktblock')).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused plugin test**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx`
Expected: FAIL because the old output panel still renders generation and artifact sections.

- [ ] **Step 3: Replace the form/link sections with configuration sections**

```tsx
return (
  <div className="space-y-5">
    <WasteOutputBrandingSection value={brandingAssetUrl} onChange={setBrandingAssetUrl} />
    <WasteOutputContactSection value={contactBlock} onChange={setContactBlock} />
  </div>
);
```

- [ ] **Step 4: Remove PDF link rendering from the locations table**

```tsx
// delete the outputs column and its cell rendering from WasteMasterDataLocationsHeader/Row
expect(screen.queryByRole('link', { name: '2026' })).toBeNull();
```

- [ ] **Step 5: Re-run the focused plugin tests**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-waste-management/src packages/plugin-waste-management/tests
git commit -m "feat: turn waste output tab into pdf config surface"
```

### Task 3: Extend waste settings and fractions for PDF metadata

**Files:**
- Modify: `packages/core/src/waste-management/master-data-addresses.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.master-data-inputs.fractions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.forms.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-create.parts.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

- [ ] **Step 1: Write failing contract tests for fraction abbreviation and output config fields**

```ts
expectTypeOf<WasteFractionRecord>().toMatchTypeOf<{
  pdfShortLabel?: string;
}>();
expect(readWasteManagementPdfContactBlock({ wasteManagementPdfContactBlock: 'Abfallberatung 03395 / 1234' })).toBe(
  'Abfallberatung 03395 / 1234'
);
```

- [ ] **Step 2: Run the smallest relevant type/unit gates**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-output.test.ts`
Expected: FAIL or type errors because the new properties do not exist yet.

- [ ] **Step 3: Add the new fields end to end**

```ts
export type WasteFractionRecord = {
  readonly id: string;
  readonly name: string;
  readonly pdfShortLabel?: string;
  readonly color: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

```sql
ALTER TABLE waste_fractions
  ADD COLUMN pdf_short_label text;
```

```ts
const WASTE_PDF_BRANDING_ASSET_URL_KEY = 'pdfBrandingAssetUrl';
const WASTE_PDF_CONTACT_BLOCK_KEY = 'pdfContactBlock';
```

- [ ] **Step 4: Re-run the relevant package gates**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core/master-data-branches.test.ts`
Expected: PASS

- [ ] **Step 5: Run server-runtime-safe type checks**

Run: `pnpm check:server-runtime`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core packages/data-repositories packages/auth-runtime packages/plugin-waste-management docs/development/studio-db-schema-final.sql docs/development/studio-db-schema.md
git commit -m "feat: add waste pdf metadata fields"
```

### Task 4: Remove Studio PDF generation and artifact contracts

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.read.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.read.ts`
- Modify: `packages/auth-runtime/src/routes.ts`
- Modify: `packages/auth-runtime/src/index.test.ts`

- [ ] **Step 1: Write failing tests that the Studio route no longer exposes `/outputs/pdf`**

```ts
expect(authRoutePaths).not.toContain('/api/v1/waste-management/outputs/pdf');
expect(screen.queryByText('Vorhandene PDFs')).toBeNull();
```

- [ ] **Step 2: Run the focused auth-runtime tests**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/index.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts`
Expected: FAIL because the dedicated handler and route still exist.

- [ ] **Step 3: Remove the mutation path and artifact result models**

```ts
// packages/plugin-waste-management/src/waste-management.api.types.read.ts
export type WasteManagementOutputOverview = Readonly<{
  pdfBrandingAssetUrl?: string;
  pdfContactBlock?: string;
}>;
```

```ts
// packages/auth-runtime/src/routes.ts
// remove '/api/v1/waste-management/outputs/pdf'
```

- [ ] **Step 4: Re-run the focused auth-runtime and plugin tests**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/index.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth-runtime packages/plugin-waste-management
git commit -m "refactor: remove studio waste pdf generation contract"
```

### Task 5: Add reusable public PDF export core logic

**Files:**
- Create: `packages/core/src/public-waste-pdf-export.ts`
- Create: `packages/core/src/public-waste-pdf-export.test.ts`
- Modify: `packages/core/src/waste-management-output.types.ts`
- Modify: `packages/core/src/waste-management-output.document.ts`
- Modify: `packages/core/src/waste-management-output.render.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core tests for address cleanup, short-label fallback, and footer blocks**

```ts
it('omits generic catch-all labels from the headline address', () => {
  expect(formatPublicWastePdfAddress(['Perleberg', 'Ackerstraße', 'Alle Hausnummern'])).toBe('Perleberg, Ackerstraße');
});

it('falls back to the first characters of the fraction label when no short label exists', () => {
  expect(resolvePublicWasteFractionShortLabel({ label: 'Schadstoffmobil', pdfShortLabel: undefined })).toBe('SCH');
});
```

- [ ] **Step 2: Run the focused core test**

Run: `pnpm nx run core:test:unit --testFiles=src/public-waste-pdf-export.test.ts --testFiles=src/waste-management-output.test.ts`
Expected: FAIL because the helper module and extended render model do not exist.

- [ ] **Step 3: Add a public export adapter over the existing renderer**

```ts
export const buildPublicWastePdfBuffer = (input: PublicWastePdfExportInput): Buffer =>
  renderWasteCalendarPdf(
    buildWasteCalendarPdfDocument({
      year: input.year,
      locationLabel: input.addressLabel,
      pickups: input.pickups,
      notes: input.noticeLines,
      footerLine: input.contactBlock,
    })
  );
```

- [ ] **Step 4: Extend the render model for branding asset and compact legend labels**

```ts
export type WasteCalendarPdfLegendEntry = Readonly<{
  code: string;
  label: string;
  fillColor: RgbColor;
}>;
```

- [ ] **Step 5: Re-run the focused core tests**

Run: `pnpm nx run core:test:unit --testFiles=src/public-waste-pdf-export.test.ts --testFiles=src/waste-management-output.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core
git commit -m "feat: add reusable public waste pdf export core"
```

### Task 6: Add a public waste PDF endpoint with inheritance-aware data loading

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-api.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-config.server.test.ts`

- [ ] **Step 1: Write failing endpoint tests for ad hoc PDF download**

```ts
it('returns application/pdf for a selected year and fractions without storage persistence', async () => {
  const response = await handlePublicWastePdfRequest({
    repository,
    request: new Request(
      'https://public.test/api/public-waste/pdf?cityId=22222222-2222-4222-8222-222222222222&streetId=33333333-3333-4333-8333-333333333333&year=2026&fractionId=bio'
    ),
  });
  expect(response.headers.get('content-type')).toContain('application/pdf');
});
```

- [ ] **Step 2: Run the focused public endpoint tests**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/lib/public-waste-endpoints.server.test.ts src/lib/public-waste-repository.server.test.ts`
Expected: FAIL because only static `pdfLinks` exist today.

- [ ] **Step 3: Replace the config/template model with a real endpoint contract**

```ts
export type PublicWasteConfig = {
  readonly instanceId: string;
  readonly supabase: {
    readonly databaseUrl: string;
    readonly schemaName: string;
  };
};
```

```ts
export const handlePublicWastePdfRequest = async (input: {
  readonly repository: Pick<PublicWasteRepository, 'loadCalendarEntries' | 'loadSelectionSummary'>;
  readonly request: Request;
}): Promise<Response> => new Response(pdfBuffer, {
  status: 200,
  headers: {
    'content-type': 'application/pdf',
    'content-disposition': 'attachment; filename=\"abfallkalender-2026.pdf\"',
  },
});
```

- [ ] **Step 4: Add explicit year/fraction request parsing and inheritance-aware entry loading**

```ts
const selectedFractionIds = url.searchParams.getAll('fractionId');
const year = Number(url.searchParams.get('year'));
```

- [ ] **Step 5: Re-run the focused public endpoint tests**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/lib/public-waste-endpoints.server.test.ts src/lib/public-waste-repository.server.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/public-waste-calendar-web/src/lib
git commit -m "feat: add public waste pdf endpoint"
```

### Task 7: Update the public UI from static PDF links to year + fraction export

**Files:**
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-app.tsx`
- Modify: `apps/public-waste-calendar-web/src/components/public-waste-app.test.tsx`
- Modify: `apps/public-waste-calendar-web/src/routes/index.tsx`
- Modify: `apps/public-waste-calendar-web/src/routes/index.test.tsx`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-page.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-page.server.test.ts`

- [ ] **Step 1: Write failing UI tests for year selection and export action**

```tsx
it('renders a year selector and pdf export action instead of a static current-year link', () => {
  render(
    <PublicWasteApp
      selectionState="complete"
      selectionSummary="Perleberg, Ackerstraße"
      calendarModel={calendarModel}
      icalUrl="/api/public-waste/ical?cityId=222"
      selection={{ cityId: '22222222-2222-4222-8222-222222222222', streetId: '33333333-3333-4333-8333-333333333333' }}
      onChangeLocation={() => {}}
    />
  );
  expect(screen.getByLabelText('PDF-Jahr')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'PDF herunterladen' })).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused public UI tests**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/components/public-waste-app.test.tsx src/routes/index.test.tsx`
Expected: FAIL because the UI still depends on `pdfLinks`.

- [ ] **Step 3: Replace `pdfLinks` usage with an export request builder**

```tsx
const pdfUrl = buildPublicWastePdfUrl({
  selection: props.selection,
  year: selectedYear,
  fractionIds: selectedFractions,
});
```

- [ ] **Step 4: Re-run the focused public UI tests**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/components/public-waste-app.test.tsx src/routes/index.test.tsx`
Expected: PASS

- [ ] **Step 5: Run app typecheck and build**

Run: `pnpm nx run public-waste-calendar-web:test:types && pnpm nx run public-waste-calendar-web:build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/public-waste-calendar-web/src
git commit -m "feat: add public waste year and fraction pdf export ui"
```

### Task 8: Update canonical specs and architecture docs, then run the smallest real gate

**Files:**
- Modify: `openspec/specs/waste-management/spec.md`
- Modify: `openspec/specs/public-waste-calendar/spec.md`
- Modify: `docs/architecture/03-context-and-scope.md`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`
- Modify: `docs/architecture/08-cross-cutting-concepts.md`

- [ ] **Step 1: Write the canonical spec/doc updates after implementation is green**

```md
### Requirement: Öffentliche App erzeugt PDF-Exporte ad hoc
- **WHEN** ein vollständig aufgelöster Standort, ein Jahr und mindestens eine Fraktion gewählt wurden
- **THEN** liefert die App ein serverseitig erzeugtes PDF ohne Persistenz
```

- [ ] **Step 2: Run strict OpenSpec validation**

Run: `openspec validate --strict`
Expected: PASS

- [ ] **Step 3: Run the smallest real multi-package gate for the changed surface**

Run: `pnpm nx run-many --target=test:unit --projects=core,auth-runtime,plugin-waste-management`
Expected: PASS

- [ ] **Step 4: Run the affected type gate and server runtime check**

Run: `pnpm nx run-many --target=test:types --projects=core,auth-runtime,plugin-waste-management,public-waste-calendar-web && pnpm check:server-runtime`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add openspec/specs docs/architecture
git commit -m "docs: align waste and public waste pdf contracts"
```
