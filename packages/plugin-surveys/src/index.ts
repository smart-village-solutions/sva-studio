import { pluginSurveys as descriptor } from './plugin.js';
export { SURVEYS_CONTENT_TYPE } from './surveys.constants.js';
export { deleteSurvey, listSurveys } from './surveys.api.js';
export type { SurveyFormInput } from './surveys.mutation.types.js';
export type {
  SurveyContentItem,
  SurveyListQuery,
  SurveyListResult,
  SurveyStatus,
} from './surveys.types.js';
export { pluginSurveysContract } from './plugin.js';
export * from './index.ui.js';

import { deleteSurvey, getSurvey, updateSurvey } from './surveys.api.js';
import type { ContentTypeMutations, PluginDefinition } from '@sva/plugin-sdk';
import type { SurveyContentItem } from './surveys.types.js';
const resolveLocalizedText = (value: SurveyContentItem['title'] | undefined): string =>
  value?.de ??
  Object.values(value ?? {}).find((entry): entry is string => typeof entry === 'string') ??
  '';

const contentMutations: ContentTypeMutations = {
  delete: {
    requiredAction: 'surveys.delete',
    requiresMainserverMutationAction: true,
    execute: deleteSurvey,
  },
  status: {
    requiredAction: 'surveys.update',
    requiresMainserverMutationAction: true,
    supportedStatuses: ['draft', 'published', 'archived'],
    execute: async (contentId, status, principal) => {
      const current = await getSurvey(contentId);
      await updateSurvey(
        contentId,
        {
          title: resolveLocalizedText(current.title),
          shortDescription: resolveLocalizedText(current.shortDescription),
          description: resolveLocalizedText(current.description),
          status: status === 'draft' ? 'DRAFT' : status === 'archived' ? 'ARCHIVED' : 'ACTIVE',
          startAt: current.startAt,
          endAt: current.endAt,
          resultVisibility: current.resultVisibility,
          targetAreaIds: current.targetAreaIds,
          showResultsInApp: current.showResultsInApp,
          isAnonymous: current.isAnonymous,
          privacyNotice: resolveLocalizedText(current.privacyNotice),
          transparencyNotice: resolveLocalizedText(current.transparencyNotice),
        },
        current,
        principal
      );
    },
  },
};
export const pluginSurveys: PluginDefinition = {
  ...descriptor,
  contentTypes: descriptor.contentTypes?.map((definition) => ({
    ...definition,
    mutations: contentMutations,
  })),
};
