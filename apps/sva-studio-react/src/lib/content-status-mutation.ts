import type { IamContentListItem, IamContentStatus } from '@sva/core';
import { getEvent, updateEvent } from '@sva/plugin-events';
import { getGenericItem, updateGenericItem } from '@sva/plugin-generic-items';
import { setNewsVisibility } from '@sva/plugin-news';
import { getPoi, updatePoi } from '@sva/plugin-poi';
import type { SurveyContentItem, SurveyStatus } from '@sva/plugin-surveys';
import { getSurvey, updateSurvey } from '@sva/plugin-surveys/api';

const visibilityStatuses = ['draft', 'published'] as const satisfies readonly IamContentStatus[];
const surveyStatuses = [
  'draft',
  'published',
  'archived',
] as const satisfies readonly IamContentStatus[];

export const getSupportedQuickStatuses = (contentType: string): readonly IamContentStatus[] => {
  switch (contentType) {
    case 'news.article':
    case 'events.event-record':
    case 'generic-items.generic-item':
    case 'poi.point-of-interest':
      return visibilityStatuses;
    case 'surveys.survey':
      return surveyStatuses;
    default:
      return [];
  }
};

const resolveLocalizedText = (value: SurveyContentItem['title'] | undefined): string =>
  value?.de ??
  Object.values(value ?? {}).find((entry): entry is string => typeof entry === 'string') ??
  '';

const mapSurveyStatus = (status: IamContentStatus): SurveyStatus => {
  switch (status) {
    case 'draft':
      return 'DRAFT';
    case 'archived':
      return 'ARCHIVED';
    default:
      return 'ACTIVE';
  }
};

export const updateMainserverContentStatus = async (
  item: Pick<IamContentListItem, 'contentType' | 'id'>,
  status: IamContentStatus
): Promise<void> => {
  if (!getSupportedQuickStatuses(item.contentType).includes(status)) {
    throw new Error(`unsupported_content_status:${item.contentType}:${status}`);
  }

  switch (item.contentType) {
    case 'news.article':
      await setNewsVisibility(item.id, status === 'published');
      return;
    case 'events.event-record': {
      const current = await getEvent(item.id);
      await updateEvent(item.id, { ...current, visible: status === 'published' });
      return;
    }
    case 'generic-items.generic-item': {
      const current = await getGenericItem(item.id);
      await updateGenericItem(item.id, { ...current, visible: status === 'published' });
      return;
    }
    case 'poi.point-of-interest': {
      const current = await getPoi(item.id);
      await updatePoi(item.id, { ...current, active: status === 'published' });
      return;
    }
    case 'surveys.survey': {
      const current = await getSurvey(item.id);
      await updateSurvey(
        item.id,
        {
          title: resolveLocalizedText(current.title),
          shortDescription: resolveLocalizedText(current.shortDescription),
          description: resolveLocalizedText(current.description),
          status: mapSurveyStatus(status),
          startAt: current.startAt,
          endAt: current.endAt,
          resultVisibility: current.resultVisibility,
          targetAreaIds: current.targetAreaIds,
          showResultsInApp: current.showResultsInApp,
          isAnonymous: current.isAnonymous,
          privacyNotice: resolveLocalizedText(current.privacyNotice),
          transparencyNotice: resolveLocalizedText(current.transparencyNotice),
        },
        current
      );
      return;
    }
  }
};
