# Waste Holiday Rule Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Waste-Management-Plugin soll ein Bundesland pro Instanz speichern, beim Speichern synchron Feiertage für die nächsten 10 Jahre von `feiertage-api.de` laden und diese als persistierte Feiertags-Regelentwürfe mit eigener Pflegeoberfläche im Scheduling-Bereich verwalten.

**Architecture:** Die Umsetzung ergänzt den bestehenden Waste-Settings-Vertrag um ein Bundeslandkürzel und führt ein separates persistiertes Modell für Feiertags-Regelentwürfe ein. Der Server lädt synchron Feiertagsdaten für einen 10-Jahres-Horizont, normalisiert sie in einen append-only Bestand mit Konflikt- und Quellstatus und hält manuelle globale Date-Shifts strikt getrennt; das Plugin zeigt Sync-Status und Regelpflege in Settings plus Scheduling.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, Vitest über Nx, auth-runtime Waste-Handler, data-repositories, OpenSpec, externer JSON-Webservice `feiertage-api.de`

---

## File Structure

### OpenSpec und Governance

- Create: `openspec/changes/add-waste-holiday-rule-import/proposal.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/tasks.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/design.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/specs/waste-management/spec.md`

### Core-Verträge und neue Feiertags-Typen

- Modify: `packages/core/src/waste-management-contract.ts`
- Modify: `packages/core/src/waste-management/master-data-contract.ts`
- Modify: `packages/core/src/waste-management/master-data-scheduling.ts`
- Modify: `packages/core/src/waste-management-master-data.ts`
- Modify: `packages/core/src/waste-management-master-data.test.ts`

### Persistenz und Repository

- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Create: `packages/data-repositories/src/waste-management/master-data.holiday-rules.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.date-shifts.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.test.ts`

### Auth-Runtime und Feiertags-Connector

- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Create: `packages/auth-runtime/src/waste-management/core/holiday-rules.ts`
- Create: `packages/auth-runtime/src/waste-management/core/holiday-sync.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.test.ts`

### Plugin-UI und API-Typen

- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-models.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-form.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-status-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.submissions.ts`
- Create: `packages/plugin-waste-management/src/waste-management.holiday-rules-list.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.holiday-rules-form.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`

### Plugin-Tests

- Modify: `packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.scheduling.submissions.test.ts`

## Task 1: OpenSpec-Change und Settings-Governance festziehen

**Files:**
- Create: `openspec/changes/add-waste-holiday-rule-import/proposal.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/tasks.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/design.md`
- Create: `openspec/changes/add-waste-holiday-rule-import/specs/waste-management/spec.md`
- Reference: `docs/superpowers/specs/2026-05-27-waste-holiday-rule-import-design.md`
- Reference: `openspec/specs/waste-management/spec.md`

- [x] **Step 1: Failing OpenSpec-Delta für Bundesland, Sync und Feiertagsentwürfe schreiben**

```md
## ADDED Requirements
### Requirement: Waste-Management speichert ein Bundesland für Feiertagsregeln
Das System SHALL in den Waste-Einstellungen ein gültiges Bundeslandkürzel für die Feiertagsintegration speichern.

#### Scenario: Benutzer speichert Bundesland
- **WHEN** ein berechtigter Benutzer ein gültiges Bundeslandkürzel speichert
- **THEN** persistiert das System das Kürzel für die aktive Instanz

### Requirement: Waste-Management synchronisiert Feiertagsentwürfe synchron über 10 Jahre
Das System SHALL beim Settings-Speichern sowie per manueller Regeneration Feiertage für das aktuelle Jahr bis einschließlich `aktuelles Jahr + 9` laden und als Feiertags-Regelentwürfe persistieren.

#### Scenario: Sync meldet Status zurück
- **WHEN** der Feiertagssync nach dem Settings-Speichern abgeschlossen ist
- **THEN** enthält die Antwort `success`, `partial_success` oder `failed`

### Requirement: Manuelle globale Regeln bleiben unangetastet
Das System SHALL manuelle globale Date-Shifts nie durch automatisch importierte Feiertagsentwürfe überschreiben.

#### Scenario: Konflikt mit manueller globaler Regel
- **WHEN** ein importierter Feiertag denselben Wirkzeitraum wie eine manuelle globale Regel berührt
- **THEN** markiert das System den Feiertagsentwurf als Konflikt
- **AND** verändert die manuelle globale Regel nicht
```

- [x] **Step 2: Proposal und Task-Liste mit Governance-Hinweis anlegen**

```md
# Change: Feiertagsbasierte Regelentwürfe im Waste Management

