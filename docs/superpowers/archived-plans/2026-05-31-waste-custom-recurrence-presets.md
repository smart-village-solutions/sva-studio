# Waste Custom Recurrence Presets Implementation Plan

## Status

Stand 2026-05-31: Die fachliche Umsetzung ist abgeschlossen und die Verifikationsschritte sind inklusive Waste-E2E grün. Offen bleiben in diesem Plan nur bewusst nicht ausgeführte Commit-Schritte; die früheren Step-Checkboxen weiter oben sind historischer Arbeitsstand und nicht mehr die führende Statusquelle.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Waste-Management soll instanzbezogene benutzerdefinierte Abstandspresets in den Einstellungen pflegen, diese im Tour-Formular zusätzlich zu den festen Default-Turnussen anbieten und bei Terminberechnung, Bearbeitung und Fallback-Löschung konsistent verwenden.

**Architecture:** Die Umsetzung bleibt additiv: feste `recurrence`-Defaults bleiben unverändert, Touren referenzieren optional ein neues Abstandspreset über `customRecurrenceId`. Die Presets werden im bestehenden Waste-Settings-Vertrag mitgeführt, aber technisch getrennt von der interfaces-gemanagten Supabase-Konfiguration behandelt; serverseitig werden Persistenz, Validierung, Fallback-Umschaltung und Terminauflösung in klar getrennten Bausteinen umgesetzt.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, Zod, Vitest über Nx, auth-runtime Waste-Handler, data-repositories, PostgreSQL-Schema-Statements, OpenSpec

---

## File Structure

### OpenSpec und begleitende Doku

- Create: `openspec/changes/add-waste-custom-recurrence-presets/proposal.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/tasks.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/design.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/specs/waste-management/spec.md`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`

### Core- und SDK-Verträge

- Modify: `packages/core/src/waste-management-contract.ts`
- Modify: `packages/core/src/waste-management-master-data-tours.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`

### Waste-Schema und Repository

- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.ts`
- Create: `packages/data-repositories/src/waste-management/master-data.custom-recurrence-presets.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.tours.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`

### Auth-Runtime und Settings-/Tour-Handler

- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/tours.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`

### Plugin-Settings und Tour-UI

- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-form.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-section.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-dialog.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-delete-dialog.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-tour-fields.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.presentation.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.api.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.presentation.test.ts`

### Öffentliche Kalenderberechnung

- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.test.ts`

### E2E

- Modify: `apps/sva-studio-react/e2e/waste-management-plugin.spec.ts`

## Task 1: OpenSpec-Change und DB-Doku für Abstandspresets anlegen

**Files:**
- Create: `openspec/changes/add-waste-custom-recurrence-presets/proposal.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/tasks.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/design.md`
- Create: `openspec/changes/add-waste-custom-recurrence-presets/specs/waste-management/spec.md`
- Modify: `docs/development/studio-db-schema-final.sql`
- Modify: `docs/development/studio-db-schema.md`
- Reference: `docs/superpowers/specs/2026-05-31-waste-custom-recurrence-presets-design.md`
- Reference: `openspec/specs/waste-management/spec.md`

- [ ] **Step 1: OpenSpec-Delta mit Preset- und Fallback-Verhalten schreiben**

```md
## ADDED Requirements
### Requirement: Waste-Management bietet benutzerdefinierte Abstandspresets pro Instanz
Das System SHALL im Settings-Bereich des Waste-Managements instanzbezogene Abstandspresets mit Name, optionaler Beschreibung und positiver Tagesanzahl verwalten.

#### Scenario: Benutzer legt einen benutzerdefinierten Abstand an
- **WHEN** ein berechtigter Benutzer im Settings-Bereich einen Namen und eine positive Tagesanzahl speichert
- **THEN** persistiert das System ein instanzbezogenes Abstandspreset
- **AND** das Preset steht anschließend im Tour-Formular als zusätzliche Option zur Verfügung

### Requirement: Waste-Touren können ein benutzerdefiniertes Abstandspreset referenzieren
Das System SHALL Touren zusätzlich zu den festen Default-Turnussen eine Referenz auf ein benutzerdefiniertes Abstandspreset speichern lassen.

#### Scenario: Tour verwendet benutzerdefinierten Abstand
- **WHEN** eine Tour ein Preset auswählt
- **THEN** speichert das System die Preset-Referenz statt einer freien Tageszahl an der Tour
- **AND** die Terminberechnung verwendet die Tagesanzahl des referenzierten Presets
- **AND** `customDates` bleiben zusätzlich wirksam

