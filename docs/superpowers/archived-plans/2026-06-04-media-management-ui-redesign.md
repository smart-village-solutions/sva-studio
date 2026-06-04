# Media Management UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Die Medienverwaltung als bibliotheksgeführte Oberfläche mit kompaktem Prioritäts-Shelf, visuellem Asset-Grid, verdichtetem Upload-Einstieg und integriertem Asset-Workspace umsetzen.

**Architecture:** Die bestehenden Medienrouten und Hooks bleiben erhalten, aber die monolithische Route `-media-page.tsx` wird in fokussierte UI-Bausteine zerlegt. Die Bibliothek wird über kleine View-Model-Helfer mit Kartenstatus und Prioritätszählungen angereichert, während die bisherige Usage-Seite in die Detailseite zurückgefaltet wird. Neue API-Endpunkte sind nicht das Ziel; kleine Vertragsanpassungen sind nur zulässig, wenn ein Shelf- oder Kartenstatus aus dem heutigen Vertrag nicht sauber ableitbar ist.

**Tech Stack:** React, TanStack Router, TypeScript strict mode, shadcn/ui, Nx, Vitest, Testing Library

**Archivstatus:** Inhaltlich umgesetzt über die Commits `ed7cf1e2`, `6826d77d`, `96fc46b0`, `cf2ddfc6`, `30e34312` und `4e820355`; Checkboxen wurden für die Archivierung auf den tatsächlichen Stand nachgezogen.

---

## File Structure Map

### Bestehende Einstiegspunkte

- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-usage-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-usage-page.test.tsx`
- Modify: `apps/sva-studio-react/src/hooks/use-media.ts`

### Neue Bibliotheksbausteine

- Create: `apps/sva-studio-react/src/routes/admin/media/-media-ui.shared.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-priority-shelf.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-toolbar.tsx`

### Neue Upload- und Detailbausteine

- Create: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-workspace-header.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-metadata-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-image-controls-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-usage-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-technical-section.tsx`

### Tests und Texte

- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.test.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/hooks/use-media.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

## Task 1: Medienroute in fokussierte UI-Bausteine aufteilen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-ui.shared.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx`

- [x] **Step 1: Route-Switching-Tests zuerst auf die neue Seitentrennung festziehen**

Ergänze `apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx` so, dass die Hauptroute nur noch den Modus-Switch prüft und nicht mehr alle UI-Details enthält:

```tsx
it('renders the library page on /admin/media', () => {
  useLocationMock.mockReturnValue({ pathname: '/admin/media' });
  useParamsMock.mockReturnValue({});

  render(<MediaPage />);

  expect(screen.getByTestId('media-library-page')).toBeTruthy();
});

it('renders the create page on /admin/media/new', () => {
  useLocationMock.mockReturnValue({ pathname: '/admin/media/new' });
  useParamsMock.mockReturnValue({});

  render(<MediaPage />);

  expect(screen.getByTestId('media-create-page')).toBeTruthy();
});

it('renders the detail page on /admin/media/asset-2', () => {
  useLocationMock.mockReturnValue({ pathname: '/admin/media/asset-2' });
  useParamsMock.mockReturnValue({ mediaId: 'asset-2' });

  render(<MediaPage />);

  expect(screen.getByTestId('media-detail-page')).toBeTruthy();
});
```

- [x] **Step 2: Den schmalen Routen-Test rot ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/media/-media-page.test.tsx
```

Expected: FAIL, weil die neuen Test-IDs und separaten Seitenkomponenten noch nicht existieren.

- [x] **Step 3: Die Route auf drei fokussierte Seitenkomponenten reduzieren**

Lege die neuen Dateien an und schrumpfe `-media-page.tsx` auf reines Routing:

```tsx
// apps/sva-studio-react/src/routes/admin/media/-media-page.tsx
import { useLocation, useParams } from '@tanstack/react-router';

