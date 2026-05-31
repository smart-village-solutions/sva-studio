# Waste Tour Duplication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Tour im Waste Management soll aus der Tabellenzeile dupliziert werden können, die normale Erstellungsseite mit vorbelegten Stammdaten öffnen und nach dem Speichern serverseitig Abholort-Zuordnungen plus tourbezogene Datumsverschiebungen vollständig auf die neue Tour kopieren.

**Architecture:** Die Umsetzung erweitert den bestehenden Tour-Create-Flow um einen optionalen Duplizierungs-Kontext statt einen separaten Spezialpfad einzuführen. Im Plugin wird der Kontext über Search-Params und Form-State geführt; im Host erweitert der bestehende Tour-Create-Handler seine Payload um `duplicateFromTourId` und orchestriert die serverseitige Relationenkopie inklusive Fehlerbehandlung und Konsistenzsicherung.

**Tech Stack:** TypeScript strict mode, React, TanStack Router Search-Params, Vitest über Nx, auth-runtime Waste-Handler, OpenSpec

---

## File Structure

### OpenSpec und Planung

- Create: `openspec/changes/add-waste-tour-duplication/proposal.md`
- Create: `openspec/changes/add-waste-tour-duplication/tasks.md`
- Create: `openspec/changes/add-waste-tour-duplication/design.md`
- Create: `openspec/changes/add-waste-tour-duplication/specs/waste-management/spec.md`

### Plugin-UI und Client-Vertrag

- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.actions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.table-row.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.table-row.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.tour-submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.ui-access.ts`

### Server und Repository-Zugriffe

- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/tours.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.location-tour-links.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.tour-date-shifts.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`

### Tests

- Modify: `packages/plugin-waste-management/tests/search-params.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.tours-panel.test.tsx`
- Modify: `packages/plugin-waste-management/tests/waste-management.ui-access.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/core.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.test.ts`

## Task 1: OpenSpec-Change für die Capability-Erweiterung anlegen

**Files:**
- Create: `openspec/changes/add-waste-tour-duplication/proposal.md`
- Create: `openspec/changes/add-waste-tour-duplication/tasks.md`
- Create: `openspec/changes/add-waste-tour-duplication/design.md`
- Create: `openspec/changes/add-waste-tour-duplication/specs/waste-management/spec.md`
- Reference: `docs/superpowers/specs/2026-05-27-waste-tour-duplication-design.md`
- Reference: `openspec/specs/waste-management/spec.md`

- [x] **Step 1: OpenSpec-Delta als failing spec formulieren**

```md
## ADDED Requirements
### Requirement: Waste-Management erlaubt das Duplizieren von Touren
Das System SHALL im Tourenbereich eine Duplizierungsaktion bereitstellen, die den bestehenden Create-Flow mit vorbelegten Tourdaten öffnet.

#### Scenario: Benutzer öffnet den Duplizieren-Flow
- **GIVEN** eine vorhandene Tour in der Tourentabelle
- **WHEN** ein berechtigter Benutzer die Aktion `Duplizieren` ausführt
- **THEN** öffnet das System den bestehenden Tour-Create-View
- **AND** das Formular ist mit den Stammdaten der Quell-Tour vorbelegt
- **AND** der Name erhält initial das Suffix ` (Kopie)`

### Requirement: Waste-Management kopiert abhängige Tour-Beziehungen erst nach dem Speichern
Das System SHALL Abholort-Zuordnungen und tourbezogene Datumsverschiebungen erst nach erfolgreichem Speichern der neuen Tour serverseitig übernehmen.

#### Scenario: UI erklärt die verzögerte Übernahme
- **WHEN** ein Benutzer den Create-View aus einem Duplizieren-Flow öffnet
- **THEN** sieht er vor den Save-Actions einen Hinweis zur erst nachgelagerten Übernahme der Zuordnungen

#### Scenario: Server dupliziert Beziehungen vollständig
- **WHEN** die neue Tour erfolgreich gespeichert wird
- **THEN** kopiert das System die Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen der Quell-Tour auf die neue Tour
- **AND** die Original-Tour bleibt unverändert
- **AND** Teilerfolge sind nicht zulässig
```

