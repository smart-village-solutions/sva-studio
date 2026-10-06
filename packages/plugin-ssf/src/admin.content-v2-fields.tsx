import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioField, StudioSection } from '@sva/studio-ui-react';

import { SsfV2Field as Field, readSsfV2Path as readPath, type SsfV2EditorProps as EditorProps } from './admin.content-v2-field-control.js';
import type { SsfInstallationContentV2Fields, SsfRuntimeContentV2Fields } from './content-v2-contracts.js';

type FormValue = SsfInstallationContentV2Fields | SsfRuntimeContentV2Fields;
type Path = readonly (string | number)[];

export const blankFeedback = () => ({
  headline: '',
  questions: [
    { id: 'translationQuality', type: 'rating' as const, question: '', required: true, min: 1, max: 5 },
    { id: 'performance', type: 'rating' as const, question: '', required: true, min: 1, max: 5 },
    { id: 'usability', type: 'rating' as const, question: '', required: true, min: 1, max: 5 },
    { id: 'recommendation', type: 'scale' as const, question: '', required: true, min: 0, max: 10 },
    { id: 'improvementIdeas', type: 'longText' as const, question: '', required: false, maxLength: 4000 },
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
      headline: '', explanationHtml: '', callToAction: '',
      load: { headline: '', green: '', yellow: '', red: '' },
    },
    newConversation: { headline: '', descriptionHtml: '' },
    feedback: blankFeedback(),
  },
  guestLanguages: [],
});


export const BrandingFields = <T extends FormValue>(props: EditorProps<T>) => {
  const pt = usePluginTranslation('ssf');
  const updateMedia = (purpose: 'logo' | 'icon', part: 'url' | 'alternativeText', next: string) => {
    const current = props.value.branding[purpose];
    const medium = part === 'url' && next === ''
      ? null
      : { url: current?.url ?? '', alternativeText: current?.alternativeText ?? '', [part]: next };
    props.onChange({ ...props.value, branding: { ...props.value.branding, [purpose]: medium } });
  };
  return (
    <StudioSection title={pt('v2.branding')}>
      {(['logo', 'icon'] as const).map((purpose) => (
        <div key={purpose} className="grid gap-4 md:grid-cols-2">
          <StudioField id={`ssf-v2-${purpose}-url`} label={pt(`v2.${purpose}Url`)}>
            <Input id={`ssf-v2-${purpose}-url`} type="url" disabled={props.disabled}
              value={props.value.branding[purpose]?.url ?? ''}
              onChange={(event) => updateMedia(purpose, 'url', event.currentTarget.value)} />
          </StudioField>
          <StudioField id={`ssf-v2-${purpose}-alt`} label={pt('v2.alternativeText')}>
            <Input id={`ssf-v2-${purpose}-alt`} disabled={props.disabled}
              value={props.value.branding[purpose]?.alternativeText ?? ''}
              onChange={(event) => updateMedia(purpose, 'alternativeText', event.currentTarget.value)} />
          </StudioField>
          {props.inherited ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
              <span>{pt(JSON.stringify(props.value.branding[purpose]) === JSON.stringify(props.inherited.branding[purpose])
                ? 'v2.inherited' : 'v2.overridden')}</span>
              <Button type="button" variant="tertiary" disabled={props.disabled}
                onClick={() => props.onChange({ ...props.value, branding: {
                  ...props.value.branding, [purpose]: props.inherited?.branding[purpose] ?? null,
                } })}>{pt('fields.inherit')}</Button>
            </div>
          ) : null}
        </div>
      ))}
    </StudioSection>
  );
};

export const FeedbackFields = <T extends FormValue>(props: EditorProps<T> & { path: Path }) => {
  const pt = usePluginTranslation('ssf');
  const feedback = readPath(props.value, props.path) as SsfInstallationContentV2Fields['localization']['feedback'];
  const known = new Set(['translationQuality', 'performance', 'usability', 'recommendation', 'improvementIdeas']);
  return (
    <StudioSection title={pt('v2.feedback')}>
      <Field {...props} path={[...props.path, 'headline']} labelKey="v2.formHeadline" />
      {feedback.questions.map((question, index) => known.has(question.id) ? (
        <details key={question.id} className="rounded-lg border border-border/70 p-4">
          <summary className="cursor-pointer font-medium">{question.headline || pt(`v2.questions.${question.id}`)}</summary>
          <div className="mt-4 space-y-4">
            <Field {...props} path={[...props.path, 'questions', index, 'headline']} labelKey="v2.questionHeadline" />
            <Field {...props} path={[...props.path, 'questions', index, 'question']} labelKey="v2.questionText" />
            <Field {...props} path={[...props.path, 'questions', index, 'required']} labelKey="v2.required" kind="checkbox" />
            {question.type === 'scale' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field {...props} path={[...props.path, 'questions', index, 'minLabel']} labelKey="v2.minLabel" />
                <Field {...props} path={[...props.path, 'questions', index, 'maxLabel']} labelKey="v2.maxLabel" />
              </div>
            ) : null}
            {question.type === 'longText' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field {...props} path={[...props.path, 'questions', index, 'placeholder']} labelKey="v2.placeholder" />
                <Field {...props} path={[...props.path, 'questions', index, 'maxLength']} labelKey="v2.maxLength" kind="number" />
              </div>
            ) : null}
          </div>
        </details>
      ) : null)}
      <Field {...props} path={[...props.path, 'noticeHtml']} labelKey="v2.notice" kind="html" />
      <Field {...props} path={[...props.path, 'button']} labelKey="v2.button" />
    </StudioSection>
  );
};

export const SsfInstallationV2Editor = (props: EditorProps<SsfInstallationContentV2Fields>) => {
  const pt = usePluginTranslation('ssf');
  return (
    <div className="space-y-5">
      <BrandingFields {...props} />
      <StudioSection title={pt('v2.legal')}>
        <Field {...props} path={['legal', 'imprintUrl']} labelKey="v2.imprintUrl" kind="url" />
        <Field {...props} path={['legal', 'privacyPolicyUrl']} labelKey="v2.privacyPolicyUrl" kind="url" />
        <Field {...props} path={['legal', 'accessibilityStatementUrl']} labelKey="v2.accessibilityStatementUrl" kind="url" nullable />
      </StudioSection>
      <StudioSection title={pt('v2.startAndLogin')}>
        <Field {...props} path={['localization', 'locale']} labelKey="v2.locale" />
        <Field {...props} path={['localization', 'startpage', 'enterCode']} labelKey="v2.enterCode" />
        <Field {...props} path={['localization', 'startpage', 'send']} labelKey="v2.send" />
        <Field {...props} path={['localization', 'startpage', 'login']} labelKey="v2.login" />
        <Field {...props} path={['localization', 'login', 'headline']} labelKey="v2.loginHeadline" />
        <Field {...props} path={['localization', 'login', 'descriptionHtml']} labelKey="v2.loginDescription" kind="html" />
      </StudioSection>
      <FeedbackFields {...props} path={['localization', 'feedback']} />
    </div>
  );
};