import { MediaCreatePage } from './-media-create-page.js';
import { MediaDetailPage } from './-media-detail-page.js';
import { MediaLibraryPage } from './-media-library-page.js';

export const MediaPage = () => {
  const location = useLocation();
  const params = useParams({ strict: false });
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : null;

  if (mediaId) {
    return <MediaDetailPage assetId={mediaId} />;
  }

  if (location.pathname.endsWith('/new')) {
    return <MediaCreatePage />;
  }

  return <MediaLibraryPage />;
};
```

```tsx
// apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx
export const MediaLibraryPage = () => <section data-testid="media-library-page" />;

// apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx
export const MediaCreatePage = () => <section data-testid="media-create-page" />;

// apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx
export const MediaDetailPage = ({ assetId }: Readonly<{ assetId: string }>) => (
  <section data-testid="media-detail-page" data-asset-id={assetId} />
);
```

- [x] **Step 4: Den Routen-Test wiederholen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/media/-media-page.test.tsx
```

Expected: PASS

- [x] **Step 5: Den Seitensplit committen**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx
git commit -m "refactor: split media route into library create and detail pages"
```

## Task 2: Bibliotheksseite auf Intake-Shelf, Prioritäts-Shelf und Asset-Grid umbauen

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-priority-shelf.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-toolbar.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Bibliotheks-Tests für Shelf und Kartenzustände zuerst schreiben**

Lege `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx` mit diesen Kernerwartungen an:

```tsx
it('renders a compact intake shelf and the priority shelf above the asset grid', () => {
  render(<MediaLibraryPage />);

  expect(screen.getByRole('heading', { name: 'Medienbibliothek' })).toBeTruthy();
  expect(screen.getByText('Quick Intake')).toBeTruthy();
  expect(screen.getByText('Blockiert')).toBeTruthy();
  expect(screen.getByText('Neu')).toBeTruthy();
  expect(screen.getByText('Ungenutzt')).toBeTruthy();
});

it('renders asset cards instead of the raw table and surfaces usage and status hints', () => {
  render(<MediaLibraryPage />);

  expect(screen.getByText('Stadtfest 2024 - Hauptbühne')).toBeTruthy();
  expect(screen.getByText('3 Verwendungen')).toBeTruthy();
  expect(screen.getByText('bereit')).toBeTruthy();
});

it('renders non-image assets with a dedicated fallback card pattern', () => {
  render(<MediaLibraryPage />);

  expect(screen.getByText('Veranstaltungsflyer 2024')).toBeTruthy();
  expect(screen.getByText('PDF')).toBeTruthy();
});
```

- [x] **Step 2: Den Bibliotheks-UI-Test rot ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-library-page.test.tsx
```

Expected: FAIL, weil `MediaLibraryPage` aktuell noch kein Shelf oder Kartenmodell enthält.

- [x] **Step 3: Ein kleines Bibliotheks-View-Model für Kartenstatus und Prioritätszählungen einführen**

Implementiere in `-media-library-view-model.ts` nur die Ableitungen, die die UI braucht:

```ts
import type { IamMediaAsset } from '../../../lib/iam-api.js';

export type MediaLibraryCardState = 'ready' | 'new' | 'blocked' | 'unused';

export const resolveMediaCardState = (
  asset: IamMediaAsset,
  referenceCount: number
): MediaLibraryCardState => {
  if (asset.processingStatus === 'failed' || asset.uploadStatus === 'failed' || asset.uploadStatus === 'blocked') {
    return 'blocked';
  }
  if (referenceCount === 0) {
    return 'unused';
  }
  if (!asset.metadata.title?.trim() || !asset.metadata.altText?.trim()) {
    return 'new';
  }
  return 'ready';
};

export const countMediaPriorityBuckets = (
  assets: readonly IamMediaAsset[],
  usageByAssetId: Readonly<Record<string, number>>
) => ({
  blocked: assets.filter((asset) => resolveMediaCardState(asset, usageByAssetId[asset.id] ?? 0) === 'blocked').length,
  newItems: assets.filter((asset) => resolveMediaCardState(asset, usageByAssetId[asset.id] ?? 0) === 'new').length,
  unused: assets.filter((asset) => resolveMediaCardState(asset, usageByAssetId[asset.id] ?? 0) === 'unused').length,
});
```

