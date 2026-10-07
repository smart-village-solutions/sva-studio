import {
  readStudioDestructiveNavigationFeedback,
  removeStudioActionNavigationFeedback,
  type MainserverPrincipalControlModel,
  type StudioBulkAction,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import { useContents } from '../../hooks/use-contents';
import { t } from '../../i18n';
import { type ContentListRouteState, type RouteSearchState } from './-content-list-route-state';
import {
  buildBulkActionLabel,
  deleteMainserverItem,
  resolveRowAccess,
  isBulkActionableContent,
  resolveListMutationPrincipal,
  type RegisteredContentRow,
} from './-content-list-row-actions';

type ContentDeletionResult = Readonly<{
  kind: 'success';
  description: string;
}>;
type PendingBulkDeletion = Readonly<{
  clearSelection: () => void;
  selectedRows: readonly RegisteredContentRow[];
}>;

const useBulkActionButtons = ({
  contentsApi,
  routeState,
  hasBulkActionableContents,
  unscopedPermissionActions,
  setBulkDeleteError,
  setPendingBulkDeletion,
}: Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  hasBulkActionableContents: boolean;
  unscopedPermissionActions: readonly string[];
  setBulkDeleteError: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingBulkDeletion: React.Dispatch<React.SetStateAction<PendingBulkDeletion | null>>;
}>): readonly StudioBulkAction<RegisteredContentRow>[] => {
  return React.useMemo<readonly StudioBulkAction<RegisteredContentRow>[]>(
    () =>
      hasBulkActionableContents
        ? [
            {
              id: 'archive-selection',
              label: buildBulkActionLabel('content.actions.archive'),
              disabled: !unscopedPermissionActions.includes('content.archive'),
              onClick: async ({ selectedRows, clearSelection }) => {
                if (selectedRows.length === 0) {
                  return;
                }
                await contentsApi.archiveContents({
                  actionId: 'content.archive',
                  contentIds: selectedRows.map((item) => item.id),
                  matchingCount: selectedRows.length,
                  page: routeState.page,
                  pageSize: routeState.pageSize,
                  selectionMode: 'explicitIds',
                  sort: routeState.sort,
                  statusFilter: routeState.status,
                });
                clearSelection();
              },
            },
            {
              id: 'delete-selection',
              label: buildBulkActionLabel('content.actions.delete'),
              disabled: !unscopedPermissionActions.includes('content.delete'),
              variant: 'destructive',
              onClick: ({ selectedRows, clearSelection }) => {
                if (selectedRows.length === 0) return;
                setBulkDeleteError(null);
                setPendingBulkDeletion({ selectedRows, clearSelection });
              },
            },
          ]
        : [],
    [
      contentsApi,
      hasBulkActionableContents,
      routeState.page,
      routeState.pageSize,
      routeState.sort,
      routeState.status,
      unscopedPermissionActions,
    ]
  );
};

const useDestructiveFeedbackNavigation = (
  locationState: unknown,
  navigate: ReturnType<typeof useNavigate>,
  setDestructiveResult: React.Dispatch<React.SetStateAction<ContentDeletionResult | null>>
): void => {
  React.useEffect(() => {
    const feedback = readStudioDestructiveNavigationFeedback(locationState);
    if (!feedback) return;
    setDestructiveResult({
      kind: 'success',
      description: t('content.messages.deleteSuccess', { id: feedback.resourceId }),
    });
    void navigate({
      to: '/admin/content',
      replace: true,
      search: (current: RouteSearchState) => current,
      state: (previous) => removeStudioActionNavigationFeedback(previous),
    });
  }, [locationState, navigate, setDestructiveResult]);
};

