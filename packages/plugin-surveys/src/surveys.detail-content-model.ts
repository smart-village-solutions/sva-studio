export type SurveyQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FREE_TEXT'
  | 'SINGLE_CHOICE_WITH_TEXT'
  | 'MULTIPLE_CHOICE_WITH_TEXT';

export type SurveyResultVisibility = 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';

export type SurveyQuestionOptionFormValues = {
  id?: string;
  title: string;
  position: number;
  enablesFreeText: boolean;
};

export type SurveyQuestionFormValues = {
  id?: string;
  title: string;
  description: string;
  type: SurveyQuestionType;
  required: boolean;
  position: number;
  options: SurveyQuestionOptionFormValues[];
};

export const surveyQuestionTypes: readonly SurveyQuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'FREE_TEXT',
  'SINGLE_CHOICE_WITH_TEXT',
  'MULTIPLE_CHOICE_WITH_TEXT',
];

export const surveyResultVisibilityValues: readonly SurveyResultVisibility[] = [
  'NONE',
  'AFTER_SUBMISSION',
  'AFTER_SURVEY_END',
];

export const questionTypeSupportsOptions = (type: SurveyQuestionType): boolean => type !== 'FREE_TEXT';

export const questionTypeSupportsFreeTextOptionToggle = (type: SurveyQuestionType): boolean =>
  type === 'SINGLE_CHOICE_WITH_TEXT' || type === 'MULTIPLE_CHOICE_WITH_TEXT';

export const createDefaultSurveyQuestionOption = (position: number): SurveyQuestionOptionFormValues => ({
  title: '',
  position,
  enablesFreeText: false,
});

export const getNormalizedSurveyQuestionOptions = (
  type: SurveyQuestionType,
  options: readonly SurveyQuestionOptionFormValues[]
): SurveyQuestionOptionFormValues[] => {
  if (!questionTypeSupportsOptions(type)) {
    return [];
  }

  const baseOptions = options.length > 0 ? [...options] : [createDefaultSurveyQuestionOption(0)];

  return baseOptions.map((option, index) => ({
    ...(option.id ? { id: option.id } : {}),
    title: option.title,
    position: index,
    enablesFreeText: questionTypeSupportsFreeTextOptionToggle(type) ? option.enablesFreeText : false,
  }));
};

export const createDefaultSurveyQuestion = (
  position: number,
  type: SurveyQuestionType = 'SINGLE_CHOICE'
): SurveyQuestionFormValues => ({
  title: '',
  description: '',
  type,
  required: false,
  position,
  options: getNormalizedSurveyQuestionOptions(type, []),
});

export const normalizeSurveyQuestions = (
  questions: readonly SurveyQuestionFormValues[]
): SurveyQuestionFormValues[] =>
  questions.map((question, index) => ({
    ...(question.id ? { id: question.id } : {}),
    title: question.title,
    description: question.description,
    type: question.type,
    required: question.required,
    position: index,
    options: getNormalizedSurveyQuestionOptions(question.type, question.options),
  }));