- [x] **Step 4: Bibliothek als Library-first Oberfläche implementieren**

Baue `-media-library-page.tsx` auf Shelf + Grid um und nutze `useMediaLibrary()` weiter:

```tsx
return (
  <section data-testid="media-library-page" className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{t('media.page.title')}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t('media.page.subtitle')}</p>
      </div>
      <Button asChild>
        <Link to="/admin/media/new">{t('media.actions.create')}</Link>
      </Button>
    </header>

    <MediaIntakeShelf />
    <MediaPriorityShelf blocked={3} newItems={5} unused={18} />
    <MediaLibraryToolbar />
    <MediaAssetGrid assets={mediaApi.assets} />
  </section>
);
```

Nutze in `-media-asset-card.tsx` ein typgerechtes Kartenmuster:

```tsx
<article className="overflow-hidden rounded-2xl border bg-card">
  <div className="aspect-[4/3] bg-muted">{preview}</div>
  <div className="grid gap-3 p-4">
    <div className="flex items-start justify-between gap-3">
      <h3 className="font-semibold text-foreground">{label}</h3>
      <Badge variant={state === 'blocked' ? 'destructive' : state === 'new' ? 'secondary' : 'outline'}>
        {t(`media.library.cardStates.${state}`)}
      </Badge>
    </div>
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <Badge variant="outline">{asset.mimeType.split('/')[1]?.toUpperCase() ?? asset.mimeType}</Badge>
      <span>{formatByteSize(asset.byteSize)}</span>
      <span>{t('media.library.usageCount', { count: referenceCount })}</span>
    </div>
  </div>
</article>
```

- [x] **Step 5: Bibliotheks-UI-Test und Typecheck wiederholen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-library-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: PASS

- [x] **Step 6: Den Bibliotheks-Slice committen**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-library-view-model.ts \
  apps/sva-studio-react/src/routes/admin/media/-media-intake-shelf.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-priority-shelf.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-asset-grid.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-asset-card.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-library-toolbar.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-library-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: redesign media library as asset grid"