### Requirement: Löschen eines verwendeten Presets verlangt einen Fallback
Das System SHALL beim Löschen eines referenzierten Abstandspresets eine Fallback-Zuweisung für betroffene Touren erzwingen.

#### Scenario: Benutzer löscht ein verwendetes Preset
- **GIVEN** mindestens eine Tour referenziert das Preset
- **WHEN** ein berechtigter Benutzer das Preset löschen will
- **THEN** verlangt das System die Auswahl eines Fallback-Presets oder eines festen Default-Turnus
- **AND** stellt alle betroffenen Touren serverseitig atomar auf den Fallback um
- **AND** löscht erst danach das Preset
```

- [ ] **Step 2: Proposal und Task-Liste passend zur neuen Richtung anlegen**

```md
# Change: Benutzerdefinierte Abstandspresets im Waste Management

## Why
Feste Turnuswerte decken die Standardfälle ab, erlauben aber keine instanzspezifischen zusätzlichen Abstände, die zentral gepflegt und in mehreren Touren wiederverwendet werden können.

## What Changes
- Neue instanzbezogene Abstandspresets im Waste-Settings-Bereich
- Erweiterung des Tour-Modells um `customRecurrenceId`
- Terminauflösung für benutzerdefinierte Tagesabstände
- Fallback-Dialog und atomare Preset-Löschung

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/core`, `packages/data-repositories`, `packages/auth-runtime`, `packages/plugin-waste-management`, `apps/public-waste-calendar-web`
- Affected arc42 sections: keine Architektur-Neusortierung; bestehende Host-Fassade bleibt führend
```

- [ ] **Step 3: OpenSpec strikt validieren**

Run: `openspec validate add-waste-custom-recurrence-presets --strict`  
Expected: PASS ohne Requirement- oder Scenario-Fehler

- [ ] **Step 4: DB-Doku für neue Tabelle und Tour-Referenz ergänzen**

```sql
CREATE TABLE waste_custom_recurrence_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waste_custom_recurrence_presets_name_unique UNIQUE (name)
);

ALTER TABLE waste_tours
  ADD COLUMN custom_recurrence_id UUID REFERENCES waste_custom_recurrence_presets(id);
```

- [ ] **Step 5: OpenSpec- und Doku-Änderungen committen**

```bash
git add openspec/changes/add-waste-custom-recurrence-presets \
  docs/development/studio-db-schema-final.sql \
  docs/development/studio-db-schema.md
git commit -m "spec: add waste custom recurrence presets proposal"
```

## Task 2: Core-Verträge, SDK-Reexports und Waste-Schema additiv erweitern

**Files:**
- Modify: `packages/core/src/waste-management-contract.ts`
- Modify: `packages/core/src/waste-management-master-data-tours.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Modify: `packages/plugin-sdk/src/index.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.test.ts`

- [ ] **Step 1: Failing Typ- und Schema-Tests ergänzen**

```ts
it('maps waste settings with custom recurrence presets', () => {
  const settings: WasteManagementSettingsRecord = {
    instanceId: 'tenant-a',
    provider: 'supabase',
    projectUrl: 'https://tenant-a.supabase.co',
    schemaName: 'wm',
    enabled: true,
    databaseUrlConfigured: true,
    serviceRoleKeyConfigured: true,
    visibleStatus: 'ok',
    customRecurrencePresets: [
      { id: 'preset-10', name: '10 Tage', intervalDays: 10, createdAt: '2026-05-31T10:00:00.000Z', updatedAt: '2026-05-31T10:00:00.000Z' },
    ],
  };

  expect(settings.customRecurrencePresets[0]?.intervalDays).toBe(10);
});

it('keeps recurrence null when a tour uses a custom preset', async () => {
  const statements = applySchemaStatements('wm').join('\n');
  expect(statements).toContain('waste_custom_recurrence_presets');
  expect(statements).toContain('custom_recurrence_id UUID');
});
```

- [ ] **Step 2: Gezielte Tests rot ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts`  
Expected: FAIL wegen fehlender Typfelder oder Schema-Statements

- [ ] **Step 3: Core-Typen und Reexports ergänzen**

