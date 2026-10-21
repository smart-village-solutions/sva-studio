import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogEditorData } from '@sva/plugin-sdk/app-translations';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { CatalogEditor } from './catalog.editor.js';

registerPluginTranslationResolver((key) => key);
afterEach(cleanup);
const data: CatalogEditorData = {
  draft: {
    id: 'draft',
    scope: { kind: 'global' },
    manifestId: 'manifest',
    draftRevision: '1',
    baseReleaseId: null,
    supportedLocales: ['de', 'en'],
    valuesByLocale: {},
    manifest: {
      contractId: 'ui',
      manifestVersion: '1',
      appCompatibility: { minVersion: '1.0.0' },
      keys: {
        greeting: {
          type: 'string',
          defaultValue: 'Hallo {{name}}',
          placeholders: { name: 'string' },
          allowEmpty: false,
        },
      },
    },
  },
  values: {
    de: {
      greeting: {
        value: 'Hallo {{name}}',
        origin: 'default',
        sourceDigest: '',
        confirmedSourceDigest: null,
      },
    },
  },
  baseCatalogs: {},
};
describe('catalog editor', () => {
  it('orders language options by translated name with German first without changing the draft', () => {
    const labels: Record<string, string> = {
      'appTranslations.ui.locales.de': 'Deutsch',
      'appTranslations.ui.locales.en': 'Englisch',
      'appTranslations.ui.locales.da': 'Dänisch',
      'appTranslations.ui.locales.zh-Hans': 'Chinesisch (vereinfacht)',
    };
    registerPluginTranslationResolver((key) => labels[key] ?? key);
    try {
      const catalog = structuredClone(data);
      catalog.draft.supportedLocales = ['en', 'da', 'de', 'zh-Hans'];
      render(
        <CatalogEditor
          data={catalog}
          busy={false}
          canWrite
          mutate={vi.fn()}
          onDirtyChange={vi.fn()}
        />
      );
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Deutsch',
        'Chinesisch (vereinfacht)',
        'Dänisch',
        'Englisch',
      ]);
      expect(catalog.draft.supportedLocales).toEqual(['en', 'da', 'de', 'zh-Hans']);
    } finally {
      registerPluginTranslationResolver((key) => key);
    }
  });
  it('validates placeholders locally and retains input when a save conflicts', async () => {
    const mutate = vi.fn(async () => false);
    render(
      <CatalogEditor data={data} busy={false} canWrite mutate={mutate} onDirtyChange={vi.fn()} />
    );
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.save' }));
    expect(screen.getByRole('alert').textContent).toContain('invalid_catalog');
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: 'Guten Tag {{name}}' } });
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.save' }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({ value: 'Guten Tag {{name}}', expectedRevision: '1' })
      )
    );
    expect((field as HTMLTextAreaElement).value).toBe('Guten Tag {{name}}');
  });
  it('can explicitly save an allowed empty translation without typing a fake character', async () => {
    const empty = structuredClone(data);
    empty.draft.manifest.keys = {
      optional: { type: 'string', defaultValue: '', placeholders: {}, allowEmpty: true },
    };
    empty.draft.supportedLocales = ['en', 'de'];
    empty.values = {};
    const mutate = vi.fn(async () => true);
    render(
      <CatalogEditor data={empty} busy={false} canWrite mutate={mutate} onDirtyChange={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.save' }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ key: 'optional', value: '' }))
    );
  });
  it('shows the pinned German source for an inherited English standard despite a German override', () => {
    const municipal = structuredClone(data);
    municipal.draft.scope = {
      kind: 'municipal',
      instanceId: 'test',
      organizationId: '11111111-2222-4333-8444-555555555555',
    };
    municipal.values.de = {
      greeting: {
        value: 'Kommunal {{name}}',
        origin: 'manual',
        sourceDigest: 'source',
        confirmedSourceDigest: null,
      },
    };
    municipal.baseCatalogs.de = {
      schemaVersion: 1,
      instanceId: null,
      organizationId: null,
      locale: 'de',
      contractId: 'ui',
      catalogSetRevision: '1',
      appCompatibility: { minVersion: '1.0.0' },
      sourceRevision: 'source',
      checksum: 'checksum',
      fallbackKeys: [],
      values: { greeting: 'Standard {{name}}' },
    };
    municipal.values.en = {
      greeting: {
        value: 'Standard English {{name}}',
        origin: 'default',
        sourceDigest: 'source',
        confirmedSourceDigest: null,
      },
    };
    render(
      <CatalogEditor
        data={municipal}
        busy={false}
        canWrite
        mutate={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'appTranslations.ui.language' }), {
      target: { value: 'en' },
    });
    expect(screen.getByText('Standard {{name}}').getAttribute('lang')).toBe('de');
  });
  it('shows effective municipal German when the foreign translation is still missing', () => {
    const municipal = structuredClone(data);
    municipal.draft.scope = {
      kind: 'municipal',
      instanceId: 'test',
      organizationId: '11111111-2222-4333-8444-555555555555',
    };
    municipal.values.de!.greeting!.value = 'Kommunal {{name}}';
    render(
      <CatalogEditor
        data={municipal}
        sourceOnly={false}
        busy={false}
        canWrite
        mutate={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'appTranslations.ui.language' }), {
      target: { value: 'en' },
    });
    expect(screen.getByText('Kommunal {{name}}').getAttribute('lang')).toBe('de');
  });
  it('uses German immediately when a refreshed language selection no longer contains English', () => {
    const bilingual = structuredClone(data);
    bilingual.values.en = {
      greeting: {
        value: 'English {{name}}',
        origin: 'manual',
        sourceDigest: '',
        confirmedSourceDigest: null,
      },
    };
    const props = { busy: false, canWrite: true, mutate: vi.fn(), onDirtyChange: vi.fn() };
    const view = render(<CatalogEditor data={bilingual} {...props} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'appTranslations.ui.language' }), {
      target: { value: 'en' },
    });
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('English {{name}}');
    const german = structuredClone(data);
    german.draft.supportedLocales = ['de'];
    view.rerender(<CatalogEditor data={german} {...props} />);
    expect(
      (screen.getByRole('combobox', { name: 'appTranslations.ui.language' }) as HTMLSelectElement)
        .value
    ).toBe('de');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Hallo {{name}}');
  });
  it('bounds rendering and finds keys, German sources and translations in a 10000-key catalog', () => {
    const large = structuredClone(data);
    large.draft.manifest.keys = {};
    large.values = { de: {}, en: {} };
    for (let index = 0; index < 10000; index++) {
      const key = `entry-${String(index).padStart(5, '0')}`;
      large.draft.manifest.keys[key] = {
        type: 'string',
        defaultValue: `Deutsch ${index}`,
        placeholders: {},
        allowEmpty: false,
      };
      const german = large.values.de;
      if (german)
        german[key] = {
          value: `Deutsch ${index}`,
          origin: 'default',
          sourceDigest: '',
          confirmedSourceDigest: null,
        };
    }
    large.values.en = {
      'entry-09999': {
        value: 'Town hall',
        origin: 'manual',
        sourceDigest: '',
        confirmedSourceDigest: null,
      },
    };
    render(
      <CatalogEditor data={large} busy={false} canWrite mutate={vi.fn()} onDirtyChange={vi.fn()} />
    );
    const list = screen.getByRole('list', { name: 'appTranslations.ui.key' });
    expect(list.children).toHaveLength(25);
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.next' }));
    expect(list.children[0]?.textContent).toContain('entry-00025');
    const search = screen.getByRole('searchbox', { name: 'appTranslations.ui.search' });
    fireEvent.change(search, { target: { value: 'ENTRY-09999' } });
    expect(list.children).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'entry-09999 Deutsch 9999' }));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Deutsch 9999');
    fireEvent.change(screen.getByRole('combobox', { name: 'appTranslations.ui.language' }), {
      target: { value: 'en' },
    });
    fireEvent.change(search, { target: { value: 'deutsch 9999' } });
    expect(list.children).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'town HALL' } });
    expect(list.children).toHaveLength(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Town hall');
    fireEvent.change(search, { target: { value: 'not found' } });
    expect(list.children).toHaveLength(0);
    expect(screen.getByText('appTranslations.ui.noMatches')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Town hall');
  });
  it('keeps selection and search locked while an unsaved value is present', () => {
    render(
      <CatalogEditor data={data} busy={false} canWrite mutate={vi.fn()} onDirtyChange={vi.fn()} />
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Guten Tag {{name}}' } });
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { pressed: true }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Guten Tag {{name}}');
  });
  it('renders a read-only editor without write permission', () => {
    render(
      <CatalogEditor
        data={data}
        busy={false}
        canWrite={false}
        mutate={vi.fn()}
        onDirtyChange={vi.fn()}
      />
    );
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'appTranslations.ui.save' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