```

## Task 3: Upload-Seite als kompakte Vorbereitungsseite neu aufbauen

**Files:**
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Upload-Seiten-Test für kompakten Intake und Nächste-Schritte-Zustand schreiben**

Lege `-media-create-page.test.tsx` mit diesen Erwartungen an:

```tsx
it('renders a compact intake page instead of a raw upload form', () => {
  render(<MediaCreatePage />);

  expect(screen.getByRole('heading', { name: 'Datei vorbereiten' })).toBeTruthy();
  expect(screen.getByText('Was jetzt konfiguriert wird')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Upload initialisieren' })).toBeTruthy();
});

it('renders the next-step panel after successful initialization', async () => {
  render(<MediaCreatePage />);

  fireEvent.submit(screen.getByRole('button', { name: 'Upload initialisieren' }).closest('form') as HTMLFormElement);

  await waitFor(() => {
    expect(screen.getByText('Nächste Schritte')).toBeTruthy();
    expect(screen.getByText('Asset-ID: asset-1')).toBeTruthy();
  });
});
```

- [x] **Step 2: Den Upload-UI-Test rot ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-create-page.test.tsx
```

Expected: FAIL, weil die neue IA und Texte noch nicht existieren.

- [x] **Step 3: Die Upload-Seite als dreiteilige Vorbereitungsseite implementieren**

Strukturiere `-media-create-page.tsx` so:

```tsx
return (
  <section data-testid="media-create-page" className="space-y-6">
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold text-foreground">{t('media.create.title')}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">{t('media.create.subtitle')}</p>
    </header>

    <Card>
      <CardHeader>
        <CardTitle>{t('media.create.intakeTitle')}</CardTitle>
        <CardDescription>{t('media.create.intakeDescription')}</CardDescription>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>

    {result ? (
      <Card>
        <CardHeader>
          <CardTitle>{t('media.create.nextStepsTitle')}</CardTitle>
          <CardDescription>{t('media.create.nextStepsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">{resultPanel}</CardContent>
      </Card>
    ) : null}
  </section>
);
```

- [x] **Step 4: Upload-Test und Typecheck wiederholen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-create-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: PASS

- [x] **Step 5: Den Upload-Slice committen**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-create-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-create-page.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: redesign media upload preparation page"
```

## Task 4: Detailseite zum Asset-Workspace machen und Usage integrieren

**Files:**
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-workspace-header.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-metadata-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-image-controls-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-usage-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-technical-section.tsx`
- Create: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.test.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-usage-page.tsx`
- Modify: `apps/sva-studio-react/src/routes/admin/media/-media-usage-page.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`

- [x] **Step 1: Detail-Test für Workspace-Kopf und integrierte Nutzung schreiben**

Lege `-media-detail-page.test.tsx` mit diesen Kernfällen an:

```tsx
it('renders the asset workspace header with preview-independent status and action context', () => {
  render(<MediaDetailPage assetId="asset-2" />);

  expect(screen.getByRole('heading', { name: 'Detail Asset' })).toBeTruthy();
  expect(screen.getByText('1 Verwendung')).toBeTruthy();
  expect(screen.getByText('protected')).toBeTruthy();
});

it('renders usage information inside the detail workspace instead of requiring a separate usage screen', () => {
  render(<MediaDetailPage assetId="asset-2" />);

  expect(screen.getByText('news')).toBeTruthy();
  expect(screen.getByText('Teaserbild')).toBeTruthy();
});
```

- [x] **Step 2: Den Detail-UI-Test rot ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-detail-page.test.tsx
```

Expected: FAIL, weil die Detailseite heute noch als lange Formularfläche organisiert ist.

- [x] **Step 3: Detailseite in Workspace-Kopf, Metadaten-, Bild- und Techniksektionen schneiden**

Implementiere `-media-detail-page.tsx` als Komposition:

```tsx
return (
  <section data-testid="media-detail-page" className="space-y-6">
    <MediaDetailWorkspaceHeader
      asset={mediaApi.asset}
      usageCount={mediaApi.usage?.totalReferences ?? 0}
      delivery={mediaApi.delivery}
      onResolveDelivery={() => void handleResolveDelivery()}
      onDelete={() => void handleDelete()}
    />

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <MediaDetailMetadataSection {...metadataProps} />
        <MediaDetailImageControlsSection {...imageProps} />
      </div>
      <div className="space-y-6">
        <MediaDetailUsageSection usage={mediaApi.usage} />
        <MediaDetailTechnicalSection asset={mediaApi.asset} delivery={mediaApi.delivery} />
      </div>
    </div>
  </section>
);
```

`-media-usage-page.tsx` soll nur noch entweder auf die Detailseite verweisen oder intern denselben `MediaDetailUsageSection`-Baustein nutzen:

```tsx
export const MediaUsagePage = () => {
  const params = useParams({ strict: false });
  const mediaId = typeof params.mediaId === 'string' ? params.mediaId : null;

  return mediaId ? <MediaDetailPage assetId={mediaId} /> : null;
};
```

- [x] **Step 4: Detail- und Usage-Tests wiederholen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-detail-page.test.tsx --testFiles=src/routes/admin/media/-media-usage-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: PASS

- [x] **Step 5: Den Detail-Slice committen**

```bash
git add apps/sva-studio-react/src/routes/admin/media/-media-detail-workspace-header.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-metadata-section.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-image-controls-section.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-usage-section.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-technical-section.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-usage-page.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-usage-page.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts
git commit -m "feat: redesign media detail page as asset workspace"
```

## Task 5: View-Model- und Hook-Ränder absichern, Texte finalisieren und Gates fahren

**Files:**
- Modify: `apps/sva-studio-react/src/hooks/use-media.ts`
- Modify: `apps/sva-studio-react/src/hooks/use-media.test.tsx`
- Modify: `apps/sva-studio-react/src/i18n/resources.ts`
- Verify: `apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx`
- Verify: `apps/sva-studio-react/src/routes/admin/media/-media-create-page.test.tsx`
- Verify: `apps/sva-studio-react/src/routes/admin/media/-media-detail-page.test.tsx`
- Verify: `apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx`

- [x] **Step 1: Kleine Hook- oder Mapping-Tests für Shelf-Zählungen und Fehlerpfade ergänzen**

Erweitere `use-media.test.tsx` oder neue kleine Mappings so, dass diese Fälle explizit abgesichert sind:

```tsx
it('keeps media detail usage and delivery available for the asset workspace', async () => {
  const { result } = renderHook(() => useMediaDetail('asset-2'), { wrapper });

  await waitFor(() => {
    expect(result.current.usage?.totalReferences).toBe(1);
    expect(result.current.delivery).toBeNull();
  });
});
```

```ts
it('classifies failed or blocked assets as blocked library cards', () => {
  expect(resolveMediaCardState(assetWithFailedProcessing, 0)).toBe('blocked');
});
```

- [x] **Step 2: Den fokussierten Hook- und UI-Gate-Pfad ausführen**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:hooks --testFiles=src/hooks/use-media.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/routes/admin/media/-media-library-page.test.tsx --testFiles=src/routes/admin/media/-media-create-page.test.tsx --testFiles=src/routes/admin/media/-media-detail-page.test.tsx
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/admin/media/-media-page.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: PASS

- [x] **Step 3: Den kleinsten echten affected-Gate-Pfad vor Abschluss laufen lassen**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
pnpm nx affected --target=test:types --base=origin/main
```

Expected: PASS

- [x] **Step 4: Finale UI- und Testanpassungen committen**

```bash
git add apps/sva-studio-react/src/hooks/use-media.ts \
  apps/sva-studio-react/src/hooks/use-media.test.tsx \
  apps/sva-studio-react/src/i18n/resources.ts \
  apps/sva-studio-react/src/routes/admin/media/-media-library-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-create-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-detail-page.test.tsx \
  apps/sva-studio-react/src/routes/admin/media/-media-page.test.tsx
git commit -m "test: harden media management ui redesign"
```

## Spec Coverage Self-Check

- Bibliothek zuerst: Task 2 baut die Hauptseite auf Intake-Shelf, Prioritäts-Shelf und Asset-Grid um.
- Verdichteter Upload-Einstieg: Task 3 reduziert die Upload-Seite auf Intake + Ergebnis + nächste Schritte.
- Asset-Workspace: Task 4 schneidet die Detailseite in Kopf, Metadaten, Bildsteuerung, Nutzung und Technik.
- Usage-Integration: Task 4 faltet die bisherige Usage-Seite in den Detail-Workspace zurück.
- Nicht-Bild-Medien: Task 2 fordert ein gleichwertiges Kartenmuster für Dokumente und Videos.
- Fehler-, Leer- und Ladefälle: Task 2 bis Task 5 decken Bibliothek, Upload und Detailseite in UI- und Hook-Tests ab.

## Plan-Selbstcheck

- Keine Platzhalter wie `TODO`, `später` oder `geeignete Tests`.
- Jede UI-Änderung ist an konkrete Dateien und Testziele gebunden.
- Die Reihenfolge liefert nach jedem Slice eine lesbare, testbare Medienoberfläche.