```ts
export type WasteCustomRecurrencePresetRecord = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly intervalDays: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type WasteManagementSettingsRecord = {
  readonly instanceId: string;
  // ...
  readonly customRecurrencePresets: readonly WasteCustomRecurrencePresetRecord[];
};

export type WasteTourRecord = {
  readonly id: string;
  readonly recurrence?: WasteTourRecurrence | null;
  readonly customRecurrenceId?: string;
  readonly customRecurrenceName?: string;
  readonly customRecurrenceIntervalDays?: number;
  // ...
};
```

- [ ] **Step 4: Waste-Schema additiv erweitern**

```ts
`CREATE TABLE IF NOT EXISTS ${schema}.waste_custom_recurrence_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT waste_custom_recurrence_presets_name_unique UNIQUE (name)
);`,
`ALTER TABLE ${schema}.waste_tours ADD COLUMN IF NOT EXISTS custom_recurrence_id UUID REFERENCES ${schema}.waste_custom_recurrence_presets(id);`,
`CREATE INDEX IF NOT EXISTS idx_waste_custom_recurrence_presets_name ON ${schema}.waste_custom_recurrence_presets(name);`,
`CREATE INDEX IF NOT EXISTS idx_waste_tours_custom_recurrence_id ON ${schema}.waste_tours(custom_recurrence_id);`,
```

- [ ] **Step 5: Tests erneut ausführen und committen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

```bash
git add packages/core/src/waste-management-contract.ts \
  packages/core/src/waste-management-master-data-tours.ts \
  packages/core/src/index.ts \
  packages/plugin-sdk/src/public-api.ts \
  packages/plugin-sdk/src/index.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.schema.ts \
  packages/data-repositories/src/waste-management/master-data.test.ts
git commit -m "feat: add waste custom recurrence contracts"
```

## Task 3: Repository-Layer für Presets und Tour-Reads mit Preset-Auflösung erweitern

**Files:**
- Create: `packages/data-repositories/src/waste-management/master-data.custom-recurrence-presets.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.tours.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`

- [ ] **Step 1: Failing Repository-Tests für Preset-CRUD und Tour-Join ergänzen**

```ts
it('lists and upserts custom recurrence presets', async () => {
  const executor = createExecutor([
    { rows: [{ id: 'preset-10', name: '10 Tage', description: 'Ferien', interval_days: 10, created_at: '2026-05-31T10:00:00.000Z', updated_at: '2026-05-31T10:00:00.000Z' }] },
  ]);

  const repository = createWasteMasterDataRepository(executor.executor);
  await expect(repository.listWasteCustomRecurrencePresets()).resolves.toEqual([
    expect.objectContaining({ id: 'preset-10', intervalDays: 10 }),
  ]);
});

it('reads tours with resolved custom recurrence metadata', async () => {
  const executor = createExecutor([
    {
      rows: [{
        id: 'tour-1',
        name: 'Rest Nord',
        description: null,
        waste_fraction_ids: ['fraction-1'],
        recurrence: null,
        custom_recurrence_id: 'preset-10',
        custom_recurrence_name: '10 Tage',
        custom_recurrence_interval_days: 10,
        first_date: '2026-01-10',
        end_date: null,
        custom_dates: null,
        active: true,
        created_at: '2026-05-31T10:00:00.000Z',
        updated_at: '2026-05-31T10:00:00.000Z',
      }],
    },
  ]);

  const repository = createWasteMasterDataRepository(executor.executor);
  await expect(repository.getWasteTourById('tour-1')).resolves.toEqual(
    expect.objectContaining({ customRecurrenceId: 'preset-10', customRecurrenceIntervalDays: 10 }),
  );
});
```

- [ ] **Step 2: Repository-Tests gezielt rot ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: FAIL wegen fehlender Repository-Methoden oder fehlender Join-Spalten

- [ ] **Step 3: Eigenes Repository-Part für Presets implementieren**

```ts
export const createWasteCustomRecurrencePresetRepositoryPart = (
  executor: SqlExecutor,
): Pick<
  WasteMasterDataRepository,
  | 'listWasteCustomRecurrencePresets'
  | 'getWasteCustomRecurrencePresetById'
  | 'upsertWasteCustomRecurrencePreset'
  | 'deleteWasteCustomRecurrencePreset'
> => ({
  async listWasteCustomRecurrencePresets() {
    const result = await executor.execute<WasteCustomRecurrencePresetRow>(buildPresetListStatement());
    return result.rows.map(mapPresetRow);
  },
  // ...
});
```

