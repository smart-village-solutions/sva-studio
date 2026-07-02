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
  svaMainserverSurveyDetailDocument,
  svaMainserverSurveyResultsDocument,
  svaMainserverSurveysListDocument,
  type SvaMainserverCreateOrUpdateSurveyMutation,
  type SvaMainserverSurveyDetailQuery,
  type SvaMainserverSurveyResultsQuery,
  type SvaMainserverSurveysListQuery,
} from '../../generated/surveys.js';

import {
  mapOptionalSurveyItem,
  mapOptionalSurveyResults,
  mapSurveyItem,
  mapSurveyMutationPayload,
} from './survey-mappers.js';
import {
  MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS,
  normalizeVisibleListQuery,
  toSvaMainserverError,
  type GraphqlExecutor,
} from './shared.js';
import { buildSurveyMutationInput } from './survey-operation-inputs.js';

const buildSurveySnapshotQueryVariables = (input: {
  readonly ids?: readonly string[];
  readonly includeArchived?: boolean;
  readonly ongoingOnly?: boolean;
  readonly order?: 'updatedAt_DESC';
}) => ({
  ...(input.ids && input.ids.length > 0 ? { ids: [...input.ids] } : {}),
  ...(input.ongoingOnly === undefined ? {} : { ongoing: input.ongoingOnly }),
  ...(input.includeArchived === undefined ? {} : { archived: input.includeArchived }),
  ...(input.order === undefined ? {} : { order: input.order }),
});

const findSurvey = <TItem extends { readonly id?: string | null }>(
  surveys: readonly (TItem | null | undefined)[] | null | undefined
): TItem | undefined => (surveys ?? []).find((item): item is TItem => Boolean(item?.id));

const compareSurveyListItems = <
  TItem extends { readonly id?: string | null; readonly updatedAt?: string | null }
>(
  left: TItem | null | undefined,
  right: TItem | null | undefined
): number => {
  const leftUpdatedAt = left?.updatedAt ?? '';
  const rightUpdatedAt = right?.updatedAt ?? '';
  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt.localeCompare(leftUpdatedAt);
  }

  return (left?.id ?? '').localeCompare(right?.id ?? '');
};

const normalizeSurveyListQuery = (
  input: SvaMainserverConnectionInput & SvaMainserverSurveyListInput
): SvaMainserverSurveyListInput => {
  const requestedPageSize = Math.trunc(input.pageSize);
  if (requestedPageSize <= 100) {
    return {
      ...input,
      ...normalizeVisibleListQuery(input),
    };
  }

  const pageSize = Math.min(requestedPageSize, MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS);
  const maxPage = Math.floor((MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS - 1) / pageSize) + 1;
  return {
    ...input,
    page: Math.min(Math.max(1, Math.trunc(input.page)), maxPage),
    pageSize,
  };
};

const createListSurveysWithConfig = (executeGraphqlWithConfig: GraphqlExecutor) => async (
  input: SvaMainserverConnectionInput & SvaMainserverSurveyListInput,
  config: SvaMainserverInstanceConfig
): Promise<SvaMainserverListResult<SvaMainserverSurveyItem>> => {
  const pagination = normalizeSurveyListQuery(input);
  const response = await executeGraphqlWithConfig<SvaMainserverSurveysListQuery>(
    {
      ...input,
      document: svaMainserverSurveysListDocument,
      operationName: 'SvaMainserverSurveysList',
      variables: buildSurveySnapshotQueryVariables({
        ids: input.ids,
        includeArchived: input.includeArchived ?? false,
        ongoingOnly: input.ongoingOnly,
        order: 'updatedAt_DESC',
      }),
    },
    config
  );

  const offset = (pagination.page - 1) * pagination.pageSize;
  const rawSurveys = response.surveys ?? [];
  if (rawSurveys.length > MAX_MAINSERVER_UPSTREAM_SCAN_RECORDS) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message:
        'Der SVA-Mainserver lieferte mehr Umfragen als für die Studio-Synchronisation ohne serverseitige Pagination unterstützt werden.',
      statusCode: 502,
    });
  }
  const pagedItems = [...rawSurveys]
    .sort(compareSurveyListItems)
    .slice(offset, offset + pagination.pageSize)
    .map(mapSurveyItem);

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
      variables: buildSurveySnapshotQueryVariables({ ids: [input.surveyId], includeArchived: true }),
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
      variables: buildSurveySnapshotQueryVariables({ ids: [input.surveyId], includeArchived: true }),
    },
    config
  );

  const survey = findSurvey(response.surveys);
  if (!survey) {
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'Survey wurde nicht gefunden.',
      statusCode: 404,
    });
  }

  return mapOptionalSurveyResults(survey.results, input.surveyId);
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
  const response = await executeGraphqlWithConfig<SvaMainserverCreateOrUpdateSurveyMutation>(
    {
      ...input,
      document: svaMainserverCreateOrUpdateSurveyDocument,
      operationName: 'SvaMainserverCreateOrUpdateSurvey',
      variables: {
        input: {
          id: input.surveyId,
          freeTextResponses: [{ id: input.freeTextResponseId, status: 'PUBLIC' }],
        },
      },
    },
    config
  );

  return mapSurveyMutationPayload(response.createOrUpdateSurvey);
};

export const createSurveyOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listSurveysWithConfig: createListSurveysWithConfig(executeGraphqlWithConfig),
  getSurveyWithConfig: createGetSurveyWithConfig(executeGraphqlWithConfig),
  getSurveyResultsWithConfig: createGetSurveyResultsWithConfig(executeGraphqlWithConfig),
  writeSurveyWithConfig: createWriteSurveyWithConfig(executeGraphqlWithConfig),
  releaseSurveyFreeTextResponseWithConfig: createReleaseSurveyFreeTextResponseWithConfig(executeGraphqlWithConfig),
});
