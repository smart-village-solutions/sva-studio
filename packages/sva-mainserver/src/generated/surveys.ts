// Survey contracts are maintained from the checked-in staging schema document
// until the mainserver snapshot exposes the same operations directly.

export type SvaMainserverSurveyLocalizedTextFragment = Record<string, string>;

export type SvaMainserverSurveyQuestionOptionFragment = {
  readonly id?: string | null;
  readonly questionId?: string | null;
  readonly title?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly position?: number | null;
  readonly enablesFreeText?: boolean | null;
};

export type SvaMainserverSurveyFreeTextResultFragment = {
  readonly id?: string | null;
  readonly text?: string | null;
  readonly status?: string | null;
  readonly createdAt?: string | null;
};

export type SvaMainserverSurveyOptionResultFragment = {
  readonly optionId?: string | null;
  readonly title?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly votes?: number | null;
  readonly percentage?: number | null;
  readonly freeTextResponses?: readonly SvaMainserverSurveyFreeTextResultFragment[] | null;
};

export type SvaMainserverSurveyQuestionResultsFragment = {
  readonly questionId?: string | null;
  readonly type?: string | null;
  readonly totalResponses?: number | null;
  readonly optionResults?: readonly SvaMainserverSurveyOptionResultFragment[] | null;
  readonly freeTextResponses?: readonly SvaMainserverSurveyFreeTextResultFragment[] | null;
};

export type SvaMainserverSurveyResultsFragment = {
  readonly surveyId?: string | null;
  readonly participationCount?: number | null;
  readonly submissionCount?: number | null;
  readonly questions?: readonly SvaMainserverSurveyQuestionResultsFragment[] | null;
};

export type SvaMainserverSurveyQuestionFragment = {
  readonly id?: string | null;
  readonly surveyId?: string | null;
  readonly title?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly description?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly type?: string | null;
  readonly required?: boolean | null;
  readonly position?: number | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly options?: readonly SvaMainserverSurveyQuestionOptionFragment[] | null;
};

export type SvaMainserverSurveyFragment = {
  readonly id?: string | null;
  readonly title?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly shortDescription?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly description?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly status?: string | null;
  readonly startAt?: string | null;
  readonly endAt?: string | null;
  readonly resultVisibility?: string | null;
  readonly targetAreaIds?: readonly string[] | null;
  readonly showResultsInApp?: boolean | null;
  readonly isAnonymous?: boolean | null;
  readonly privacyNotice?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly transparencyNotice?: SvaMainserverSurveyLocalizedTextFragment | null;
  readonly questions?: readonly SvaMainserverSurveyQuestionFragment[] | null;
  readonly questionCount?: number | null;
  readonly participationCount?: number | null;
  readonly submissionCount?: number | null;
  readonly results?: SvaMainserverSurveyResultsFragment | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly publishedAt?: string | null;
  readonly archivedAt?: string | null;
};

export type SvaMainserverSurveysListQuery = {
  readonly surveys?: readonly SvaMainserverSurveyFragment[] | null;
};

export type SvaMainserverSurveyDetailQuery = SvaMainserverSurveysListQuery;

export type SvaMainserverSurveyResultsQuery = {
  readonly surveys?: readonly Pick<SvaMainserverSurveyFragment, 'id' | 'results'>[] | null;
};

export type SvaMainserverSurveyMutationErrorFragment = {
  readonly code?: string | null;
  readonly message?: string | null;
  readonly field?: string | null;
};

export type SvaMainserverSurveyMutationPayloadFragment = {
  readonly success?: boolean | null;
  readonly action?: string | null;
  readonly survey?: SvaMainserverSurveyFragment | null;
  readonly deletedSurveyId?: string | null;
  readonly errors?: readonly SvaMainserverSurveyMutationErrorFragment[] | null;
};

export type SvaMainserverCreateOrUpdateSurveyMutation = {
  readonly createOrUpdateSurvey?: SvaMainserverSurveyMutationPayloadFragment | null;
};

