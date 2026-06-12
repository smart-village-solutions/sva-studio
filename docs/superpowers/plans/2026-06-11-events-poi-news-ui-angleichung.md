# Events Und POI News UI Angleichung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das `Events`- und das `POI`-Plugin werden auf dieselbe Detailseiten- und Listen-UX wie das `News`-Plugin umgestellt, bei fester Tab-Struktur `Basis` / `Inhalt` / `Einstellungen` / `Historie` und plugin-spezifischen Cards innerhalb der Tabs.

**Architecture:** Beide Plugins folgen dem bereits etablierten `News`-Schnitt: schlanke Entry-Pages, zentrale Detailseite, separate Tab-Komponenten, eigenes Formularmodell und sauberes Mapping zwischen UI und Mainserver-Input. Die Nutzerführung wird vereinheitlicht, ohne die Fachmodelle von `Events` und `POI` zu künstlich zu generalisieren.

**Tech Stack:** TypeScript strict mode, React, TanStack Router, React Hook Form, bestehende `@sva/plugin-sdk`-Utilities, `@sva/studio-ui-react`, Vitest, Nx, bestehende Plugin-Tests und E2E-Tests

---

## File Structure

**Create:**
- `packages/plugin-events/src/events.detail-page.tsx`
- `packages/plugin-events/src/events.detail-form.ts`
- `packages/plugin-events/src/events.detail-tabs.tsx`
- `packages/plugin-events/src/events.detail-basis-tab.tsx`
- `packages/plugin-events/src/events.detail-content-tab.tsx`
- `packages/plugin-events/src/events.detail-settings-tab.tsx`
- `packages/plugin-events/src/events.detail-history-tab.tsx`
- `packages/plugin-events/tests/events.detail-page.test.tsx`
- `packages/plugin-events/tests/events.detail-form.test.ts`
- `packages/plugin-poi/src/poi.detail-page.tsx`
- `packages/plugin-poi/src/poi.detail-form.ts`
- `packages/plugin-poi/src/poi.detail-tabs.tsx`
- `packages/plugin-poi/src/poi.detail-basis-tab.tsx`
- `packages/plugin-poi/src/poi.detail-content-tab.tsx`
- `packages/plugin-poi/src/poi.detail-settings-tab.tsx`
- `packages/plugin-poi/src/poi.detail-history-tab.tsx`
- `packages/plugin-poi/tests/poi.detail-page.test.tsx`
- `packages/plugin-poi/tests/poi.detail-form.test.ts`

**Modify:**
- `apps/sva-studio-react/e2e/events-poi-plugin.spec.ts`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `packages/plugin-events/src/events.pages.tsx`
- `packages/plugin-events/src/index.ts`
- `packages/plugin-events/src/plugin.translations.ts`
- `packages/plugin-events/tests/events.pages.test.tsx`
- `packages/plugin-poi/src/index.ts`
- `packages/plugin-poi/src/plugin.translations.ts`
- `packages/plugin-poi/src/poi.pages.tsx`
- `packages/plugin-poi/tests/poi.pages.test.tsx`

## Constraints And Decisions

- Die Tab-Struktur ist für `News`, `Events` und `POI` identisch und darf in der Umsetzung nicht plugin-spezifisch erweitert oder umsortiert werden.
- Fachliche Unterschiede werden nur über Card-Zuschnitt und Feldbelegung innerhalb der Tabs modelliert.
- `Historie` bleibt in beiden Plugins immer sichtbar; wenn keine echte Historie verfügbar ist, wird ein konsistenter Leer- oder Hinweiszustand gezeigt.
- Listen- und Detailumbau werden als getrennte Commit-Schnitte umgesetzt, damit Review und Regressionen beherrschbar bleiben.
- Die bestehenden Mainserver-API-Verträge bleiben unverändert; neue UI-Modelle sind reine Mapping-Schichten innerhalb der Plugins.

### Task 1: Build The Events Detail Page Foundation

**Files:**
- Create: `packages/plugin-events/src/events.detail-page.tsx`
- Create: `packages/plugin-events/src/events.detail-form.ts`
- Create: `packages/plugin-events/src/events.detail-tabs.tsx`
- Create: `packages/plugin-events/src/events.detail-basis-tab.tsx`
- Create: `packages/plugin-events/src/events.detail-content-tab.tsx`
- Create: `packages/plugin-events/src/events.detail-settings-tab.tsx`
- Create: `packages/plugin-events/src/events.detail-history-tab.tsx`
- Modify: `packages/plugin-events/src/events.pages.tsx`
- Modify: `packages/plugin-events/src/index.ts`
- Test: `packages/plugin-events/tests/events.detail-page.test.tsx`
- Test: `packages/plugin-events/tests/events.detail-form.test.ts`