## Why
Das Waste-Management benötigt einen nachvollziehbaren, bundeslandspezifischen Feiertagsbestand als Grundlage späterer globaler Verschiebungsregeln.

## What Changes
- neues Bundeslandfeld in Waste-Settings
- synchroner 10-Jahres-Sync gegen `feiertage-api.de`
- neuer persistierter Bestand für Feiertags-Regelentwürfe
- Scheduling-UI zur Pflege von Geltungsbereich und Strategie

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, `packages/auth-runtime`, `packages/core`, `packages/data-repositories`
- Affected arc42 sections: keine Pflichtänderung, solange bestehende Settings/Host-Fassade architektonisch unverändert bleiben
```

- [x] **Step 3: OpenSpec validieren**

Run: `openspec validate add-waste-holiday-rule-import --strict`  
Expected: PASS ohne Delta- oder Scenario-Fehler

- [ ] **Step 4: OpenSpec-Dateien committen**

```bash
git add openspec/changes/add-waste-holiday-rule-import
git commit -m "spec: add waste holiday rule import proposal"
```

## Task 2: Core-Verträge für Bundesland, Sync-Status und Feiertags-Regelentwürfe ergänzen

**Files:**
- Modify: `packages/core/src/waste-management-contract.ts`
- Modify: `packages/core/src/waste-management/master-data-contract.ts`
- Modify: `packages/core/src/waste-management/master-data-scheduling.ts`
- Modify: `packages/core/src/waste-management-master-data.ts`
- Test: `packages/core/src/waste-management-master-data.test.ts`

- [x] **Step 1: Failing Core-Tests für neue Typen ergänzen**

```ts
it('exposes supported waste holiday rule scopes and strategies', () => {
  expect(wasteManagementMasterDataContract.holidayRuleScopes).toEqual(['holiday-only', 'full-week']);
  expect(wasteManagementMasterDataContract.holidayRuleStrategies).toEqual(['advance', 'postpone']);
});

it('models waste settings with holiday state code and sync result', () => {
  const record: WasteManagementSettingsRecord = {
    instanceId: 'instance-1',
    provider: 'supabase',
    projectUrl: 'https://example.supabase.co',
    schemaName: 'public',
    enabled: true,
    databaseUrlConfigured: true,
    serviceRoleKeyConfigured: true,
    visibleStatus: 'ok',
    holidayStateCode: 'NW',
    lastHolidaySyncStatus: 'success',
  };

  expect(record.holidayStateCode).toBe('NW');
});
```

- [x] **Step 2: Core-Tests ausführen**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-master-data.test.ts`  
Expected: FAIL wegen fehlender `holidayStateCode`, Sync-Status oder Vertragskonstanten

- [x] **Step 3: Minimale Vertrags- und Typ-Erweiterung implementieren**

```ts
const wasteHolidayStateCodes = ['BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH'] as const;
const wasteHolidayRuleScopes = ['holiday-only', 'full-week'] as const;
const wasteHolidayRuleStrategies = ['advance', 'postpone'] as const;
const wasteHolidaySyncStatuses = ['success', 'partial_success', 'failed'] as const;

export type WasteHolidayRuleRecord = {
  readonly id: string;
  readonly holidayDate: string;
  readonly holidayName: string;
  readonly year: number;
  readonly stateCode: WasteHolidayStateCode;
  readonly sourceStatus: 'confirmed' | 'not-confirmed';
  readonly configurationStatus: 'draft' | 'configured';
  readonly conflictStatus: 'none' | 'manual-global-rule';
  readonly scope?: WasteHolidayRuleScope;
  readonly strategy?: WasteHolidayRuleStrategy;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-master-data.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/core/src/waste-management-contract.ts \
  packages/core/src/waste-management/master-data-contract.ts \
  packages/core/src/waste-management/master-data-scheduling.ts \
  packages/core/src/waste-management-master-data.ts \
  packages/core/src/waste-management-master-data.test.ts
git commit -m "feat: add waste holiday rule core contracts"
```

## Task 3: Repository und Persistenz für Feiertags-Regelentwürfe aufbauen

**Files:**
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Create: `packages/data-repositories/src/waste-management/master-data.holiday-rules.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.date-shifts.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`
- Test: `packages/data-repositories/src/waste-management/master-data.test.ts`