- [ ] **Step 4: Tour-Selects um Preset-Join ergänzen**

```ts
SELECT
  t.id::text,
  t.name,
  t.description,
  t.waste_fraction_ids,
  t.recurrence,
  t.custom_recurrence_id::text,
  p.name AS custom_recurrence_name,
  p.interval_days AS custom_recurrence_interval_days,
  t.first_date::text,
  t.end_date::text,
  t.custom_dates,
  t.active,
  COUNT(ltl.id)::int AS location_count,
  t.created_at::text,
  t.updated_at::text
FROM waste_tours t
LEFT JOIN waste_custom_recurrence_presets p
  ON p.id = t.custom_recurrence_id
LEFT JOIN waste_location_tour_links ltl
  ON ltl.tour_id = t.id
```

- [ ] **Step 5: Repository-Tests grün ausführen und committen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

```bash
git add packages/data-repositories/src/waste-management/master-data.custom-recurrence-presets.ts \
  packages/data-repositories/src/waste-management/master-data.contract.ts \
  packages/data-repositories/src/waste-management/master-data.ts \
  packages/data-repositories/src/waste-management/master-data.tours.ts \
  packages/data-repositories/src/waste-management/master-data.contract.test.ts \
  packages/data-repositories/src/waste-management/master-data.test.ts
git commit -m "feat: add waste custom recurrence repositories"
```

## Task 4: Auth-Runtime-Settings und Tour-Handler auf Presets und Fallback-Löschung erweitern

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/tours.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/read-handlers.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`

- [ ] **Step 1: Failing Handler-Tests für Settings-Write und Preset-Fallback ergänzen**

```ts
it('accepts preset updates when datasource fields remain unchanged', async () => {
  const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
    createRequest({
      provider: 'supabase',
      projectUrl: 'https://tenant.example',
      schemaName: 'wm',
      enabled: true,
      customRecurrencePresets: [
        { id: 'preset-10', name: '10 Tage', description: 'Ferien', intervalDays: 10 },
      ],
    }),
    actor,
    createDeps(),
  );

  expect(response.status).toBe(200);
});

it('rejects deleting a referenced preset without fallback', async () => {
  await expect(
    saveWasteCustomRecurrencePresets('tenant-a', {
      nextItems: [],
      deletedPresetFallbacks: {},
    }),
  ).rejects.toThrowError('custom_recurrence_fallback_required:preset-10');
});
```

- [ ] **Step 2: Auth-Runtime-Tests gezielt rot ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core/settings-shared.test.ts --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: FAIL wegen unbekannter Felder oder fehlender Loader

- [ ] **Step 3: Settings-Schema und Deps um Presets ergänzen**

```ts
const wasteCustomRecurrencePresetSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  intervalDays: z.number().int().positive(),
});

const updateWasteSettingsSchema = z.object({
  provider: z.literal('supabase'),
  projectUrl: z.string().trim(),
  schemaName: z.string().trim().optional(),
  enabled: z.boolean(),
  customRecurrencePresets: z.array(wasteCustomRecurrencePresetSchema).default([]),
  deletedPresetFallbacks: z.record(
    z.string().trim().min(1),
    z.object({
      kind: z.enum(['preset', 'default']),
      value: z.string().trim().min(1),
    }),
  ).default({}),
});
```

- [ ] **Step 4: Settings-Handler so umbauen, dass Interfaces-Felder geschützt bleiben, Presets aber speicherbar sind**

```ts
const current = await loadConfiguredWasteSettings(deps, instanceId);
if (
  parsed.data.projectUrl !== current?.projectUrl ||
  parsed.data.schemaName !== current?.schemaName ||
  parsed.data.enabled !== current?.enabled
) {
  return createApiError(409, 'invalid_request', 'Die Waste-Supabase wird ausschließlich über /interfaces verwaltet.', requestId);
}

