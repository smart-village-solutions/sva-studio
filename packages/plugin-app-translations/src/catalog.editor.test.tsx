import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogEditorData } from '@sva/plugin-sdk/app-translations';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { catalogDigest } from '@sva/plugin-sdk/app-translations';
import { CatalogEditor, catalogSealIssues } from './catalog.editor.js';

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
  it('identifies missing and invalid translations without blocking a German-only snapshot', async () => {
    const catalog = structuredClone(data);
    expect(await catalogSealIssues(catalog, false)).toEqual([
      { locale: 'en', key: 'greeting', reason: 'missing' },
    ]);
    catalog.values.en = {
      greeting: {
        origin: 'default',
        sourceDigest: '',
        confirmedSourceDigest: null,
        value: 'Missing required placeholder',
      },
    };
    expect(await catalogSealIssues(catalog, false)).toEqual([
      { locale: 'en', key: 'greeting', reason: 'invalid_catalog' },
    ]);
    expect(await catalogSealIssues(catalog, true)).toEqual([]);
  });
  it('offers German translation only on a saved municipal German override', () => {
    const catalog = structuredClone(data);
    catalog.draft.scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
    const props = {
      canWrite: true,
      sourceOnly: false,
      busy: false,
      mutate: vi.fn(),
      onDirtyChange: vi.fn(),
      translate: vi.fn(),
    };
    const { rerender } = render(<CatalogEditor {...props} data={catalog} />);
    expect(
      screen.queryByRole('group', { name: 'appTranslations.ui.transferMunicipal' })
    ).toBeNull();
    catalog.draft.valuesByLocale.de = {
      greeting: {
        value: 'Unser Hallo {{name}}',
        origin: 'manual',
        sourceDigest: '',
        confirmedSourceDigest: null,
      },
    };
    catalog.values.de = catalog.draft.valuesByLocale.de;
    rerender(<CatalogEditor {...props} data={catalog} />);
    expect(
      screen.getByRole('group', { name: 'appTranslations.ui.transferMunicipal' })
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
      target: { value: 'en' },
    });
    expect(
      screen.queryByRole('group', { name: 'appTranslations.ui.transferMunicipal' })
    ).toBeNull();
    fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
      target: { value: 'de' },
    });
    expect(
      screen.getByRole('group', { name: 'appTranslations.ui.transferMunicipal' })
    ).toBeTruthy();
  });
  it('separates selected target languages from each manual overwrite confirmation and resets consent when selection changes', async () => {
    const catalog = structuredClone(data);
    catalog.draft.scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
    catalog.draft.supportedLocales = ['de', 'en', 'fr', 'es'];
    const own = {
      value: 'Unser Hallo {{name}}',
      origin: 'manual' as const,
      sourceDigest: '',
      confirmedSourceDigest: null,
    };
    catalog.draft.valuesByLocale = {
      de: { greeting: own },
      en: { greeting: { ...own, value: 'My correction {{name}}' } },
      fr: { greeting: { ...own, value: 'Ma correction {{name}}' } },
    };
    catalog.values.de = { greeting: own };
    const translate = vi.fn().mockResolvedValue(true);
    render(
      <CatalogEditor
        data={catalog}
        canWrite
        sourceOnly={false}
        busy={false}
        mutate={vi.fn()}
        onDirtyChange={vi.fn()}
        translate={translate}
      />
    );
    const button = screen.getByRole('button', { name: 'appTranslations.ui.transferMunicipal' });
    fireEvent.click(screen.getByLabelText('appTranslations.ui.locales.es'));
    fireEvent.click(button);
    await waitFor(() =>
      expect(translate).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'municipal', locales: ['es'], confirmations: {} })
      )
    );
    translate.mockClear();
    fireEvent.click(screen.getByLabelText('appTranslations.ui.locales.en'));
    fireEvent.click(screen.getByLabelText('Französisch'));
    expect(button).toHaveProperty('disabled', true);
    const confirmations = screen.getAllByRole('checkbox', {
      name: /appTranslations.ui.replaceManual/,
    });
    expect(confirmations).toHaveLength(2);
    const [englishConfirmation, frenchConfirmation] = confirmations;
    if (!englishConfirmation || !frenchConfirmation)
      throw new Error('missing confirmation controls');
    fireEvent.click(englishConfirmation);
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(frenchConfirmation);
    expect(button).toHaveProperty('disabled', false);
    fireEvent.click(button);
    await waitFor(async () =>
      expect(translate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'municipal',
          key: 'greeting',
          locales: ['es', 'en', 'fr'],
          confirmations: {
            en: {
              sourceDigest: await catalogDigest(own.value),
              overrideDigest: await catalogDigest(catalog.draft.valuesByLocale.en?.greeting),
            },
            fr: {
              sourceDigest: await catalogDigest(own.value),
              overrideDigest: await catalogDigest(catalog.draft.valuesByLocale.fr?.greeting),
            },
          },
        })
      )
    );
    fireEvent.click(screen.getByLabelText('Französisch'));
    expect(button).toHaveProperty('disabled', true);
    expect(
      screen.getByRole('checkbox', { name: /appTranslations.ui.replaceManual/ })
    ).toHaveProperty('checked', false);
  });
  it.each(
    (['standard', 'municipal', 'legacy', 'missing', 'default'] as const).flatMap((kind) =>
      [false, true].map((ownGerman) => ({ kind, ownGerman }))
    )
  )(
    'retranslates $kind text with own German override=$ownGerman using the matching source',
    async ({ kind, ownGerman }) => {
      const catalog = structuredClone(data);
      catalog.draft.scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
      const standard = 'Standard {{name}}';
      const municipal = 'Kommunal {{name}}';
      catalog.baseCatalogs.de = { values: { greeting: standard } } as NonNullable<
        CatalogEditorData['baseCatalogs']['de']
      >;
      const german = {
        value: ownGerman ? municipal : standard,
        origin: ownGerman ? ('manual' as const) : ('default' as const),
        sourceDigest: '',
        confirmedSourceDigest: null,
      };
      catalog.values.de = { greeting: german };
      if (ownGerman) catalog.draft.valuesByLocale.de = { greeting: german };
      const manual = kind !== 'missing' && kind !== 'default';
      const foreign = {
        value: 'Foreign {{name}}',
        origin: manual ? ('manual' as const) : ('default' as const),
        ...(kind === 'standard' || kind === 'municipal' ? { sourceKind: kind } : {}),
        sourceDigest: '',
        confirmedSourceDigest: null,
      };
      if (kind !== 'missing') catalog.values.en = { greeting: foreign };
      if (manual) catalog.draft.valuesByLocale.en = { greeting: foreign };
      const translate = vi.fn().mockResolvedValue(true);
      render(
        <CatalogEditor
          data={catalog}
          canWrite
          sourceOnly={false}
          busy={false}
          mutate={vi.fn()}
          onDirtyChange={vi.fn()}
          translate={translate}
        />
      );
      fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
        target: { value: 'en' },
      });
      if (manual) fireEvent.click(screen.getByLabelText('appTranslations.ui.replaceManual'));
      fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.translateKey' }));
      const mode =
        ownGerman && (kind === 'municipal' || kind === 'legacy') ? 'municipal' : 'standard';
      await waitFor(async () =>
        expect(translate).toHaveBeenCalledWith({
          mode,
          key: 'greeting',
          locales: ['en'],
          confirmations: manual
            ? {
                en: {
                  sourceDigest: await catalogDigest(mode === 'municipal' ? municipal : standard),
                  overrideDigest: await catalogDigest(foreign),
                },
              }
            : {},
        })
      );
      const sourceHeading = screen.getByRole('heading', { name: 'appTranslations.ui.source' });
      expect(sourceHeading.nextElementSibling?.textContent).toBe(
        kind === 'standard' || kind === 'default' ? standard : german.value
      );
    }
  );
  it('requires explicit confirmation before replacing a manual translation and binds it to both digests', async () => {
    const catalog = structuredClone(data);
    catalog.draft.scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
    catalog.baseCatalogs.de = { values: { greeting: 'Hallo {{name}}' } } as NonNullable<
      CatalogEditorData['baseCatalogs']['de']
    >;
    const own = {
      value: 'Correction {{name}}',
      origin: 'manual' as const,
      sourceKind: 'standard' as const,
      sourceDigest: '',
      confirmedSourceDigest: '',
    };
    catalog.draft.valuesByLocale.en = { greeting: own };
    catalog.values.en = { greeting: own };
    const translate = vi.fn().mockResolvedValue(true);
    render(
      <CatalogEditor
        data={catalog}
        canWrite
        sourceOnly={false}
        busy={false}
        mutate={vi.fn()}
        onDirtyChange={vi.fn()}
        translate={translate}
      />
    );
    fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
      target: { value: 'en' },
    });
    const button = screen.getByRole('button', { name: 'appTranslations.ui.translateKey' });
    expect(button).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByLabelText('appTranslations.ui.replaceManual'));
    fireEvent.click(button);
    await waitFor(() =>
      expect(translate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'standard',
          key: 'greeting',
          locales: ['en'],
          confirmations: {
            en: {
              sourceDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
              overrideDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
          },
        })
      )
    );
    fireEvent.change(screen.getByLabelText('appTranslations.ui.value'), {
      target: { value: 'Unsaved {{name}}' },
    });
    expect(button).toHaveProperty('disabled', true);
    expect(translate).toHaveBeenCalledTimes(1);
  });
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
  it('discards input locally without changing search, selection or list scroll', () => {
    const mutate = vi.fn();
    render(
      <CatalogEditor data={data} busy={false} canWrite mutate={mutate} onDirtyChange={vi.fn()} />
    );
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.discard' })).toBeNull();
    const field = screen.getByRole('textbox') as HTMLTextAreaElement;
    const savedInput = field.value;
    const search = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'greeting' } });
    const selected = screen.getByRole('button', { pressed: true });
    const list = screen.getByRole('list');
    list.scrollTop = 80;
    fireEvent.change(field, { target: { value: 'Neue Eingabe' } });
    const discard = screen.getByRole('button', { name: 'appTranslations.ui.discard' });
    expect(discard.parentElement).toBe(
      screen.getByRole('button', { name: 'appTranslations.ui.save' }).parentElement
    );
    fireEvent.click(discard);
    expect(field.value).toBe(savedInput);
    expect(search.value).toBe('greeting');
    expect(screen.getByRole('button', { pressed: true })).toBe(selected);
    expect(screen.getByRole('list')).toBe(list);
    expect(list.scrollTop).toBe(80);
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.discard' })).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
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
