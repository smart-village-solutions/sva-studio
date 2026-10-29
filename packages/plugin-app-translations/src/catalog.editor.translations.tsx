import { Button, Checkbox } from '@sva/studio-ui-react';
import { type CatalogEditorViewModel } from './catalog.editor.state.js';

export const CatalogTranslateKey = ({ model }: { model: CatalogEditorViewModel }) => {
  const {
    busy,
    pt,
    locale,
    dirty,
    replaceConfirmed,
    setReplaceConfirmed,
    own,
    translationMode,
    translateKey,
  } = model;
  return (
    <div className="space-y-2">
      {own?.origin === 'manual' && (
        <label className="flex items-center gap-2">
          <Checkbox
            type="checkbox"
            checked={replaceConfirmed}
            disabled={busy || dirty}
            onChange={(event) => setReplaceConfirmed(event.target.checked)}
          />
          {pt('replaceManual')}
        </label>
      )}
      <Button
        type="button"
        variant="secondary"
        disabled={busy || dirty || (own?.origin === 'manual' && !replaceConfirmed)}
        onClick={() =>
          void translateKey(translationMode, [locale], replaceConfirmed ? [locale] : [])
        }
      >
        {pt('translateKey')}
      </Button>
    </div>
  );
};

export const CatalogTransfer = ({ model }: { model: CatalogEditorViewModel }) => {
  const {
    busy,
    pt,
    languageName,
    locales,

    dirty,
    transferTargets,
    setTransferTargets,
    transferConfirmations,
    setTransferConfirmations,
    manualTransferTargets,
    translateKey,
  } = model;
  return (
    <fieldset className="space-y-2 rounded-md border border-border p-3" disabled={busy || dirty}>
      <legend>{pt('transferMunicipal')}</legend>
      <p className="text-sm text-muted-foreground">{pt('transferHelp')}</p>
      {locales
        .filter((target) => target !== 'de')
        .map((target) => (
          <label key={target} className="flex items-center gap-2">
            <Checkbox
              type="checkbox"
              checked={transferTargets.includes(target)}
              onChange={(event) => {
                setTransferTargets((current) =>
                  event.target.checked
                    ? [...current, target]
                    : current.filter((entry) => entry !== target)
                );
                setTransferConfirmations([]);
              }}
            />
            {languageName(target)}
          </label>
        ))}
      <CatalogManualTargets model={model} />
      <Button
        type="button"
        variant="secondary"
        disabled={
          busy ||
          dirty ||
          !transferTargets.length ||
          manualTransferTargets.some((target) => !transferConfirmations.includes(target))
        }
        onClick={() => void translateKey('municipal', transferTargets, transferConfirmations)}
      >
        {pt('transferMunicipal')}
      </Button>
    </fieldset>
  );
};

export const CatalogManualTargets = ({ model }: { model: CatalogEditorViewModel }) => {
  const {
    pt,
    languageName,

    transferConfirmations,
    setTransferConfirmations,
    manualTransferTargets,
  } = model;
  return (
    <>
      {manualTransferTargets.length > 0 && (
        <div
          role="group"
          aria-label={pt('replaceManualTargets')}
          className="space-y-2 border-t border-border pt-3"
        >
          <p className="text-sm font-medium">{pt('replaceManualTargets')}</p>
          {manualTransferTargets.map((target) => (
            <label key={target} className="flex items-center gap-2">
              <Checkbox
                type="checkbox"
                checked={transferConfirmations.includes(target)}
                onChange={(event) =>
                  setTransferConfirmations((current) =>
                    event.target.checked
                      ? [...current, target]
                      : current.filter((entry) => entry !== target)
                  )
                }
              />
              {languageName(target)} · {pt('replaceManual')}
            </label>
          ))}
        </div>
      )}
    </>
  );
};

export const CatalogFieldTranslations = ({ model }: { model: CatalogEditorViewModel }) => {
  const { data, locale, own } = model;
  return (
    <>
      {locale !== 'de' && <CatalogTranslateKey model={model} />}
      {locale === 'de' && data.draft.scope.kind === 'municipal' && own?.origin === 'manual' && (
        <CatalogTransfer model={model} />
      )}
    </>
  );
};
