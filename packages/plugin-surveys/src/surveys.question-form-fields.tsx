import { Checkbox, Input, Select, StudioField, StudioFieldGroup, Textarea } from '@sva/studio-ui-react';

import {
  getNormalizedSurveyQuestionOptions,
  surveyQuestionTypes,
  type SurveyQuestionFormValues,
  type SurveyQuestionType,
} from './surveys.detail-content-model.js';
import { questionTypeLabelKey, type SurveyContentTranslate } from './surveys.question-editor.shared.js';
import type { UpdateSurveyQuestion } from './surveys.question-list.shared.js';

export function SurveyQuestionFormFields({
  pt,
  question,
  questionIndex,
  updateQuestion,
}: Readonly<{
  pt: SurveyContentTranslate;
  question: SurveyQuestionFormValues;
  questionIndex: number;
  updateQuestion: UpdateSurveyQuestion;
}>) {
  return (
    <>
      <StudioField id={`survey-question-${questionIndex}-title`} label={pt('fields.questionTitle')} required>
        <Input
          id={`survey-question-${questionIndex}-title`}
          required
          value={question.title}
          onChange={(event) =>
            updateQuestion(questionIndex, (currentQuestion) => ({ ...currentQuestion, title: event.target.value }))
          }
        />
      </StudioField>

      <StudioField id={`survey-question-${questionIndex}-description`} label={pt('fields.questionDescription')}>
        <Textarea
          id={`survey-question-${questionIndex}-description`}
          value={question.description}
          onChange={(event) =>
            updateQuestion(questionIndex, (currentQuestion) => ({
              ...currentQuestion,
              description: event.target.value,
            }))
          }
        />
      </StudioField>

      <StudioFieldGroup columns={2}>
        <StudioField id={`survey-question-${questionIndex}-type`} label={pt('fields.questionType')}>
          <Select
            id={`survey-question-${questionIndex}-type`}
            value={question.type}
            onChange={(event) =>
              updateQuestion(questionIndex, (currentQuestion) => {
                const nextType = event.target.value as SurveyQuestionType;
                return {
                  ...currentQuestion,
                  type: nextType,
                  options: getNormalizedSurveyQuestionOptions(nextType, currentQuestion.options),
                };
              })
            }
          >
            {surveyQuestionTypes.map((questionType) => (
              <option key={questionType} value={questionType}>
                {pt(questionTypeLabelKey[questionType])}
              </option>
            ))}
          </Select>
        </StudioField>

        <StudioField id={`survey-question-${questionIndex}-required`} label={pt('fields.questionRequired')}>
          <Checkbox
            id={`survey-question-${questionIndex}-required`}
            checked={question.required}
            onChange={(event) =>
              updateQuestion(questionIndex, (currentQuestion) => ({
                ...currentQuestion,
                required: event.target.checked,
              }))
            }
          />
        </StudioField>
      </StudioFieldGroup>
    </>
  );
}
