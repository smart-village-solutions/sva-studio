// fallow-ignore-file code-duplication
import type {
  SvaMainserverConnectionInput,
  SvaMainserverInstanceConfig,
  SvaMainserverListResult,
  SvaMainserverSurveyInput,
  SvaMainserverSurveyListInput,
  SvaMainserverSurveyMutationPayload,
  SvaMainserverSurveyResults,
  SvaMainserverSurveyItem,
} from '../../types.js';
import {
  svaMainserverCreateOrUpdateSurveyDocument,
  svaMainserverDeleteSurveyFreeTextDocument,
  svaMainserverSurveyDetailDocument,
  svaMainserverSurveyResultsDocument,
  svaMainserverSurveysListDocument,
  svaMainserverUpdateSurveyFreeTextStatusDocument,
  type SvaMainserverCreateOrUpdateSurveyMutation,
  type SvaMainserverDeleteSurveyFreeTextMutation,
  type SvaMainserverSurveyDetailQuery,
  type SvaMainserverSurveyResultsQuery,
  type SvaMainserverSurveysListQuery,
  type SvaMainserverUpdateSurveyFreeTextStatusMutation,
} from '../../generated/surveys.js';

import {
  mapOptionalSurveyItem,
  mapOptionalSurveyResults,
  mapSurveyItem,
  mapSurveyMutationPayload,
} from './survey-mappers.js';
import { normalizeVisibleListQuery, type GraphqlExecutor } from './shared.js';

const buildSurveyFilter = (input: {
  readonly ids?: readonly string[];
  readonly statuses?: readonly string[];
  readonly targetAreaIds?: readonly string[];
  readonly includeArchived?: boolean;
  readonly ongoingOnly?: boolean;
}) => ({
  ...(input.ids && input.ids.length > 0 ? { ids: [...input.ids] } : {}),
  ...(input.statuses && input.statuses.length > 0 ? { statuses: [...input.statuses] } : {}),
  ...(input.targetAreaIds && input.targetAreaIds.length > 0 ? { targetAreaIds: [...input.targetAreaIds] } : {}),
  ...(input.includeArchived === undefined ? {} : { includeArchived: input.includeArchived }),
  ...(input.ongoingOnly === undefined ? {} : { ongoingOnly: input.ongoingOnly }),
});

const buildSurveyQuestionOptionInput = (
  option: NonNullable<NonNullable<SvaMainserverSurveyInput['questions']>[number]['options']>[number]
) => ({
  ...(option.id ? { id: option.id } : {}),
  ...(option.delete === true ? { delete: true } : {}),
  ...(option.title ? { title: option.title } : {}),
  ...(option.position === undefined ? {} : { position: option.position }),
  ...(option.enablesFreeText === undefined ? {} : { enablesFreeText: option.enablesFreeText }),
});

const buildSurveyQuestionInput = (question: NonNullable<SvaMainserverSurveyInput['questions']>[number]) => ({
  ...(question.id ? { id: question.id } : {}),
  ...(question.delete === true ? { delete: true } : {}),
  ...(question.title ? { title: question.title } : {}),
  ...(question.description ? { description: question.description } : {}),
  ...(question.type ? { type: question.type } : {}),
  ...(question.required === undefined ? {} : { required: question.required }),
  ...(question.position === undefined ? {} : { position: question.position }),
  ...(question.options ? { options: question.options.map(buildSurveyQuestionOptionInput) } : {}),
});

const buildSurveyCoreInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.title ? { title: survey.title } : {}),
  ...(survey.shortDescription ? { shortDescription: survey.shortDescription } : {}),
  ...(survey.description ? { description: survey.description } : {}),
  ...(survey.status ? { status: survey.status } : {}),
  ...(survey.startAt === undefined ? {} : { startAt: survey.startAt }),
  ...(survey.endAt === undefined ? {} : { endAt: survey.endAt }),
});

const buildSurveyVisibilityInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.resultVisibility ? { resultVisibility: survey.resultVisibility } : {}),
  ...(survey.targetAreaIds ? { targetAreaIds: [...survey.targetAreaIds] } : {}),
  ...(survey.showResultsInApp === undefined ? {} : { showResultsInApp: survey.showResultsInApp }),
  ...(survey.isAnonymous === undefined ? {} : { isAnonymous: survey.isAnonymous }),
});

const buildSurveyNoticeInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.privacyNotice ? { privacyNotice: survey.privacyNotice } : {}),
  ...(survey.transparencyNotice ? { transparencyNotice: survey.transparencyNotice } : {}),
});

const buildSurveyQuestionsInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.questions ? { questions: survey.questions.map(buildSurveyQuestionInput) } : {}),
});

const buildSurveyFreeTextResponsesInput = (survey: SvaMainserverSurveyInput) => ({
  ...(survey.freeTextResponses
    ? {
        freeTextResponses: survey.freeTextResponses.map((freeText) => ({
          id: freeText.id,
          ...(freeText.status ? { status: freeText.status } : {}),
          ...(freeText.delete === true ? { delete: true } : {}),
        })),
      }
    : {}),
});

