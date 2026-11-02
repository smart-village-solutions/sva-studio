import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button, Checkbox, Input, Select, StudioField, StudioSection,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@sva/studio-ui-react';
import { useRef, useState, type RefObject } from 'react';

import {
  SsfV2Field as Field, type SsfV2EditorProps, updateSsfV2Field,
} from './admin.content-v2-field-control.js';
import { blankFeedback, BrandingFields, FeedbackFields } from './admin.content-v2-fields.js';
import { SsfLegalTextsEditor } from './admin.content-v2-legal-fields.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';
import type { SsfSupportedLanguagesCatalog } from './content-v2-admin-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields> & Readonly<{ supportedLanguages: SsfSupportedLanguagesCatalog | null }>;
type Language = SsfRuntimeContentV2Fields['guestLanguages'][number];

const catalogLanguages = (catalog: SsfSupportedLanguagesCatalog) => {
  const popular = new Set(catalog.popular);
  return Object.entries(catalog.languages).sort(([left], [right]) =>
    Number(popular.has(right)) - Number(popular.has(left)) || left.localeCompare(right));
};

const catalogLocale = (locale: string, catalog: SsfSupportedLanguagesCatalog) =>
  catalog.languages[locale] ? locale : locale.split(/[-_]/, 1)[0] ?? locale;
const primaryLanguage = (locale: string) => locale.split('-')[0]?.toLowerCase();

const StaffFields = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const guestLanguages = new Set(props.value.guestLanguages.map(({ locale }) => primaryLanguage(locale)));
  const availableStaffLanguages = props.supportedLanguages
    ? catalogLanguages(props.supportedLanguages).filter(([locale]) => !guestLanguages.has(primaryLanguage(locale)))
    : [];
  return <StudioSection title={pt('v2.staff')}>
    <StudioField id="ssf-v2-staff-locale" label={pt('v2.locale')}>
      <Select id="ssf-v2-staff-locale" disabled={props.disabled || !props.supportedLanguages}
        value={props.supportedLanguages ? catalogLocale(props.value.staff.locale, props.supportedLanguages) : props.value.staff.locale}
        onChange={(event) => props.onChange(updateSsfV2Field(props.value, ['staff', 'locale'], event.currentTarget.value))}>
        {props.supportedLanguages && !props.supportedLanguages.languages[catalogLocale(props.value.staff.locale, props.supportedLanguages)]
          ? <option value={catalogLocale(props.value.staff.locale, props.supportedLanguages)}>{pt('v2.savedLanguageUnavailable')}</option>
          : null}
        {props.supportedLanguages ? availableStaffLanguages.map(([locale, language]) =>
          <option key={locale} value={locale}>{language.name} ({language.native}) · {locale}</option>) :
          <option value={props.value.staff.locale}>{props.value.staff.locale}</option>}
      </Select>
    </StudioField>
    <Field {...props} path={['staff', 'dashboard', 'headline']} labelKey="v2.dashboardHeadline" />
    <Field {...props} path={['staff', 'dashboard', 'explanationHtml']} labelKey="v2.dashboardExplanation" kind="html" />
    <Field {...props} path={['staff', 'dashboard', 'callToAction']} labelKey="v2.callToAction" />
    {(['headline', 'green', 'yellow', 'red'] as const).map((key) =>
      <Field key={key} {...props} path={['staff', 'dashboard', 'load', key]} labelKey={`v2.load.${key}`} />)}
    <Field {...props} path={['staff', 'newConversation', 'headline']} labelKey="v2.newConversationHeadline" />
    <Field {...props} path={['staff', 'newConversation', 'descriptionHtml']} labelKey="v2.newConversationDescription" kind="html" />
  </StudioSection>;
};