- [x] **Step 2: Proposal, Design-Verweis und Task-Liste anlegen**

```md
# Change: Tour-Duplizierung im Waste Management

## Why
Redakteure können heute Touren nur manuell neu anlegen oder bearbeiten. Wiederkehrende Tourkonfigurationen mit identischen Zuordnungen und Datumsverschiebungen verursachen dadurch unnötigen Erfassungsaufwand und Fehlerpotenzial.

## What Changes
- Neue Tabellenaktion `Duplizieren` im Tourenbereich
- Erweiterung des Tour-Create-Flows um `duplicateFromTourId`
- Serverseitige Kopie von Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen
- UI-Hinweis vor dem Speichern

## Impact
- Affected specs: `waste-management`
- Affected code: `packages/plugin-waste-management`, `packages/auth-runtime`, `packages/data-repositories`
- Affected arc42 sections: keine fachliche Architekturänderung; im Proposal als explizite Nicht-Änderung dokumentieren
```

- [x] **Step 3: OpenSpec validieren**

Run: `openspec validate add-waste-tour-duplication --strict`  
Expected: PASS ohne Schema- oder Scenario-Fehler

- [ ] **Step 4: OpenSpec-Dateien committen**

```bash
git add openspec/changes/add-waste-tour-duplication
git commit -m "spec: add waste tour duplication proposal"
```

## Task 2: Search-Params und Client-Vertrag für den Duplizieren-Kontext vorbereiten

**Files:**
- Modify: `packages/plugin-waste-management/src/search-params.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.shared.ts`
- Test: `packages/plugin-waste-management/tests/search-params.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts`

- [x] **Step 1: Failing Tests für `duplicateFromTourId` ergänzen**

```ts
it('normalizes duplicateFromTourId as optional trimmed search param', () => {
  expect(
    normalizeWasteManagementSearchParams({
      tab: 'tours',
      toursView: 'create',
      duplicateFromTourId: '  tour-42  ',
    }),
  ).toMatchObject({
    toursView: 'create',
    duplicateFromTourId: 'tour-42',
  });
});

it('includes duplicateFromTourId in create tour input mapping when present', () => {
  const form = {
    ...createDefaultTourForm(),
    name: 'Bio Nord (Kopie)',
    wasteFractionIds: ['fraction-1'],
  };

  expect(toCreateTourInput(form, 'tour-source-1')).toMatchObject({
    name: 'Bio Nord (Kopie)',
    duplicateFromTourId: 'tour-source-1',
  });
});
```

- [x] **Step 2: Gezielte Plugin-Tests ausführen und rotes Verhalten bestätigen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/search-params.test.ts --testFiles=tests/waste-management.tours.shared.test.ts`  
Expected: FAIL wegen fehlendem `duplicateFromTourId` in Typen, Normalisierung oder Mappern

- [x] **Step 3: Minimale Typ- und Mapper-Erweiterung implementieren**

```ts
export type WasteManagementSearchParams = Readonly<{
  // ...
  duplicateFromTourId?: string;
}>;

export type CreateWasteManagementTourInput = Readonly<{
  id: string;
  name: string;
  wasteFractionIds: readonly string[];
  duplicateFromTourId?: string;
  // ...
}>;

export const toCreateTourInput = (
  form: TourFormState,
  duplicateFromTourId?: string,
): CreateWasteManagementTourInput => ({
  id: form.id,
  name: form.name.trim(),
  wasteFractionIds: form.wasteFractionIds,
  duplicateFromTourId: compactOptionalString(duplicateFromTourId),
  // ...
});
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/search-params.test.ts --testFiles=tests/waste-management.tours.shared.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/plugin-waste-management/src/search-params.ts \
  packages/plugin-waste-management/src/waste-management.api.types.operations-inputs.ts \
  packages/plugin-waste-management/src/waste-management.tours.shared.ts \
  packages/plugin-waste-management/tests/search-params.test.ts \
  packages/plugin-waste-management/tests/waste-management.tours.shared.test.ts