const buildSurveyMutationInput = (input: {
  readonly survey: SvaMainserverSurveyInput;
  readonly surveyId?: string;
  readonly delete?: boolean;
}) => ({
  ...(input.surveyId ? { id: input.surveyId } : {}),
  ...(input.delete === true ? { delete: true } : {}),
  ...buildSurveyCoreInput(input.survey),
  ...buildSurveyVisibilityInput(input.survey),
  ...buildSurveyNoticeInput(input.survey),
  ...buildSurveyQuestionsInput(input.survey),
  ...buildSurveyFreeTextResponsesInput(input.survey),
});

const findSurvey = <TItem extends { readonly id?: string | null }>(
  surveys: readonly (TItem | null | undefined)[] | null | undefined
): TItem | undefined => (surveys ?? []).find((item): item is TItem => Boolean(item?.id));

const createListSurveysWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & SvaMainserverSurveyListInput,
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverListResult<SvaMainserverSurveyItem>> => {
  const pagination = normalizeVisibleListQuery(input);
  const response = await executeGraphqlWithConfig<SvaMainserverSurveysListQuery>(
    {
      ...input,
      document: svaMainserverSurveysListDocument,
      operationName: 'SvaMainserverSurveysList',
      variables: {
        filter: buildSurveyFilter({
          ...input,
          includeArchived: input.includeArchived ?? false,
          ongoingOnly: input.ongoingOnly ?? false,
        }),
      },
    },
    config
  );

  const offset = (pagination.page - 1) * pagination.pageSize;
  const rawSurveys = response.surveys ?? [];
  const pagedItems = rawSurveys.slice(offset, offset + pagination.pageSize).map(mapSurveyItem);

  return {
    data: pagedItems,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      hasNextPage: offset + pagination.pageSize < rawSurveys.length,
      total: rawSurveys.length,
    },
  };
};

const createGetSurveyWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & { readonly surveyId: string },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverSurveyItem> => {
  const response = await executeGraphqlWithConfig<SvaMainserverSurveyDetailQuery>(
    {
      ...input,
      document: svaMainserverSurveyDetailDocument,
      operationName: 'SvaMainserverSurveyDetail',
      variables: { filter: buildSurveyFilter({ ids: [input.surveyId], includeArchived: true }) },
    },
    config
  );

  return mapOptionalSurveyItem(findSurvey(response.surveys));
};

const createGetSurveyResultsWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & { readonly surveyId: string },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverSurveyResults> => {
  const response = await executeGraphqlWithConfig<SvaMainserverSurveyResultsQuery>(
    {
      ...input,
      document: svaMainserverSurveyResultsDocument,
      operationName: 'SvaMainserverSurveyResults',
      variables: { filter: buildSurveyFilter({ ids: [input.surveyId], includeArchived: true }) },
    },
    config
  );

  const survey = findSurvey(response.surveys);
  const surveyItem = mapOptionalSurveyItem(survey);
  return mapOptionalSurveyResults(surveyItem.results);
};

const createWriteSurveyWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & {
    readonly survey: SvaMainserverSurveyInput;
    readonly surveyId?: string;
    readonly delete?: boolean;
  },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverSurveyMutationPayload> => {
  const response = await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateSurveyMutation>(
    {
      ...input,
      document: svaMainserverCreateOrUpdateSurveyDocument,
      operationName: 'SvaMainserverCreateOrUpdateSurvey',
      variables: { input: buildSurveyMutationInput(input) },
    },
    config
  );

  return mapSurveyMutationPayload(response.createOrUpdateSurvey);
};

const createReleaseSurveyFreeTextResponseWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & {
    readonly surveyId: string;
    readonly freeTextResponseId: string;
  },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverSurveyMutationPayload> => {
  const response = await executeGraphqlWithConfig<SvaMainserverUpdateSurveyFreeTextStatusMutation>(
    {
      ...input,
      document: svaMainserverUpdateSurveyFreeTextStatusDocument,
      operationName: 'SvaMainserverUpdateSurveyFreeTextStatus',
      variables: {
        surveyId: input.surveyId,
        freeTextResponseId: input.freeTextResponseId,
        status: 'PUBLIC',
      },
    },
    config
  );

  return mapSurveyMutationPayload(response.updateSurveyFreeTextStatus);
};

const createDeleteSurveyFreeTextResponseWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & {
    readonly surveyId: string;
    readonly freeTextResponseId: string;
  },
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverSurveyMutationPayload> => {
  const response = await executeGraphqlWithConfig<SvaMainserverDeleteSurveyFreeTextMutation>(
    {
      ...input,
      document: svaMainserverDeleteSurveyFreeTextDocument,
      operationName: 'SvaMainserverDeleteSurveyFreeText',
      variables: {
        surveyId: input.surveyId,
        freeTextResponseId: input.freeTextResponseId,
      },
    },
    config
  );

  return mapSurveyMutationPayload(response.deleteSurveyFreeText);
};

export const createSurveyOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listSurveysWithConfig: createListSurveysWithConfig(executeGraphqlWithConfig),
  getSurveyWithConfig: createGetSurveyWithConfig(executeGraphqlWithConfig),
  getSurveyResultsWithConfig: createGetSurveyResultsWithConfig(executeGraphqlWithConfig),
  writeSurveyWithConfig: createWriteSurveyWithConfig(executeGraphqlWithConfig),
  releaseSurveyFreeTextResponseWithConfig: createReleaseSurveyFreeTextResponseWithConfig(executeGraphqlWithConfig),
  deleteSurveyFreeTextResponseWithConfig: createDeleteSurveyFreeTextResponseWithConfig(executeGraphqlWithConfig),
});