- [x] **Step 1: Failing Repository-Tests für Holiday-Rules ergänzen**

```ts
it('exposes holiday rule repository methods', () => {
  expect(wasteMasterDataRepositoryContract).toHaveProperty('listWasteHolidayRules');
  expect(wasteMasterDataRepositoryContract).toHaveProperty('upsertWasteHolidayRule');
});

it('lists and upserts holiday rule records', async () => {
  await repository.upsertWasteHolidayRule({
    id: 'holiday-rule-1',
    holidayDate: '2026-01-01',
    holidayName: 'Neujahr',
    year: 2026,
    stateCode: 'NW',
    sourceStatus: 'confirmed',
    configurationStatus: 'draft',
    conflictStatus: 'none',
  });

  const items = await repository.listWasteHolidayRules({ stateCode: 'NW', year: 2026 });
  expect(items).toHaveLength(1);
});
```

- [x] **Step 2: Repository-Tests ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: FAIL wegen fehlender Holiday-Rule-Methoden und SQL-Bausteine

- [x] **Step 3: Minimalen Holiday-Rule-Repository-Part implementieren**

```ts
export const wasteHolidayRuleStatements = {
  listWasteHolidayRules: buildHolidayRuleListStatement,
  upsertWasteHolidayRule: buildHolidayRuleUpsertStatement,
};

export const createWasteHolidayRuleRepositoryPart = (
  executor: SqlExecutor,
): Pick<WasteMasterDataRepository, 'listWasteHolidayRules' | 'upsertWasteHolidayRule'> => ({
  async listWasteHolidayRules(filter) {
    const result = await executor.execute<WasteHolidayRuleRow>(buildHolidayRuleListStatement(filter));
    return result.rows.map(mapWasteHolidayRuleRow);
  },
  async upsertWasteHolidayRule(input) {
    await executor.execute(buildHolidayRuleUpsertStatement(input));
  },
});
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/data-repositories/src/waste-management/master-data.contract.ts \
  packages/data-repositories/src/waste-management/master-data.holiday-rules.ts \
  packages/data-repositories/src/waste-management/master-data.date-shifts.ts \
  packages/data-repositories/src/waste-management/master-data.ts \
  packages/data-repositories/src/waste-management/master-data.contract.test.ts \
  packages/data-repositories/src/waste-management/master-data.test.ts
git commit -m "feat: add waste holiday rule repository"
```

## Task 4: Settings-Vertrag und Sync-Antwort im Plugin vorbereiten

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-models.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-form.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.settings-status-panel.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.settings.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.settings.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`

- [x] **Step 1: Failing Plugin-Tests für Bundesland und Sync-Status ergänzen**

```ts
it('renders the holiday state code field and submits it', async () => {
  render(<WasteSettingsForm form={form} saving={false} onSubmit={vi.fn()} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('settings.fields.holidayStateCode'), {
    target: { value: 'NW' },
  });
  expect(onChange).toHaveBeenCalled();
});

it('shows save success with holiday sync status', async () => {
  expect(await persistWasteSettings(form, pt)).toMatchObject({
    message: { kind: 'success', text: 'settings.messages.saveSuccessWithHolidaySync' },
  });
});
```

- [x] **Step 2: Plugin-Tests ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.low-coverage-views.test.tsx --testFiles=tests/waste-management.page.test.tsx`  
Expected: FAIL wegen fehlendem Feld oder falschem Response-Modell

- [x] **Step 3: Minimale Settings-Typen und Formularerweiterung implementieren**

```ts
type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
  readonly holidayStateCode: WasteHolidayStateCode | '';
};

export type WasteManagementSettingsInput = Readonly<{
  provider: 'supabase';
  projectUrl: string;
  schemaName?: string;
  enabled: boolean;
  databaseUrl?: string;
  serviceRoleKey?: string;
  holidayStateCode?: WasteHolidayStateCode;
}>;
```

