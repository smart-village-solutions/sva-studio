import { Button, Textarea } from '@sva/studio-ui-react';
import { type CatalogEditorViewModel } from './catalog.editor.state.js';

export const CatalogFieldMetadata = ({ model }: { model: CatalogEditorViewModel }) => {
  const { pt, reviewRequired, definition, own, effective } = model;
  if (!definition) return null;
  return (
    <dl className="grid gap-3 text-sm md:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">{pt('type')}</dt>
        <dd>{definition.type}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{pt('placeholders')}</dt>
        <dd>
          {Object.entries(definition.placeholders)
            .map(([name, type]) => `${name}: ${type}`)
            .join(', ') || pt('none')}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{pt('origin')}</dt>
        <dd>
          {pt(
            !effective
              ? 'missing'
              : effective.origin === 'machine'
                ? 'machine'
                : own
                  ? 'own'
                  : 'inherited'
          )}
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{pt('status')}</dt>
        <dd>{pt(reviewRequired ? 'reviewRequired' : effective ? 'complete' : 'missing')}</dd>
      </div>
    </dl>
  );
};

export const CatalogInput = ({ model }: { model: CatalogEditorViewModel }) => {
  const { busy, pt, locale, input, setInput, setDirty, invalid, setInvalid, canEdit, definition } =
    model;
  if (!definition) return null;
  return (
    <>
      <label className="block space-y-2">
        {pt('value')}
        <Textarea
          lang={locale}
          dir="auto"
          value={input}
          disabled={!canEdit || busy}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'catalog-value-error' : 'catalog-value-help'}
          onChange={(event) => {
            setInput(event.target.value);
            setDirty(true);
            setInvalid(false);
          }}
        />
      </label>
      <p id="catalog-value-help" className="text-sm text-muted-foreground">
        {pt(
          definition.type === 'stringArray'
            ? 'arrayHelp'
            : definition.allowEmpty
              ? 'emptyAllowed'
              : 'valueHelp'
        )}
      </p>
      {invalid && (
        <p id="catalog-value-error" role="alert" className="text-destructive">
          {pt('invalid_catalog')}
        </p>
      )}
    </>
  );
};

export const CatalogFieldActions = ({ model }: { model: CatalogEditorViewModel }) => {
  const {
    data,
    busy,
    pt,
    setInput,
    dirty,
    setDirty,
    setInvalid,
    reviewRequired,
    canEdit,
    definition,
    own,
    effective,
    savedInput,
    save,
    fieldOperation,
  } = model;
  if (!definition) return null;
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        disabled={!canEdit || busy || (!dirty && !(definition.allowEmpty && !effective))}
        onClick={() => void save()}
      >
        {pt('save')}
      </Button>
      {dirty && (
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            setInput(savedInput);
            setDirty(false);
            setInvalid(false);
          }}
        >
          {pt('discard')}
        </Button>
      )}
      {data.draft.scope.kind === 'municipal' && (
        <Button
          type="button"
          variant="secondary"
          disabled={!canEdit || busy || dirty || !own}
          onClick={() => void fieldOperation('reset')}
        >
          {pt('reset')}
        </Button>
      )}
      {reviewRequired && own?.origin === 'manual' && (
        <Button
          type="button"
          variant="secondary"
          disabled={!canEdit || busy || dirty}
          onClick={() => void fieldOperation('confirm')}
        >
          {pt('confirm')}
        </Button>
      )}
    </div>
  );
};
