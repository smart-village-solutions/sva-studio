# Waste Fraction Reminder JSONB Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die bisher flache Reminder-Konfiguration von Waste-Fraktionen auf das vorgegebene kanalbezogene JSON-Schema mit persistenter Slot-ID, Supabase-Migration und durchgängiger Verwendung in API, Repository, UI und Static Content umstellen.

**Architecture:** `waste_fractions.reminder_config` wird die fachlich führende Source of Truth. Der bestehende flache Spaltensatz bleibt als Migrationsquelle erhalten, wird in der runtime-nahen Waste-Schema-Migration deterministisch nach `reminder_config` backfilled und anschließend im Code nur noch kompatibel gelesen oder nicht mehr fachlich verwendet. Core-, Auth-, Repository- und Plugin-Verträge werden auf ein gemeinsames verschachteltes Reminder-Modell umgestellt, damit Static Content und spätere Geräte-Persistenz dieselben Slot-IDs sehen.

**Tech Stack:** TypeScript strict mode, Nx, Vitest, TanStack/React, runtime-nahe SQL-Migrationen in `apps/sva-studio-react`, Repository-Mapping in `packages/data-repositories`

---

### Task 1: Core- und Vertragsmodell auf Reminder-JSON umstellen

**Files:**
- Modify: `packages/core/src/waste-management/master-data-addresses.ts`
- Modify: `packages/core/src/waste-management/master-data-contract.ts`
- Modify: `packages/core/src/waste-management-static-content.ts`
- Modify: `packages/core/src/waste-management-static-content.test.ts`
- Modify: `packages/core/src/waste-management-location-tour-pickup-date-planner.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.master-data-inputs.fractions.ts`
- Modify: `packages/plugin-sdk/src/public-api.ts`
- Test: `packages/core/src/waste-management-static-content.test.ts`

- [ ] **Step 1: Write the failing core contract test expectation**

```ts
expect(JSON.parse(artifact.content)).toEqual({
  PPK: {
    reminders: {
      reminder_count: 'twice',
      channels: { push: true, email: false, calendar: true },
      push: {
        slots: [
          {
            id: 'fraction-paper:push:first',
            max_lead_days: 7,
            default_lead_days: 1,
          },
        ],
      },
    },
  },
});
```

- [ ] **Step 2: Run test to verify it fails against the old `WasteFractionRecord` shape**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-static-content.test.ts`  
Expected: FAIL because the old fraction contract and static-content builder still depend on `firstReminderMaxLeadDays`, `secondReminderMaxLeadDays`, and `reminderChannel*Enabled`.

- [ ] **Step 3: Introduce the shared reminder JSON types**

```ts
export type WasteReminderChannelKey = 'push' | 'email' | 'calendar';

export type WasteReminderSlotRecord = {
  readonly id: string;
  readonly maxLeadDays: number;
  readonly defaultLeadDays: number;
};

export type WasteReminderChannelRecord = {
  readonly slots: readonly WasteReminderSlotRecord[];
};

export type WasteFractionReminderConfig = {
  readonly reminderCount: WasteFractionReminderCount;
  readonly channels: Readonly<Record<WasteReminderChannelKey, boolean>>;
  readonly push?: WasteReminderChannelRecord;
  readonly email?: WasteReminderChannelRecord;
  readonly calendar?: WasteReminderChannelRecord;
};

