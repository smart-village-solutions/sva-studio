export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SurveyLocalizedText = Readonly<Record<string, string>>;

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

export type SurveyQuestionOption = Readonly<{
  id: string;
  questionId: string;
  title: SurveyLocalizedText;
  position: number;
  enablesFreeText: boolean;
}>;

export type SurveyQuestion = Readonly<{
  id: string;
  surveyId: string;
  title: SurveyLocalizedText;
  description?: SurveyLocalizedText;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'SINGLE_CHOICE_WITH_TEXT' | 'MULTIPLE_CHOICE_WITH_TEXT';
  required: boolean;
  position: number;
  options: readonly SurveyQuestionOption[];
}>;

export type SurveyContentItem = Readonly<{
  id: string;
  contentType: 'surveys.survey';
  title: SurveyLocalizedText;
  shortDescription?: SurveyLocalizedText;
  description?: SurveyLocalizedText;
  status: SurveyStatus;
  startAt?: string;
  endAt?: string;
  resultVisibility: 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';
  targetAreaIds: readonly string[];
  showResultsInApp: boolean;
  isAnonymous: boolean;
  privacyNotice?: SurveyLocalizedText;
  transparencyNotice?: SurveyLocalizedText;
  questions: readonly SurveyQuestion[];
  questionCount: number;
  participationCount: number;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
}>;

export type SurveyListQuery = Readonly<{
  page: number;
  pageSize: number;
}>;

export type SurveyListResult = Readonly<{
  data: readonly SurveyContentItem[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    hasNextPage: boolean;
    total?: number;
  }>;
}>;
