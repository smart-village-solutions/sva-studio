import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContentMediaUsageBlock, type ContentMediaUsageBlockLabels } from './content-media-usage-block.js';
import { createManualContentMediaUsage, type ContentMediaUsage } from './content-media-usage.js';

const labels: ContentMediaUsageBlockLabels = {
  title: 'Bilder', description: 'Bilder verwalten', empty: 'Keine Bilder',
  actions: { library: 'Mediathek', upload: 'Upload', manual: 'Manuell', remove: 'Entfernen', moveUp: 'Hoch', moveDown: 'Runter', refreshMetadata: 'Aktualisieren', cancel: 'Abbrechen', apply: 'Übernehmen' },
  fields: { url: 'URL', altText: 'Alternativtext', caption: 'Bildunterschrift', credit: 'Urheber', license: 'Lizenz' },
  states: { linked: 'Verknüpft', manual: 'Manuell', synced: 'Synchron', pending: 'Ausstehend', missing: 'Fehlt', additional: 'Zusätzlich', unresolved: 'Nicht auflösbar', failed: 'Aktualisierung fehlgeschlagen', previewUnavailable: 'Keine Vorschau' },
  announcements: { moved: 'Position {{position}} von {{total}}', removed: 'Entfernt' },
  refresh: { title: 'Metadaten aktualisieren', description: 'Felder wählen', assetValue: 'Asset', contentValue: 'Inhalt' },
};

const linked = (overrides: Partial<ContentMediaUsage> = {}): ContentMediaUsage => ({
  uiId: 'one', assetId: 'asset-1', persistentUrl: 'https://cdn.example.test/one.jpg', previewUrl: 'https://preview.example.test/one.jpg',
  altText: 'Alt', caption: 'Redaktionell geändert', credit: 'Stadt', license: 'CC', role: 'gallery_item', sortOrder: 0,
  assetSnapshot: { persistentUrl: 'https://cdn.example.test/one.jpg', altText: 'Alt', caption: 'Ursprünglich', credit: 'Stadt', license: 'CC' },
  referenceStatus: 'synced', ...overrides,
});

const Harness = ({ initial = [], load = vi.fn() }: { initial?: readonly ContentMediaUsage[]; load?: (usage: ContentMediaUsage) => Promise<ContentMediaUsage['assetSnapshot']> }) => {
  const [usages, setUsages] = React.useState(initial);
  return <ContentMediaUsageBlock usages={usages} onChange={setUsages} onAddManual={() => setUsages((current) => [...current, createManualContentMediaUsage({ sortOrder: current.length })])} onOpenLibrary={vi.fn()} onOpenUpload={vi.fn()} onLoadAssetSnapshot={load as NonNullable<React.ComponentProps<typeof ContentMediaUsageBlock>['onLoadAssetSnapshot']>} labels={labels} supportedFields={{ altText: true, caption: true, credit: true, license: true }} />;
};

afterEach(cleanup);

describe('ContentMediaUsageBlock', () => {
  it('exposes library, upload and manual entry points and edits the controlled usage', () => {
    render(<Harness />);
    expect(screen.getByText('Keine Bilder')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mediathek' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Manuell' }));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://cdn.example.test/manual.jpg' } });
    expect((screen.getByLabelText('URL') as HTMLInputElement).value).toBe('https://cdn.example.test/manual.jpg');
  });

  it('reorders and removes by stable UI identity while announcing and restoring focus', async () => {
    render(<Harness initial={[linked(), linked({ uiId: 'two', assetId: 'asset-2', sortOrder: 1, persistentUrl: 'https://cdn.example.test/two.jpg' })]} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Hoch' })[1]!);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('content-media-two-remove')));
    expect(screen.getByText('Position 1 von 2')).toBeTruthy();
    fireEvent.click(document.getElementById('content-media-two-remove')!);
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('content-media-one-remove')));
    expect(screen.getByText('Entfernt')).toBeTruthy();
  });

  it('keeps editorial overrides unselected and applies only explicitly selected asset metadata', async () => {
    const load = vi.fn(async () => ({ persistentUrl: 'https://cdn.example.test/new.jpg', altText: 'Neu', caption: 'Asset neu', credit: 'Neu', license: 'CC-BY' }));
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
    render(<Harness initial={[linked()]} load={vi.fn(async () => { throw new Error('failed'); })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Aktualisierung fehlgeschlagen');
  });

  it('shows reference mismatches for usages without an asset id', () => {
    render(<Harness initial={[linked({ assetId: undefined, referenceStatus: 'missing' })]} />);

    expect(screen.getAllByText('Manuell')).toHaveLength(2);
    expect(screen.getByText('Fehlt')).toBeTruthy();
  });
});
