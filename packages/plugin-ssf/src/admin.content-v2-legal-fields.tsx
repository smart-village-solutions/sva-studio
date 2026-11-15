/** Legal source/version fields compose the independent localisation editor. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Select, StudioField, StudioSection } from '@sva/studio-ui-react';

import { SsfV2Field as Field, type SsfV2EditorProps } from './admin.content-v2-field-control.js';
import { blankLocalization } from './admin.content-v2-legal-groups.js';
import { LegalLanguages } from './admin.content-v2-legal-languages.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields> & {
  supportedLanguages: SsfSupportedLanguagesCatalog | null;
};
export const SsfLegalTextsEditor = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const legal = props.value.legalTexts;
  const inherited = props.inherited?.legalTexts;
  return (
    <StudioSection title={pt('v2.legalTexts.title')}>
      <p className="text-sm text-muted-foreground">{pt('v2.legalTexts.sourceNotice')}</p>
      {!legal ? (
        <Button
          type="button"
          variant="secondary"
          disabled={props.disabled || !props.supportedLanguages}
          onClick={() =>
            props.onChange({
              ...props.value,
              legalTexts: {
                sourceLocale: props.value.staff.locale,
                version: '',
                localizations: [blankLocalization(props.value.staff.locale)],
              },
            })
          }
        >
          {pt('v2.legalTexts.add')}
        </Button>
      ) : (
        <div className="space-y-5">
          <StudioField
            id="ssf-legal-source-locale"
            label={pt('v2.legalTexts.sourceLocale')}
            error={props.errors?.['legalTexts.sourceLocale']}
          >
            <Select
              id="ssf-legal-source-locale"
              disabled={props.disabled || !props.supportedLanguages}
              value={legal.sourceLocale}
              onChange={(event) =>
                props.onChange({
                  ...props.value,
                  legalTexts: { ...legal, sourceLocale: event.currentTarget.value },
                })
              }
            >
              {legal.localizations.map((entry) => (
                <option key={entry.locale} value={entry.locale}>
                  {entry.locale}
                </option>
              ))}
            </Select>
          </StudioField>
          {inherited && legal.sourceLocale !== inherited.sourceLocale ? (
            <Button
              type="button"
              variant="tertiary"
              disabled={props.disabled}
              onClick={() =>
                props.onChange({
                  ...props.value,
                  legalTexts: { ...legal, sourceLocale: inherited.sourceLocale },
                })
              }
            >
              {pt('fields.inherit')}
            </Button>
          ) : null}
          <Field
            {...props}
            inherited={inherited ? props.inherited : undefined}
            path={['legalTexts', 'version']}
            labelKey="v2.legalTexts.version"
          />
          <LegalLanguages {...props} />
        </div>
      )}
    </StudioSection>
  );
};