export const useContentListDeletion = ({
  contentsApi,
  routeState,
  registeredContents,
  principalControl,
  unscopedPermissionActions,
  permissionActions,
  enabledMainserverMutationActions,
}: Readonly<{
  contentsApi: ReturnType<typeof useContents>;
  routeState: ContentListRouteState;
  registeredContents: readonly RegisteredContentRow[];
  principalControl: MainserverPrincipalControlModel | undefined;
  unscopedPermissionActions: readonly string[];
  permissionActions: readonly string[];
  enabledMainserverMutationActions: readonly string[];
}>) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [destructiveResult, setDestructiveResult] = React.useState<ContentDeletionResult | null>(
    () => {
      const feedback = readStudioDestructiveNavigationFeedback(location.state);
      return feedback
        ? {
            kind: 'success',
            description: t('content.messages.deleteSuccess', { id: feedback.resourceId }),
          }
        : null;
    }
  );
  const [pendingRowDeletion, setPendingRowDeletion] = React.useState<RegisteredContentRow | null>(
    null
  );
  const [rowDeletePending, setRowDeletePending] = React.useState(false);
  const [rowDeleteError, setRowDeleteError] = React.useState<string | null>(null);
  const [pendingBulkDeletion, setPendingBulkDeletion] = React.useState<PendingBulkDeletion | null>(
    null
  );
  const [bulkDeletePending, setBulkDeletePending] = React.useState(false);
  const [bulkDeleteError, setBulkDeleteError] = React.useState<string | null>(null);
  const deleteFocusFallbackRef = React.useRef<HTMLElement | null>(null);
  useDestructiveFeedbackNavigation(location.state, navigate, setDestructiveResult);
  const hasBulkActionableContents = React.useMemo(
    () => registeredContents.some(isBulkActionableContent),
    [registeredContents]
  );

  const confirmRowDeletion = React.useCallback(async () => {
    const item = pendingRowDeletion;
    if (!item || rowDeletePending) return;
    setRowDeletePending(true);
    setRowDeleteError(null);
    try {
      const currentItem = registeredContents.find(
        (row) => row.id === item.id && row.contentType === item.contentType
      );
      if (!currentItem || !resolveRowAccess(currentItem.access, contentsApi.error).canRead)
        throw new Error('content_mutation_unavailable');
      const principal = resolveListMutationPrincipal(currentItem, principalControl);
      if (!principal) {
        throw new Error('mainserver_mutation_principal_unavailable');
      }
      await deleteMainserverItem(
        item.contentType,
        item.id,
        principal,
        permissionActions,
        enabledMainserverMutationActions
      );
    } catch {
      setRowDeleteError(t('content.messages.deleteError'));
      setRowDeletePending(false);
      return;
    }

    setPendingRowDeletion(null);
    setDestructiveResult({
      kind: 'success',
      description: t('content.messages.deleteSuccess', { id: item.id }),
    });
    const refreshSucceeded = await contentsApi.refetchWithOutcome();
    if (!refreshSucceeded) {
      setDestructiveResult({
        kind: 'success',
        description: t('content.messages.deleteRefreshError'),
      });
    }
    setRowDeletePending(false);
  }, [
    contentsApi,
    pendingRowDeletion,
    principalControl,
    rowDeletePending,
    permissionActions,
    enabledMainserverMutationActions,
    registeredContents,
  ]);

  const confirmBulkDeletion = React.useCallback(async () => {
    const pending = pendingBulkDeletion;
    if (!pending || bulkDeletePending) return;
    setBulkDeletePending(true);
    setBulkDeleteError(null);
    let result: Awaited<ReturnType<typeof contentsApi.deleteContents>>;
    try {
      result = await contentsApi.deleteContents({
        actionId: 'content.delete',
        contentIds: pending.selectedRows.map((item) => item.id),
        matchingCount: pending.selectedRows.length,
        page: routeState.page,
        pageSize: routeState.pageSize,
        selectionMode: 'explicitIds',
        sort: routeState.sort,
        statusFilter: routeState.status,
      });
    } catch {
      setBulkDeleteError(
        t('content.messages.deleteBulkError', { failedCount: pending.selectedRows.length })
      );
      setBulkDeletePending(false);
      return;
    }
    setBulkDeletePending(false);

    if (result.failedCount > 0) {
      const failedIds = new Set(result.failedContentIds);
      setPendingBulkDeletion({
        ...pending,
        selectedRows: pending.selectedRows.filter((item) => failedIds.has(item.id)),
      });
      setBulkDeleteError(
        t('content.messages.deleteBulkError', { failedCount: result.failedCount })
      );
      return;
    }

    pending.clearSelection();
    setPendingBulkDeletion(null);
    setDestructiveResult({
      kind: 'success',
      description: result.refreshFailed
        ? t('content.messages.deleteRefreshError')
        : t('content.messages.deleteBulkSuccess', { count: result.acceptedCount }),
    });
  }, [bulkDeletePending, contentsApi, pendingBulkDeletion, routeState]);

  const bulkActionButtons = useBulkActionButtons({
    contentsApi,
    routeState,
    hasBulkActionableContents,
    unscopedPermissionActions,
    setBulkDeleteError,
    setPendingBulkDeletion,
  });

  return {
    destructiveResult,
    setDestructiveResult,
    pendingRowDeletion,
    setPendingRowDeletion,
    rowDeletePending,
    rowDeleteError,
    setRowDeleteError,
    pendingBulkDeletion,
    setPendingBulkDeletion,
    bulkDeletePending,
    bulkDeleteError,
    setBulkDeleteError,
    deleteFocusFallbackRef,
    confirmRowDeletion,
    confirmBulkDeletion,
    bulkActionButtons,
  };
};