const RecordingFields = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const settings = props.value.recording ?? {};
  const value = { ...props.value, recording: settings };
  const editor = { ...props, value };
  const set = (key: string, next: unknown) => props.onChange({ ...props.value, recording: { ...settings, [key]: next } });
  const choices = {
    legalBasis: ['consent', 'statutory'], signature: ['off', 'optional', 'required'],
    idCheck: ['off', 'optional', 'required'], recoveryMode: ['standard', 'enhanced'],
  } as const;
  const effectiveHours = settings.retentionHours ?? props.inherited?.recording?.retentionHours ?? 720;
  return <StudioSection title={pt('v2.recording.title')}>
    <p>{pt('v2.recording.notice')}</p>
    {props.inherited ? <StudioField id="ssf-v2-recording-enabled" label={pt('v2.recording.enabled')}
      error={props.errors?.['recording.enabled']}>
      <Checkbox id="ssf-v2-recording-enabled" checked={settings.enabled === true} disabled={props.disabled}
        onChange={(event) => set('enabled', event.currentTarget.checked)} />
    </StudioField> : null}
    <StudioField id="ssf-v2-recording-retention" label={pt('v2.recording.retentionHours')}
      error={props.errors?.['recording.retentionHours']}>
      <Input id="ssf-v2-recording-retention" type="number" min={1} max={8760} step={1}
        disabled={props.disabled} value={settings.retentionHours ?? ''}
        onChange={(event) => set('retentionHours', event.currentTarget.value === '' ? null : Number(event.currentTarget.value))} />
    </StudioField>
    <p role="status">{pt('v2.recording.effectiveRetention')}: {effectiveHours}</p>
    <p>{pt(props.inherited ? settings.retentionHours == null ? 'v2.inherited' : 'v2.overridden' : 'v2.recording.installationDefault')}</p>
    {props.inherited ? <Button type="button" variant="tertiary" disabled={props.disabled}
      onClick={() => set('retentionHours', null)}>{pt('v2.recording.resetRetention')}</Button> : null}
    {Object.entries(choices).map(([key, options]) => <StudioField key={key} id={`ssf-v2-recording-${key}`} label={pt(`v2.recording.${key}`)}>
      <Select id={`ssf-v2-recording-${key}`} disabled={props.disabled} value={settings[key as keyof typeof choices] ?? ''}
        onChange={(event) => set(key, event.currentTarget.value || undefined)}>
        <option value="">{pt('v2.notConfigured')}</option>
        {options.map((option) => <option key={option} value={option}>{pt(`v2.recording.options.${option}`)}</option>)}
      </Select>
    </StudioField>)}
    <Field {...editor} path={['recording', 'verificationRequired']} labelKey="v2.recording.verificationRequired" kind="checkbox" />
    <Field {...editor} path={['recording', 'timestampAuthorityUrl']} labelKey="v2.recording.timestampAuthorityUrl" kind="url" />
    <Field {...editor} path={['recording', 'auditRetentionHours']} labelKey="v2.recording.auditRetentionHours" kind="number" />
    {(settings.texts ?? []).map((_entry, index) => <div key={index} className="space-y-2">
      <Field {...editor} path={['recording', 'texts', index, 'locale']} labelKey="v2.locale" />
      <Field {...editor} path={['recording', 'texts', index, 'consentHtml']} labelKey="v2.recording.consentHtml" kind="html" />
      <Field {...editor} path={['recording', 'texts', index, 'resumePromptHtml']} labelKey="v2.recording.resumePromptHtml" kind="html" />
      <Button type="button" variant="tertiary" disabled={props.disabled}
        onClick={() => set('texts', settings.texts?.filter((_, current) => current !== index))}>{pt('v2.recording.removeText')}</Button>
    </div>)}
    <Button type="button" variant="secondary" disabled={props.disabled || (settings.texts?.length ?? 0) >= 40}
      onClick={() => set('texts', [...(settings.texts ?? []), { locale: '', consentHtml: '', resumePromptHtml: '' }])}>
      {pt('v2.recording.addText')}
    </Button>
  </StudioSection>;
};

const AddLanguage = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const catalog = props.supportedLanguages;
  const [locale, setLocale] = useState('');
  const staffLanguage = primaryLanguage(props.value.staff.locale);
  const available = catalog ? catalogLanguages(catalog).filter(([code]) =>
    primaryLanguage(code) !== staffLanguage &&
    !props.value.guestLanguages.some((language) => language.locale === code)) : [];
  const add = () => {
    if (!catalog) return;
    const language = catalog.languages[locale];
    if (!language) return;
    props.onChange({ ...props.value, guestLanguages: [...props.value.guestLanguages, {
      locale, nativeName: language.native, staffName: language.name, icon: null,
      guest: { explanationHtml: '', storageQuestionHtml: null },
      feedback: blankFeedback(),
    }] });
    setLocale('');
  };
  return <div className="flex flex-wrap items-end gap-3">
    <StudioField id="ssf-v2-new-locale" label={pt('v2.newLanguage')}>
      <Select id="ssf-v2-new-locale" value={locale} disabled={props.disabled || !catalog}
        onChange={(event) => setLocale(event.currentTarget.value)}>
        <option value="">{pt('v2.chooseLanguage')}</option>
        {available.map(([code, language]) =>
          <option key={code} value={code}>{language.name} ({language.native}) · {code}</option>)}
      </Select>
    </StudioField>
    <Button type="button" variant="secondary" disabled={props.disabled || !catalog || !locale || !catalog.languages[locale] ||
      props.value.guestLanguages.length >= 30} onClick={add}>{pt('v2.addLanguage')}</Button>
  </div>;
};

