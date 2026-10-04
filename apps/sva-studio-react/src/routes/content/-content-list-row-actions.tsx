import {
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentListItem,
} from '@sva/core';
import { deleteEvent } from '@sva/plugin-events';
import { deleteFaq } from '@sva/plugin-faq';
import { deleteCockpitCard } from '@sva/plugin-cockpit-cards';
import { deleteGenericItem } from '@sva/plugin-generic-items';
import { deleteNews } from '@sva/plugin-news';
import { deletePoi } from '@sva/plugin-poi';
import { deleteProject } from '@sva/plugin-projects';
import { deleteSurvey } from '@sva/plugin-surveys';
import { IconTrash } from '@tabler/icons-react';
import {
  StudioTableActionButton,
  StudioTableValueAction,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
  type StudioColumnDef,
} from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';
import React from 'react';
import { useContents } from '../../hooks/use-contents';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import { ContentStatusDialog } from './-content-status-dialog';
import { t } from '../../i18n';
import { resolveStandaloneMainserverPrincipal } from '../../lib/content-status-mutation';
import type { IamHttpError } from '../../lib/iam-api';

export type RegisteredContentRow = IamContentListItem &
  Readonly<{
    typeLabel: string;
    editPath: string;
  }>;
const MAIN_SERVER_CONTENT_TYPES = new Set([
  'news.article',
  'events.event-record',
  'poi.point-of-interest',
  'surveys.survey',
  'generic-items.generic-item',
  'cockpit-cards.cockpit-card',
  'projects.project',
]);

export const resolveRowAccess = (
  access: IamContentAccessSummary | undefined,
  listError: IamHttpError | null
): IamContentAccessSummary => {
  if (access) {
    return access;
  }
  if (listError?.code === 'forbidden') {
    return withServerDeniedContentAccess(undefined);
  }
  return {
    state: 'read_only',
    canRead: true,
    canCreate: false,
    canUpdate: false,
    reasonCode: 'content_update_missing',
    organizationIds: [],
    sourceKinds: [],
  };
};

const deriveDeleteAction = (contentType: string): string | null => {
  const namespace = contentType.split('.')[0]?.trim();
  return namespace ? `${namespace}.delete` : null;
};

export const canDeleteMainserverItem = (
  contentType: string,
  permissionActions: readonly string[] = [],
  enabledMainserverMutationActions: readonly string[] = []
): boolean => {
  const deleteAction = deriveDeleteAction(contentType);
  if (!deleteAction || !permissionActions.includes(deleteAction)) {
    return false;
  }
  return (
    contentType !== 'surveys.survey' || enabledMainserverMutationActions.includes(deleteAction)
  );
};

export const canUpdateMainserverItem = (
  contentType: string,
  enabledMainserverMutationActions: readonly string[]
): boolean =>
  contentType !== 'surveys.survey' || enabledMainserverMutationActions.includes('surveys.update');

