import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox, Select, StudioField, Textarea } from '@sva/studio-ui-react';

import type { SurveyDetailFormValues } from './surveys.detail-form.js';
import { SurveyQuestionListEditor } from './surveys.question-list-editor.js';
import {
  resultVisibilityLabelKey,
  type SurveyContentTranslate,
} from './surveys.question-editor.shared.js';
import { surveyResultVisibilityValues } from './surveys.detail-content-model.js';
import { SurveyDetailCard } from './surveys.detail-card.js';

export function SurveyDescriptionCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { register } = useFormContext<SurveyDetailFormValues>();

  return (
    <SurveyDetailCard
      title={pt('cards.content.descriptions.title')}
      description={pt('cards.content.descriptions.description')}
    >
      <div className="space-y-4">
        <StudioField
          id="survey-short-description"
          description={pt('create.help.shortDescription')}
          label={pt('fields.shortDescription')}
        >
          <Textarea
            aria-describedby="survey-short-description-description"
            id="survey-short-description"
            {...register('content.shortDescription')}
          />
        </StudioField>
        <StudioField
          id="survey-description"
          description={pt('create.help.description')}
          label={pt('fields.description')}
        >
          <Textarea
            aria-describedby="survey-description-description"
            id="survey-description"
            {...register('content.description')}
          />
        </StudioField>
      </div>
    </SurveyDetailCard>
  );
}

export function SurveyParticipationCard({
  pt,
  section,
}: Readonly<{ pt: SurveyContentTranslate; section?: 'anonymity' | 'results' }>) {
  const { setValue } = useFormContext<SurveyDetailFormValues>();
  const isAnonymous = useWatch({ name: 'content.isAnonymous' }) ?? false;
  const showResultsInApp = useWatch({ name: 'content.showResultsInApp' }) ?? false;
  const resultVisibility = useWatch({ name: 'content.resultVisibility' }) ?? 'NONE';

  return (
    <SurveyDetailCard
      title={pt('cards.content.participation.title')}
      description={pt('cards.content.participation.description')}
    >
      <div className="space-y-4">
        {section !== 'results' ? (
          <StudioField
            id="survey-is-anonymous"
            description={pt('create.help.anonymity')}
            label={pt('fields.isAnonymous')}
          >
            <Checkbox
              aria-describedby="survey-is-anonymous-description"
              id="survey-is-anonymous"
              checked={isAnonymous}
              onChange={(event) =>
                setValue('content.isAnonymous', event.target.checked, { shouldDirty: true })
              }
            />
          </StudioField>
        ) : null}
        {section !== 'anonymity' ? (
          <>
            <StudioField
              id="survey-show-results-in-app"
              description={pt('create.help.results')}
              label={pt('fields.showResultsInApp')}
            >
              <Checkbox
                aria-describedby="survey-show-results-in-app-description"
                id="survey-show-results-in-app"
                checked={showResultsInApp}
                onChange={(event) =>
                  setValue('content.showResultsInApp', event.target.checked, { shouldDirty: true })
                }
              />
            </StudioField>
            <StudioField
              id="survey-result-visibility"
              description={pt('create.help.resultVisibility')}
              label={pt('fields.resultVisibility')}
            >
              <Select
                aria-describedby="survey-result-visibility-description"
                id="survey-result-visibility"
                value={resultVisibility}
                onChange={(event) =>
                  setValue(
                    'content.resultVisibility',
                    event.target.value as SurveyDetailFormValues['content']['resultVisibility'],
                    {
                      shouldDirty: true,
                    }
                  )
                }
              >
                {surveyResultVisibilityValues.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {pt(resultVisibilityLabelKey[visibility])}
                  </option>
                ))}
              </Select>
            </StudioField>
          </>
        ) : null}
      </div>
    </SurveyDetailCard>
  );
}

export function SurveyNoticesCard({ pt }: Readonly<{ pt: SurveyContentTranslate }>) {
  const { register } = useFormContext<SurveyDetailFormValues>();

  return (
    <SurveyDetailCard
      title={pt('cards.content.notices.title')}
      description={pt('cards.content.notices.description')}
    >
      <div className="space-y-4">
        <StudioField
          id="survey-privacy-notice"
          description={pt('create.help.privacy')}
          label={pt('fields.privacyNotice')}
        >
          <Textarea
            aria-describedby="survey-privacy-notice-description"
            id="survey-privacy-notice"
            {...register('content.privacyNotice')}
          />
        </StudioField>
        <StudioField
          id="survey-transparency-notice"
          description={pt('create.help.transparency')}
          label={pt('fields.transparencyNotice')}
        >
          <Textarea
            aria-describedby="survey-transparency-notice-description"
            id="survey-transparency-notice"
            {...register('content.transparencyNotice')}
          />
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
      <SurveyDetailCard
        title={pt('cards.content.questions.title')}
        description={pt('cards.content.questions.description')}
      >
        <SurveyQuestionListEditor pt={pt} />
      </SurveyDetailCard>
    </div>
  );
}
