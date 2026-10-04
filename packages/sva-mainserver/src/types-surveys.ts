import type {
  SvaMainserverDataProvider,
  SvaMainserverListQuery,
  SvaMainserverLocalizedText,
  SvaMainserverSurveyFreeTextStatus,
  SvaMainserverSurveyQuestionType,
  SvaMainserverSurveyResultVisibility,
  SvaMainserverSurveyStatus,
} from './types.js';

export type SvaMainserverSurveyPayloadBackedFields = {
  readonly startAt?: string;
  readonly endAt?: string;
  readonly resultVisibility: SvaMainserverSurveyResultVisibility;
  readonly showResultsInApp: boolean;
  readonly privacyNotice?: SvaMainserverLocalizedText;
  readonly transparencyNotice?: SvaMainserverLocalizedText;
};

export type SvaMainserverSurveyMutationAction = 'CREATED' | 'UPDATED' | 'DELETED';

export type SvaMainserverSurveyMutationErrorCode =
  | 'VALIDATION_ERROR'
  | 'SURVEY_NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'DELETE_REQUIRES_ID'
  | 'CONFLICTING_INPUT'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';

export type SvaMainserverSurveySubmissionErrorCode =
  'VALIDATION_ERROR' | 'SURVEY_NOT_FOUND' | 'SURVEY_NOT_ACTIVE' | 'FORBIDDEN' | 'INTERNAL_ERROR';

export type SvaMainserverSurveyFilterInput = {
  readonly ids?: readonly string[];
  readonly statuses?: readonly SvaMainserverSurveyStatus[];
  readonly targetAreaIds?: readonly string[];
  readonly includeArchived?: boolean;
  readonly ongoingOnly?: boolean;
};

export type SvaMainserverSurveyListInput = SvaMainserverListQuery & SvaMainserverSurveyFilterInput;

export type SvaMainserverSurveyQuestionOptionInput = {
  readonly id?: string;
  readonly delete?: boolean;
  readonly title?: SvaMainserverLocalizedText;
  readonly position?: number;
  readonly enablesFreeText?: boolean;
};

export type SvaMainserverSurveyQuestionInput = {
  readonly id?: string;
  readonly delete?: boolean;
  readonly title?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly type?: SvaMainserverSurveyQuestionType;
  readonly required?: boolean;
  readonly position?: number;
  readonly options?: readonly SvaMainserverSurveyQuestionOptionInput[];
};

export type SvaMainserverSurveyFreeTextInput = {
  readonly id: string;
  readonly status?: SvaMainserverSurveyFreeTextStatus;
  readonly delete?: boolean;
};

export type SvaMainserverSurveyInput = {
  readonly title?: SvaMainserverLocalizedText;
  readonly shortDescription?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly status?: SvaMainserverSurveyStatus;
  readonly startAt?: string;
  readonly endAt?: string;
  readonly resultVisibility?: SvaMainserverSurveyResultVisibility;
  readonly targetAreaIds?: readonly string[];
  readonly showResultsInApp?: boolean;
  readonly isAnonymous?: boolean;
  readonly privacyNotice?: SvaMainserverLocalizedText;
  readonly transparencyNotice?: SvaMainserverLocalizedText;
  readonly questions?: readonly SvaMainserverSurveyQuestionInput[];
  readonly freeTextResponses?: readonly SvaMainserverSurveyFreeTextInput[];
};

export type SvaMainserverSurveyQuestionOption = {
  readonly id: string;
  readonly questionId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly position: number;
  readonly enablesFreeText: boolean;
};

export type SvaMainserverSurveyQuestion = {
  readonly id: string;
  readonly surveyId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly type: SvaMainserverSurveyQuestionType;
  readonly required: boolean;
  readonly position: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly options: readonly SvaMainserverSurveyQuestionOption[];
};

export type SvaMainserverSurveyFreeTextResult = {
  readonly id: string;
  readonly text: string;
  readonly status: SvaMainserverSurveyFreeTextStatus;
  readonly createdAt: string;
};

export type SvaMainserverSurveyOptionResult = {
  readonly optionId: string;
  readonly title: SvaMainserverLocalizedText;
  readonly votes: number;
  readonly percentage?: number;
  readonly freeTextResponses: readonly SvaMainserverSurveyFreeTextResult[];
};

export type SvaMainserverSurveyQuestionResults = {
  readonly questionId: string;
  readonly type: SvaMainserverSurveyQuestionType;
  readonly totalResponses: number;
  readonly optionResults: readonly SvaMainserverSurveyOptionResult[];
  readonly freeTextResponses: readonly SvaMainserverSurveyFreeTextResult[];
};

export type SvaMainserverSurveyResults = {
  readonly surveyId: string;
  readonly participationCount: number;
  readonly submissionCount: number;
  readonly questions: readonly SvaMainserverSurveyQuestionResults[];
};

export type SvaMainserverSurveyItem = {
  readonly id: string;
  readonly contentType: 'surveys.survey';
  readonly title: SvaMainserverLocalizedText;
  readonly shortDescription?: SvaMainserverLocalizedText;
  readonly description?: SvaMainserverLocalizedText;
  readonly status: SvaMainserverSurveyStatus;
  readonly targetAreaIds: readonly string[];
  readonly isAnonymous: boolean;
  readonly questions: readonly SvaMainserverSurveyQuestion[];
  readonly questionCount: number;
  readonly participationCount: number;
  readonly submissionCount: number;
  readonly results?: SvaMainserverSurveyResults;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
  readonly archivedAt?: string;
  readonly dataProvider?: SvaMainserverDataProvider;
} & SvaMainserverSurveyPayloadBackedFields;

export type SvaMainserverSurveyMutationError = {
  readonly code: SvaMainserverSurveyMutationErrorCode;
  readonly message: string;
  readonly field?: string;
};

export type SvaMainserverSurveyMutationPayload = {
  readonly success: boolean;
  readonly action?: SvaMainserverSurveyMutationAction;
  readonly survey?: SvaMainserverSurveyItem;
  readonly deletedSurveyId?: string;
  readonly errors: readonly SvaMainserverSurveyMutationError[];
};

export type SvaMainserverSurveySubmissionError = {
  readonly code: SvaMainserverSurveySubmissionErrorCode;
  readonly message: string;
  readonly field?: string;
};
