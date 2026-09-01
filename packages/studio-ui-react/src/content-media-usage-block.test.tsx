import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ContentMediaUsageBlock,
  type ContentMediaUsageBlockLabels,
} from './content-media-usage-block.js';
import { createManualContentMediaUsage, type ContentMediaUsage } from './content-media-usage.js';

const labels: ContentMediaUsageBlockLabels = {
  title: 'Bilder',
  description: 'Bilder verwalten',
  empty: 'Keine Bilder',
  actions: {
    add: 'Medium hinzufügen',
    remove: 'Entfernen',
    moveUp: 'Hoch',
    moveDown: 'Runter',
    refreshMetadata: 'Aktualisieren',
    cancel: 'Abbrechen',
    apply: 'Übernehmen',
  },
  fields: {
    url: 'URL',
    altText: 'Alternativtext',
    caption: 'Bildunterschrift',
    credit: 'Urheber',
    license: 'Lizenz',
  },
  states: {
    linked: 'Verknüpft',
    manual: 'Manuell',
    synced: 'Synchron',
    pending: 'Ausstehend',
    missing: 'Fehlt',
    additional: 'Zusätzlich',
    unresolved: 'Nicht auflösbar',
    failed: 'Aktualisierung fehlgeschlagen',
    previewUnavailable: 'Keine Vorschau',
  },
  announcements: { moved: 'Position {{position}} von {{total}}', removed: 'Entfernt' },
  urlFeedback: {
    upgradedToHttps: 'URL wurde auf HTTPS aktualisiert.',
    insecureHttp: 'Unsichere HTTP-URL; das Bild kann blockiert werden.',
    httpsUnavailable: 'Keine funktionierende HTTPS-Version gefunden.',
    invalid: 'Die Bild-URL ist ungültig.',
  },
  refresh: {
    title: 'Metadaten aktualisieren',
    description: 'Felder wählen',
    assetValue: 'Asset',
    contentValue: 'Inhalt',
  },
};

const linked = (overrides: Partial<ContentMediaUsage> = {}): ContentMediaUsage => ({
  uiId: 'one',
  assetId: 'asset-1',
  persistentUrl: 'https://cdn.example.test/one.jpg',
  previewUrl: 'https://preview.example.test/one.jpg',
  altText: 'Alt',
  caption: 'Redaktionell geändert',
  credit: 'Stadt',
  license: 'CC',
  role: 'gallery_item',
  sortOrder: 0,
  assetSnapshot: {
    persistentUrl: 'https://cdn.example.test/one.jpg',
    altText: 'Alt',
    caption: 'Ursprünglich',
    credit: 'Stadt',
    license: 'CC',
  },
  referenceStatus: 'synced',
  ...overrides,
});

