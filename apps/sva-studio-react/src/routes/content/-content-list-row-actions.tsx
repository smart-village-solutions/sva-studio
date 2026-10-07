import {
  withServerDeniedContentAccess,
  type IamContentAccessSummary,
  type IamContentListItem,
} from '@sva/core';
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
import {
  getContentMutations,
  isContentMutationAvailable,
  resolveStandaloneMainserverPrincipal,
} from '../../lib/content-status-mutation';
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

export const canDeleteMainserverItem = (
  contentType: string,
  permissionActions: readonly string[] = [],
  enabledMainserverMutationActions: readonly string[] = []
): boolean =>
  isContentMutationAvailable(
    contentType,
    'delete',
    permissionActions,
    enabledMainserverMutationActions
  );

export const canUpdateMainserverItem = (
  contentType: string,
  enabledMainserverMutationActions: readonly string[]
): boolean => {
  const capability = getContentMutations(contentType)?.status;
  return (
    !capability?.requiresMainserverMutationAction ||
    enabledMainserverMutationActions.includes(capability.requiredAction)
  );
};

export const deleteMainserverItem = async (
  contentType: string,
  contentId: string,
  actingPrincipalType: MainserverPrincipalType,
  permissionActions: readonly string[],
  enabledMainserverMutationActions: readonly string[]
): Promise<void> => {
  const capability = getContentMutations(contentType)?.delete;
  if (!capability) throw new Error(`unsupported_content_delete:${contentType}`);
  if (
    (actingPrincipalType !== 'user' && actingPrincipalType !== 'organization') ||
    !canDeleteMainserverItem(contentType, permissionActions, enabledMainserverMutationActions)
  ) {
    throw new Error('content_mutation_unavailable');
  }
  await capability.execute(contentId, actingPrincipalType);
};

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
    ) &&
    mutationPrincipalAvailable &&
    item.access?.state !== 'server_denied' &&
    item.access?.canRead !== false;

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
  permissionActions,
}: Readonly<{
  permissionActions: readonly string[];
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
                isContentMutationAvailable(
                  item.contentType,
                  'status',
                  permissionActions,
                  enabledMainserverMutationActions
                )
              }
              permissionActions={permissionActions}
              enabledMainserverMutationActions={enabledMainserverMutationActions}
              actingPrincipalType={mutationPrincipal ?? 'user'}
              onUpdated={contentsApi.refetch}
            />
          );
        },
      },
    ],
    [
      contentsApi.error,
      contentsApi.refetch,
      enabledMainserverMutationActions,
      principalControl,
      permissionActions,
    ]
  );
};
