import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioSection } from '@sva/studio-ui-react';

import {
  SsfV2Field as Field,
  type SsfV2EditorProps as EditorProps,
} from './admin.content-v2-field-control.js';
import type {
  SsfSupportedLanguagesCatalog,
  SsfSystemContentV2View,
} from './content-v2-admin-contracts.js';
import type {
  SsfInstallationContentV2Fields,
  SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';

import { BrandingFields } from './admin.content-v2-branding-fields.js';
import { FeedbackFields } from './admin.content-v2-feedback-fields.js';
export { BrandingFields } from './admin.content-v2-branding-fields.js';
export { FeedbackFields } from './admin.content-v2-feedback-fields.js';

export const blankFeedback = () => ({
  headline: '',
  questions: [
    {
      id: 'translationQuality',
      type: 'rating' as const,
      question: '',
      required: true,
      min: 1,
      max: 5,
    },
    { id: 'performance', type: 'rating' as const, question: '', required: true, min: 1, max: 5 },
    { id: 'usability', type: 'rating' as const, question: '', required: true, min: 1, max: 5 },
    { id: 'recommendation', type: 'scale' as const, question: '', required: true, min: 0, max: 10 },
    {
      id: 'improvementIdeas',
      type: 'longText' as const,
      question: '',
      required: false,
      maxLength: 4000,
    },
  ],
  noticeHtml: '',
  button: '',
});

export const blankSsfInstallationV2 = (): SsfInstallationContentV2Fields => ({
  branding: { logo: null, icon: null },
  legal: { imprintUrl: '', privacyPolicyUrl: '', accessibilityStatementUrl: null },
  localization: {
    locale: 'de-DE',
    startpage: { enterCode: '', send: '', login: '' },
    login: { headline: '', descriptionHtml: '' },
    feedback: blankFeedback(),
  },
});

export const blankSsfRuntimeTemplateV2 = (): SsfRuntimeContentV2Fields => ({
  branding: { logo: null, icon: null },
  conversationContentStorage: { mode: 'disabled', retentionHours: null },
  staff: {
    locale: 'de-DE',
    dashboard: {
      headline: '',
      explanationHtml: '',
      callToAction: '',
      load: { headline: '', green: '', yellow: '', red: '' },
    },
    newConversation: { headline: '', descriptionHtml: '' },
    feedback: blankFeedback(),
  },
  guestLanguages: [],
});

const InstallationLocaleField = (
  props: EditorProps<SsfInstallationContentV2Fields> & {
    supportedLanguages: SsfSupportedLanguagesCatalog | null;
  }
) => {
  const pt = usePluginTranslation('ssf');
  const locale =
    props.supportedLanguages && !props.supportedLanguages.languages[props.value.localization.locale]
      ? (props.value.localization.locale.split(/[-_]/, 1)[0] ?? props.value.localization.locale)
      : props.value.localization.locale;
  return (
    <StudioField id="ssf-v2-localization-locale" label={pt('v2.locale')}>
      <Select
        id="ssf-v2-localization-locale"
        disabled={props.disabled || !props.supportedLanguages}
        value={locale}
        onChange={(event) =>
          props.onChange({
            ...props.value,
            localization: { ...props.value.localization, locale: event.currentTarget.value },
          })
        }
      >
        {props.supportedLanguages && !props.supportedLanguages.languages[locale] ? (
          <option value={locale}>{pt('v2.savedLanguageUnavailable')}</option>
        ) : null}
        {props.supportedLanguages ? (
          Object.entries(props.supportedLanguages.languages)
            .sort(
              ([left], [right]) =>
                Number(props.supportedLanguages?.popular.includes(right)) -
                  Number(props.supportedLanguages?.popular.includes(left)) ||
                left.localeCompare(right)
            )
            .map(([locale, language]) => (
              <option key={locale} value={locale}>
                {language.name} ({language.native}) · {locale}
              </option>
            ))
        ) : (
          <option value={props.value.localization.locale}>{props.value.localization.locale}</option>
        )}
      </Select>
    </StudioField>
  );
};

export const SsfInstallationV2Editor = (
  props: EditorProps<SsfInstallationContentV2Fields> & {
    supportedLanguages: SsfSupportedLanguagesCatalog | null;
  }
) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="space-y-5">
      <BrandingFields {...props} />
      <StudioSection title={pt('v2.legal')}>
        <Field {...props} path={['legal', 'imprintUrl']} labelKey="v2.imprintUrl" kind="url" />
        <Field
          {...props}
          path={['legal', 'privacyPolicyUrl']}
          labelKey="v2.privacyPolicyUrl"
          kind="url"
        />
        <Field
          {...props}
          path={['legal', 'accessibilityStatementUrl']}
          labelKey="v2.accessibilityStatementUrl"
          kind="url"
          nullable
        />
      </StudioSection>
      <StudioSection title={pt('v2.startAndLogin')}>
        <InstallationLocaleField {...props} />
        <Field
          {...props}
          path={['localization', 'startpage', 'enterCode']}
          labelKey="v2.enterCode"
        />
        <Field {...props} path={['localization', 'startpage', 'send']} labelKey="v2.send" />
        <Field {...props} path={['localization', 'startpage', 'login']} labelKey="v2.login" />
        <Field
          {...props}
          path={['localization', 'login', 'headline']}
          labelKey="v2.loginHeadline"
        />
        <Field
          {...props}
          path={['localization', 'login', 'descriptionHtml']}
          labelKey="v2.loginDescription"
          kind="html"
        />
      </StudioSection>
      <FeedbackFields {...props} path={['localization', 'feedback']} />
    </div>
  );
};

export const editableSystemContent = (saved: SsfSystemContentV2View) => {
  const defaultLocale = saved.supportedLanguages?.admin_default;
  const installation = saved.installation ?? blankSsfInstallationV2();
  const runtimeTemplate = saved.runtimeTemplate ?? blankSsfRuntimeTemplateV2();
  return {
    installation:
      saved.installation || !defaultLocale
        ? installation
        : {
            ...installation,
            localization: { ...installation.localization, locale: defaultLocale },
          },
    runtimeTemplate:
      saved.runtimeTemplate || !defaultLocale
        ? runtimeTemplate
        : {
            ...runtimeTemplate,
            staff: { ...runtimeTemplate.staff, locale: defaultLocale },
          },
  };
};

export const catalogLanguages = (catalog: SsfSupportedLanguagesCatalog) => {
  const popular = new Set(catalog.popular);
  return Object.entries(catalog.languages).sort(
    ([left], [right]) =>
      Number(popular.has(right)) - Number(popular.has(left)) || left.localeCompare(right)
  );
};

export const primaryLanguage = (locale: string) => locale.split('-')[0]?.toLowerCase();
