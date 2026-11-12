/** Legal localisation membership and validation-round language selection. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Select, StudioField } from '@sva/studio-ui-react';
import { useEffect, useRef, useState } from 'react';

import {
  SsfLanguageVersionSelect,
  type SsfV2EditorProps,
} from './admin.content-v2-field-control.js';
import { LegalGroups, blankLocalization } from './admin.content-v2-legal-groups.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields> & {
  supportedLanguages: SsfSupportedLanguagesCatalog | null;
};
const AddLegalLanguage = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const [locale, setLocale] = useState('');
  const legal = props.value.legalTexts;
  if (!legal) return null;
  const canAdd =
    !props.disabled && !props.inherited?.legalTexts && props.supportedLanguages !== null;
  const available = Object.entries(props.supportedLanguages?.languages ?? {}).filter(
    ([code]) => !legal.localizations.some((entry) => entry.locale === code)
  );
  return (
    <div className="flex flex-wrap items-end gap-3">
      <StudioField id="ssf-legal-new-locale" label={pt('v2.legalTexts.newLanguage')}>
        <Select
          id="ssf-legal-new-locale"
          disabled={!canAdd}
          value={locale}
          onChange={(event) => setLocale(event.currentTarget.value)}
        >
          <option value="">{pt('v2.chooseLanguage')}</option>
          {available.map(([code, language]) => (
            <option key={code} value={code}>
              {language.name} ({language.native}) · {code}
            </option>
          ))}
        </Select>
      </StudioField>
      <Button
        type="button"
        variant="secondary"
        disabled={!canAdd || !locale || legal.localizations.length >= 30}
        onClick={() => {
          props.onChange({
            ...props.value,
            legalTexts: {
              ...legal,
              localizations: [...legal.localizations, blankLocalization(locale)],
            },
          });
          setLocale('');
        }}
      >
        {pt('v2.legalTexts.addLanguage')}
      </Button>
    </div>
  );
};

export const LegalLanguages = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const [selected, setSelected] = useState(props.value.legalTexts?.sourceLocale ?? '');
  const lastErrors = useRef(props.errors);
  const legal = props.value.legalTexts;
  useEffect(() => {
    // Keep subsequent manual language choices until a new validation result arrives.
    if (lastErrors.current === props.errors) return;
    lastErrors.current = props.errors;
    const path = Object.keys(props.errors ?? {}).find((key) =>
      key.startsWith('legalTexts.localizations.')
    );
    const entry = path
      ? props.value.legalTexts?.localizations[Number(path.split('.')[2])]
      : undefined;
    if (entry) setSelected(entry.locale);
  }, [props.errors, props.value.legalTexts]);
  if (!legal) return null;
  return (
    <>
      <AddLegalLanguage {...props} />
      <SsfLanguageVersionSelect
        entries={legal.localizations.map((entry) => ({ id: entry.locale, locale: entry.locale }))}
        selected={
          legal.localizations.some((entry) => entry.locale === selected)
            ? selected
            : legal.sourceLocale
        }
        onSelect={setSelected}
        catalog={props.supportedLanguages}
      />
      {legal.localizations.map((entry, index) => (
        <div
          key={entry.locale}
          hidden={
            entry.locale !==
            (legal.localizations.some((item) => item.locale === selected)
              ? selected
              : legal.sourceLocale)
          }
          className="space-y-5"
        >
          {!props.inherited?.legalTexts && entry.locale !== legal.sourceLocale ? (
            <Button
              type="button"
              variant="secondary"
              disabled={props.disabled || !props.supportedLanguages}
              onClick={() =>
                props.onChange({
                  ...props.value,
                  legalTexts: {
                    ...legal,
                    localizations: legal.localizations.filter(
                      (item) => item.locale !== entry.locale
                    ),
                  },
                })
              }
            >
              {pt('v2.legalTexts.removeLanguage')}
            </Button>
          ) : null}
          <LegalGroups props={props} entry={entry} index={index} />
        </div>
      ))}
    </>
  );
};
