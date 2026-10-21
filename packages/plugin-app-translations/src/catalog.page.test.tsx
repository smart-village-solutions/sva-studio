import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { registerPluginTranslationResolver } from '@sva/plugin-sdk';
import { CatalogsPage } from './catalog.page.js';
import { requestCatalog } from './catalog.api.js';
import manifest from '../tests/fixtures/catalog-demo.json';
import { appTranslationsPlugin } from './descriptor.js';
import { validateCatalogManifest } from '@sva/plugin-sdk/app-translations';
vi.mock('./catalog.api.js', () => ({ requestCatalog: vi.fn() }));
afterEach(cleanup);
beforeEach(() => {
  vi.mocked(requestCatalog).mockReset();
  registerPluginTranslationResolver((key) => key);
});
describe('catalog overview', () => {
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