await requireDeps(deps.saveWasteCustomRecurrencePresets, 'saveWasteCustomRecurrencePresets')(instanceId, {
  nextItems: parsed.data.customRecurrencePresets,
  deletedPresetFallbacks: parsed.data.deletedPresetFallbacks,
});
```

- [ ] **Step 5: Tour-Create/Update auf `customRecurrenceId` normalisieren und Tests grün ziehen**

```ts
await requireDeps(deps.saveWasteTour, 'saveWasteTour')(instanceId, {
  id: parsed.data.id,
  name: parsed.data.name.trim(),
  recurrence: parsed.data.customRecurrenceId ? undefined : parsed.data.recurrence ?? undefined,
  customRecurrenceId: parsed.data.customRecurrenceId,
  firstDate: parsed.data.firstDate,
  endDate: parsed.data.endDate,
  customDates: normalizeCustomTourDates(parsed.data.customDates),
  active: parsed.data.active,
  wasteFractionIds: parsed.data.wasteFractionIds.map((value) => value.trim()),
  description: normalizeOptionalString(parsed.data.description),
  locationCount: undefined,
});
```

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core/settings-shared.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: PASS

```bash
git add packages/auth-runtime/src/waste-management/core/types.ts \
  packages/auth-runtime/src/waste-management/core/schemas.ts \
  packages/auth-runtime/src/waste-management/core/settings.ts \
  packages/auth-runtime/src/waste-management/core/settings-shared.ts \
  packages/auth-runtime/src/waste-management/core/read-handlers.ts \
  packages/auth-runtime/src/waste-management/core/tours.ts \
  packages/auth-runtime/src/waste-management/server-loaders.ts \
  packages/auth-runtime/src/waste-management/core/settings.test.ts \
  packages/auth-runtime/src/waste-management/core/settings-shared.test.ts \
  packages/auth-runtime/src/waste-management/core/read-handlers.test.ts \
  packages/auth-runtime/src/waste-management/core.test.ts \
  packages/auth-runtime/src/waste-management/server-loaders.test.ts
git commit -m "feat: add waste custom recurrence handlers"
```

## Task 5: Settings-UI und Tour-Formular für Preset-Pflege und Preset-Auswahl umsetzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-form.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-section.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-dialog.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-delete-dialog.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-tour-fields.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.presentation.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.api.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours.presentation.test.ts`

- [ ] **Step 1: Failing Plugin-Tests für Settings-Preset-Liste und Tour-Select ergänzen**

```tsx
it('renders custom recurrence presets inside the settings tab and saves them through the host client', async () => {
  wasteManagementApiMocks.getWasteManagementSettings.mockResolvedValue({
    instanceId: 'tenant-a',
    provider: 'supabase',
    projectUrl: 'https://tenant-a.supabase.co',
    schemaName: 'wm',
    enabled: true,
    databaseUrlConfigured: true,
    serviceRoleKeyConfigured: true,
    visibleStatus: 'ok',
    customRecurrencePresets: [],
  });

  render(<WasteManagementPage />);
  expect(await screen.findByText('wasteManagement.settings.customRecurrences.title')).toBeTruthy();
});

it('maps selected custom recurrence to customRecurrenceId and clears recurrence', () => {
  const form = {
    ...createDefaultTourForm(),
    customRecurrenceId: 'preset-10',
    recurrence: '',
    firstDate: '2026-01-10',
  };

  expect(toCreateTourInput(form)).toMatchObject({
    customRecurrenceId: 'preset-10',
    recurrence: undefined,
  });
});
```

- [ ] **Step 2: Plugin-Tests gezielt rot ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx --testFiles=tests/waste-management.low-coverage-views.test.tsx --testFiles=tests/waste-management.tours.shared.test.ts --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.tours.presentation.test.ts --testFiles=tests/waste-management.api.test.ts`  
Expected: FAIL wegen fehlender Settings-UI, fehlender Form-Felder oder falscher Mapping-Semantik

- [ ] **Step 3: Settings-Tab um schreibbare Preset-Sektion und read-only Datasource-Hinweis erweitern**

```tsx
return (
  <div className="space-y-4">
    <StatusNotice message={message} />
    <WasteSettingsStatusPanel settings={settings} />
    <WasteSettingsForm
      form={form}
      saving={saving}
      onSubmit={onSubmit}
      onChange={setForm}
      datasourceReadOnly
    />
    <WasteSettingsCustomRecurrenceSection
      items={form.customRecurrencePresets}
      availableFallbacks={form.customRecurrencePresets}
      onChange={(customRecurrencePresets, deletedPresetFallbacks) =>
        setForm((current) => ({ ...current, customRecurrencePresets, deletedPresetFallbacks }))
      }
    />
  </div>
);
```

- [ ] **Step 4: Tour-Formular und Präsentation auf Preset-Auswahl umstellen**

```tsx
<optgroup label={pt('tours.recurrenceGroups.defaults')}>
  <option value="custom">{pt('tours.recurrence.custom')}</option>
  <option value="weekly">{pt('tours.recurrence.weekly')}</option>
  <option value="biweekly">{pt('tours.recurrence.biweekly')}</option>
  <option value="fourweekly">{pt('tours.recurrence.fourweekly')}</option>
  <option value="yearly">{pt('tours.recurrence.yearly')}</option>
  <option value="on-demand">{pt('tours.recurrence.onDemand')}</option>