git commit -m "feat: add waste tour duplication client contract"
```

## Task 3: Tabellenaktion, Navigation und Vorbelegung im Plugin umsetzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours.actions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.table-row.parts.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.table-row.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.state.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.ui-access.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.ui-access.test.ts`

- [x] **Step 1: Failing UI- und Navigationstests ergänzen**

```ts
it('prefills create flow from duplicate action with copied name suffix', () => {
  act(() => {
    result.current.toDuplicate({
      id: 'tour-7',
      name: 'Bio Nord',
      description: 'Montag',
      wasteFractionIds: ['fraction-1'],
      recurrence: 'weekly',
      firstDate: '2026-01-07',
      endDate: '2026-12-31',
      customDates: [],
      active: true,
      createdAt: '',
      updatedAt: '',
    });
  });

  expect(controller.setTourForm).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Bio Nord (Kopie)',
      recurrence: 'weekly',
      firstDate: '2026-01-07',
    }),
  );

  expect(navigateMock).toHaveBeenCalledWith({
    to: '/plugins/waste-management',
    search: expect.objectContaining({
      toursView: 'create',
      duplicateFromTourId: 'tour-7',
    }),
  });
});

it('shows duplicate action only when user can manage tours and scheduling', () => {
  expect(resolveWasteToursUiAccess({
    canManageTours: true,
    canManageScheduling: false,
  }).canDuplicateTour).toBe(false);
});
```

- [x] **Step 2: Gezielte Tests ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.navigation.test.ts --testFiles=tests/waste-management.tours-content.test.tsx --testFiles=tests/waste-management.ui-access.test.ts`  
Expected: FAIL wegen fehlender `toDuplicate`-Navigation, fehlendem Access-Flag oder fehlender Tabellenaktion

- [x] **Step 3: Vorbelegung, Aktion und Rechte-Gating minimal implementieren**

```ts
openDuplicateDialog: (tour: WasteTourRecord) => {
  state.setDialogMode('create');
  state.setTourForm({
    ...mapTourToForm(tour),
    id: crypto.randomUUID(),
    name: `${tour.name} (Kopie)`,
  });
  state.setMessage(null);
  state.setDialogOpen(false);
};

toDuplicate: (tour: WasteTourRecord) => {
  controller.setTourForm({
    ...mapTourToForm(tour),
    id: crypto.randomUUID(),
    name: `${tour.name} (Kopie)`,
  });
  void navigate({
    to: '/plugins/waste-management',
    search: { ...search, toursView: 'create', duplicateFromTourId: tour.id, tourId: undefined },
  });
};

return {
  canDuplicateTour: access.canManageTours && access.canManageScheduling,
};
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.navigation.test.ts --testFiles=tests/waste-management.tours-content.test.tsx --testFiles=tests/waste-management.ui-access.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/plugin-waste-management/src/waste-management.tours.actions.ts \
  packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts \
  packages/plugin-waste-management/src/waste-management.tours.table-row.parts.tsx \
  packages/plugin-waste-management/src/waste-management.tours.table-row.tsx \
  packages/plugin-waste-management/src/waste-management.tours-form-view.tsx \
  packages/plugin-waste-management/src/waste-management.tours.state.ts \
  packages/plugin-waste-management/src/waste-management.ui-access.ts \
  packages/plugin-waste-management/src/plugin.translations.de.tours.ts \
  packages/plugin-waste-management/src/plugin.translations.en.tours.ts \
  packages/plugin-waste-management/tests/waste-management.tours-list-view.navigation.test.ts \
  packages/plugin-waste-management/tests/waste-management.tours-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.ui-access.test.ts
