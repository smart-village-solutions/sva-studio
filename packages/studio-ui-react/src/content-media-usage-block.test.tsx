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

afterEach(cleanup);

describe('ContentMediaUsageBlock', () => {
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
    expect(screen.getByText('Ungültig')).toBeTruthy();
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