</optgroup>
<optgroup label={pt('tours.recurrenceGroups.customPresets')}>
  {customRecurrencePresets.map((preset) => (
    <option key={preset.id} value={`preset:${preset.id}`}>{preset.name}</option>
  ))}
</optgroup>
```

- [ ] **Step 5: Plugin-Tests grün ausführen und committen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx --testFiles=tests/waste-management.low-coverage-views.test.tsx --testFiles=tests/waste-management.tours.shared.test.ts --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.tours.presentation.test.ts --testFiles=tests/waste-management.api.test.ts`  
Expected: PASS

```bash
git add packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts \
  packages/plugin-waste-management/src/waste-management.settings-panel.tsx \
  packages/plugin-waste-management/src/waste-management.settings-form.tsx \
  packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-section.tsx \
  packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-dialog.tsx \
  packages/plugin-waste-management/src/waste-management.settings-custom-recurrence-delete-dialog.tsx \
  packages/plugin-waste-management/src/waste-management.tours.shared.ts \
  packages/plugin-waste-management/src/waste-management.tours-tour-fields.tsx \
  packages/plugin-waste-management/src/waste-management.tours.presentation.ts \
  packages/plugin-waste-management/src/plugin.translations.de.settings.ts \
  packages/plugin-waste-management/src/plugin.translations.en.settings.ts \
  packages/plugin-waste-management/src/plugin.translations.de.tours.ts \
  packages/plugin-waste-management/src/plugin.translations.en.tours.ts \
  packages/plugin-waste-management/tests/waste-management.api.test.ts \
  packages/plugin-waste-management/tests/waste-management.page.test.tsx \
  packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx \
  packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts \
  packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.tours.presentation.test.ts
git commit -m "feat: add waste custom recurrence preset ui"
```

## Task 6: Öffentliche Kalenderberechnung, Jahreskalender und E2E auf Presets erweitern

**Files:**
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts`
- Modify: `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.test.ts`
- Modify: `apps/sva-studio-react/e2e/waste-management-plugin.spec.ts`

- [ ] **Step 1: Failing Read-/Calendar-Tests für Preset-Touren ergänzen**

```ts
it('derives occurrences from a custom recurrence preset interval plus custom dates', () => {
  const entries = calculatePublicWasteCalendarEntries({
    referenceDate: '2026-01-01',
    selection,
    linkedTours: [{
      linkId: 'link-1',
      locationId: 'location-1',
      tour: {
        id: 'tour-1',
        name: 'Rest Nord',
        recurrence: null,
        customRecurrenceIntervalDays: 10,
        firstDate: '2026-01-10',
        customDates: [{ date: '2026-01-25', description: 'Sonderleerung' }],
        fractions: [{ id: 'fraction-1', label: 'Restmüll' }],
      },
    }],
    tourDateShifts: [],
    globalDateShifts: [],
  });

  expect(entries.map((entry) => entry.date)).toContain('2026-01-20');
  expect(entries.map((entry) => entry.date)).toContain('2026-01-25');
});
```

- [ ] **Step 2: Öffentliche Tests gezielt rot ausführen**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/lib/public-waste-repository.server.test.ts src/lib/public-waste-calendar-occurrences.test.ts`  
Expected: FAIL wegen fehlender Preset-Auflösung in Repository oder Occurrence-Berechnung

- [ ] **Step 3: Public-Repository und Occurrence-Berechnung erweitern**

