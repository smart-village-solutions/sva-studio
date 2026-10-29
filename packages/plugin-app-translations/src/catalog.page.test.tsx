import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  MainserverApiError,
  registerPluginTranslationResolver,
  publishSessionAccessSnapshot,
  resetSessionAccessSnapshot,
} from '@sva/plugin-sdk';
import { CatalogsPage } from './catalog.page.js';
import { requestCatalog, requestCatalogDownload } from './catalog.api.js';
import manifest from '../tests/fixtures/catalog-demo.json';
import { appTranslationsPlugin } from './descriptor.js';
import {
  catalogDigest,
  type CatalogEditorData,
  type CatalogRelease,
  validateCatalogManifest,
} from '@sva/plugin-sdk/app-translations';
vi.mock('./catalog.api.js', () => ({ requestCatalog: vi.fn(), requestCatalogDownload: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetSessionAccessSnapshot();
});
beforeEach(() => {
  vi.mocked(requestCatalog).mockReset();
  vi.mocked(requestCatalogDownload).mockReset();
  registerPluginTranslationResolver((key) => key);
});
describe('catalog overview', () => {
  it('shows the current central basis and offers a deliberate switch without creating another draft', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-texts.catalog.write'],
      roles: [],
      assignedModules: [],
    });
    const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
    const bases = [
      { id: 'old', contractId: 'ui', catalogSetRevision: '1', supportedLocales: ['de'] },
      { id: 'next', contractId: 'ui', catalogSetRevision: '2', supportedLocales: ['de'] },
      { id: 'other', contractId: 'other', catalogSetRevision: '5', supportedLocales: ['de'] },
    ];
    const editor = {
      draft: {
        id: 'draft',
        scope,
        manifestId: 'manifest',
        manifest: { contractId: 'ui', keys: {} },
        draftRevision: '99',
        baseReleaseId: 'old',
        supportedLocales: ['de'],
        valuesByLocale: {},
      },
      values: {},
      baseCatalogs: {},
    };
    vi.mocked(requestCatalog).mockImplementation(async (op) => {
      if (op.operation === 'overview')
        return {
          scope,
          catalogs: [{ contractId: 'ui', baseReleaseId: editor.draft.baseReleaseId }],
          releases: [],
          bases,
        };
      if (op.operation === 'changeBase') {
        editor.draft.baseReleaseId = 'next';
        editor.draft.draftRevision = '100';
        return editor.draft;
      }
      return structuredClone(editor);
    });
    render(<CatalogsPage />);
    const switchButton = await screen.findByRole('button', {
      name: 'appTranslations.ui.switchBasis',
    });
    expect(screen.getByText(/appTranslations.ui.currentBasis.*ui \/ 1/)).toBeTruthy();
    expect(screen.queryByLabelText('appTranslations.ui.chooseBasis')).toBeNull();
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.create' })).toBeNull();
    await waitFor(() => expect(switchButton).toHaveProperty('disabled', false));
    fireEvent.click(switchButton);
    const select = screen.getByLabelText('appTranslations.ui.chooseBasis') as HTMLSelectElement;
    expect(Array.from(select.options, (option) => option.value)).toEqual(['', 'next']);
    fireEvent.change(select, { target: { value: 'next' } });
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.cancelBasisChange' }));
    expect(screen.queryByLabelText('appTranslations.ui.chooseBasis')).toBeNull();
    expect(requestCatalog.mock.calls.some(([op]) => op.operation === 'changeBase')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.switchBasis' }));
    fireEvent.change(screen.getByLabelText('appTranslations.ui.chooseBasis'), {
      target: { value: 'next' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.changeBasis' }));
    await waitFor(() =>
      expect(screen.queryByLabelText('appTranslations.ui.chooseBasis')).toBeNull()
    );
    expect(requestCatalog).toHaveBeenCalledWith(
      {
        operation: 'changeBase',
        contractId: 'ui',
        expectedRevision: '99',
        baseReleaseId: 'next',
        locales: ['de'],
      },
      scope,
      undefined,
      'source'
    );
    expect(screen.getByText(/appTranslations.ui.currentBasis.*ui \/ 2/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.create' })).toBeNull();
  });
  it('does not offer a basis switch when only the current central basis exists', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-texts.catalog.write'],
      roles: [],
      assignedModules: [],
    });
    const scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
    vi.mocked(requestCatalog).mockImplementation(async (op) =>
      op.operation === 'overview'
        ? {
            scope,
            catalogs: [{ contractId: 'ui', baseReleaseId: 'current' }],
            releases: [],
            bases: [
              {
                id: 'current',
                contractId: 'ui',
                catalogSetRevision: '1',
                supportedLocales: ['de'],
              },
            ],
          }
        : {
            draft: {
              id: 'draft',
              scope,
              manifest: { contractId: 'ui', keys: {} },
              baseReleaseId: 'current',
              supportedLocales: ['de'],
              valuesByLocale: {},
            },
            values: {},
            baseCatalogs: {},
          }
    );
    render(<CatalogsPage />);
    await screen.findByText(/appTranslations.ui.currentBasis.*ui \/ 1/);
    expect(screen.queryByLabelText('appTranslations.ui.chooseBasis')).toBeNull();
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.switchBasis' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.create' })).toBeNull();
  });
  it('offers draft creation only when no draft exists', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-texts.catalog.write'],
      roles: [],
      assignedModules: [],
    });
    vi.mocked(requestCatalog).mockResolvedValue({
      scope: { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' },
      catalogs: [],
      releases: [],
      bases: [{ id: 'basis', contractId: 'ui', catalogSetRevision: '1', supportedLocales: ['de'] }],
    });
    render(<CatalogsPage />);
    expect(await screen.findByRole('button', { name: 'appTranslations.ui.create' })).toBeTruthy();
    expect(screen.getByLabelText('appTranslations.ui.chooseBasis')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'appTranslations.ui.switchBasis' })).toBeNull();
  });
  it.each([true, false])(
    'distinguishes unsaved input, a stored draft and its sealed revision (sourceOnly=%s)',
    async (sourceOnly) => {
      publishSessionAccessSnapshot({
        isResolved: true,
        permissionActions: [
          'app-texts.catalog.write',
          'app-texts.catalog.publish',
          'app-translations.catalog.write',
          'app-translations.catalog.publish',
        ],
        roles: [],
        assignedModules: ['app-translations'],
      });
      registerPluginTranslationResolver((key, variables) =>
        key.endsWith('.draftSealed') ? `${key} ${variables?.revision}` : key
      );
      const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
      const digest = await catalogDigest('Hallo');
      const editLocale = sourceOnly ? 'de' : 'en';
      const editor: CatalogEditorData = {
        draft: {
          id: 'draft',
          scope,
          manifestId: 'manifest',
          draftRevision: '2',
          baseReleaseId: null,
          supportedLocales: sourceOnly ? ['de'] : ['de', 'en'],
          valuesByLocale: {},
          manifest: {
            contractId: 'ui',
            manifestVersion: '1',
            appCompatibility: { minVersion: '1.0.0' },
            keys: {
              greeting: {
                type: 'string',
                defaultValue: 'Hallo',
                placeholders: {},
                allowEmpty: false,
              },
            },
          },
        },
        values: {
          de: {
            greeting: {
              value: 'Hallo',
              origin: 'default',
              sourceDigest: '',
              confirmedSourceDigest: null,
            },
          },
        },
        baseCatalogs: {},
        targetCodes: { en: 'en-GB' },
      };
      if (!sourceOnly)
        editor.values.en = {
          greeting: {
            value: 'Hello',
            origin: 'manual',
            sourceDigest: digest,
            confirmedSourceDigest: digest,
            targetCode: 'en-GB',
          },
        };
      const releases = [
        {
          id: 'old',
          contractId: 'ui',
          draftRevision: '1',
          catalogSetRevision: '1',
          supportedLocales: ['de'],
        },
        {
          id: 'unrelated',
          contractId: 'other',
          draftRevision: '2',
          catalogSetRevision: '2',
          supportedLocales: ['de'],
        },
      ];
      vi.mocked(requestCatalog).mockImplementation(async (operation) => {
        if (operation.operation === 'overview')
          return {
            scope,
            catalogs: [{ contractId: 'ui' }],
            releases,
            bases: [],
            setup: { ready: true, reason: 'ready' },
          };
        if (operation.operation === 'read') return structuredClone(editor);
        if (operation.operation === 'translationStatus') return null;
        if (operation.operation === 'edit') {
          editor.draft.draftRevision = String(Number(editor.draft.draftRevision) + 1);
          editor.values[editLocale]!.greeting!.value = String(operation.value);
          return structuredClone(editor.draft);
        }
        if (operation.operation === 'seal') {
          const release = {
            id: 'new',
            contractId: 'ui',
            draftRevision: editor.draft.draftRevision,
            catalogSetRevision: '2',
            supportedLocales: [...editor.draft.supportedLocales],
          };
          releases.unshift(release);
          return { ...release, state: 'sealed', catalogs: {} };
        }
        throw new Error(`Unexpected operation: ${operation.operation}`);
      });
      const page = render(<CatalogsPage sourceOnly={sourceOnly} />);
      await screen.findByRole('heading', { name: 'appTranslations.ui.draftTitle' });
      expect(screen.getByText('appTranslations.ui.draftUnsealed')).toBeTruthy();
      if (!sourceOnly)
        fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
          target: { value: 'en' },
        });
      await waitFor(() =>
        expect(screen.getByLabelText('appTranslations.ui.value')).toHaveProperty(
          'value',
          sourceOnly ? 'Hallo' : 'Hello'
        )
      );
      fireEvent.change(screen.getByLabelText('appTranslations.ui.value'), {
        target: { value: 'Neu' },
      });
      await screen.findByText('appTranslations.ui.draftUnsaved');
      fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.save' }));
      await screen.findByText('appTranslations.ui.saved');
      expect(screen.getByText('appTranslations.ui.draftUnsealed')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.seal' }));
      await screen.findByText('appTranslations.ui.sealed');
      expect(screen.getByText('appTranslations.ui.draftSealed 2')).toBeTruthy();
      expect(
        screen.getByRole('heading', { name: 'appTranslations.ui.currentStateTitle' })
      ).toBeTruthy();
      const sealedButton = screen.getByRole('button', { name: 'appTranslations.ui.seal' });
      expect(sealedButton).toHaveProperty('disabled', true);
      fireEvent.click(sealedButton);
      expect(requestCatalog.mock.calls.filter(([op]) => op.operation === 'seal')).toHaveLength(1);
      page.unmount();
      render(<CatalogsPage sourceOnly={sourceOnly} />);
      await screen.findByText('appTranslations.ui.draftSealed 2');
      expect(
        screen.getByRole('heading', { name: 'appTranslations.ui.currentStateTitle' })
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'appTranslations.ui.seal' })).toHaveProperty(
        'disabled',
        true
      );
      if (!sourceOnly)
        fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
          target: { value: 'en' },
        });
      await waitFor(() =>
        expect(screen.getByLabelText('appTranslations.ui.value')).toHaveProperty('value', 'Neu')
      );
      fireEvent.change(screen.getByLabelText('appTranslations.ui.value'), {
        target: { value: 'Weitere Änderung' },
      });
      await screen.findByText('appTranslations.ui.draftUnsaved');
      expect(screen.queryByText('appTranslations.ui.draftSealed 2')).toBeNull();
      expect(screen.getByRole('heading', { name: 'appTranslations.ui.draftTitle' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'appTranslations.ui.seal' })).toHaveProperty(
        'disabled',
        true
      );
      fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.save' }));
      await screen.findByText('appTranslations.ui.saved');
      expect(screen.getByText('appTranslations.ui.draftUnsealed')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'appTranslations.ui.seal' })).toHaveProperty(
        'disabled',
        false
      );
    }
  );
  it.each([true, false])(
    'keeps sealing available when the same revision was saved with different languages (sourceOnly=%s)',
    async (sourceOnly) => {
      publishSessionAccessSnapshot({
        isResolved: true,
        permissionActions: ['app-texts.catalog.publish', 'app-translations.catalog.publish'],
        roles: [],
        assignedModules: ['app-translations'],
      });
      const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
      const supportedLocales = sourceOnly ? ['de'] : ['de', 'en'];
      const text = {
        value: 'Close',
        origin: 'default' as const,
        sourceDigest: '',
        confirmedSourceDigest: null,
      };
      const editor: CatalogEditorData = {
        draft: {
          id: 'draft',
          scope,
          manifestId: 'manifest',
          draftRevision: '5',
          baseReleaseId: null,
          supportedLocales,
          valuesByLocale: {},
          manifest: {
            contractId: 'ui',
            manifestVersion: '1',
            appCompatibility: { minVersion: '1.0.0' },
            keys: {
              close: { type: 'string', defaultValue: 'Close', placeholders: {}, allowEmpty: false },
            },
          },
        },
        values: { de: { close: text }, en: { close: text } },
        baseCatalogs: {},
      };
      const releases = [
        {
          id: 'different-languages',
          contractId: 'ui',
          catalogSetRevision: '1',
          draftRevision: '5',
          supportedLocales: sourceOnly ? ['de', 'en'] : ['de'],
        },
      ];
      vi.mocked(requestCatalog).mockImplementation(async (operation) => {
        if (operation.operation === 'overview')
          return {
            scope,
            catalogs: [{ contractId: 'ui' }],
            releases,
            bases: [],
            setup: { ready: true, reason: 'ready' },
          };
        if (operation.operation === 'read') return editor;
        if (operation.operation === 'translationStatus') return null;
        if (operation.operation === 'seal') {
          const release = {
            id: 'matching-languages',
            contractId: 'ui',
            catalogSetRevision: '2',
            draftRevision: '5',
            supportedLocales,
          };
          releases.unshift(release);
          return { ...release, state: 'sealed', catalogs: {} };
        }
        throw new Error(`Unexpected operation: ${operation.operation}`);
      });
      render(<CatalogsPage sourceOnly={sourceOnly} />);
      await screen.findByText('appTranslations.ui.draftUnsealed');
      const button = screen.getByRole('button', { name: 'appTranslations.ui.seal' });
      expect(button).toHaveProperty('disabled', false);
      fireEvent.click(button);
      await screen.findByText('appTranslations.ui.draftSealed');
      expect(screen.getByRole('button', { name: 'appTranslations.ui.seal' })).toHaveProperty(
        'disabled',
        true
      );
      expect(
        requestCatalog.mock.calls.filter(([operation]) => operation.operation === 'seal')
      ).toHaveLength(1);
    }
  );
  it.each([true, false])(
    'shows multilingual saved snapshots and their draft revision in both page modes (sourceOnly=%s)',
    async (sourceOnly) => {
      const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
      const release = {
        id: 'release',
        contractId: 'ui',
        catalogSetRevision: '2',
        draftRevision: '97',
        supportedLocales: ['de', 'en', 'fr', 'pt-PT'],
        state: 'sealed',
        catalogs: {},
      } as CatalogRelease;
      const older = { ...release, id: 'older', catalogSetRevision: '1' };
      vi.mocked(requestCatalog).mockImplementation(async (operation) =>
        operation.operation === 'overview'
          ? {
              scope,
              catalogs: [],
              releases: [release, older],
              bases: [],
              setup: { ready: true, reason: 'ready' },
            }
          : operation.releaseId === older.id
            ? older
            : release
      );
      render(<CatalogsPage sourceOnly={sourceOnly} />);
      const button = await screen.findByText('appTranslations.ui.preview ui / 2');
      expect(button.parentElement?.textContent).toContain('appTranslations.ui.draftRevision: 97');
      expect(button.parentElement?.textContent).toContain('Französisch');
      expect(button.parentElement?.textContent).toContain('appTranslations.ui.locales.pt-PT');
      const details = button.closest('details')!;
      expect(details.open).toBe(false);
      fireEvent.click(button.closest('summary')!);
      await screen.findByLabelText('appTranslations.ui.preview / 2');
      expect(details.open).toBe(true);
      expect(requestCatalog).toHaveBeenCalledWith(
        { operation: 'readRelease', releaseId: 'release' },
        scope,
        undefined,
        sourceOnly ? 'source' : 'translations'
      );
      expect(screen.getByLabelText('appTranslations.ui.preview / 2').textContent).toContain(
        '"draftRevision": "97"'
      );
      const other = screen.getByText('appTranslations.ui.preview ui / 1').closest('details')!;
      expect(other.open).toBe(false);
      fireEvent.click(other.querySelector('summary')!);
      await screen.findByLabelText('appTranslations.ui.preview / 1');
      expect(details.open).toBe(true);
      expect(other.open).toBe(true);
      expect(
        within(details).getByRole('link', { name: 'appTranslations.ui.downloadTexts' })
      ).toBeTruthy();
      const reads = vi
        .mocked(requestCatalog)
        .mock.calls.filter(([op]) => op.operation === 'readRelease').length;
      fireEvent.click(button.closest('summary')!);
      expect(details.open).toBe(false);
      expect(other.open).toBe(true);
      fireEvent.click(button.closest('summary')!);
      await waitFor(() => expect(details.open).toBe(true));
      expect(
        vi.mocked(requestCatalog).mock.calls.filter(([op]) => op.operation === 'readRelease')
      ).toHaveLength(reads);
    }
  );
  it('locates a legacy correction blocking sealing and shows languages and draft revision on the saved snapshot', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-translations.catalog.write', 'app-translations.catalog.publish'],
      roles: [],
      assignedModules: ['app-translations'],
    });
    const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
    const digest = await catalogDigest('Hallo');
    const correction = {
      value: 'Hello',
      origin: 'manual' as const,
      sourceDigest: digest,
      confirmedSourceDigest: digest,
    };
    const editor: CatalogEditorData = {
      draft: {
        id: 'draft',
        scope,
        manifestId: 'manifest',
        draftRevision: '95',
        manifest: {
          contractId: 'ui',
          manifestVersion: '1',
          appCompatibility: { minVersion: '1.0.0' },
          keys: {
            greeting: {
              type: 'string',
              defaultValue: 'Hallo',
              placeholders: {},
              allowEmpty: false,
            },
          },
        },
        supportedLocales: ['de', 'en'],
        valuesByLocale: { en: { greeting: correction } },
        baseReleaseId: 'base',
      },
      values: {
        de: { greeting: { ...correction, value: 'Hallo', origin: 'default' } },
        en: { greeting: correction },
      },
      baseCatalogs: {},
      targetCodes: { en: 'en-GB' },
    };
    const releases: CatalogRelease[] = [];
    vi.mocked(requestCatalog).mockImplementation(async (operation) => {
      if (operation.operation === 'overview')
        return {
          scope,
          catalogs: [{ contractId: 'ui' }],
          releases,
          bases: [],
          setup: { ready: true, reason: 'ready' },
        };
      if (operation.operation === 'read') return structuredClone(editor);
      if (operation.operation === 'confirm') {
        Object.assign(correction, { targetCode: 'en-GB' });
        editor.draft.draftRevision = '96';
        return structuredClone(editor.draft);
      }
      if (operation.operation === 'seal') {
        const release = {
          id: 'release',
          contractId: 'ui',
          catalogSetRevision: '2',
          draftRevision: '96',
          supportedLocales: ['de', 'en'],
          state: 'sealed',
          catalogs: {},
        } as CatalogRelease;
        releases.push(release);
        return release;
      }
      return null;
    });
    render(<CatalogsPage sourceOnly={false} />);
    const seal = await screen.findByRole('button', { name: 'appTranslations.ui.seal' });
    fireEvent.click(seal);
    const issue = await screen.findByRole('button', {
      name: /appTranslations.ui.locales.en.*greeting/,
    });
    expect(requestCatalog.mock.calls.some(([op]) => op.operation === 'seal')).toBe(false);
    fireEvent.click(issue);
    expect(screen.getByLabelText('appTranslations.ui.language')).toHaveProperty('value', 'en');
    expect(screen.getByLabelText('appTranslations.ui.value')).toHaveProperty('value', 'Hello');
    fireEvent.click(await screen.findByRole('button', { name: 'appTranslations.ui.confirm' }));
    await waitFor(() => expect(seal).toHaveProperty('disabled', false));
    fireEvent.click(seal);
    const preview = await screen.findByText(/appTranslations.ui.preview ui.*2/);
    expect(preview.parentElement?.textContent).toContain('appTranslations.ui.draftRevision: 96');
    expect(preview.parentElement?.textContent).toContain(
      'appTranslations.ui.locales.de, appTranslations.ui.locales.en'
    );
    expect(screen.queryByText('appTranslations.ui.sealBlocked')).toBeNull();
  });
  it('shows planned language counts and does not poll or display a job for a no-op start', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-translations.catalog.write'],
      roles: [],
      assignedModules: ['app-translations'],
    });
    const scope = { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' };
    vi.mocked(requestCatalog).mockImplementation(async (op) => {
      if (op.operation === 'overview')
        return {
          scope,
          catalogs: [{ contractId: 'ui' }],
          releases: [],
          bases: [],
          setup: { ready: true, reason: 'ready' },
        };
      if (op.operation === 'read')
        return {
          draft: {
            id: 'draft',
            scope,
            draftRevision: '1',
            supportedLocales: ['de', 'fr'],
            valuesByLocale: {},
            manifest: {
              contractId: 'ui',
              keys: {
                title: {
                  type: 'string',
                  defaultValue: 'Hallo',
                  placeholders: {},
                  allowEmpty: false,
                },
              },
            },
          },
          values: {},
          baseCatalogs: { de: { values: { title: 'Hallo' } } },
          targetCodes: { fr: 'fr' },
        };
      return null;
    });
    render(<CatalogsPage sourceOnly={false} />);
    const button = await screen.findByRole('button', {
      name: 'appTranslations.ui.translateMissing',
    });
    expect(
      await screen.findByText(/appTranslations.ui.translationPlan.*Französisch: 1/)
    ).toBeTruthy();
    const polls = requestCatalog.mock.calls.filter(
      ([op]) => op.operation === 'translationStatus'
    ).length;
    fireEvent.click(button);
    await screen.findByText('appTranslations.ui.nothingToTranslate');
    expect(
      requestCatalog.mock.calls.filter(([op]) => op.operation === 'translationStatus')
    ).toHaveLength(polls);
    expect(screen.queryByText(/appTranslations.ui.jobStatus/)).toBeNull();
  });
  it.each([
    ['hides historical completion when nothing is missing', false, 'succeeded', false],
    ['shows historical completion when translations are still missing', true, 'succeeded', true],
    ['shows a running job even when nothing is missing', false, 'running', true],
  ])('%s', async (_name, missing, status, visible) => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-translations.catalog.write'],
      roles: [],
      assignedModules: ['app-translations'],
    });
    const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
    const digest = await catalogDigest('Hallo');
    const translation = {
      value: 'Hello',
      origin: 'manual' as const,
      sourceDigest: digest,
      confirmedSourceDigest: digest,
    };
    const editor: CatalogEditorData = {
      draft: {
        id: 'draft',
        scope,
        manifestId: 'manifest',
        draftRevision: '1',
        manifest: {
          contractId: 'ui',
          manifestVersion: '1',
          appCompatibility: { minVersion: '1.0.0' },
          keys: {
            greeting: {
              type: 'string',
              defaultValue: 'Hallo',
              placeholders: {},
              allowEmpty: false,
            },
          },
        },
        supportedLocales: ['de', 'en'],
        valuesByLocale: missing ? {} : { en: { greeting: translation } },
        baseReleaseId: 'base',
      },
      values: {
        de: { greeting: { ...translation, value: 'Hallo', origin: 'default' } },
        ...(missing ? {} : { en: { greeting: translation } }),
      },
      baseCatalogs: {
        de: {
          schemaVersion: 1,
          instanceId: null,
          organizationId: null,
          contractId: 'ui',
          catalogSetRevision: '1',
          locale: 'de',
          appCompatibility: { minVersion: '1.0.0' },
          sourceRevision: '1',
          values: { greeting: 'Hallo' },
          fallbackKeys: [],
          checksum: digest,
        },
      },
    };
    let job = {
      id: 'historical',
      status,
      progress: {
        completedSteps: 1,
        totalSteps: 1,
        details: { locale: 'en', translated: 1, skipped: 0 },
      },
    };
    vi.mocked(requestCatalog).mockImplementation(async (operation) => {
      if (operation.operation === 'overview')
        return {
          scope,
          catalogs: [{ contractId: 'ui' }],
          releases: [],
          bases: [],
          setup: { ready: true, reason: 'ready' },
        };
      if (operation.operation === 'read') return structuredClone(editor);
      if (operation.operation === 'translate') {
        job = { ...job, id: 'just-started' };
        editor.draft.valuesByLocale = { en: { greeting: translation } };
        editor.values.en = { greeting: translation };
      }
      return job;
    });
    const page = render(<CatalogsPage sourceOnly={false} />);
    const plan = await screen.findByText(/appTranslations.ui.translationPlan/);
    expect(plan.textContent).toContain(`appTranslations.ui.locales.en: ${missing ? 1 : 0}`);
    const jobStatus = () => screen.queryByText(/appTranslations.ui.jobStatus/);
    const progressDetails = () => screen.queryByText(/appTranslations.ui.translationProgress/);
    await waitFor(() => {
      expect(Boolean(jobStatus())).toBe(visible);
      expect(Boolean(progressDetails())).toBe(visible);
    });
    const translateButton = screen.getByRole('button', {
      name: 'appTranslations.ui.translateMissing',
    });
    expect(translateButton).toHaveProperty('disabled', !missing || status === 'running');
    if (!missing) {
      fireEvent.click(translateButton);
      expect(requestCatalog.mock.calls.some(([op]) => op.operation === 'translate')).toBe(false);
    }
    if (missing) {
      fireEvent.click(screen.getByRole('button', { name: 'appTranslations.ui.translateMissing' }));
      await screen.findByText(/appTranslations.ui.jobStatus.succeeded/);
      expect(progressDetails()).toBeTruthy();
      await waitFor(() => {
        expect(translateButton).toHaveProperty('disabled', true);
        expect(screen.getByText(/appTranslations.ui.translationPlan/).textContent).toContain(
          'appTranslations.ui.locales.en: 0'
        );
      });
      page.unmount();
      render(<CatalogsPage sourceOnly={false} />);
      await screen.findByText(/appTranslations.ui.translationPlan/);
      expect(jobStatus()).toBeNull();
      expect(progressDetails()).toBeNull();
    }
    if (status === 'running') {
      expect(screen.getByText('appTranslations.ui.draftTranslating')).toBeTruthy();
      job = { ...job, status: 'succeeded' };
      await waitFor(
        () => expect(jobStatus()?.textContent).toContain('appTranslations.ui.jobStatus.succeeded'),
        { timeout: 3000 }
      );
    }
  });
  it('starts only explicitly and keeps dirty text, search and selection while polling a persisted job', async () => {
    publishSessionAccessSnapshot({
      isResolved: true,
      permissionActions: ['app-translations.catalog.write'],
      roles: [],
      assignedModules: ['app-translations'],
    });
    const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
    const source = {
      value: 'Hallo',
      origin: 'default',
      sourceDigest: '',
      confirmedSourceDigest: null,
    };
    const editor = {
      draft: {
        id: 'draft',
        scope,
        manifestId: 'manifest',
        manifest: {
          contractId: 'ui',
          manifestVersion: '1',
          appCompatibility: { minVersion: '1.0.0' },
          keys: {
            greeting: {
              type: 'string',
              defaultValue: 'Hallo',
              placeholders: {},
              allowEmpty: false,
            },
          },
        },
        draftRevision: '1',
        supportedLocales: ['de', 'en'],
        valuesByLocale: {},
        baseReleaseId: 'basis',
      },
      values: { de: { greeting: source } },
      baseCatalogs: { de: { values: { greeting: 'Hallo' } } },
    };
    let job: {
      id: string;
      status: string;
      progress?: {
        completedSteps: number;
        totalSteps: number;
        details: { locale: string; translated: number; skipped: number };
      };
    } | null = null;
    vi.mocked(requestCatalog).mockImplementation(async (operation) => {
      if (operation.operation === 'overview')
        return {
          scope,
          catalogs: [{ contractId: 'ui' }],
          releases: [],
          bases: [],
          setup: { ready: true, reason: 'ready' },
        };
      if (operation.operation === 'read') return editor;
      if (operation.operation === 'translate') {
        job = {
          id: 'job',
          status: 'running',
          progress: {
            completedSteps: 1,
            totalSteps: 2,
            details: { locale: 'en', translated: 1, skipped: 0 },
          },
        };
        return job;
      }
      return job;
    });
    render(<CatalogsPage sourceOnly={false} />);
    const button = await screen.findByRole('button', {
      name: 'appTranslations.ui.translateMissing',
    });
    expect(requestCatalog.mock.calls.some(([op]) => op.operation === 'translate')).toBe(false);
    await waitFor(() => expect(button).toHaveProperty('disabled', false));
    fireEvent.click(button);
    await screen.findByText(/appTranslations.ui.jobStatus.running/);
    expect(
      screen.getByText(/appTranslations.ui.locales.en.*appTranslations.ui.translationProgress/)
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('appTranslations.ui.language'), {
      target: { value: 'en' },
    });
    fireEvent.change(screen.getByLabelText('appTranslations.ui.search'), {
      target: { value: 'greeting' },
    });
    fireEvent.change(screen.getByLabelText('appTranslations.ui.value'), {
      target: { value: 'My unsaved correction' },
    });
    await waitFor(() => expect(button).toHaveProperty('disabled', true));
    const reads = vi
      .mocked(requestCatalog)
      .mock.calls.filter(([op]) => op.operation === 'read').length;
    vi.useFakeTimers();
    job = { id: 'job', status: 'succeeded' };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByLabelText('appTranslations.ui.value')).toHaveProperty(
      'value',
      'My unsaved correction'
    );
    expect(screen.getByLabelText('appTranslations.ui.search')).toHaveProperty('value', 'greeting');
    expect(screen.getByLabelText('appTranslations.ui.language')).toHaveProperty('value', 'en');
    expect(
      vi.mocked(requestCatalog).mock.calls.filter(([op]) => op.operation === 'read')
    ).toHaveLength(reads);
  });
  it('renders the guarded global import and empty state from the actual overview contract', async () => {
    vi.mocked(requestCatalog).mockResolvedValue({
      scope: { kind: 'global' },
      catalogs: [],
      releases: [],
      bases: [],
    });
    render(<CatalogsPage platform />);
    expect(await screen.findByText('appTranslations.ui.empty')).toBeTruthy();
    expect(screen.getByLabelText('appTranslations.ui.importFile')).toBeTruthy();
    expect(requestCatalog).toHaveBeenCalledWith(
      { operation: 'overview' },
      undefined,
      expect.any(AbortSignal),
      'source'
    );
    expect(validateCatalogManifest(manifest).keys.labels?.defaultValue).toEqual([
      'Öffnen',
      'Schließen',
    ]);
  });
  it('explains the app file and imports German source texts without a language selection', async () => {
    registerPluginTranslationResolver((key) => {
      let value: unknown = appTranslationsPlugin.translations?.de;
      for (const part of key.split('.'))
        value =
          value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
      return typeof value === 'string' ? value : key;
    });
    vi.mocked(requestCatalog).mockResolvedValue({
      scope: { kind: 'global' },
      catalogs: [],
      releases: [],
      bases: [],
    });
    render(<CatalogsPage platform />);
    await screen.findByText('App-Texte aus der Entwicklung übernehmen');
    expect(screen.getByText(/von der App-Entwicklung bereitgestellte JSON-Datei/)).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    vi.mocked(requestCatalog).mockRejectedValueOnce(new Error('controlled import failure'));
    const file = new File([JSON.stringify(manifest)], 'app-texts.json', {
      type: 'application/json',
    });
    fireEvent.change(screen.getByLabelText('App-Textdatei (JSON)'), { target: { files: [file] } });
    await waitFor(() =>
      expect(requestCatalog).toHaveBeenCalledWith(
        expect.objectContaining({ operation: 'import', manifest, locales: ['de'] }),
        { kind: 'global' },
        undefined,
        'source'
      )
    );
  });
  it.each([true, false])(
    'explains setup and exposes the interface link only with its own permission (%s)',
    async (canManageInterfaces) => {
      vi.mocked(requestCatalog).mockResolvedValue({
        scope: { kind: 'municipal', instanceId: 'a', organizationId: 'org' },
        catalogs: [],
        releases: [],
        bases: [],
        setup: { ready: false, reason: 'not_configured', interfaceId: null, selectedLocales: [] },
        canManageInterfaces,
      });
      render(<CatalogsPage sourceOnly={false} />);
      await screen.findByText('appTranslations.ui.setupTitle');
      expect(!!screen.queryByRole('link', { name: 'appTranslations.ui.setupLink' })).toBe(
        canManageInterfaces
      );
      if (!canManageInterfaces)
        expect(screen.getByText('appTranslations.ui.setupAdmin')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'appTranslations.ui.seal' })).toBeNull();
    }
  );
  it('does not show global data when the transport returns a municipal scope', async () => {
    vi.mocked(requestCatalog).mockResolvedValue({
      scope: { kind: 'municipal', instanceId: 'a', organizationId: 'org' },
      catalogs: [],
      releases: [],
      bases: [],
    });
    render(<CatalogsPage platform />);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('appTranslations.ui.catalog_forbidden')
    );
    expect(screen.queryByLabelText('appTranslations.ui.importFile')).toBeNull();
  });
});