export type WasteFractionRecord = {
  // ...
  readonly reminderConfig: WasteFractionReminderConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

- [ ] **Step 4: Update the static content builder to consume `reminderConfig` directly**

```ts
reminders: {
  reminder_count: fraction.reminderConfig.reminderCount,
  channels: fraction.reminderConfig.channels,
  ...(fraction.reminderConfig.push ? { push: toStaticChannel(fraction.reminderConfig.push) } : {}),
  ...(fraction.reminderConfig.email ? { email: toStaticChannel(fraction.reminderConfig.email) } : {}),
  ...(fraction.reminderConfig.calendar ? { calendar: toStaticChannel(fraction.reminderConfig.calendar) } : {}),
},
```

- [ ] **Step 5: Replace remaining flat reminder defaults in core helpers**

```ts
reminderConfig: {
  reminderCount: 'none',
  channels: { push: false, email: false, calendar: false },
},
```

- [ ] **Step 6: Run the focused core test to verify it passes**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-static-content.test.ts`  
Expected: PASS

- [ ] **Step 7: Run the relevant type gate for the changed packages**

Run: `pnpm nx affected --target=test:types --base=origin/main`  
Expected: PASS with `core`, `plugin-sdk`, `plugin-waste-management`, `auth-runtime`, `data-repositories`, `sva-studio-react` green.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/waste-management/master-data-addresses.ts \
  packages/core/src/waste-management/master-data-contract.ts \
  packages/core/src/waste-management-static-content.ts \
  packages/core/src/waste-management-static-content.test.ts \
  packages/core/src/waste-management-location-tour-pickup-date-planner.ts \
  packages/plugin-waste-management/src/waste-management.api.types.master-data-inputs.fractions.ts \
  packages/plugin-sdk/src/public-api.ts
git commit -m "feat: introduce waste reminder json contract"
```

### Task 2: Waste-Schema-Migration und Repository auf `reminder_config` umstellen

**Files:**
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.fractions.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`
- Modify: `docs/development/studio-db-schema.md`
- Modify: `docs/development/studio-db-schema-final.sql`
- Test: `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.test.ts`

- [ ] **Step 1: Extend the schema test with `reminder_config` and backfill expectations**

```ts
expect(statements).toContain(
  'ALTER TABLE "wm".waste_fractions ADD COLUMN IF NOT EXISTS reminder_config JSONB'
);
expect(statements.join('\n')).toContain('UPDATE "wm".waste_fractions');
expect(statements.join('\n')).toContain('fraction-paper:push:first');
```

- [ ] **Step 2: Run the schema test to verify it fails**

Run: `pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-operations.server.test.ts`  
Expected: FAIL because `applySchemaStatements()` still creates only the flat reminder columns.

- [ ] **Step 3: Add `reminder_config` and a deterministic SQL backfill**

```ts
`ALTER TABLE ${schema}.waste_fractions ADD COLUMN IF NOT EXISTS reminder_config JSONB;`,
`UPDATE ${schema}.waste_fractions
 SET reminder_config = jsonb_build_object(
   'reminderCount', reminder_count,
   'channels', jsonb_build_object(
     'push', reminder_channel_push_enabled,
     'email', reminder_channel_email_enabled,
     'calendar', reminder_channel_calendar_enabled
   ),
   'push', CASE WHEN reminder_channel_push_enabled THEN ... END,
   'email', CASE WHEN reminder_channel_email_enabled THEN ... END,
   'calendar', CASE WHEN reminder_channel_calendar_enabled THEN ... END
 )
 WHERE reminder_config IS NULL;`,
`ALTER TABLE ${schema}.waste_fractions ALTER COLUMN reminder_config SET NOT NULL;`,
```

- [ ] **Step 4: Switch repository read/write mapping to JSONB**

```ts
type WasteFractionRow = {
  readonly reminder_config: unknown;
};

const mapWasteFractionRow = (row: WasteFractionRow): WasteFractionRecord => ({
  // ...
  reminderConfig: parseWasteReminderConfig(row.reminder_config),
});

VALUES (..., $9::jsonb)
SET reminder_config = EXCLUDED.reminder_config
```

- [ ] **Step 5: Preserve backward-safe schema documentation**

```md
- `waste_fractions.reminder_config` ist die fachlich führende Reminder-Persistenz im externen Waste-Schema.
- Die Altspalten `reminder_count`, `first_reminder_max_lead_days`, `second_reminder_max_lead_days`, `reminder_channel_*` bleiben als Migrationsquelle dokumentiert.
```

- [ ] **Step 6: Run the repository unit test**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

- [ ] **Step 7: Re-run the waste schema server test**

Run: `pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-operations.server.test.ts`  
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/sva-studio-react/src/lib/waste-management-operations.schema.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts \
  packages/data-repositories/src/waste-management/master-data.fractions.ts \
  packages/data-repositories/src/waste-management/master-data.test.ts \
  docs/development/studio-db-schema.md \
  docs/development/studio-db-schema-final.sql
git commit -m "feat: persist waste reminder config as jsonb"
```

### Task 3: Host-Fassade und Auth-Runtime auf kanalbezogene Slots umstellen

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/fractions-support.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/fractions.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts` or the file exporting `wasteManagementMasterDataSchemas`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.import.ts`
- Modify: `apps/sva-studio-react/src/lib/waste-management-operations.seed.ts`
- Test: `packages/auth-runtime/src/waste-management/core.test.ts`

- [ ] **Step 1: Add failing auth-runtime cases for slot normalization**

```ts
expect(normalizeWasteFractionReminderConfig({
  reminderCount: 'once',
  reminderConfig: {
    channels: { push: true, email: false, calendar: false },
    push: {
      slots: [
        { id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 },
        { id: 'fraction-1:push:second', maxLeadDays: 3, defaultLeadDays: 1 },
      ],
    },
  },
})).toEqual({
  reminderCount: 'once',
  channels: { push: true, email: false, calendar: false },
  push: {
    slots: [{ id: 'fraction-1:push:first', maxLeadDays: 7, defaultLeadDays: 1 }],
  },
});
```

- [ ] **Step 2: Run the auth-runtime reminder tests to verify failure**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts`  
Expected: FAIL because validation and normalization still operate on flat fields.

- [ ] **Step 3: Replace flat schemas with nested reminder schemas**

```ts
const wasteReminderSlotSchema = z.object({
  id: z.string().min(1),
  maxLeadDays: wasteFractionReminderLeadDaySchema,
  defaultLeadDays: wasteFractionReminderLeadDaySchema,
});

const wasteReminderConfigSchema = z.object({
  reminderCount: z.enum(['none', 'once', 'twice']),
  channels: z.object({
    push: z.boolean(),
    email: z.boolean(),
    calendar: z.boolean(),
  }),
  push: z.object({ slots: z.array(wasteReminderSlotSchema).max(2) }).optional(),
  email: z.object({ slots: z.array(wasteReminderSlotSchema).max(2) }).optional(),
  calendar: z.object({ slots: z.array(wasteReminderSlotSchema).max(2) }).optional(),
});
```

- [ ] **Step 4: Normalize channel blocks and seed/import defaults**

```ts
if (input.reminderConfig.reminderCount === 'none') {
  return {
    reminderCount: 'none',
    channels: { push: false, email: false, calendar: false },
  };
}
```

- [ ] **Step 5: Run the auth-runtime test to verify it passes**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/auth-runtime/src/waste-management/core/fractions-support.ts \
  packages/auth-runtime/src/waste-management/core/fractions.ts \
  packages/auth-runtime/src/waste-management/core.test.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.import.ts \
  apps/sva-studio-react/src/lib/waste-management-operations.seed.ts
git commit -m "feat: normalize nested waste reminder config"
```

### Task 4: Plugin-Formular, Mappers und Submission-Flows auf Slot-UI umstellen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.forms.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data-fraction-reminder-section.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.helpers.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.master-data-fraction-create-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.helpers.test.tsx`

- [ ] **Step 1: Add failing UI expectations for channel slot groups**

```tsx
expect(
  screen.getByLabelText('masterData.fractions.fields.reminderPushSlot1MaxLeadDays')
).toBeTruthy();
expect(
  screen.queryByLabelText('masterData.fractions.fields.reminderEmailSlot1MaxLeadDays')
).toBeNull();
```

- [ ] **Step 2: Run the focused plugin reminder UI test**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data-fraction-create-content.test.tsx --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts`  
Expected: FAIL because the form still renders first/second global lead-day fields instead of channel slot groups.

- [ ] **Step 3: Refactor form state to nested reminder config**

```ts
export type FractionFormState = {
  // ...
  readonly reminderConfig: WasteFractionReminderConfig;
};

const toCreateFractionInput = (form: FractionFormState): CreateWasteManagementFractionInput => ({
  // ...
  reminderConfig: normalizeReminderConfigForSubmit(form.reminderConfig),
});
```

- [ ] **Step 4: Render channel-specific slot editors**

```tsx
{form.reminderConfig.channels.push ? (
  <FractionReminderChannelSlots
    channel="push"
    slots={form.reminderConfig.push?.slots ?? []}
    reminderCount={form.reminderConfig.reminderCount}
    onChange={(slots) => onReminderChannelSlotsChange('push', slots)}
  />
) : null}
```

- [ ] **Step 5: Run the focused plugin tests to verify they pass**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data-fraction-create-content.test.tsx --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts --testFiles=tests/waste-management.helpers.test.tsx`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/plugin-waste-management/src/waste-management.master-data.forms.ts \
  packages/plugin-waste-management/src/waste-management.master-data-fraction-reminder-section.tsx \
  packages/plugin-waste-management/src/waste-management.master-data.fraction-region-submissions.helpers.ts \
  packages/plugin-waste-management/src/plugin.translations.de.masterData.fractions.ts \
  packages/plugin-waste-management/src/plugin.translations.en.masterData.fractions.ts \
  packages/plugin-waste-management/tests/waste-management.master-data-fraction-create-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.master-data.fraction-submissions.test.ts \
  packages/plugin-waste-management/tests/waste-management.helpers.test.tsx
git commit -m "feat: edit waste reminder channels and slots in plugin ui"
```

### Task 5: End-to-end verification, doc sync and checklist completion

**Files:**
- Modify: `openspec/changes/add-waste-fraction-reminder-settings/tasks.md`
- Modify: `docs/development/studio-db-schema.md`
- Modify: `docs/development/studio-db-schema-final.sql`

- [ ] **Step 1: Run the smallest real verification set for this change**

Run:
```bash
pnpm nx run core:test:unit --testFiles=src/waste-management-static-content.test.ts
pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.master-data-fraction-create-content.test.tsx --testFiles=tests/waste-management.master-data.fraction-submissions.test.ts --testFiles=tests/waste-management.helpers.test.tsx
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-operations.server.test.ts
pnpm nx affected --target=test:types --base=origin/main
```
Expected: all commands PASS

- [ ] **Step 2: Run the stricter runtime gate for the touched server packages**

Run: `pnpm check:server-runtime`  
Expected: PASS

- [ ] **Step 3: Mark the OpenSpec checklist complete**

```md
- [x] 2.1 Core-/SDK-Typen und API-Inputs auf das verschachtelte Reminder-JSON-Schema umstellen
- [x] 2.2 Waste-Schema um die fachlich führende JSONB-Spalte `reminder_config` an `waste_fractions` erweitern
- [x] 2.3 Backfill und Migrationspfad von den flachen Reminder-Spalten in `reminder_config` implementieren
```

- [ ] **Step 4: Review final diff before handoff**

Run: `git diff --stat HEAD~5..HEAD`  
Expected: changed files limited to the waste reminder contract, migration, tests, and docs named in this plan.

- [ ] **Step 5: Commit**

```bash
git add openspec/changes/add-waste-fraction-reminder-settings/tasks.md \
  docs/development/studio-db-schema.md \
  docs/development/studio-db-schema-final.sql
git commit -m "docs: finalize waste reminder jsonb migration rollout"
```
