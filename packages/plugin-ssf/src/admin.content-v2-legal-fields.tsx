import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, Select, StudioField, StudioSection, Tabs, TabsContent, TabsList, TabsTrigger } from '@sva/studio-ui-react';
import { useState } from 'react';

import { SsfV2Field as Field, updateSsfV2Field, type SsfV2EditorProps } from './admin.content-v2-field-control.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';
import type { SsfLegalLocalization, SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields> & { supportedLanguages: SsfSupportedLanguagesCatalog | null };
const choiceKeys = ['mode2Consent', 'mode3Consent', 'guestRecordingRelease', 'staffRecordingRelease'] as const;
const blankLocalization = (locale: string): SsfLegalLocalization => ({
  locale, mode2Consent: null, mode3Consent: null, guestRecordingRelease: null,
  staffRecordingRelease: null, recordingStatus: null,
});
const blankChoice = () => ({ headline: '', bodyHtml: '', acceptLabel: '', declineLabel: '' });

const LegalGroups = ({ props, entry, index }: { props: Props; entry: SsfLegalLocalization; index: number }) => {
  const pt = usePluginTranslation('ssf');
  const inherited = props.inherited?.legalTexts?.localizations.find((item) => item.locale === entry.locale);
  return <div className="space-y-5">
    {([...choiceKeys, 'recordingStatus'] as const).map((key) => {
      const value = entry[key];
      const path = ['legalTexts', 'localizations', index, key] as const;
      const original = inherited?.[key];
      return <fieldset key={key} aria-label={pt(`v2.legalTexts.${key}`)} className="space-y-3">
        <legend>{pt(`v2.legalTexts.${key}`)}</legend>
        <label className="flex items-center gap-2">
          <Checkbox checked={value !== null} disabled={props.disabled} onChange={(event) => {
            const blank = key === 'recordingStatus'
              ? { waiting: '', running: '', stopped: '', renewedReleaseRequired: '' } : blankChoice();
            props.onChange(updateSsfV2Field(props.value, path, event.currentTarget.checked ? (original ?? blank) : null));
          }} />{pt('v2.legalTexts.configured')}
        </label>
        {value === null ? <p className="text-sm text-muted-foreground">{pt('v2.legalTexts.missing')}</p> :
          (key === 'recordingStatus' ? ['waiting', 'running', 'stopped', 'renewedReleaseRequired'] :
            ['headline', 'bodyHtml', 'acceptLabel', 'declineLabel']).map((field) => <Field
            key={field} {...props} inherited={original ? props.inherited : undefined}
            path={[...path, field]} labelKey={`v2.legalTexts.${field}`} kind={field === 'bodyHtml' ? 'html' : 'text'} />)}
      </fieldset>;
    })}
  </div>;
};

const LegalLanguages = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const [locale, setLocale] = useState('');
  const legal = props.value.legalTexts;
  if (!legal) return null;
  const canAdd = !props.disabled && !props.inherited?.legalTexts && props.supportedLanguages !== null;
  const available = Object.entries(props.supportedLanguages?.languages ?? {})
    .filter(([code]) => !legal.localizations.some((entry) => entry.locale === code));
  return <>
    <div className="flex flex-wrap items-end gap-3">
      <StudioField id="ssf-legal-new-locale" label={pt('v2.legalTexts.newLanguage')}>
        <Select id="ssf-legal-new-locale" disabled={!canAdd} value={locale} onChange={(event) => setLocale(event.currentTarget.value)}>
          <option value="">{pt('v2.chooseLanguage')}</option>
          {available.map(([code, language]) => <option key={code} value={code}>{language.name} ({language.native}) · {code}</option>)}
        </Select>
      </StudioField>
      <Button type="button" variant="secondary" disabled={!canAdd || !locale || legal.localizations.length >= 30}
        onClick={() => {
          props.onChange({ ...props.value, legalTexts: { ...legal, localizations: [...legal.localizations, blankLocalization(locale)] } });
          setLocale('');
        }}>{pt('v2.legalTexts.addLanguage')}</Button>
    </div>
    <Tabs defaultValue={legal.localizations[0]?.locale ?? ''}>
      <TabsList aria-label={pt('v2.legalTexts.languages')}>
        {legal.localizations.map((entry) => <TabsTrigger key={entry.locale} value={entry.locale}>{entry.locale}</TabsTrigger>)}
      </TabsList>
      {legal.localizations.map((entry, index) => <TabsContent key={entry.locale} value={entry.locale} className="space-y-5">
        {!props.inherited?.legalTexts && entry.locale !== legal.sourceLocale ? <Button type="button" variant="secondary"
          disabled={props.disabled || !props.supportedLanguages} onClick={() => props.onChange({ ...props.value,
            legalTexts: { ...legal, localizations: legal.localizations.filter((item) => item.locale !== entry.locale) },
          })}>{pt('v2.legalTexts.removeLanguage')}</Button> : null}
        <LegalGroups props={props} entry={entry} index={index} />
      </TabsContent>)}
    </Tabs>
  </>;
};

export const SsfLegalTextsEditor = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const legal = props.value.legalTexts;
  const inherited = props.inherited?.legalTexts;
  return <StudioSection title={pt('v2.legalTexts.title')}>
    <p className="text-sm text-muted-foreground">{pt('v2.legalTexts.sourceNotice')}</p>
    {!legal ? <Button type="button" variant="secondary" disabled={props.disabled || !props.supportedLanguages}
      onClick={() => props.onChange({ ...props.value, legalTexts: {
        sourceLocale: props.value.staff.locale, version: '', localizations: [blankLocalization(props.value.staff.locale)],
      } })}>{pt('v2.legalTexts.add')}</Button> : <div className="space-y-5">
      <StudioField id="ssf-legal-source-locale" label={pt('v2.legalTexts.sourceLocale')} error={props.errors?.['legalTexts.sourceLocale']}>
        <Select id="ssf-legal-source-locale" disabled={props.disabled || !props.supportedLanguages} value={legal.sourceLocale}
          onChange={(event) => props.onChange({ ...props.value, legalTexts: { ...legal, sourceLocale: event.currentTarget.value } })}>
          {legal.localizations.map((entry) => <option key={entry.locale} value={entry.locale}>{entry.locale}</option>)}
        </Select>
      </StudioField>
      {inherited && legal.sourceLocale !== inherited.sourceLocale ? <Button type="button" variant="tertiary" disabled={props.disabled}
        onClick={() => props.onChange({ ...props.value, legalTexts: { ...legal, sourceLocale: inherited.sourceLocale } })}>
        {pt('fields.inherit')}</Button> : null}
      <Field {...props} inherited={inherited ? props.inherited : undefined} path={['legalTexts', 'version']} labelKey="v2.legalTexts.version" />
      <LegalLanguages {...props} />
    </div>}
  </StudioSection>;
};
