import { Button, Select } from '@sva/studio-ui-react';
import { type CatalogPageViewModel } from './catalog.page.state.js';
export const CatalogBasis = ({ model }: { model: CatalogPageViewModel }) => {
  const {
    data,
    choosingBase,
    setChoosingBase,
    dirty,
    busy,
    pt,
    languageNames,
    canWrite,

    existingDraft,
    currentBaseId,
    currentBase,
    availableBases,
  } = model;
  return (
    <section
      className="space-y-3 rounded-lg border border-border p-5"
      aria-labelledby="catalog-base-heading"
    >
      <h2 id="catalog-base-heading" className="font-semibold">
        {pt('basis')}
      </h2>
      {existingDraft && (
        <>
          <p className="text-sm">
            {pt('currentBasis')}:{' '}
            {currentBase
              ? `${currentBase.contractId} / ${currentBase.catalogSetRevision} / ${languageNames(currentBase.supportedLocales)}`
              : (currentBaseId ?? pt('none'))}
          </p>
          {!choosingBase && availableBases.length > 0 && canWrite && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy || dirty || !data}
              onClick={() => setChoosingBase(true)}
            >
              {pt('switchBasis')}
            </Button>
          )}
        </>
      )}
      {(!existingDraft || choosingBase) && (
        <>
          <CatalogBasisPicker model={model} />{' '}
        </>
      )}
    </section>
  );
};

export const CatalogBasisPicker = ({ model }: { model: CatalogPageViewModel }) => {
  const {
    data,
    baseId,
    setBaseId,
    setChoosingBase,
    dirty,
    busy,
    pt,
    languageNames,
    canWrite,
    selectedBase,
    existingDraft,
    availableBases,
    applyBase,
  } = model;
  return (
    <>
      <label className="block space-y-2">
        {pt('chooseBasis')}
        <Select
          value={baseId}
          disabled={busy || dirty || !canWrite}
          onChange={(event) => setBaseId(event.target.value)}
        >
          <option value="">{pt('choose')}</option>
          {availableBases.map((base) => (
            <option key={base.id} value={base.id}>
              {base.contractId} / {base.catalogSetRevision} / {languageNames(base.supportedLocales)}
            </option>
          ))}
        </Select>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={busy || dirty || !canWrite || !selectedBase || Boolean(existingDraft && !data)}
          onClick={() => void applyBase()}
        >
          {pt(existingDraft ? 'changeBasis' : 'create')}
        </Button>
        {existingDraft && (
          <Button
            type="button"
            variant="tertiary"
            disabled={busy}
            onClick={() => {
              setChoosingBase(false);
              setBaseId('');
            }}
          >
            {pt('cancelBasisChange')}
          </Button>
        )}
      </div>
    </>
  );
};