git commit -m "feat: add waste tour duplicate navigation"
```

## Task 4: Hinweisblock und Submit-Verhalten im Create-View umsetzen

**Files:**
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-content.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours-form-view.tsx`
- Modify: `packages/plugin-waste-management/src/waste-management.tours.tour-submissions.ts`
- Modify: `packages/plugin-waste-management/src/waste-management.api.operations.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- Modify: `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- Test: `packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx`
- Test: `packages/plugin-waste-management/tests/waste-management.page.test.tsx`

- [x] **Step 1: Failing Tests für Hinweistext und Submit-Payload ergänzen**

```ts
it('renders duplication hint only when duplicateFromTourId is set', () => {
  render(
    <WasteToursFormContent
      mode="create"
      duplicateFromTourName="Bio Nord"
      showDuplicationHint
      form={form}
      fractions={fractions}
      saving={false}
      onChange={vi.fn()}
      onCancel={vi.fn()}
      onSubmit={vi.fn()}
    />,
  );

  expect(screen.getByText('tours.duplicate.hint')).toBeInTheDocument();
});

it('sends duplicateFromTourId during create submit', async () => {
  await handler(submitEvent, 'create', 'tour-source-1');
  expect(createWasteManagementTour).toHaveBeenCalledWith(
    expect.objectContaining({ duplicateFromTourId: 'tour-source-1' }),
  );
});
```

- [x] **Step 2: Gezielte Tests ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.page.test.tsx`  
Expected: FAIL wegen fehlendem Hinweisblock oder fehlender Submit-Weitergabe

- [x] **Step 3: Hint-Rendering und Submit-Weitergabe minimal implementieren**

```tsx
{showDuplicationHint ? (
  <div className="rounded-2xl border border-info/40 bg-info/5 px-4 py-3 text-sm text-foreground">
    {pt('tours.duplicate.hint', { sourceName: duplicateFromTourName ?? '' })}
  </div>
) : null}
```

```ts
const createSubmitTourHandler = ({ state, pt, loadOverview }: WasteToursSubmissionContext) => async (
  event: FormEvent<HTMLFormElement>,
  mode = state.dialogMode,
  duplicateFromTourId?: string,
) => {
  if (mode === 'create') {
    await createWasteManagementTour(toCreateTourInput(state.tourForm, duplicateFromTourId));
  }
};
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.page.test.tsx`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/plugin-waste-management/src/waste-management.tours-form-content.tsx \
  packages/plugin-waste-management/src/waste-management.tours-form-view.tsx \
  packages/plugin-waste-management/src/waste-management.tours.tour-submissions.ts \
  packages/plugin-waste-management/src/waste-management.api.operations.ts \
  packages/plugin-waste-management/src/plugin.translations.de.tours.ts \
  packages/plugin-waste-management/src/plugin.translations.en.tours.ts \
  packages/plugin-waste-management/tests/waste-management.tours-form-content.test.tsx \
  packages/plugin-waste-management/tests/waste-management.page.test.tsx
git commit -m "feat: add waste tour duplication form flow"
```

## Task 5: Repository- und Loader-Bausteine für Quellen und Kopien ergänzen

**Files:**
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.location-tour-links.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.tour-date-shifts.ts`
- Modify: `packages/data-repositories/src/waste-management/master-data.contract.test.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.ts`
- Modify: `packages/auth-runtime/src/waste-management/server-loaders.test.ts`

- [x] **Step 1: Failing Tests für listenbasierte Quell-Lader ergänzen**

```ts
it('exposes loader helpers for location-tour-links and tour-date-shifts by tour id', () => {
  expect(wasteServerLoaders).toEqual(
    expect.objectContaining({
      listWasteLocationTourLinksByTourId: expect.any(Function),
      listWasteTourDateShiftsByTourId: expect.any(Function),
    }),
  );
});
```

- [x] **Step 2: Loader-Tests ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/server-loaders.test.ts --testFiles=../data-repositories/src/waste-management/master-data.contract.test.ts`  
Expected: FAIL wegen fehlender Repository-/Loader-Methoden  
Note: Wenn Nx projektübergreifende `--testFiles` nicht akzeptiert, Tests getrennt ausführen.

- [x] **Step 3: Minimale Repository- und Loader-Erweiterung implementieren**