- [ ] **Step 1: Write the failing Events detail-page tests**

```tsx
// packages/plugin-events/tests/events.detail-page.test.tsx
it('renders the fixed tab order for events', async () => {
  render(<EventsDetailPage mode="create" />);

  expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
});

it('shows event-specific cards inside the content tab', async () => {
  render(<EventsDetailPage mode="create" />);

  fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));

  expect(screen.getByText('Termine')).toBeTruthy();
  expect(screen.getByText('Orte und Adressen')).toBeTruthy();
  expect(screen.getByText('Kontakt')).toBeTruthy();
  expect(screen.getByText('Links')).toBeTruthy();
  expect(screen.getByText('Wiederholung')).toBeTruthy();
  expect(screen.getByText('POI-Verknüpfung')).toBeTruthy();
});

// packages/plugin-events/tests/events.detail-form.test.ts
it('maps an event item into the fixed tab form model', () => {
  expect(
    mapEventItemToDetailFormValues({
      id: 'event-1',
      title: 'Stadtfest',
      description: 'Innenstadt',
      categoryName: 'Kultur',
      dates: [{ dateStart: '2026-06-11T10:00:00.000Z' }],
      addresses: [{ street: 'Marktplatz 1', city: 'Bochum' }],
      pointOfInterestId: 'poi-1',
    } as EventContentItem)
  ).toMatchObject({
    title: 'Stadtfest',
    content: {
      description: 'Innenstadt',
      pointOfInterestId: 'poi-1',
    },
  });
});
```

- [ ] **Step 2: Run the focused Events tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-events:test:unit --testFiles=tests/events.detail-page.test.tsx --testFiles=tests/events.detail-form.test.ts
```

Expected:

```text
FAIL  packages/plugin-events/tests/events.detail-page.test.tsx
FAIL  packages/plugin-events/tests/events.detail-form.test.ts
```

- [ ] **Step 3: Add the Events detail form model and tab descriptors**

```ts
// packages/plugin-events/src/events.detail-tabs.tsx
export type EventsDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export const createEventsDetailTabDefinitions = (
  pt: (key: string) => string
): readonly { id: EventsDetailTabId; title: string; description: string }[] => [
  { id: 'basis', title: pt('detailTabs.basis.title'), description: pt('detailTabs.basis.description') },
  { id: 'content', title: pt('detailTabs.content.title'), description: pt('detailTabs.content.description') },
  { id: 'settings', title: pt('detailTabs.settings.title'), description: pt('detailTabs.settings.description') },
  { id: 'history', title: pt('detailTabs.history.title'), description: pt('detailTabs.history.description') },
];

// packages/plugin-events/src/events.detail-form.ts
export type EventsDetailFormValues = Readonly<{
  title: string;
  basis: {
    categoryName: string;
  };
  content: {
    description: string;
    dates: EventFormInput['dates'];
    addresses: EventFormInput['addresses'];
    contact: EventFormInput['contact'];
    urls: EventFormInput['urls'];
    pointOfInterestId: string;
    repeat: boolean;
    recurring: string;
    recurringType: string;
    recurringInterval: string;
    recurringWeekdays: readonly string[];
  };
  settings: {
    headerImageAssetId: string;
  };
}>;

export const mapEventItemToDetailFormValues = (item: EventContentItem): EventsDetailFormValues => ({
  title: item.title,
  basis: {
    categoryName: item.categoryName ?? '',
  },
  content: {
    description: item.description ?? '',
    dates: item.dates?.length ? item.dates : [{ dateStart: '', dateEnd: '', timeStart: '', timeEnd: '' }],
    addresses: item.addresses?.length ? item.addresses : [{ street: '', zip: '', city: '' }],
    contact: item.contact ?? { firstName: '', lastName: '', phone: '', email: '' },
    urls: item.urls?.length ? item.urls : [{ url: '', description: '' }],
    pointOfInterestId: item.pointOfInterestId ?? '',
    repeat: item.repeat ?? false,
    recurring: item.recurring ?? '',
    recurringType: item.recurringType ?? '',
    recurringInterval: item.recurringInterval ?? '',
    recurringWeekdays: item.recurringWeekdays ?? [],
  },
  settings: {
    headerImageAssetId: '',
  },
});
```

- [ ] **Step 4: Implement the Events detail page and route it through `events.pages.tsx`**

```tsx
// packages/plugin-events/src/events.pages.tsx
import { EventsDetailPage } from './events.detail-page.js';

