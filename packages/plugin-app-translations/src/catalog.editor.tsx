import {
  useCatalogEditor,
  type CatalogEditorProps,
  type CatalogEditorViewModel,
} from './catalog.editor.state.js';
import { save, fieldOperation, translateKey } from './catalog.editor.operations.js';
import { CatalogLocale, CatalogKeys } from './catalog.editor.navigation.js';
import { CatalogFieldMetadata, CatalogInput, CatalogFieldActions } from './catalog.editor.field.js';
import { CatalogFieldTranslations } from './catalog.editor.translations.js';
export { catalogSealIssues } from './catalog.editor.operations.js';
export const CatalogEditor = ({ sourceOnly = true, ...props }: CatalogEditorProps) => {
  const state = useCatalogEditor({ ...props, sourceOnly });
  const model = {
    ...state,
    save: save.bind(null, state),
    fieldOperation: fieldOperation.bind(null, state),
    translateKey: translateKey.bind(null, state),
  };
  if (!state.definition) return <p>{state.pt('empty')}</p>;
  return (
    <section
      ref={state.section}
      tabIndex={-1}
      className="space-y-5 rounded-lg border border-border-subtle bg-card p-4 sm:p-6"
      aria-labelledby="catalog-editor-heading"
    >
      <h2 id="catalog-editor-heading" className="text-xl font-semibold">
        {state.pt('editor')}
      </h2>
      <CatalogLocale model={model} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <CatalogKeys model={model} />
        <CatalogField model={model} />
      </div>
    </section>
  );
};

export const CatalogSources = ({ model }: { model: CatalogEditorViewModel }) => {
  const { pt, dirty, source, base, locale } = model;
  return (
    <>
      {dirty && (
        <p role="status" className="text-sm text-muted-foreground">
          {pt('unsaved')}
        </p>
      )}
      <div className="grid gap-4 border-t border-border pt-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">{pt('source')}</h3>
          <pre lang="de" className="whitespace-pre-wrap break-words text-sm">
            {typeof source === 'string' ? source : JSON.stringify(source ?? null, null, 2)}
          </pre>
        </div>
        <div>
          <h3 className="text-sm font-medium">{pt('standard')}</h3>
          <pre dir="auto" lang={locale} className="whitespace-pre-wrap break-words text-sm">
            {base === undefined
              ? pt('none')
              : typeof base === 'string'
                ? base
                : JSON.stringify(base, null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
};
export const CatalogField = ({ model }: { model: CatalogEditorViewModel }) => {
  const { canWrite, sourceOnly, translate, key } = model;
  return (
    <div className="min-w-0 space-y-5">
      <h3 className="break-all font-mono text-sm font-medium">{key}</h3>
      <CatalogFieldMetadata model={model} />
      <CatalogInput model={model} />
      <CatalogFieldActions model={model} />
      {!sourceOnly && canWrite && translate && <CatalogFieldTranslations model={model} />}
      <CatalogSources model={model} />
    </div>
  );
};