describe('snapshot download', () => {
  it.each([true, false])(
    'downloads a specific saved release without refreshing the editor (sourceOnly=%s)',
    async (sourceOnly) => {
      const scope = { kind: 'municipal' as const, instanceId: 'tenant', organizationId: 'org' };
      publishSessionAccessSnapshot({
        isResolved: true,
        permissionActions: ['app-texts.catalog.write', 'app-translations.catalog.write'],
        roles: [],
        assignedModules: ['app-translations'],
      });
      const text = {
        value: 'Stored text',
        origin: 'default' as const,
        sourceDigest: '',
        confirmedSourceDigest: null,
      };
      const editor: CatalogEditorData = {
        draft: {
          id: 'draft',
          scope,
          manifestId: 'manifest',
          draftRevision: '100',
          baseReleaseId: null,
          supportedLocales: ['de', 'en'],
          valuesByLocale: {},
          manifest: {
            contractId: 'ui',
            manifestVersion: '1',
            appCompatibility: { minVersion: '1.0.0' },
            keys: {
              close: {
                type: 'string',
                defaultValue: 'Stored text',
                placeholders: {},
                allowEmpty: false,
              },
            },
          },
        },
        values: { de: { close: text }, en: { close: text } },
        baseCatalogs: {},
      };
      vi.mocked(requestCatalog).mockImplementation(async (op) =>
        op.operation === 'overview'
          ? {
              scope,
              catalogs: [{ contractId: 'ui' }],
              bases: [],
              setup: { ready: true, reason: 'ready' },
              releases: [
                {
                  id: 'old',
                  contractId: 'ui',
                  catalogSetRevision: '2',
                  draftRevision: '97',
                  supportedLocales: ['de', 'en'],
                },
              ],
            }
          : editor
      );
      vi.mocked(requestCatalogDownload).mockResolvedValue(new Blob(['export const texts = {};']));
      const create = vi.fn(() => 'blob:snapshot');
      const revoke = vi.fn();
      vi.stubGlobal(
        'URL',
        class extends URL {
          static createObjectURL = create;
          static revokeObjectURL = revoke;
        }
      );
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
        expect(this.download).toBe('texts.js');
        expect(this.href).toBe('blob:snapshot');
      });
      render(<CatalogsPage sourceOnly={sourceOnly} />);
      fireEvent.click(
        (await screen.findByText('appTranslations.ui.preview ui / 2')).closest('summary')!
      );
      const button = await screen.findByRole('link', { name: 'appTranslations.ui.downloadTexts' });
      expect(
        new URL(button.getAttribute('href')!, 'https://studio.test').searchParams.get('mode')
      ).toBe(sourceOnly ? 'source' : 'translations');
      const input = await screen.findByLabelText('appTranslations.ui.value');
      fireEvent.change(input, { target: { value: 'Unsaved correction' } });
      const requests = vi.mocked(requestCatalog).mock.calls.length;
      fireEvent.click(button);
      await screen.findByText('appTranslations.ui.downloadedTexts');
      expect(requestCatalogDownload).toHaveBeenCalledWith(
        'old',
        scope,
        expect.any(AbortSignal),
        sourceOnly ? 'source' : 'translations'
      );
      expect(click).toHaveBeenCalledOnce();
      expect(input).toHaveProperty('value', 'Unsaved correction');
      expect(requestCatalog).toHaveBeenCalledTimes(requests);
      await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:snapshot'));
      vi.mocked(requestCatalogDownload).mockRejectedValue(
        new MainserverApiError('catalog_export_incompatible')
      );
      fireEvent.click(button);
      await screen.findByText('appTranslations.ui.catalog_export_incompatible');
      expect(input).toHaveProperty('value', 'Unsaved correction');
      expect(create).toHaveBeenCalledOnce();
      expect(requestCatalog).toHaveBeenCalledTimes(requests);
      click.mockRestore();
    }
  );
  it('aborts an outstanding download on unmount and creates no file', async () => {
    vi.mocked(requestCatalog).mockResolvedValue({
      scope: { kind: 'municipal', instanceId: 'tenant', organizationId: 'org' },
      catalogs: [],
      bases: [],
      releases: [
        {
          id: 'old',
          contractId: 'ui',
          catalogSetRevision: '2',
          draftRevision: '97',
          supportedLocales: ['de'],
        },
      ],
    });
    let finish!: (value: Blob) => void;
    vi.mocked(requestCatalogDownload).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    const create = vi.fn();
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
      }
    );
    const view = render(<CatalogsPage />);
    fireEvent.click(
      (await screen.findByText('appTranslations.ui.preview ui / 2')).closest('summary')!
    );
    fireEvent.click(await screen.findByRole('link', { name: 'appTranslations.ui.downloadTexts' }));
    const signal = vi.mocked(requestCatalogDownload).mock.calls[0]![2];
    view.unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(new Blob(['ignored'])));
    expect(create).not.toHaveBeenCalled();
  });
});