const Harness = ({
  initial = [],
  load = vi.fn(),
}: {
  initial?: readonly ContentMediaUsage[];
  load?: (usage: ContentMediaUsage) => Promise<ContentMediaUsage['assetSnapshot']>;
}) => {
  const [usages, setUsages] = React.useState(initial);
  return (
    <ContentMediaUsageBlock
      usages={usages}
      onChange={setUsages}
      onAddManual={() =>
        setUsages((current) => [
          ...current,
          createManualContentMediaUsage({ sortOrder: current.length }),
        ])
      }
      onOpenLibrary={vi.fn()}
      onOpenUpload={vi.fn()}
      onLoadAssetSnapshot={
        load as NonNullable<
          React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot']
        >
      }
      labels={labels}
      supportedFields={{ altText: true, caption: true, credit: true, license: true }}
    />
  );
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ContentMediaUsageBlock', () => {
  it('upgrades explicit HTTP after the HTTPS image candidate loads', async () => {
    const OriginalImage = globalThis.Image;
    class SuccessfulImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', SuccessfulImage);

    render(
      <Harness
        initial={[
          linked({
            assetId: undefined,
            persistentUrl: 'http://cdn.example.test/image.jpg',
            previewUrl: '',
          }),
        ]}
      />
    );
    fireEvent.blur(screen.getByLabelText('URL'));

    await waitFor(() =>
      expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe(
        'https://cdn.example.test/image.jpg'
      )
    );
    expect(screen.getByText('URL wurde auf HTTPS aktualisiert.')).toBeTruthy();
    vi.stubGlobal('Image', OriginalImage);
  });

  it('keeps explicit HTTP after a failed HTTPS probe and shows a non-blocking warning', async () => {
    const OriginalImage = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage);

    render(
      <Harness
        initial={[
          linked({
            assetId: undefined,
            persistentUrl: ' http://cdn.example.test/image.jpg ',
            previewUrl: '',
          }),
        ]}
      />
    );
    fireEvent.blur(screen.getByLabelText('URL'));

    await waitFor(() =>
      expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe(
        'http://cdn.example.test/image.jpg'
      )
    );
    expect(screen.getByText('Unsichere HTTP-URL; das Bild kann blockiert werden.')).toBeTruthy();
    expect(screen.queryByText('Keine funktionierende HTTPS-Version gefunden.')).toBeNull();
    vi.stubGlobal('Image', OriginalImage);
  });

  it('warns for an already stored HTTP URL without blocking the field', () => {
    render(
      <ContentMediaUsageBlock
        usages={[linked({ assetId: undefined, persistentUrl: 'http://example.org/image.jpg' })]}
        onChange={vi.fn()}
        onAddManual={vi.fn()}
        labels={labels}
      />
    );

    expect(screen.getByRole('status').textContent).toBe(labels.urlFeedback.insecureHttp);
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBeNull();
  });

  it('does not downgrade a protocol-free URL when its HTTPS probe fails', async () => {
    const OriginalImage = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage);

    render(
      <Harness
        initial={[
          linked({
            assetId: undefined,
            persistentUrl: 'cdn.example.test/image.jpg',
            previewUrl: '',
          }),
        ]}
      />
    );
    fireEvent.blur(screen.getByLabelText('URL'));

    expect(await screen.findByText('Keine funktionierende HTTPS-Version gefunden.')).toBeTruthy();
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe(
      'cdn.example.test/image.jpg'
    );
    expect(screen.queryByText('Unsichere HTTP-URL; das Bild kann blockiert werden.')).toBeNull();
    vi.stubGlobal('Image', OriginalImage);
  });

  it('ignores an outdated HTTPS probe after the user enters a newer URL', async () => {
    const pendingImages: Array<{
      onload: (() => void) | null;
      onerror: (() => void) | null;
      src: string;
    }> = [];
    class DeferredImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = '';
      constructor() {
        pendingImages.push(this);
      }
    }
    vi.stubGlobal('Image', DeferredImage);

    render(
      <Harness
        initial={[
          linked({
            assetId: undefined,
            persistentUrl: 'http://old.example.test/image.jpg',
            previewUrl: '',
          }),
        ]}
      />
    );
    const input = screen.getByLabelText('URL');
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: 'http://new.example.test/image.jpg' } });
    fireEvent.blur(input);

    pendingImages[1]?.onerror?.();
    await screen.findByText('Unsichere HTTP-URL; das Bild kann blockiert werden.');
    pendingImages[0]?.onload?.();

    await waitFor(() =>
      expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe(
        'http://new.example.test/image.jpg'
      )
    );
  });

  it('exposes one primary add action that opens the upload flow', () => {
    const onOpenUpload = vi.fn();
    render(
      <ContentMediaUsageBlock
        usages={[]}
        onChange={vi.fn()}
        onAddManual={vi.fn()}
        onOpenLibrary={vi.fn()}
        onOpenUpload={onOpenUpload}
        labels={labels}
      />
    );
    expect(screen.getByText('Keine Bilder')).toBeTruthy();
    const action = screen.getByRole('button', { name: 'Medium hinzufügen' });
    fireEvent.click(action);
    expect(onOpenUpload).toHaveBeenCalledOnce();
  });

  it('disables media editing while a content save operation is running', () => {
    render(
      <ContentMediaUsageBlock
        usages={[linked()]}
        onChange={vi.fn()}
        onAddManual={vi.fn()}
        onOpenUpload={vi.fn()}
        labels={labels}
        disabled
      />
    );

    const addButton = screen.getByRole('button', { name: 'Medium hinzufügen' });
    const fieldset = addButton.closest('fieldset') as HTMLFieldSetElement | null;
    expect(fieldset?.getAttribute('aria-busy')).toBe('true');
    expect(fieldset?.disabled).toBe(true);
  });

  it('reorders and removes by stable UI identity while announcing and restoring focus', async () => {
    render(
      <Harness
        initial={[
          linked(),
          linked({
            uiId: 'two',
            assetId: 'asset-2',
            sortOrder: 1,
            persistentUrl: 'https://cdn.example.test/two.jpg',
          }),
        ]}
      />
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Hoch' })[1]!);
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('content-media-two-remove'))
    );
    expect(screen.getByText('Position 1 von 2')).toBeTruthy();
    fireEvent.click(document.getElementById('content-media-two-remove')!);
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('content-media-one-remove'))
    );
    expect(screen.getByText('Entfernt')).toBeTruthy();
  });

  it('revokes local previews exactly once when they are removed', () => {
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    render(
      <Harness
        initial={[
          linked({
            assetId: undefined,
            localDraft: {
              id: 'draft-remove',
              file: new File(['image'], 'draft.jpg', { type: 'image/jpeg' }),
            },
            previewUrl: 'blob:usage-remove',
            persistentUrl: '',
          }),
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));

    expect(revokeObjectUrl).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:usage-remove');
    revokeObjectUrl.mockRestore();
  });

  it('keeps editorial overrides unselected and applies only explicitly selected asset metadata', async () => {
    const load = vi.fn(async () => ({
      persistentUrl: 'https://cdn.example.test/new.jpg',
      altText: 'Neu',
      caption: 'Asset neu',
      credit: 'Neu',
      license: 'CC-BY',
    }));
    render(<Harness initial={[linked()]} load={load} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[2]?.checked).toBe(false);
    fireEvent.click(checkboxes[2]!);
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect((screen.getByLabelText('Bildunterschrift') as HTMLInputElement).value).toBe('Asset neu');
  });

  it('shows an accessible error when refreshing metadata fails', async () => {
    render(
      <Harness
        initial={[linked()]}
        load={vi.fn(async () => {
          throw new Error('failed');
        })}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Aktualisierung fehlgeschlagen');
  });

  it('shows reference mismatches for usages without an asset id', () => {
    render(<Harness initial={[linked({ assetId: undefined, referenceStatus: 'missing' })]} />);

    expect(screen.getByText('Manuell')).toBeTruthy();
    expect(screen.getByText('Fehlt')).toBeTruthy();
  });

  it.each(['failed', 'unresolved', 'additional', 'pending'] as const)(
    'renders the %s reference state',
    (referenceStatus) => {
      render(
        <Harness initial={[linked({ referenceStatus, previewUrl: '', persistentUrl: '' })]} />
      );
      expect(screen.getByText(labels.states[referenceStatus])).toBeTruthy();
      expect(screen.getByText('Keine Vorschau')).toBeTruthy();
    }
  );

  it('covers the compact block, downward movement, final removal and additional fields', async () => {
    const onChange = vi.fn();
    const onAddManual = vi.fn();
    const usages = [linked(), linked({ uiId: 'two', assetId: undefined, sortOrder: 1 })];
    const view = render(
      <ContentMediaUsageBlock
        usages={usages}
        onChange={onChange}
        onAddManual={onAddManual}
        labels={labels}
        showHeader={false}
        errors={{ 'one.persistentUrl': 'Ungültig' }}
        supportedFields={{ altText: false, caption: false, credit: false, license: false }}
        renderAdditionalFields={({ usage }) => <span>Zusatz {usage.uiId}</span>}
      />
    );
    expect(screen.getByLabelText('Bilder')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Medium hinzufügen' })).toBeTruthy();
    expect(screen.queryByText('Ungültig')).toBeNull();
    expect(screen.getAllByLabelText('URL')[0]?.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('Zusatz one')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Runter' })[0]!);
    expect(onChange).toHaveBeenCalled();
    view.rerender(
      <ContentMediaUsageBlock
        usages={[linked()]}
        onChange={onChange}
        onAddManual={onAddManual}
        labels={labels}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(document.getElementById('content-media-add'))
    );
  });
});