export const deleteMainserverItem = async (
  contentType: string,
  contentId: string,
  actingPrincipalType: MainserverPrincipalType,
  detachLinkedContent = false
): Promise<void> => {
  if (contentType === 'news.article') {
    await (detachLinkedContent
      ? deleteNews(contentId, actingPrincipalType, true)
      : deleteNews(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'events.event-record') {
    await (detachLinkedContent
      ? deleteEvent(contentId, actingPrincipalType, true)
      : deleteEvent(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'poi.point-of-interest') {
    await (detachLinkedContent
      ? deletePoi(contentId, actingPrincipalType, true)
      : deletePoi(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'surveys.survey') {
    await deleteSurvey(contentId, actingPrincipalType);
    return;
  }
  if (contentType === 'faq.faq') {
    await (detachLinkedContent
      ? deleteFaq(contentId, actingPrincipalType, true)
      : deleteFaq(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'cockpit-cards.cockpit-card') {
    await (detachLinkedContent
      ? deleteCockpitCard(contentId, actingPrincipalType, true)
      : deleteCockpitCard(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'projects.project') {
    await (detachLinkedContent
      ? deleteProject(contentId, actingPrincipalType, true)
      : deleteProject(contentId, actingPrincipalType));
    return;
  }
  if (contentType === 'generic-items.generic-item') {
    await (detachLinkedContent
      ? deleteGenericItem(contentId, actingPrincipalType, true)
      : deleteGenericItem(contentId, actingPrincipalType));
  }
};

export const deletionImpactBasePath = (contentType: string): string | undefined =>
  ({
    'poi.point-of-interest': '/api/v1/mainserver/poi',
    'events.event-record': '/api/v1/mainserver/events',
    'news.article': '/api/v1/mainserver/news',
    'generic-items.generic-item': '/api/v1/mainserver/generic-items',
    'faq.faq': '/api/v1/mainserver/faqs',
    'cockpit-cards.cockpit-card': '/api/v1/mainserver/cockpit-cards',
    'projects.project': '/api/v1/mainserver/projects',
  })[contentType];

const isMainserverContentType = (contentType: string): boolean =>
  MAIN_SERVER_CONTENT_TYPES.has(contentType);

export const resolveListMutationPrincipal = (
  item: RegisteredContentRow,
  principalControl: MainserverPrincipalControlModel | undefined
): MainserverPrincipalType | undefined =>
  principalControl ? resolveStandaloneMainserverPrincipal(item, principalControl) : undefined;

export const isBulkActionableContent = (item: RegisteredContentRow): boolean =>
  !isMainserverContentType(item.contentType);

export const buildBulkActionLabel = (
  actionLabelKey: 'content.actions.archive' | 'content.actions.delete'
): string => `${t(actionLabelKey)} (${t('content.bulk.scope.explicitIds')})`;

export const resolveEffectiveRowAccess = (
  item: RegisteredContentRow,
  listError: IamHttpError | null,
  enabledMainserverMutationActions: readonly string[]
): IamContentAccessSummary => {
  const access = resolveRowAccess(item.access, listError);
  return canUpdateMainserverItem(item.contentType, enabledMainserverMutationActions)
    ? access
    : { ...access, canUpdate: false };
};

export const ContentRowActions = ({
  item,
  permissionActions,
  enabledMainserverMutationActions,
  mutationPrincipalAvailable,
  onRequestDelete,
}: Readonly<{
  item: RegisteredContentRow;
  permissionActions: readonly string[] | undefined;
  enabledMainserverMutationActions: readonly string[];
  mutationPrincipalAvailable: boolean;
  onRequestDelete: (item: RegisteredContentRow) => void;
}>) => {
  const canDelete =
    canDeleteMainserverItem(
      item.contentType,
      permissionActions,
      enabledMainserverMutationActions
    ) && mutationPrincipalAvailable;

  return (
    <StudioTableActionButton
      label={t('content.actions.delete')}
      icon={<IconTrash aria-hidden="true" className="h-4 w-4" />}
      tone="destructive"
      disabled={!canDelete}
      onClick={() => {
        if (canDelete) onRequestDelete(item);
      }}
    />
  );
};

const formatDateTime = (value: string): string => formatEditorDateTime(value) ?? value;

export const useContentColumns = ({
  contentsApi,
  enabledMainserverMutationActions,
  principalControl,
}: Readonly<{
  contentsApi: Pick<ReturnType<typeof useContents>, 'error' | 'refetch'>;
  enabledMainserverMutationActions: readonly string[];
  principalControl: MainserverPrincipalControlModel | undefined;
}>): readonly StudioColumnDef<RegisteredContentRow>[] => {
  return React.useMemo<readonly StudioColumnDef<RegisteredContentRow>[]>(
    () => [
      {
        id: 'title',
        header: t('content.table.headerTitle'),
        cell: (item) => {
          const access = resolveEffectiveRowAccess(
            item,
            contentsApi.error,
            enabledMainserverMutationActions
          );
          const title = access.canRead ? (
            <StudioTableValueAction asChild emphasis="primary">
              <Link
                to={item.editPath}
                aria-label={t(
                  access.canUpdate
                    ? 'content.actions.editTitle'
                    : 'content.actions.openReadOnlyTitle',
                  { title: item.title }
                )}
              >
                {item.title}
              </Link>
            </StudioTableValueAction>
          ) : (
            <span className="font-medium text-foreground">{item.title}</span>
          );

          return (
            <span className="flex min-w-0 flex-col">
              {title}
              <span
                className="max-w-64 truncate font-mono text-xs text-muted-foreground"
                title={item.id}
              >
                {item.id}
              </span>
            </span>
          );
        },
        sortable: true,
        sortLabel: t('content.table.headerTitle'),
        sortValue: (item) => item.title.toLowerCase(),
      },
      {
        id: 'contentType',
        header: t('content.table.headerType'),
        cell: (item) => item.typeLabel,
      },
      {
        id: 'createdAt',
        header: t('content.table.headerCreated'),
        cell: (item) => formatDateTime(item.createdAt),
        sortable: true,
        sortLabel: t('content.table.headerCreated'),
        sortValue: (item) => item.createdAt,
      },
      {
        id: 'updatedAt',
        header: t('content.table.headerUpdated'),
        cell: (item) =>
          item.updatedAt ? formatDateTime(item.updatedAt) : t('content.table.notAvailable'),
        sortable: true,
        sortLabel: t('content.table.headerUpdated'),
        sortValue: (item) => item.updatedAt ?? '',
      },
      {
        id: 'publishedAt',
        header: t('content.table.headerPublished'),
        cell: (item) =>
          item.publishedAt ? formatDateTime(item.publishedAt) : t('content.table.notPublished'),
        sortable: true,
        sortLabel: t('content.table.headerPublished'),
        sortValue: (item) => item.publishedAt ?? '',
      },
      {
        id: 'status',
        header: t('content.table.headerStatus'),
        cell: (item) => {
          const mutationPrincipal = resolveListMutationPrincipal(item, principalControl);
          return (
            <ContentStatusDialog
              item={item}
              canUpdate={
                mutationPrincipal !== undefined &&
                resolveRowAccess(item.access, contentsApi.error).canUpdate &&
                canUpdateMainserverItem(item.contentType, enabledMainserverMutationActions)
              }
              actingPrincipalType={mutationPrincipal ?? 'user'}
              onUpdated={contentsApi.refetch}
            />
          );
        },
      },
    ],
    [contentsApi.error, contentsApi.refetch, enabledMainserverMutationActions, principalControl]
  );
};
