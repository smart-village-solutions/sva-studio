import {
  normalizeSurveyQuestions,
  type SurveyQuestionFormValues,
} from './surveys.detail-content-model.js';
import type { SurveyDetailFormValues } from './surveys.detail-form.js';

export type UpdateSurveyQuestion = (
  questionIndex: number,
  updater: (question: SurveyQuestionFormValues) => SurveyQuestionFormValues
) => void;

export const updateSurveyQuestionList = (
  setValue: (
    name: 'content.questions',
    value: SurveyDetailFormValues['content']['questions'],
    options: { shouldDirty: true }
  ) => void,
  nextQuestions: readonly SurveyQuestionFormValues[]
) => {
  setValue('content.questions', normalizeSurveyQuestions(nextQuestions), { shouldDirty: true });
};
