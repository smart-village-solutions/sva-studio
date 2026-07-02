import type { SurveyQuestionType } from './surveys.detail-content-model.js';

export type SurveyContentTranslate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

export type PendingDeleteState =
  | { kind: 'question'; questionIndex: number }
  | { kind: 'option'; questionIndex: number; optionIndex: number }
  | null;

export const reorderEntries = <T,>(entries: readonly T[], fromIndex: number, toIndex: number): T[] => {
  const nextEntries = [...entries];
  const [entry] = nextEntries.splice(fromIndex, 1);
  if (typeof entry === 'undefined') {
    return nextEntries;
  }
  nextEntries.splice(toIndex, 0, entry);
  return nextEntries;
};

export const questionTypeLabelKey: Record<SurveyQuestionType, string> = {
  SINGLE_CHOICE: 'fields.questionTypeOptions.singleChoice',
  MULTIPLE_CHOICE: 'fields.questionTypeOptions.multipleChoice',
  FREE_TEXT: 'fields.questionTypeOptions.freeText',
  SINGLE_CHOICE_WITH_TEXT: 'fields.questionTypeOptions.singleChoiceWithText',
  MULTIPLE_CHOICE_WITH_TEXT: 'fields.questionTypeOptions.multipleChoiceWithText',
};

export const resultVisibilityLabelKey = {
  NONE: 'fields.resultVisibilityOptions.none',
  AFTER_SUBMISSION: 'fields.resultVisibilityOptions.afterSubmission',
  AFTER_SURVEY_END: 'fields.resultVisibilityOptions.afterSurveyEnd',
} as const;