```tsx
<StudioField id="waste-settings-holiday-state-code" label={pt('settings.fields.holidayStateCode')}>
  <Select
    id="waste-settings-holiday-state-code"
    value={form.holidayStateCode}
    onChange={(event) => onChange((current) => ({ ...current, holidayStateCode: event.target.value as WasteHolidayStateCode }))}
  >
    <option value="">{pt('settings.fields.holidayStateCodePlaceholder')}</option>
    <option value="NW">Nordrhein-Westfalen (NW)</option>
    <option value="BY">Bayern (BY)</option>
  </Select>
</StudioField>
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.low-coverage-views.test.tsx --testFiles=tests/waste-management.page.test.tsx`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts \
  packages/plugin-waste-management/src/waste-management.api.types.operations-models.ts \
  packages/plugin-waste-management/src/waste-management.api.operations.ts \
  packages/plugin-waste-management/src/waste-management.settings-form.tsx \
  packages/plugin-waste-management/src/waste-management.settings-panel.tsx \
  packages/plugin-waste-management/src/waste-management.settings-status-panel.tsx \
  packages/plugin-waste-management/src/plugin.translations.de.settings.ts \
  packages/plugin-waste-management/src/plugin.translations.en.settings.ts \
  packages/plugin-waste-management/tests/waste-management.low-coverage-views.test.tsx \
  packages/plugin-waste-management/tests/waste-management.page.test.tsx
git commit -m "feat: add waste holiday settings form contract"
```

## Task 5: Feiertags-Connector und synchronen Settings-Sync im Auth-Runtime einbauen

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings-shared.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/settings.ts`
- Create: `packages/auth-runtime/src/waste-management/core/holiday-sync.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Test: `packages/auth-runtime/src/waste-management/core/settings.test.ts`
- Test: `packages/auth-runtime/src/waste-management/core.test.ts`
- Test: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`

- [x] **Step 1: Failing Auth-Runtime-Tests für synchronen 10-Jahres-Sync ergänzen**

```ts
it('persists holiday state code and returns success sync result when all years load', async () => {
  const response = await updateWasteManagementSettingsInternal(
    new Request('https://studio.test/api/v1/waste-management/settings', {
      method: 'PUT',
      body: JSON.stringify({ holidayStateCode: 'NW' }),
    }),
    ctx,
    deps,
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    data: {
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'success',
    },
  });
});

it('returns partial_success when one year fetch fails', async () => {
  expect(payload.data.lastHolidaySyncStatus).toBe('partial_success');
});
```

- [x] **Step 2: Auth-Runtime-Tests ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: FAIL, weil Settings aktuell noch `managed_via_interfaces` mit `409` zurückgeben

- [x] **Step 3: Minimalen Sync-Connector und Settings-Handler implementieren**

