import { Input, Select } from '@sva/studio-ui-react';
import { type CatalogPageViewModel } from './catalog.page.state.js';
export const CatalogMessages = ({ model }: { model: CatalogPageViewModel }) => {
  const { overview, error, notice, pt } = model;
  return (
    <>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive"
        >
          {pt(
            [
              'catalog_export_incompatible',
              'catalog_setup_required',
              'deepl_text_too_large',
              'catalog_conflict',
              'catalog_incomplete',
              'catalog_review_required',
              'catalog_forbidden',
              'catalog_not_found',
              'invalid_catalog',
            ].includes(error)
              ? error
              : 'catalog_unavailable'
          )}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {pt(notice)}
        </p>
      )}
      {!overview && !error && <p role="status">{pt('loading')}</p>}
    </>
  );
};

export const CatalogScope = ({ model }: { model: CatalogPageViewModel }) => {
  const { overview, pt, sourceOnly, ready } = model;
  if (!overview) return null;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {pt('scope')}:{' '}
        {overview.scope.kind === 'global'
          ? pt('global')
          : `${overview.scope.instanceId} / ${overview.scope.organizationId}`}
      </p>
      {!sourceOnly && overview.setup && (
        <section role="status" className="space-y-2 rounded-lg border border-border bg-card p-5">
          <h2 className="font-semibold">{pt(ready ? 'setupReady' : 'setupTitle')}</h2>
          <p>{pt(`setupReasons.${overview.setup.reason}`)}</p>
          {overview.canManageInterfaces ? (
            <a className="underline" href="/interfaces">
              {pt('setupLink')}
            </a>
          ) : (
            <p>{pt('setupAdmin')}</p>
          )}
        </section>
      )}
    </>
  );
};

export const CatalogImport = ({ model }: { model: CatalogPageViewModel }) => {
  const { dirty, busy, pt, importFile } = model;
  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-card p-6"
      aria-labelledby="catalog-import-heading"
    >
      <h2 id="catalog-import-heading" className="text-lg font-semibold">
        {pt('import')}
      </h2>
      <p className="text-sm text-muted-foreground">{pt('importHelp')}</p>

      <label className="block space-y-2">
        {pt('importFile')}
        <Input
          type="file"
          accept=".json,application/json"
          disabled={busy || dirty}
          onChange={(event) => {
            void importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
    </section>
  );
};

export const CatalogSelection = ({ model }: { model: CatalogPageViewModel }) => {
  const { overview, contractId, setContractId, setBaseId, dirty, busy, pt } = model;
  if (!overview) return null;
  return (
    <section className="space-y-3" aria-labelledby="catalog-overview-heading">
      <h2 id="catalog-overview-heading" className="text-lg font-semibold">
        {pt('catalogs')}
      </h2>
      {overview.catalogs.length === 0 ? (
        <p>{pt('empty')}</p>
      ) : (
        <label className="block space-y-2">
          {pt('catalog')}
          <Select
            value={contractId}
            disabled={busy || dirty}
            onChange={(event) => {
              setContractId(event.target.value);
              setBaseId('');
            }}
          >
            {overview.catalogs.map((catalog) => (
              <option key={catalog.contractId} value={catalog.contractId}>
                {catalog.contractId}
              </option>
            ))}
          </Select>
        </label>
      )}
    </section>
  );
};

export const catalogPageHeading = ({ pt, platform, sourceOnly }: CatalogPageViewModel) => ({
  title: pt(platform ? 'standardsTitle' : sourceOnly ? 'sourceTitle' : 'title'),
  description: pt(
    platform ? 'standardsDescription' : sourceOnly ? 'sourceDescription' : 'description'
  ),
});