export const EventsCreatePage = () => <EventsDetailPage mode="create" />;

export const EventsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <EventsDetailPage mode="edit" contentId={params.contentId ?? params.id} />;
};

// packages/plugin-events/src/events.detail-page.tsx
export const EventsDetailPage = ({ mode, contentId }: { readonly mode: 'create' | 'edit'; readonly contentId?: string }) => {
  const pt = usePluginTranslation('events');
  const tabs = createEventsDetailTabDefinitions(pt);

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
      actions={<Button type="submit">{pt('actions.save')}</Button>}
    >
      <Tabs defaultValue="basis">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="basis">
          <EventsDetailBasisTab />
        </TabsContent>
        <TabsContent value="content">
          <EventsDetailContentTab />
        </TabsContent>
        <TabsContent value="settings">
          <EventsDetailSettingsTab />
        </TabsContent>
        <TabsContent value="history">
          <EventsDetailHistoryTab />
        </TabsContent>
      </Tabs>
    </StudioDetailPageTemplate>
  );
};
```

- [ ] **Step 5: Run the Events unit and type checks**

Run:

```bash
pnpm nx run plugin-events:test:unit --testFiles=tests/events.detail-page.test.tsx --testFiles=tests/events.detail-form.test.ts --testFiles=tests/events.pages.test.tsx
pnpm nx run plugin-events:test:types
```

Expected:

```text
PASS  packages/plugin-events/tests/events.detail-page.test.tsx
PASS  packages/plugin-events/tests/events.detail-form.test.ts
PASS  packages/plugin-events/tests/events.pages.test.tsx
PASS  plugin-events:test:types
```

- [ ] **Step 6: Commit the Events detail-page foundation**

```bash
git add packages/plugin-events/src/events.pages.tsx packages/plugin-events/src/events.detail-page.tsx packages/plugin-events/src/events.detail-form.ts packages/plugin-events/src/events.detail-tabs.tsx packages/plugin-events/src/events.detail-basis-tab.tsx packages/plugin-events/src/events.detail-content-tab.tsx packages/plugin-events/src/events.detail-settings-tab.tsx packages/plugin-events/src/events.detail-history-tab.tsx packages/plugin-events/src/index.ts packages/plugin-events/tests/events.detail-page.test.tsx packages/plugin-events/tests/events.detail-form.test.ts packages/plugin-events/tests/events.pages.test.tsx
git commit -m "feat: add news-style events detail page"
```

### Task 2: Build The POI Detail Page Foundation

**Files:**
- Create: `packages/plugin-poi/src/poi.detail-page.tsx`
- Create: `packages/plugin-poi/src/poi.detail-form.ts`
- Create: `packages/plugin-poi/src/poi.detail-tabs.tsx`
- Create: `packages/plugin-poi/src/poi.detail-basis-tab.tsx`
- Create: `packages/plugin-poi/src/poi.detail-content-tab.tsx`
- Create: `packages/plugin-poi/src/poi.detail-settings-tab.tsx`
- Create: `packages/plugin-poi/src/poi.detail-history-tab.tsx`
- Modify: `packages/plugin-poi/src/poi.pages.tsx`
- Modify: `packages/plugin-poi/src/index.ts`
- Test: `packages/plugin-poi/tests/poi.detail-page.test.tsx`
- Test: `packages/plugin-poi/tests/poi.detail-form.test.ts`

- [ ] **Step 1: Write the failing POI detail-page tests**

```tsx
// packages/plugin-poi/tests/poi.detail-page.test.tsx
it('renders the fixed tab order for poi', async () => {
  render(<PoiDetailPage mode="create" />);

  expect(screen.getByRole('tab', { name: 'Basis' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Inhalt' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
  expect(screen.getByRole('tab', { name: 'Historie' })).toBeTruthy();
});

it('shows poi-specific cards inside the content tab', async () => {
  render(<PoiDetailPage mode="create" />);

  fireEvent.click(screen.getByRole('tab', { name: 'Inhalt' }));

  expect(screen.getByText('Beschreibungen')).toBeTruthy();
  expect(screen.getByText('Kontakt')).toBeTruthy();
  expect(screen.getByText('Lage und Adresse')).toBeTruthy();
  expect(screen.getByText('Öffnungszeiten')).toBeTruthy();
  expect(screen.getByText('Weblinks')).toBeTruthy();
  expect(screen.getByText('Zusatzdaten')).toBeTruthy();
});

// packages/plugin-poi/tests/poi.detail-form.test.ts
it('maps a poi item into the fixed tab form model', () => {
  expect(
    mapPoiItemToDetailFormValues({
      id: 'poi-1',
      name: 'Rathaus',
      description: 'Zentrale',
      mobileDescription: 'Kurz',
      active: true,
      categoryName: 'Verwaltung',
      addresses: [{ street: 'Rathausplatz 1', city: 'Essen' }],
      openingHours: [{ weekday: 'Mo', timeFrom: '08:00', open: true }],
      webUrls: [{ url: 'https://example.test' }],
      payload: { floor: '1' },
    } as PoiContentItem)
  ).toMatchObject({
    name: 'Rathaus',
    content: {
      description: 'Zentrale',
      mobileDescription: 'Kurz',
    },
  });
});
```

- [ ] **Step 2: Run the focused POI tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-page.test.tsx --testFiles=tests/poi.detail-form.test.ts
```

Expected:

```text
FAIL  packages/plugin-poi/tests/poi.detail-page.test.tsx
FAIL  packages/plugin-poi/tests/poi.detail-form.test.ts
```

- [ ] **Step 3: Add the POI detail form model and tab descriptors**

```ts
// packages/plugin-poi/src/poi.detail-tabs.tsx
export type PoiDetailTabId = 'basis' | 'content' | 'settings' | 'history';

export const createPoiDetailTabDefinitions = (
  pt: (key: string) => string
): readonly { id: PoiDetailTabId; title: string; description: string }[] => [
  { id: 'basis', title: pt('detailTabs.basis.title'), description: pt('detailTabs.basis.description') },
  { id: 'content', title: pt('detailTabs.content.title'), description: pt('detailTabs.content.description') },
  { id: 'settings', title: pt('detailTabs.settings.title'), description: pt('detailTabs.settings.description') },
  { id: 'history', title: pt('detailTabs.history.title'), description: pt('detailTabs.history.description') },
];

// packages/plugin-poi/src/poi.detail-form.ts
export type PoiDetailFormValues = Readonly<{
  name: string;
  basis: {
    categoryName: string;
    active: boolean;
  };
  content: {
    description: string;
    mobileDescription: string;
    addresses: PoiFormInput['addresses'];
    contact: PoiFormInput['contact'];
    openingHours: PoiFormInput['openingHours'];
    webUrls: PoiFormInput['webUrls'];
    payloadText: string;
  };
  settings: {
    teaserImageAssetId: string;
  };
}>;

export const mapPoiItemToDetailFormValues = (item: PoiContentItem): PoiDetailFormValues => ({
  name: item.name,
  basis: {
    categoryName: item.categoryName ?? '',
    active: item.active !== false,
  },
  content: {
    description: item.description ?? '',
    mobileDescription: item.mobileDescription ?? '',
    addresses: item.addresses?.length ? item.addresses : [{ street: '', zip: '', city: '' }],
    contact: item.contact ?? { firstName: '', lastName: '', phone: '', email: '' },
    openingHours: item.openingHours?.length ? item.openingHours : [{ weekday: '', timeFrom: '', timeTo: '', open: true, description: '' }],
    webUrls: item.webUrls?.length ? item.webUrls : [{ url: '', description: '' }],
    payloadText: JSON.stringify(item.payload ?? {}, null, 2),
  },
  settings: {
    teaserImageAssetId: '',
  },
});
```

- [ ] **Step 4: Implement the POI detail page and route it through `poi.pages.tsx`**

```tsx
// packages/plugin-poi/src/poi.pages.tsx
import { PoiDetailPage } from './poi.detail-page.js';

export const PoiCreatePage = () => <PoiDetailPage mode="create" />;

export const PoiEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <PoiDetailPage mode="edit" contentId={params.contentId ?? params.id} />;
};

// packages/plugin-poi/src/poi.detail-page.tsx
export const PoiDetailPage = ({ mode, contentId }: { readonly mode: 'create' | 'edit'; readonly contentId?: string }) => {
  const pt = usePluginTranslation('poi');
  const tabs = createPoiDetailTabDefinitions(pt);

  return (
    <StudioDetailPageTemplate
      title={mode === 'create' ? pt('detail.createTitle') : pt('detail.editTitle')}
      actions={<Button type="submit">{pt('actions.save')}</Button>}
    >
      <Tabs defaultValue="basis">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.title}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="basis">
          <PoiDetailBasisTab />
        </TabsContent>
        <TabsContent value="content">
          <PoiDetailContentTab />
        </TabsContent>
        <TabsContent value="settings">
          <PoiDetailSettingsTab />
        </TabsContent>
        <TabsContent value="history">
          <PoiDetailHistoryTab />
        </TabsContent>
      </Tabs>
    </StudioDetailPageTemplate>
  );
};
```

- [ ] **Step 5: Run the POI unit and type checks**

Run:

```bash
pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-page.test.tsx --testFiles=tests/poi.detail-form.test.ts --testFiles=tests/poi.pages.test.tsx
pnpm nx run plugin-poi:test:types
```

Expected:

```text
PASS  packages/plugin-poi/tests/poi.detail-page.test.tsx
PASS  packages/plugin-poi/tests/poi.detail-form.test.ts
PASS  packages/plugin-poi/tests/poi.pages.test.tsx
PASS  plugin-poi:test:types
```

- [ ] **Step 6: Commit the POI detail-page foundation**

```bash
git add packages/plugin-poi/src/poi.pages.tsx packages/plugin-poi/src/poi.detail-page.tsx packages/plugin-poi/src/poi.detail-form.ts packages/plugin-poi/src/poi.detail-tabs.tsx packages/plugin-poi/src/poi.detail-basis-tab.tsx packages/plugin-poi/src/poi.detail-content-tab.tsx packages/plugin-poi/src/poi.detail-settings-tab.tsx packages/plugin-poi/src/poi.detail-history-tab.tsx packages/plugin-poi/src/index.ts packages/plugin-poi/tests/poi.detail-page.test.tsx packages/plugin-poi/tests/poi.detail-form.test.ts packages/plugin-poi/tests/poi.pages.test.tsx
git commit -m "feat: add news-style poi detail page"
```

### Task 3: Align Events And POI Detail Interactions With The News Pattern

**Files:**
- Modify: `packages/plugin-events/src/events.detail-page.tsx`
- Modify: `packages/plugin-events/src/events.detail-basis-tab.tsx`
- Modify: `packages/plugin-events/src/events.detail-content-tab.tsx`
- Modify: `packages/plugin-events/src/events.detail-settings-tab.tsx`
- Modify: `packages/plugin-events/src/events.detail-history-tab.tsx`
- Modify: `packages/plugin-events/src/plugin.translations.ts`
- Modify: `packages/plugin-poi/src/poi.detail-page.tsx`
- Modify: `packages/plugin-poi/src/poi.detail-basis-tab.tsx`
- Modify: `packages/plugin-poi/src/poi.detail-content-tab.tsx`
- Modify: `packages/plugin-poi/src/poi.detail-settings-tab.tsx`
- Modify: `packages/plugin-poi/src/poi.detail-history-tab.tsx`
- Modify: `packages/plugin-poi/src/plugin.translations.ts`
- Test: `packages/plugin-events/tests/events.detail-page.test.tsx`
- Test: `packages/plugin-poi/tests/poi.detail-page.test.tsx`

- [ ] **Step 1: Extend the failing tests for header actions, summaries, and history placeholders**

```tsx
// packages/plugin-events/tests/events.detail-page.test.tsx
it('renders a global save action and a history placeholder for events', async () => {
  render(<EventsDetailPage mode="create" />);

  expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
  expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
});

// packages/plugin-poi/tests/poi.detail-page.test.tsx
it('renders a global save action and a history placeholder for poi', async () => {
  render(<PoiDetailPage mode="create" />);

  expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
  expect(screen.getByText('Noch keine Historie verfügbar.')).toBeTruthy();
});
```

- [ ] **Step 2: Run the interaction tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-events:test:unit --testFiles=tests/events.detail-page.test.tsx
pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-page.test.tsx
```

Expected:

```text
FAIL  packages/plugin-events/tests/events.detail-page.test.tsx
FAIL  packages/plugin-poi/tests/poi.detail-page.test.tsx
```

- [ ] **Step 3: Add global page actions, card descriptions, and consistent history placeholders**

```tsx
// packages/plugin-events/src/events.detail-history-tab.tsx
export const EventsDetailHistoryTab = () => (
  <StudioEmptyState title="Noch keine Historie verfügbar.">
    Historienereignisse fuer Events werden in einem spaeteren Schritt angebunden.
  </StudioEmptyState>
);

// packages/plugin-poi/src/poi.detail-history-tab.tsx
export const PoiDetailHistoryTab = () => (
  <StudioEmptyState title="Noch keine Historie verfügbar.">
    Historienereignisse fuer POI werden in einem spaeteren Schritt angebunden.
  </StudioEmptyState>
);

// packages/plugin-events/src/plugin.translations.ts
detailTabs: {
  basis: { title: 'Basis', description: 'Stammdaten und redaktionelle Kerndaten.' },
  content: { title: 'Inhalt', description: 'Termine, Orte, Kontakt und inhaltliche Daten.' },
  settings: { title: 'Einstellungen', description: 'Medien und sekundäre Konfigurationen.' },
  history: { title: 'Historie', description: 'Aenderungs- und Aktivitaetsverlauf.' },
},
```

- [ ] **Step 4: Run the full Events and POI unit slices**

Run:

```bash
pnpm nx run plugin-events:test:unit
pnpm nx run plugin-poi:test:unit
```

Expected:

```text
PASS  plugin-events:test:unit
PASS  plugin-poi:test:unit
```

- [ ] **Step 5: Commit the shared interaction alignment**

```bash
git add packages/plugin-events/src/events.detail-page.tsx packages/plugin-events/src/events.detail-basis-tab.tsx packages/plugin-events/src/events.detail-content-tab.tsx packages/plugin-events/src/events.detail-settings-tab.tsx packages/plugin-events/src/events.detail-history-tab.tsx packages/plugin-events/src/plugin.translations.ts packages/plugin-poi/src/poi.detail-page.tsx packages/plugin-poi/src/poi.detail-basis-tab.tsx packages/plugin-poi/src/poi.detail-content-tab.tsx packages/plugin-poi/src/poi.detail-settings-tab.tsx packages/plugin-poi/src/poi.detail-history-tab.tsx packages/plugin-poi/src/plugin.translations.ts packages/plugin-events/tests/events.detail-page.test.tsx packages/plugin-poi/tests/poi.detail-page.test.tsx
git commit -m "feat: align events and poi detail interactions with news"
```

### Task 4: Align Events And POI List Pages With The News-Level Overview Pattern

**Files:**
- Modify: `packages/plugin-events/src/events.pages.tsx`
- Modify: `packages/plugin-poi/src/poi.pages.tsx`
- Modify: `packages/plugin-events/tests/events.pages.test.tsx`
- Modify: `packages/plugin-poi/tests/poi.pages.test.tsx`

- [ ] **Step 1: Write the failing list-page tests for overview consistency**

```tsx
// packages/plugin-events/tests/events.pages.test.tsx
it('renders the create action and overview states in the news-style layout', async () => {
  render(<EventsListPage />);

  expect(screen.getByRole('link', { name: 'Anlegen' })).toBeTruthy();
  expect(screen.getByText('Events')).toBeTruthy();
});

// packages/plugin-poi/tests/poi.pages.test.tsx
it('renders the create action and overview states in the news-style layout', async () => {
  render(<PoiListPage />);

  expect(screen.getByRole('link', { name: 'Anlegen' })).toBeTruthy();
  expect(screen.getByText('POI')).toBeTruthy();
});
```

- [ ] **Step 2: Run the focused list-page tests and confirm they fail**

Run:

```bash
pnpm nx run plugin-events:test:unit --testFiles=tests/events.pages.test.tsx
pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.pages.test.tsx
```

Expected:

```text
FAIL  packages/plugin-events/tests/events.pages.test.tsx
FAIL  packages/plugin-poi/tests/poi.pages.test.tsx
```

- [ ] **Step 3: Normalize page copy, primary actions, and pagination presentation**

```tsx
// packages/plugin-events/src/events.pages.tsx
<StudioOverviewPageTemplate
  title={pt('list.title')}
  description={pt('list.description')}
  primaryAction={
    <Button asChild>
      <Link to="/admin/events/new">{pt('actions.create')}</Link>
    </Button>
  }
>
  {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
  {error ? <StudioErrorState>{error}</StudioErrorState> : null}
  {!loading && !error && result.data.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
</StudioOverviewPageTemplate>

// packages/plugin-poi/src/poi.pages.tsx
<StudioOverviewPageTemplate
  title={pt('list.title')}
  description={pt('list.description')}
  primaryAction={
    <Button asChild>
      <Link to="/admin/poi/new">{pt('actions.create')}</Link>
    </Button>
  }
>
  {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
  {error ? <StudioErrorState>{error}</StudioErrorState> : null}
  {!loading && !error && result.data.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
</StudioOverviewPageTemplate>
```

- [ ] **Step 4: Run the full plugin unit suites after list alignment**

Run:

```bash
pnpm nx run plugin-events:test:unit
pnpm nx run plugin-poi:test:unit
```

Expected:

```text
PASS  plugin-events:test:unit
PASS  plugin-poi:test:unit
```

- [ ] **Step 5: Commit the list-page alignment**

```bash
git add packages/plugin-events/src/events.pages.tsx packages/plugin-poi/src/poi.pages.tsx packages/plugin-events/tests/events.pages.test.tsx packages/plugin-poi/tests/poi.pages.test.tsx
git commit -m "feat: align events and poi overview pages with news"
```

### Task 5: Update E2E Coverage And Documentation

**Files:**
- Modify: `apps/sva-studio-react/e2e/events-poi-plugin.spec.ts`
- Modify: `docs/architecture/05-building-block-view.md`
- Modify: `docs/architecture/06-runtime-view.md`

- [ ] **Step 1: Extend the failing E2E spec to cover the fixed tab structure**

```ts
// apps/sva-studio-react/e2e/events-poi-plugin.spec.ts
test('events editor uses the shared tab structure', async ({ page }) => {
  await page.goto('/admin/events/new');

  await expect(page.getByRole('tab', { name: 'Basis' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Inhalt' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Einstellungen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Historie' })).toBeVisible();
});

test('poi editor uses the shared tab structure', async ({ page }) => {
  await page.goto('/admin/poi/new');

  await expect(page.getByRole('tab', { name: 'Basis' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Inhalt' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Einstellungen' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Historie' })).toBeVisible();
});
```

- [ ] **Step 2: Run the targeted E2E spec and confirm the new assertions fail first**

Run:

```bash
pnpm nx run sva-studio-react:test:e2e --testFiles=apps/sva-studio-react/e2e/events-poi-plugin.spec.ts
```

Expected:

```text
FAIL  apps/sva-studio-react/e2e/events-poi-plugin.spec.ts
```

- [ ] **Step 3: Update architecture docs to describe the shared content-detail pattern**

```md
<!-- docs/architecture/05-building-block-view.md -->
- Die Plugins `News`, `Events` und `POI` verwenden fuer redaktionelle Detailseiten ein gemeinsames Seitenmuster:
  feste Tabs `Basis`, `Inhalt`, `Einstellungen`, `Historie`, globale Seitenaktionen und plugin-spezifische Cards innerhalb der Tabs.

<!-- docs/architecture/06-runtime-view.md -->
- Beim Bearbeiten redaktioneller Inhalte liefert der Host eine einheitliche Detailseiten-Orchestrierung.
- Die Plugins mappen ihre eigenen Fachmodelle in diese UI-Struktur, ohne den Mainserver-Vertrag zu veraendern.
```

- [ ] **Step 4: Run the smallest relevant final gate**

Run:

```bash
pnpm nx run plugin-events:test:unit
pnpm nx run plugin-poi:test:unit
pnpm nx run sva-studio-react:test:e2e --testFiles=apps/sva-studio-react/e2e/events-poi-plugin.spec.ts
pnpm nx affected --target=test:unit --base=origin/main
```

Expected:

```text
PASS  plugin-events:test:unit
PASS  plugin-poi:test:unit
PASS  apps/sva-studio-react/e2e/events-poi-plugin.spec.ts
PASS  nx affected --target=test:unit --base=origin/main
```

- [ ] **Step 5: Commit the verification and documentation updates**

```bash
git add apps/sva-studio-react/e2e/events-poi-plugin.spec.ts docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md
git commit -m "test: cover unified events and poi editor tabs"
```