```ts
listWasteLocationTourLinksByTourId: defineRepositoryMethod<
  (tourId: string) => Promise<readonly WasteLocationTourLinkRecord[]>
>(),
listWasteTourDateShiftsByTourId: defineRepositoryMethod<
  (tourId: string) => Promise<readonly WasteTourDateShiftRecord[]>
>(),
```

```ts
const listWasteLocationTourLinksByTourId = createLoader(
  'list_waste_location_tour_links_by_tour_id',
  (repository, tourId: string) => repository.listWasteLocationTourLinks({ tourId }),
);
const listWasteTourDateShiftsByTourId = createLoader(
  'list_waste_tour_date_shifts_by_tour_id',
  (repository, tourId: string) => repository.listWasteTourDateShifts({ tourId }),
);
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts`  
Expected: PASS  

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/server-loaders.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/data-repositories/src/waste-management/master-data.contract.ts \
  packages/data-repositories/src/waste-management/master-data.location-tour-links.ts \
  packages/data-repositories/src/waste-management/master-data.tour-date-shifts.ts \
  packages/data-repositories/src/waste-management/master-data.contract.test.ts \
  packages/auth-runtime/src/waste-management/server-loaders.ts \
  packages/auth-runtime/src/waste-management/server-loaders.test.ts
git commit -m "feat: add waste tour duplication source loaders"
```

## Task 6: Serverseitige Duplizierungslogik im Tour-Create-Handler implementieren

**Files:**
- Modify: `packages/auth-runtime/src/waste-management/core/schemas.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/types.ts`
- Modify: `packages/auth-runtime/src/waste-management/core/tours.ts`
- Modify: `packages/auth-runtime/src/waste-management/server.ts`
- Test: `packages/auth-runtime/src/waste-management/core.test.ts`
- Test: `packages/auth-runtime/src/waste-management/server.test.ts`

- [x] **Step 1: Failing Handler-Tests für Erfolg, Rechte und Fehlerpfade ergänzen**

```ts
it('duplicates location-tour-links and tour-date-shifts when duplicateFromTourId is set', async () => {
  const response = await createWasteManagementTourInternal(
    new Request('https://studio.test/api/v1/waste-management/tours', {
      method: 'POST',
      body: JSON.stringify({
        id: 'tour-copy-1',
        name: 'Bio Nord (Kopie)',
        wasteFractionIds: ['fraction-1'],
        duplicateFromTourId: 'tour-source-1',
        active: true,
      }),
    }),
    ctx,
    deps,
  );

  expect(response.status).toBe(201);
  expect(deps.saveWasteLocationTourLink).toHaveBeenCalled();
  expect(deps.saveWasteTourDateShift).toHaveBeenCalled();
});

it('rejects duplicate flow without scheduling permission', async () => {
  expect(response.status).toBe(403);
});

it('removes created tour again when shift copy fails', async () => {
  expect(deps.deleteWasteTour).toHaveBeenCalledWith('instance-1', 'tour-copy-1');
});
```

- [x] **Step 2: Gezielte Auth-Runtime-Tests ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server.test.ts`  
Expected: FAIL wegen fehlendem Schema-Feld, fehlender Rechteverzweigung oder fehlender Kompensation

- [x] **Step 3: Minimalen Serverpfad mit Kopierorchestrierung implementieren**

```ts
const createWasteTourSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  wasteFractionIds: z.array(z.string().trim().min(1)).min(1),
  duplicateFromTourId: z.string().trim().min(1).optional(),
  active: z.boolean(),
  // ...
});
```