const LanguageToggle = ({ props, language, hiddenLanguages }: {
  props: Props; language: Language; hiddenLanguages: RefObject<Map<string, Language>>;
}) => {
  const inherited = props.inherited;
  if (!inherited) return null;
  const active = props.value.guestLanguages.some((entry) => entry.locale === language.locale);
  const toggle = (enabled: boolean) => {
    if (!enabled) {
      const current = props.value.guestLanguages.find((entry) => entry.locale === language.locale);
      if (current) hiddenLanguages.current.set(language.locale, current);
    }
    props.onChange({
      ...props.value,
      guestLanguages: enabled
        ? inherited.guestLanguages.filter((entry) => entry.locale === language.locale ||
          props.value.guestLanguages.some((current) => current.locale === entry.locale))
          .map((entry) => props.value.guestLanguages.find((current) => current.locale === entry.locale) ??
            hiddenLanguages.current.get(entry.locale) ?? entry)
        : props.value.guestLanguages.filter((entry) => entry.locale !== language.locale),
    });
  };
  return <label className="flex items-center gap-2">
    <Checkbox checked={active} disabled={props.disabled || !props.supportedLanguages ||
      (active && props.value.guestLanguages.length === 1)}
      onChange={(event) => toggle(event.currentTarget.checked)} />
    <span>{language.nativeName} ({language.locale})</span>
  </label>;
};

const LanguageTab = ({ props, language, index }: { props: Props; language: Language; index: number }) => {
  const pt = usePluginTranslation('ssf');
  return <TabsContent value={language.locale} className="space-y-5">
    {!props.inherited && props.value.guestLanguages.length > 1 ?
      <Button type="button" variant="secondary" disabled={props.disabled || !props.supportedLanguages}
        onClick={() => props.onChange({ ...props.value,
          guestLanguages: props.value.guestLanguages.filter((entry) => entry.locale !== language.locale),
        })}>{pt('v2.removeLanguage')}</Button> : null}
    <Field {...props} path={['guestLanguages', index, 'nativeName']} labelKey="v2.nativeName" />
    <Field {...props} path={['guestLanguages', index, 'staffName']} labelKey="v2.staffName" />
    <StudioField id={`ssf-v2-guest-${index}-icon-url`} label={pt('v2.iconUrl')}>
      <Input id={`ssf-v2-guest-${index}-icon-url`} type="url" disabled={props.disabled}
        value={language.icon?.url ?? ''} onChange={(event) => {
          const url = event.currentTarget.value;
          props.onChange(updateSsfV2Field(props.value, ['guestLanguages', index, 'icon'],
            url === '' ? null : { url, alternativeText: language.icon?.alternativeText ?? '' }));
        }} />
    </StudioField>
    {language.icon ? <Field {...props} path={['guestLanguages', index, 'icon', 'alternativeText']} labelKey="v2.alternativeText" /> : null}
    {props.inherited ? <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{pt(JSON.stringify(language.icon ?? null) === JSON.stringify(
        props.inherited.guestLanguages.find((entry) => entry.locale === language.locale)?.icon ?? null)
        ? 'v2.inherited' : 'v2.overridden')}</span>
      <Button type="button" variant="tertiary" disabled={props.disabled}
        onClick={() => props.onChange(updateSsfV2Field(props.value, ['guestLanguages', index, 'icon'],
          props.inherited?.guestLanguages.find((entry) => entry.locale === language.locale)?.icon))}>
        {pt('fields.inherit')}
      </Button>
    </div> : null}
    <Field {...props} path={['guestLanguages', index, 'guest', 'explanationHtml']} labelKey="v2.guestExplanation" kind="html" />
    <FeedbackFields {...props} path={['guestLanguages', index, 'feedback']} />
  </TabsContent>;
};

const GuestLanguages = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const hiddenLanguages = useRef(new Map<string, Language>());
  return <StudioSection title={pt('v2.guestLanguages')}>
    {props.inherited
      ? props.inherited.guestLanguages.map((language) => <LanguageToggle key={language.locale} props={props}
        language={language} hiddenLanguages={hiddenLanguages} />)
      : <AddLanguage {...props} />}
    <Tabs key={props.value.guestLanguages[0]?.locale ?? 'empty'} defaultValue={props.value.guestLanguages[0]?.locale ?? ''}>
      <TabsList aria-label={pt('v2.guestLanguages')}>
        {props.value.guestLanguages.map((language) =>
          <TabsTrigger key={language.locale} value={language.locale}>{language.nativeName || language.locale}</TabsTrigger>)}
      </TabsList>
      {props.value.guestLanguages.map((language, index) =>
        <LanguageTab key={language.locale} props={props} language={language} index={index} />)}
    </Tabs>
  </StudioSection>;
};

export const SsfRuntimeV2Editor = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  return <div className="space-y-5">
    {!props.supportedLanguages ? <p className="text-sm text-muted-foreground" role="status">
      {pt('v2.languageCatalogUnavailable')}
    </p> : null}
    <BrandingFields {...props} />
    <StaffFields {...props} />
    <RecordingFields {...props} />
    <SsfLegalTextsEditor {...props} />
    <FeedbackFields {...props} path={['staff', 'feedback']} />
    <GuestLanguages {...props} />
  </div>;
};
