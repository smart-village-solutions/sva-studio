import type { SurveyStatus } from './surveys.types.js';

export type SurveyQuestionOptionInput = Readonly<{
  title: string;
  position: number;
  enablesFreeText: boolean;
}>;

export type SurveyQuestionInput = Readonly<{
  title: string;
  description?: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'SINGLE_CHOICE_WITH_TEXT' | 'MULTIPLE_CHOICE_WITH_TEXT';
  required: boolean;
  position: number;
  options: readonly SurveyQuestionOptionInput[];
}>;

export type SurveyFormInput = Readonly<{
  title: string;
  shortDescription?: string;
  description?: string;
  status: SurveyStatus;
  startAt?: string;
  endAt?: string;
  resultVisibility?: 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';
  targetAreaIds?: readonly string[];
  showResultsInApp?: boolean;
  isAnonymous: boolean;
  privacyNotice?: string;
  transparencyNotice?: string;
  questions?: readonly SurveyQuestionInput[];
}>;

export type SurveyQuestionOptionMutationInput = Readonly<{
  id?: string;
  delete?: boolean;
  title?: string;
  position?: number;
  enablesFreeText?: boolean;
}>;

export type SurveyQuestionMutationInput = Readonly<{
  id?: string;
  delete?: boolean;
  title?: string;
  description?: string;
  type?: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'SINGLE_CHOICE_WITH_TEXT' | 'MULTIPLE_CHOICE_WITH_TEXT';
  required?: boolean;
  position?: number;
  options?: readonly SurveyQuestionOptionMutationInput[];
}>;

export type SurveyMutationInput = Readonly<{
  title: string;
  shortDescription?: string;
  description?: string;
  status: SurveyStatus;
  startAt?: string;
  endAt?: string;
  resultVisibility?: 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';
  targetAreaIds?: readonly string[];
  showResultsInApp?: boolean;
  isAnonymous: boolean;
  privacyNotice?: string;
  transparencyNotice?: string;
  questions?: readonly SurveyQuestionMutationInput[];
}>;