export type SvaMainserverUpdateSurveyFreeTextStatusMutation = {
  readonly updateSurveyFreeTextStatus?: SvaMainserverSurveyMutationPayloadFragment | null;
};

export type SvaMainserverDeleteSurveyFreeTextMutation = {
  readonly deleteSurveyFreeText?: SvaMainserverSurveyMutationPayloadFragment | null;
};

const surveyQuestionOptionFields = `
  id
  questionId
  title
  position
  enablesFreeText
`;

const surveyFreeTextResultFields = `
  id
  text
  status
  createdAt
`;

const surveyOptionResultFields = `
  optionId
  title
  votes
  percentage
  freeTextResponses {
    ${surveyFreeTextResultFields}
  }
`;

const surveyQuestionResultsFields = `
  questionId
  type
  totalResponses
  optionResults {
    ${surveyOptionResultFields}
  }
  freeTextResponses {
    ${surveyFreeTextResultFields}
  }
`;

const surveyQuestionFields = `
  id
  surveyId
  title
  description
  type
  required
  position
  createdAt
  updatedAt
  options {
    ${surveyQuestionOptionFields}
  }
`;

const surveyResultsFields = `
  surveyId
  participationCount
  submissionCount
  questions {
    ${surveyQuestionResultsFields}
  }
`;

const surveyFields = `
  id
  title
  shortDescription
  description
  status
  startAt
  endAt
  resultVisibility
  targetAreaIds
  showResultsInApp
  isAnonymous
  privacyNotice
  transparencyNotice
  questions {
    ${surveyQuestionFields}
  }
  questionCount
  participationCount
  submissionCount
  results {
    ${surveyResultsFields}
  }
  createdAt
  updatedAt
  publishedAt
  archivedAt
`;

const surveyListFields = `
  id
  title
  shortDescription
  description
  status
  startAt
  endAt
  resultVisibility
  targetAreaIds
  showResultsInApp
  isAnonymous
  privacyNotice
  transparencyNotice
  questionCount
  participationCount
  submissionCount
  createdAt
  updatedAt
  publishedAt
  archivedAt
`;

const surveyMutationPayloadFields = `
  success
  action
  deletedSurveyId
  survey {
    ${surveyFields}
  }
  errors {
    code
    message
    field
  }
`;

export const svaMainserverSurveysListDocument = `
  query SvaMainserverSurveysList($filter: SurveyFilterInput) {
    surveys(filter: $filter) {
      ${surveyListFields}
    }
  }
`;

export const svaMainserverSurveyDetailDocument = `
  query SvaMainserverSurveyDetail($filter: SurveyFilterInput) {
    surveys(filter: $filter) {
      ${surveyFields}
    }
  }
`;

export const svaMainserverSurveyResultsDocument = `
  query SvaMainserverSurveyResults($filter: SurveyFilterInput) {
    surveys(filter: $filter) {
      id
      results {
        ${surveyResultsFields}
      }
    }
  }
`;

export const svaMainserverCreateOrUpdateSurveyDocument = `
  mutation SvaMainserverCreateOrUpdateSurvey($input: UpsertSurveyInput!) {
    createOrUpdateSurvey(input: $input) {
      ${surveyMutationPayloadFields}
    }
  }
`;

export const svaMainserverUpdateSurveyFreeTextStatusDocument = `
  mutation SvaMainserverUpdateSurveyFreeTextStatus(
    $surveyId: ID!
    $freeTextResponseId: ID!
    $status: SurveyFreeTextStatus!
  ) {
    updateSurveyFreeTextStatus(
      surveyId: $surveyId
      freeTextResponseId: $freeTextResponseId
      status: $status
    ) {
      ${surveyMutationPayloadFields}
    }
  }
`;

export const svaMainserverDeleteSurveyFreeTextDocument = `
  mutation SvaMainserverDeleteSurveyFreeText($surveyId: ID!, $freeTextResponseId: ID!) {
    deleteSurveyFreeText(surveyId: $surveyId, freeTextResponseId: $freeTextResponseId) {
      ${surveyMutationPayloadFields}
    }
  }
`;