```ts
type PublicWasteLinkedTour = {
  // ...
  readonly tour: {
    readonly recurrence?: 'weekly' | 'biweekly' | 'fourweekly' | 'yearly' | 'on-demand' | 'custom' | null;
    readonly customRecurrenceId?: string;
    readonly customRecurrenceName?: string;
    readonly customRecurrenceIntervalDays?: number;
    readonly firstDate?: string;
    // ...
  };
};

if (tour.customRecurrenceIntervalDays && recurringStartDate) {
  const current = parseDateOnlyUtc(recurringStartDate);
  const end = parseDateOnlyUtc(recurringEndDate);
  while (current <= end) {
    const date = formatDateOnlyUtc(current);
    if (isDateWithinRange(date, windowStart, windowEnd)) {
      occurrences.set(date, occurrences.get(date) ?? null);
    }
    current.setUTCDate(current.getUTCDate() + tour.customRecurrenceIntervalDays);
  }
}
```

- [x] **Step 4: Waste-E2E um Preset-Anlage, Tour-Auswahl, Bearbeitung und Fallback-Löschung ergänzen**

```ts
await page.getByRole('tab', { name: /Einstellungen|settings/i }).click();
await page.getByRole('button', { name: /Eigenen Abstand anlegen|Add custom recurrence/i }).click();
await page.getByLabel(/Name/).fill('10 Tage');
await page.getByLabel(/Abstand in Tagen|Interval in days/i).fill('10');
await page.getByRole('button', { name: /Speichern|Save/i }).click();

await page.getByRole('tab', { name: /Touren|Tours/i }).click();
await page.getByRole('button', { name: /Neue Tour|New tour/i }).click();
await page.getByLabel(/Turnus|Recurrence/i).selectOption({ label: '10 Tage' });
await page.getByLabel(/Erster Termin|First date/i).fill('2026-01-10');
```

- [ ] **Step 5: Finalen Gate-Pfad ausführen und committen**

Run: `cd apps/public-waste-calendar-web && pnpm exec vitest run src/lib/public-waste-repository.server.test.ts src/lib/public-waste-calendar-occurrences.test.ts`  
Expected: PASS

Run: `pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/waste-management-plugin.spec.ts`  
Expected: PASS

```bash
git add apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-repository.server.test.ts \
  apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.test.ts \
  apps/sva-studio-react/e2e/waste-management-plugin.spec.ts
git commit -m "feat: resolve waste custom recurrences in calendars"
```

## Task 7: Abschließende Verifikation und Plan-/OpenSpec-Status auf Realität ziehen

**Files:**
- Modify: `openspec/changes/add-waste-custom-recurrence-presets/tasks.md`
- Modify: `docs/superpowers/plans/2026-05-31-waste-custom-recurrence-presets.md`

- [x] **Step 1: Kleinsten relevanten Unit-Gate-Pfad pro betroffenen Bereich ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core/settings-shared.test.ts --testFiles=src/waste-management/core/read-handlers.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: PASS

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx --testFiles=tests/waste-management.tours.shared.test.ts --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.tours.presentation.test.ts --testFiles=tests/waste-management.api.test.ts`  
Expected: PASS

- [x] **Step 2: Server-Runtime- und Typ-Gates nachziehen**

Run: `pnpm check:server-runtime`  
Expected: PASS ohne endungslose Runtime-Imports oder fehlende Workspace-Dependencies

Run: `pnpm nx affected --target=test:types --base=origin/main`  
Expected: PASS für die durch Core/Auth/Plugin/Public-Web betroffenen Projekte

- [x] **Step 3: E2E- und PR-relevanten Gate-Pfad ausführen**

Run: `pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/waste-management-plugin.spec.ts`  
Expected: PASS

Run: `pnpm nx affected --target=test:unit --base=origin/main`  
Expected: PASS

- [x] **Step 4: OpenSpec-Taskliste und Implementierungsplan auf Ist-Stand aktualisieren**

```md
- [x] 1.1 Proposal, Design und Delta angelegt
- [x] 2.1 Core-Verträge und Waste-Schema erweitert
- [x] 3.1 Repository und Tour-Reads mit Preset-Auflösung ergänzt
- [x] 4.1 Settings- und Tour-Handler erweitert
- [x] 5.1 Plugin-Settings und Tour-Formular ergänzt
- [x] 6.1 Öffentliche Kalenderberechnung und E2E ergänzt
- [x] 7.1 Verifikation abgeschlossen
```

- [ ] **Step 5: Abschluss-Commit erstellen**

```bash
git add openspec/changes/add-waste-custom-recurrence-presets/tasks.md \
  docs/superpowers/plans/2026-05-31-waste-custom-recurrence-presets.md
git commit -m "chore: finalize waste custom recurrence implementation plan status"
```
