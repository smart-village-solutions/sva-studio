/** Complete legal wording groups, preserving existing independent contracts. */
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox } from '@sva/studio-ui-react';

import {
  SsfV2Field as Field,
  updateSsfV2Field,
  type SsfV2EditorProps,
} from './admin.content-v2-field-control.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import type { SsfLegalLocalization, SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields> & {
  supportedLanguages: SsfSupportedLanguagesCatalog | null;
};
const choiceKeys = [
  'mode2Consent',
  'mode3Consent',
  'guestRecordingRelease',
  'staffRecordingRelease',
] as const;
export const blankLocalization = (locale: string): SsfLegalLocalization => ({
  locale,
  mode2Consent: null,
  mode3Consent: null,
  guestRecordingRelease: null,
  staffRecordingRelease: null,
  recordingStatus: null,
});
const blankChoice = () => ({ headline: '', bodyHtml: '', acceptLabel: '', declineLabel: '' });

export const LegalGroups = ({
  props,
  entry,
  index,
}: {
  props: Props;
  entry: SsfLegalLocalization;
  index: number;
}) => {
  const pt = usePluginTranslation('ssf');
  const inherited = props.inherited?.legalTexts?.localizations.find(
    (item) => item.locale === entry.locale
  );
  return (
    <div className="space-y-5">
      {([...choiceKeys, 'recordingStatus'] as const).map((key) => {
        const value = entry[key];
        const path = ['legalTexts', 'localizations', index, key] as const;
        const original = inherited?.[key];
        return (
          <fieldset key={key} aria-label={pt(`v2.legalTexts.${key}`)} className="space-y-3">
            <legend>{pt(`v2.legalTexts.${key}`)}</legend>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={value !== null}
                disabled={props.disabled}
                onChange={(event) => {
                  const blank =
                    key === 'recordingStatus'
                      ? { waiting: '', running: '', stopped: '', renewedReleaseRequired: '' }
                      : blankChoice();
                  props.onChange(
                    updateSsfV2Field(
                      props.value,
                      path,
                      event.currentTarget.checked ? (original ?? blank) : null
                    )
                  );
                }}
              />
              {pt('v2.legalTexts.configured')}
            </label>
            {value === null ? (
              <p className="text-sm text-muted-foreground">{pt('v2.legalTexts.missing')}</p>
            ) : (
              (key === 'recordingStatus'
                ? ['waiting', 'running', 'stopped', 'renewedReleaseRequired']
                : ['headline', 'bodyHtml', 'acceptLabel', 'declineLabel']
              ).map((field) => (
                <Field
                  key={field}
                  {...props}
                  inherited={original ? props.inherited : undefined}
                  path={[...path, field]}
                  labelKey={`v2.legalTexts.${field}`}
                  kind={field === 'bodyHtml' ? 'html' : 'text'}
                />
              ))
            )}
          </fieldset>
        );
      })}
    </div>
  );
};
