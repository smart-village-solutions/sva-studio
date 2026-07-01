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

const buildSurveyMutationInput = (input: {
  readonly survey: SvaMainserverSurveyInput;
  readonly surveyId?: string;
  readonly delete?: boolean;
}) => ({
  ...(input.surveyId ? { id: input.surveyId } : {}),
  ...(input.delete === true ? { delete: true } : {}),
  ...(input.survey.title ? { title: input.survey.title } : {}),
  ...(input.survey.shortDescription ? { shortDescription: input.survey.shortDescription } : {}),
  ...(input.survey.description ? { description: input.survey.description } : {}),
  ...(input.survey.status ? { status: input.survey.status } : {}),
  ...(input.survey.startAt === undefined ? {} : { startAt: input.survey.startAt }),
  ...(input.survey.endAt === undefined ? {} : { endAt: input.survey.endAt }),
  ...(input.survey.resultVisibility ? { resultVisibility: input.survey.resultVisibility } : {}),
  ...(input.survey.targetAreaIds ? { targetAreaIds: [...input.survey.targetAreaIds] } : {}),
  ...(input.survey.showResultsInApp === undefined ? {} : { showResultsInApp: input.survey.showResultsInApp }),
  ...(input.survey.isAnonymous === undefined ? {} : { isAnonymous: input.survey.isAnonymous }),
  ...(input.survey.privacyNotice ? { privacyNotice: input.survey.privacyNotice } : {}),
  ...(input.survey.transparencyNotice ? { transparencyNotice: input.survey.transparencyNotice } : {}),
  ...(input.survey.questions ? { questions: input.survey.questions.map(buildSurveyQuestionInput) } : {}),
  ...(input.survey.freeTextResponses
    ? {
        freeTextResponses: input.survey.freeTextResponses.map((freeText) => ({
          id: freeText.id,
          ...(freeText.status ? { status: freeText.status } : {}),
          ...(freeText.delete === true ? { delete: true } : {}),
        })),
      }
    : {}),
});

export const createSurveyOperations = (executeGraphqlWithConfig: GraphqlExecutor) => ({
  listSurveysWithConfig: async (
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

    const surveys = (response.surveys ?? []).map(mapSurveyItem);
    const offset = (pagination.page - 1) * pagination.pageSize;
    const pagedItems = surveys.slice(offset, offset + pagination.pageSize);

    return {
      data: pagedItems,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        hasNextPage: offset + pagination.pageSize < surveys.length,
        total: surveys.length,
      },
    };
  },

  getSurveyWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly surveyId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverSurveyItem> => {
    const response = await executeGraphqlWithConfig<SvaMainserverSurveyDetailQuery>(
      {
        ...input,
        document: svaMainserverSurveyDetailDocument,
        operationName: 'SvaMainserverSurveyDetail',
        variables: {
          filter: buildSurveyFilter({
            ids: [input.surveyId],
          }),
        },
      },
      config
    );

    const survey = (response.surveys ?? []).find((item): item is NonNullable<typeof item> => Boolean(item?.id));
    return mapOptionalSurveyItem(survey);
  },

  getSurveyResultsWithConfig: async (
    input: SvaMainserverConnectionInput & { readonly surveyId: string },
    config: SvaMainserverInstanceConfig
  ): Promise<SvaMainserverSurveyResults> => {
    const response = await executeGraphqlWithConfig<SvaMainserverSurveyResultsQuery>(
      {
        ...input,
        document: svaMainserverSurveyResultsDocument,
        operationName: 'SvaMainserverSurveyResults',
        variables: {
          filter: buildSurveyFilter({
            ids: [input.surveyId],
          }),
        },
      },
      config
    );

    const survey = (response.surveys ?? []).find((item): item is NonNullable<typeof item> => Boolean(item?.id));
    return mapOptionalSurveyResults(survey?.results);
  },

  writeSurveyWithConfig: async (
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
        variables: {
          input: buildSurveyMutationInput(input),
        },
      },
      config
    );

    return mapSurveyMutationPayload(response.createOrUpdateSurvey);
  },

  releaseSurveyFreeTextResponseWithConfig: async (
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
  },

  deleteSurveyFreeTextResponseWithConfig: async (
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
  },
});
