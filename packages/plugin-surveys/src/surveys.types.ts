export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type SurveyLocalizedText = Readonly<Record<string, string>>;

export type SurveyFormInput = Readonly<{
  title: SurveyLocalizedText;
  shortDescription?: SurveyLocalizedText;
  description?: SurveyLocalizedText;
  status: SurveyStatus;
  startAt?: string;
  endAt?: string;
  resultVisibility?: 'NONE' | 'AFTER_SUBMISSION' | 'AFTER_SURVEY_END';
  targetAreaIds?: readonly string[];
  showResultsInApp?: boolean;
  isAnonymous: boolean;
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
