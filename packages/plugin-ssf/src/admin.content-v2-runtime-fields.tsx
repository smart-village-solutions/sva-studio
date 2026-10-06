import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button, Checkbox, Input, Select, StudioField, StudioSection,
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@sva/studio-ui-react';
import { useState } from 'react';

import {
  SsfV2Field as Field, type SsfV2EditorProps, updateSsfV2Field,
} from './admin.content-v2-field-control.js';
import { blankFeedback, BrandingFields, FeedbackFields } from './admin.content-v2-fields.js';
import type { SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type Props = SsfV2EditorProps<SsfRuntimeContentV2Fields>;
type Language = SsfRuntimeContentV2Fields['guestLanguages'][number];

const StaffFields = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  return <StudioSection title={pt('v2.staff')}>
    <Field {...props} path={['staff', 'locale']} labelKey="v2.locale" />
    <Field {...props} path={['staff', 'dashboard', 'headline']} labelKey="v2.dashboardHeadline" />
    <Field {...props} path={['staff', 'dashboard', 'explanationHtml']} labelKey="v2.dashboardExplanation" kind="html" />
    <Field {...props} path={['staff', 'dashboard', 'callToAction']} labelKey="v2.callToAction" />
    {(['headline', 'green', 'yellow', 'red'] as const).map((key) =>
      <Field key={key} {...props} path={['staff', 'dashboard', 'load', key]} labelKey={`v2.load.${key}`} />)}
    <Field {...props} path={['staff', 'newConversation', 'headline']} labelKey="v2.newConversationHeadline" />
    <Field {...props} path={['staff', 'newConversation', 'descriptionHtml']} labelKey="v2.newConversationDescription" kind="html" />
  </StudioSection>;
};

const StorageFields = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const inherited = props.inherited;
  const changeMode = (mode: 'ask' | 'disabled') => props.onChange({
    ...props.value,
    conversationContentStorage: {
      mode,
      retentionHours: mode === 'disabled' ? null : props.value.conversationContentStorage.retentionHours,
    },
    guestLanguages: props.value.guestLanguages.map((language) => ({
      ...language,
      guest: { ...language.guest, storageQuestionHtml:
        mode === 'disabled' ? null : (language.guest.storageQuestionHtml ?? '') },
    })),
  });
  const restore = () => {
    if (!inherited) return;
    props.onChange({
      ...props.value,
      conversationContentStorage: inherited.conversationContentStorage,
      guestLanguages: props.value.guestLanguages.map((language) => ({ ...language,
        guest: { ...language.guest, storageQuestionHtml:
          inherited.guestLanguages.find((entry) => entry.locale === language.locale)?.guest.storageQuestionHtml ?? null },
      })),
    });
  };
  return <StudioSection title={pt('v2.storage')}>
    <StudioField id="ssf-v2-storage-mode" label={pt('fields.storageMode')}>
      <Select id="ssf-v2-storage-mode" disabled={props.disabled}
        value={props.value.conversationContentStorage.mode}
        onChange={(event) => changeMode(event.currentTarget.value as 'ask' | 'disabled')}>
        <option value="ask">{pt('fields.ask')}</option>
        <option value="disabled">{pt('fields.disabled')}</option>
      </Select>
    </StudioField>
    {inherited ? <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>{pt(props.value.conversationContentStorage.mode === inherited.conversationContentStorage.mode
        ? 'v2.inherited' : 'v2.overridden')}</span>
      <Button type="button" variant="tertiary" disabled={props.disabled} onClick={restore}>
        {pt('fields.inherit')}
      </Button>
    </div> : null}
    {props.value.conversationContentStorage.mode === 'ask'
      ? <Field {...props} path={['conversationContentStorage', 'retentionHours']} labelKey="v2.retentionHours" kind="number" />
      : null}
  </StudioSection>;
};

const AddLanguage = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  const [locale, setLocale] = useState('');
  const add = () => {
    props.onChange({ ...props.value, guestLanguages: [...props.value.guestLanguages, {
      locale, nativeName: locale, staffName: locale, icon: null,
      guest: { explanationHtml: '', storageQuestionHtml:
        props.value.conversationContentStorage.mode === 'ask' ? '' : null },
      feedback: blankFeedback(),
    }] });
    setLocale('');
  };
  return <div className="flex flex-wrap items-end gap-3">
    <StudioField id="ssf-v2-new-locale" label={pt('v2.newLanguage')}>
      <Input id="ssf-v2-new-locale" value={locale} disabled={props.disabled}
        onChange={(event) => setLocale(event.currentTarget.value)} />
    </StudioField>
    <Button type="button" variant="secondary" disabled={props.disabled || !locale ||
      props.value.guestLanguages.some((language) => language.locale === locale) ||
      props.value.guestLanguages.length >= 30} onClick={add}>{pt('v2.addLanguage')}</Button>
  </div>;
};

const LanguageToggle = ({ props, language }: { props: Props; language: Language }) => {
  const inherited = props.inherited;
  if (!inherited) return null;
  const active = props.value.guestLanguages.some((entry) => entry.locale === language.locale);
  const toggle = (enabled: boolean) => props.onChange({
    ...props.value,
    guestLanguages: enabled
      ? inherited.guestLanguages.filter((entry) => entry.locale === language.locale ||
        props.value.guestLanguages.some((current) => current.locale === entry.locale))
        .map((entry) => props.value.guestLanguages.find((current) => current.locale === entry.locale) ?? entry)
      : props.value.guestLanguages.filter((entry) => entry.locale !== language.locale),
  });
  return <label className="flex items-center gap-2">
    <Checkbox checked={active} disabled={props.disabled || (active && props.value.guestLanguages.length === 1)}
      onChange={(event) => toggle(event.currentTarget.checked)} />
    <span>{language.nativeName} ({language.locale})</span>
  </label>;
};

const LanguageTab = ({ props, language, index }: { props: Props; language: Language; index: number }) => {
  const pt = usePluginTranslation('ssf');
  return <TabsContent value={language.locale} className="space-y-5">
    {!props.inherited && props.value.guestLanguages.length > 1 ?
      <Button type="button" variant="secondary" disabled={props.disabled}
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
          props.inherited?.guestLanguages.find((entry) => entry.locale === language.locale)?.icon ?? null))}>
        {pt('fields.inherit')}
      </Button>
    </div> : null}
    <Field {...props} path={['guestLanguages', index, 'guest', 'explanationHtml']} labelKey="v2.guestExplanation" kind="html" />
    {props.value.conversationContentStorage.mode === 'ask'
      ? <Field {...props} path={['guestLanguages', index, 'guest', 'storageQuestionHtml']} labelKey="v2.storageQuestion" kind="html" />
      : null}
    <FeedbackFields {...props} path={['guestLanguages', index, 'feedback']} />
  </TabsContent>;
};

const GuestLanguages = (props: Props) => {
  const pt = usePluginTranslation('ssf');
  return <StudioSection title={pt('v2.guestLanguages')}>
    {props.inherited
      ? props.inherited.guestLanguages.map((language) => <LanguageToggle key={language.locale} props={props} language={language} />)
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

export const SsfRuntimeV2Editor = (props: Props) => <div className="space-y-5">
  <BrandingFields {...props} />
  <StaffFields {...props} />
  <StorageFields {...props} />
  <FeedbackFields {...props} path={['staff', 'feedback']} />
  <GuestLanguages {...props} />
</div>;
