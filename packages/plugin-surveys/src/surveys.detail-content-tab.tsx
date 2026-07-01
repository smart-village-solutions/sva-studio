import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox, Select, StudioField, Textarea } from '@sva/studio-ui-react';

import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyQuestionListEditor } from './surveys.question-list-editor.js';
import { resultVisibilityLabelKey, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import { surveyResultVisibilityValues } from './surveys.detail-content-model.js';
import { SurveyDetailCard } from './surveys.detail-card.js';

function SurveyDescriptionCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { register } = useFormContext<SurveyDetailFormValues>();

  return (
    <SurveyDetailCard title={pt('cards.content.descriptions.title')} description={pt('cards.content.descriptions.description')}>
      <div className="space-y-4">
        <StudioField id="survey-short-description" label={pt('fields.shortDescription')}>
          <Textarea id="survey-short-description" {...register('content.shortDescription')} />
        </StudioField>
        <StudioField id="survey-description" label={pt('fields.description')}>
          <Textarea id="survey-description" {...register('content.description')} />
        </StudioField>
      </div>
    </SurveyDetailCard>
  );
}

function SurveyParticipationCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { setValue } = useFormContext<SurveyDetailFormValues>();
  const isAnonymous = useWatch({ name: 'content.isAnonymous' }) ?? false;
  const showResultsInApp = useWatch({ name: 'content.showResultsInApp' }) ?? false;
  const resultVisibility = useWatch({ name: 'content.resultVisibility' }) ?? 'NONE';

  return (
    <SurveyDetailCard title={pt('cards.content.participation.title')} description={pt('cards.content.participation.description')}>
      <div className="space-y-4">
        <StudioField id="survey-is-anonymous" label={pt('fields.isAnonymous')}>
          <Checkbox
            id="survey-is-anonymous"
            checked={isAnonymous}
            onChange={(event) => setValue('content.isAnonymous', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="survey-show-results-in-app" label={pt('fields.showResultsInApp')}>
          <Checkbox
            id="survey-show-results-in-app"
            checked={showResultsInApp}
            onChange={(event) => setValue('content.showResultsInApp', event.target.checked, { shouldDirty: true })}
          />
        </StudioField>
        <StudioField id="survey-result-visibility" label={pt('fields.resultVisibility')}>
          <Select
            id="survey-result-visibility"
            value={resultVisibility}
            onChange={(event) =>
              setValue('content.resultVisibility', event.target.value as SurveyDetailFormValues['content']['resultVisibility'], {
                shouldDirty: true,
              })
            }
          >
            {surveyResultVisibilityValues.map((visibility) => (
              <option key={visibility} value={visibility}>
                {pt(resultVisibilityLabelKey[visibility])}
              </option>
            ))}
          </Select>
        </StudioField>
      </div>
    </SurveyDetailCard>
  );
}

function SurveyNoticesCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { register } = useFormContext<SurveyDetailFormValues>();

  return (
    <SurveyDetailCard title={pt('cards.content.notices.title')} description={pt('cards.content.notices.description')}>
      <div className="space-y-4">
        <StudioField id="survey-privacy-notice" label={pt('fields.privacyNotice')}>
          <Textarea id="survey-privacy-notice" {...register('content.privacyNotice')} />
        </StudioField>
        <StudioField id="survey-transparency-notice" label={pt('fields.transparencyNotice')}>
          <Textarea id="survey-transparency-notice" {...register('content.transparencyNotice')} />
        </StudioField>
      </div>
    </SurveyDetailCard>
  );
}

export function SurveyDetailContentTab({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  return (
    <div className="space-y-5">
      <SurveyDescriptionCard pt={pt} />
      <SurveyParticipationCard pt={pt} />
      <SurveyNoticesCard pt={pt} />
      <SurveyDetailCard title={pt('cards.content.questions.title')} description={pt('cards.content.questions.description')}>
        <SurveyQuestionListEditor pt={pt} />
      </SurveyDetailCard>
    </div>
  );
}