```ts
if (parsed.data.duplicateFromTourId) {
  const schedulingAuthError = await authorizeWasteManagementAction(
    ctx,
    'waste-management.scheduling.manage',
    deps,
    requestId,
  );
  if (schedulingAuthError) {
    return schedulingAuthError;
  }
}

await saveWasteTour(instanceId, nextTour);

try {
  if (parsed.data.duplicateFromTourId) {
    const sourceLinks = await listWasteLocationTourLinksByTourId(instanceId, parsed.data.duplicateFromTourId);
    const sourceShifts = await listWasteTourDateShiftsByTourId(instanceId, parsed.data.duplicateFromTourId);
    await copyLocationLinks(instanceId, parsed.data.id, sourceLinks);
    await copyTourDateShifts(instanceId, parsed.data.id, sourceShifts);
  }
} catch (error) {
  await deleteWasteTour(instanceId, parsed.data.id);
  throw error;
}
```

- [x] **Step 4: Tests erneut ausführen**

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server.test.ts`  
Expected: PASS

- [ ] **Step 5: Teilfortschritt committen**

```bash
git add packages/auth-runtime/src/waste-management/core/schemas.ts \
  packages/auth-runtime/src/waste-management/core/types.ts \
  packages/auth-runtime/src/waste-management/core/tours.ts \
  packages/auth-runtime/src/waste-management/server.ts \
  packages/auth-runtime/src/waste-management/core.test.ts \
  packages/auth-runtime/src/waste-management/server.test.ts
git commit -m "feat: add waste tour duplication server flow"
```

## Task 7: End-to-End Fachverhalten verifizieren und Abschlussdokumentation aktualisieren

**Files:**
- Modify: `openspec/changes/add-waste-tour-duplication/tasks.md`
- Verify: `docs/superpowers/specs/2026-05-27-waste-tour-duplication-design.md`
- Verify: `openspec/changes/add-waste-tour-duplication/specs/waste-management/spec.md`

- [x] **Step 1: Vollständige fokussierte Testmatrix ausführen**

Run: `pnpm nx run plugin-waste-management:test:unit --testFiles=tests/search-params.test.ts --testFiles=tests/waste-management.tours.shared.test.ts --testFiles=tests/waste-management.tours-list-view.navigation.test.ts --testFiles=tests/waste-management.tours-content.test.tsx --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.page.test.tsx --testFiles=tests/waste-management.ui-access.test.ts`  
Expected: PASS

Run: `pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/server-loaders.test.ts --testFiles=src/waste-management/core.test.ts --testFiles=src/waste-management/server.test.ts`  
Expected: PASS

Run: `pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.contract.test.ts`  
Expected: PASS

- [x] **Step 2: Typ- und Lint-Gates nachziehen**

Run: `pnpm test:types`  
Expected: PASS

Run: `pnpm test:eslint`  
Expected: PASS

### If runtime allows before push

Run: `pnpm test:pr`  
Expected: PASS oder dokumentierter Abbruchgrund

- [x] **Step 3: OpenSpec-Tasks als erledigt markieren und erneut validieren**

```md
## 1. Implementation
- [x] 1.1 Duplizieren-Aktion und vorbelegten Create-Flow implementieren
- [x] 1.2 Hinweistext und Client-Payload umsetzen
- [x] 1.3 Serverseitige Relationenkopie für Zuordnungen und Tour-Date-Shifts ergänzen
- [x] 1.4 Fehler- und Rechtepfade absichern
- [x] 1.5 Tests und Validierung abschließen
```

Run: `openspec validate add-waste-tour-duplication --strict`  
Expected: PASS

- [ ] **Step 4: Abschlusscommit erstellen**

```bash
git add packages/plugin-waste-management packages/auth-runtime packages/data-repositories openspec/changes/add-waste-tour-duplication
git commit -m "feat: add waste tour duplication"
```

## Self-Review Checklist

- Spec coverage: OpenSpec-Change, Tabellenaktion, vorbelegter Create-View, Hinweisblock, serverseitige Kopie, Rechteprüfung, Konsistenzverhalten und Tests sind jeweils mindestens einem Task zugeordnet.
- Placeholder scan: Keine `TODO`-, `TBD`- oder unbestimmten "handle this later"-Schritte im Plan belassen.
- Type consistency: Überall denselben Feldnamen `duplicateFromTourId` und dieselben Rechte `waste-management.tours.manage` plus `waste-management.scheduling.manage` verwenden.