```ts
export const syncWasteHolidayRules = async ({
  stateCode,
  now,
  fetch,
}: {
  readonly stateCode: WasteHolidayStateCode;
  readonly now: Date;
  readonly fetch: typeof globalThis.fetch;
}): Promise<WasteHolidaySyncResult> => {
  const startYear = now.getUTCFullYear();
  const years = Array.from({ length: 10 }, (_, index) => startYear + index);
  const results = await Promise.allSettled(
    years.map(async (year) => fetch(`https://feiertage-api.de/api/?jahr=${year}&nur_land=${stateCode}`)),
  );
  return summarizeHolidayYearResults(results);
};
```

```ts
const settings = await saveWasteSettings(instanceId, {
  ...parsed.data,
  holidayStateCode: parsed.data.holidayStateCode,
});
const sync = await syncWasteHolidayRules({ stateCode: parsed.data.holidayStateCode, now: new Date(), fetch: deps.fetch ?? fetch });
return new Response(JSON.stringify(asApiItem({ ...settings, lastHolidaySyncStatus: sync.status }, requestId)), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/auth-runtime/src/waste-management/core/types.ts \
  packages/auth-runtime/src/waste-management/core/settings-shared.ts \
  packages/auth-runtime/src/waste-management/core/settings.ts \
  packages/auth-runtime/src/waste-management/core/holiday-sync.ts \
  packages/auth-runtime/src/waste-management/server-loaders.ts \
  packages/auth-runtime/src/waste-management/server.ts \
  packages/auth-runtime/src/waste-management/core/settings.test.ts \
  packages/auth-runtime/src/waste-management/core.test.ts \
  packages/auth-runtime/src/waste-management/server-loaders.test.ts
git commit -m "feat: add waste holiday settings sync"
```

## Task 6: Feiertags-Regelentwürfe persistieren, Konflikte markieren und manuelle Regeneration ergänzen

**Files:**
- Create: `packages/auth-runtime/src/waste-management/core/holiday-rules.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/operations.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Test: `packages/auth-runtime/src/waste-management/core/operations.test.ts`
- Test: `packages/auth-runtime/src/waste-management/core.test.ts`

- [x] **Step 1: Failing Tests für append-only, Konflikte und manuellen Sync ergänzen**

```ts
it('marks missing holidays as not-confirmed instead of deleting them', async () => {
  await synchronizeHolidayRules(...);
  expect(savedRule.sourceStatus).toBe('not-confirmed');
});

it('does not overwrite manual global rules and marks conflicting holiday rules', async () => {
  expect(savedRule.conflictStatus).toBe('manual-global-rule');
});

it('runs manual holiday resync through a dedicated operation', async () => {
  expect(response.status).toBe(200);
});
```

- [x] **Step 2: Gezielte Runtime-Tests ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts --testFiles=src/waste-management/core.test.ts`  
Expected: FAIL wegen fehlender Holiday-Rule-Synchronisierung und fehlendem manuellen Sync-Pfad

- [x] **Step 3: Minimalen Persistenz- und Konfliktpfad implementieren**

```ts
export const reconcileWasteHolidayRules = async ({
  importedRules,
  existingRules,
  manualGlobalDateShifts,
}: ReconcileWasteHolidayRulesInput): Promise<readonly WasteHolidayRuleRecord[]> => {
  const existingByKey = new Map(existingRules.map((rule) => [createHolidayRuleKey(rule), rule] as const));
  const nextRules = importedRules.map((rule) => ({
    ...existingByKey.get(createHolidayRuleKey(rule)),
    ...rule,
    sourceStatus: 'confirmed',
    conflictStatus: hasManualGlobalShiftConflict(rule, manualGlobalDateShifts) ? 'manual-global-rule' : 'none',
  }));
  return markMissingRulesNotConfirmed(existingRules, nextRules);
};
```

```ts
if (request.url.endsWith('/settings/holiday-sync')) {
  return runWasteHolidaySyncInternal(request, ctx, deps);
}
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/operations.test.ts --testFiles=src/waste-management/core.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/auth-runtime/src/waste-management/core/holiday-rules.ts \
  packages/auth-runtime/src/waste-management/core/operations.ts \
  packages/auth-runtime/src/waste-management/server-loaders.ts \
  packages/auth-runtime/src/waste-management/server.ts \
  packages/auth-runtime/src/waste-management/core/operations.test.ts \
  packages/auth-runtime/src/waste-management/core.test.ts
git commit -m "feat: add waste holiday rule reconciliation"
```

## Task 7: Scheduling-UI für Feiertagsliste, Pflege und manuellen Sync ergänzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.scheduling.submissions.ts`
- Create: `packages/plugin-waste-management/src/waste-management.holiday-rules-list.tsx`
- Create: `packages/plugin-waste-management/src/waste-management.holiday-rules-form.tsx`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.scheduling.submissions.test.ts`

- [x] **Step 1: Failing Scheduling-Tests für Feiertagsliste und Pflege ergänzen**

```ts
it('renders holiday rules grouped by year and exposes scope/strategy controls', () => {
  render(
    <WasteSchedulingContent
      holidayRules={[
        {
          id: 'holiday-rule-1',
          holidayDate: '2026-01-01',
          holidayName: 'Neujahr',
          year: 2026,
          stateCode: 'NW',
          sourceStatus: 'confirmed',
          configurationStatus: 'draft',
          conflictStatus: 'none',
        },
      ]}
      // ...
    />,
  );

  expect(screen.getByText('Neujahr')).toBeInTheDocument();
  expect(screen.getByText('2026')).toBeInTheDocument();
});

it('triggers manual holiday resync from scheduling area', async () => {
  await result.current.onRunHolidaySync();
  expect(startWasteHolidaySync).toHaveBeenCalled();
});
```

- [x] **Step 2: Scheduling-Tests ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.scheduling-content.test.tsx --testFiles=tests/waste-management.scheduling-panel.test.tsx --testFiles=tests/waste-management.scheduling.submissions.test.ts`  
Expected: FAIL wegen fehlender Holiday-Rule-UI und fehlender Resync-Aktion

- [x] **Step 3: Minimale Holiday-Rule-UI und Submission-Pfade implementieren**

```tsx
<section className="space-y-4">
  <header className="space-y-1">
    <h3>{pt('scheduling.holidayRules.title')}</h3>
    <p>{pt('scheduling.holidayRules.description')}</p>
  </header>
  <WasteHolidayRulesList
    rules={holidayRules}
    onSaveRule={onSaveHolidayRule}
    onRunSync={onRunHolidaySync}
  />
</section>
```

```ts
onRunHolidaySync: async () => {
  state.setSaving(true);
  try {
    await startWasteManagementHolidaySync();
    await loadOverview(true);
    state.setMessage({ kind: 'success', text: pt('scheduling.holidayRules.syncSuccess') });
  } finally {
    state.setSaving(false);
  }
};
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.scheduling-content.test.tsx --testFiles=tests/waste-management.scheduling-panel.test.tsx --testFiles=tests/waste-management.scheduling.submissions.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/plugin-waste-management/src/waste-management.api.types.operations-overview.ts \
  packages/plugin-waste-management/src/waste-management.scheduling.shared.ts \
  packages/plugin-waste-management/src/waste-management.scheduling.content.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling-panel.tsx \
  packages/plugin-waste-management/src/waste-management.scheduling.submissions.ts \
  packages/plugin-waste-management/src/waste-management.holiday-rules-list.tsx \
  packages/plugin-waste-management/src/waste-management.holiday-rules-form.tsx \
  packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts \
  packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts \
  packages/plugin-waste-management/tests/waste-management.scheduling-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.scheduling-panel.test.tsx \
  packages/plugin-waste-management/tests/waste-management.scheduling.submissions.test.ts
git commit -m "feat: add waste holiday rule scheduling ui"
```

## Task 8: Vollständige Verifikation und OpenSpec-Abschluss

**Files:**
- Modify: `openspec/changes/add-waste-holiday-rule-import/tasks.md`
- Verify: `docs/superpowers/specs/2026-05-27-waste-holiday-rule-import-design.md`
- Verify: `openspec/changes/add-waste-holiday-rule-import/specs/waste-management/spec.md`

- [x] **Step 1: Fokussierte Testmatrix vollständig ausführen**

Run: `pnpm nx run core:test:unit --testFiles=src/waste-management-master-data.test.ts`  
Expected: PASS

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts --testFiles=src/waste-management/master-data.test.ts`  
Expected: PASS

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/settings.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server-loaders.test.ts --testFiles=src/waste-management/core/operations.test.ts`  
Expected: PASS

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.low-coverage-views.test.tsx --testFiles=tests/waste-management.page.test.tsx --testFiles=tests/waste-management.scheduling-content.test.tsx --testFiles=tests/waste-management.scheduling-panel.test.tsx --testFiles=tests/waste-management.scheduling.submissions.test.ts`  
Expected: PASS

- [x] **Step 2: Typ-, Lint- und Server-Runtime-Gates nachziehen**

Run: `pnpm check:server-runtime`  
Expected: PASS

Run: `pnpm test:types`  
Expected: PASS

Run: `pnpm test:eslint`  
Expected: PASS

### If runtime allows before push

Run: `pnpm test:pr`  
Expected: PASS oder dokumentierter Abbruchgrund

- [x] **Step 3: OpenSpec-Tasks abhaken und validieren**

```md
## 1. Implementation
- [x] 1.1 Bundesland-Setting und synchronen Sync-Vertrag ergänzen
- [x] 1.2 Feiertags-Regelentwürfe persistieren
- [x] 1.3 Konflikt- und Append-only-Regeln umsetzen
- [x] 1.4 Scheduling-UI und manuelle Regeneration ergänzen
- [x] 1.5 Tests und Validierung abschließen
```

Run: `openspec validate add-waste-holiday-rule-import --strict`  
Expected: PASS

- [ ] **Step 4: Abschlusscommit erstellen**

```bash
git add packages/core packages/data-repositories packages/auth-runtime packages/plugin-waste-management openspec/changes/add-waste-holiday-rule-import
git commit -m "feat: add waste holiday rule import"
```

## Self-Review Checklist

- Spec coverage: Bundesland-Setting, synchroner 10-Jahres-Sync, manueller Resync, append-only-Import, Konfliktmarkierung, Scheduling-UI und Testmatrix sind jeweils einem Task zugeordnet.
- Placeholder scan: Keine `TODO`-, `TBD`- oder unbestimmten Implementierungsschritte stehen geblieben.
- Type consistency: Durchgängig dieselben Feldnamen `holidayStateCode`, `lastHolidaySyncStatus`, `sourceStatus`, `configurationStatus`, `conflictStatus`, `scope`, `strategy` verwenden.
