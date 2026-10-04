import type { IamContentListQuery } from '@sva/core';
import { loadMainserverDeletionImpact } from '@sva/plugin-sdk';
import {
  type MainserverPrincipalControlModel,
  StudioDestructiveActionDialog,
  StudioListPageTemplate,
  StudioPersistentActionResult,
} from '@sva/studio-ui-react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import React from 'react';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { useContents } from '../../hooks/use-contents';
import { useContentAccess } from '../../hooks/use-content-access';
import { t } from '../../i18n';
import { formatEditorDateTime } from '../../lib/editor-date-time';
import type { IamHttpError } from '../../lib/iam-api';
import { getStudioPermissionDenialMessage } from '../../lib/studio-permission-denial-message';
import type { IamContentListMetadata } from '../../lib/iam-api';
import { EMPTY_VISIBLE_TYPE_SENTINEL } from '../../lib/iam-content-list-api.shared';
import { studioContentTypes } from '../../lib/plugins';
import { useAuth } from '../../providers/auth-provider';
import {
  filterCreatableStudioContentTypes,
  filterRegisteredStudioContentItems,
  resolveStudioContentTypeLabel,
} from '../../lib/studio-content-types';
import {
  readNormalizedRouteState,
  resolveContentSortField,
  updateRouteState,
  type ContentListRouteState,
  type RouteSearchState,
} from './-content-list-route-state';
import { useContentListDeletion } from './-content-list-deletion';
import { ContentListTable } from './-content-list-table';
import { MainserverAuthoringDiagnosticsPanel } from './-mainserver-authoring-diagnostics';
import { deletionImpactBasePath } from './-content-list-row-actions';

const EMPTY_PERMISSION_ACTIONS: readonly string[] = [];

const contentErrorMessage = (error: IamHttpError | null): string => {
  const permissionMessage = getStudioPermissionDenialMessage(error);
  if (permissionMessage) return permissionMessage;
  if (!error) {
    return t('content.messages.loadError');
  }

  switch (error.code) {
    case 'forbidden':
      return t('content.errors.forbidden');
    case 'database_unavailable':
      return t('content.errors.databaseUnavailable');
    default:
      return t('content.messages.loadError');
  }
};

const formatDateTime = (value: string): string => formatEditorDateTime(value) ?? value;

const renderProjectionSyncMessage = (metadata: IamContentListMetadata): string | null => {
  if (metadata.mainserverSyncStates.length === 0) {
    return null;
  }

  const latestSucceededAt = metadata.mainserverSyncStates
    .map((entry) => entry.lastSucceededAt)
    .filter((value): value is string => typeof value === 'string')
    .sort((left, right) => right.localeCompare(left))[0];
  const latestErrorCode = metadata.mainserverSyncStates
    .map((entry) => entry.lastErrorCode)
    .find((value): value is string => typeof value === 'string' && value.length > 0);

  if (metadata.hasRunningMainserverSync && latestSucceededAt) {
    return t('content.sync.runningWithSnapshot', {
      value: formatDateTime(latestSucceededAt),
    });
  }

  if (metadata.hasRunningMainserverSync) {
    return t('content.sync.running');
  }

  if (metadata.hasStaleMainserverContent && latestSucceededAt && latestErrorCode) {
    return t('content.sync.staleWithError', {
      value: formatDateTime(latestSucceededAt),
      errorCode: latestErrorCode,
    });
  }

  if (metadata.hasStaleMainserverContent && latestSucceededAt) {
    return t('content.sync.stale', {
      value: formatDateTime(latestSucceededAt),
    });
  }

  return null;
};

export type ContentListPageProps = Readonly<{
  enabledMainserverMutationActions?: readonly string[];
  principalControl?: MainserverPrincipalControlModel;
}>;

export const ContentListPage = ({
  enabledMainserverMutationActions = [],
  principalControl,
}: ContentListPageProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as RouteSearchState;
  const auth = useAuth();
  const contentAccessApi = useContentAccess();
  const routeState = readNormalizedRouteState(search);
  const routeSortField = routeState.sort?.field;
  const routeSortDirection = routeState.sort?.direction;
  const authSessionPending = auth.isLoading || !auth.hasResolvedSession;
  const contentAccessPending =
    contentAccessApi.isLoading ||
    (contentAccessApi.permissionActions.length === 0 &&
      contentAccessApi.access === null &&
      contentAccessApi.error === null);
  const contentListEnabled = !authSessionPending && Boolean(auth.user) && !contentAccessPending;
  const effectivePermissionActions = React.useMemo(
    () =>
      authSessionPending || contentAccessApi.isLoading || contentAccessPending
        ? []
        : contentAccessApi.permissionActions,
    [
      authSessionPending,
      contentAccessApi.isLoading,
      contentAccessApi.permissionActions,
      contentAccessApi.access,
      contentAccessApi.error,
      contentAccessPending,
    ]
  );
  const unscopedPermissionActions =
    contentAccessApi.unscopedPermissionActions ?? EMPTY_PERMISSION_ACTIONS;
  const readableContentTypes = React.useMemo(
    () =>
      studioContentTypes.filter((definition) =>
        effectivePermissionActions.includes(definition.requiredReadAction)
      ),
    [effectivePermissionActions]
  );
  const visibleTypeSignature = React.useMemo(() => {
    if (readableContentTypes.length === 0) {
      return EMPTY_VISIBLE_TYPE_SENTINEL;
    }

    return readableContentTypes.map((definition) => definition.contentType).join('|');
  }, [readableContentTypes]);
  const visibleTypes = React.useMemo(
    () =>
      visibleTypeSignature === EMPTY_VISIBLE_TYPE_SENTINEL
        ? [EMPTY_VISIBLE_TYPE_SENTINEL]
        : visibleTypeSignature.split('|'),
    [visibleTypeSignature]
  );
  const contentListQuery = React.useMemo<IamContentListQuery>(
    () => ({
      page: routeState.page,
      pageSize: routeState.pageSize,
      ...(routeState.type !== 'all' ? { type: routeState.type } : {}),
      ...(routeState.type === 'faq.faq' && routeState.languageCode
        ? { languageCode: routeState.languageCode }
        : {}),
      ...(routeState.status !== 'all' ? { status: routeState.status } : {}),
      visibleTypes,
      sortBy: resolveContentSortField(routeSortField),
      sortDirection: routeSortDirection ?? 'desc',
    }),
    [
      routeSortDirection,
      routeSortField,
      routeState.page,
      routeState.pageSize,
      routeState.languageCode,
      routeState.status,
      routeState.type,
      visibleTypes,
      visibleTypeSignature,
    ]
  );
  const contentsApi = useContents(contentListQuery, { enabled: contentListEnabled });
  const projectionSyncMessage = React.useMemo(
    () => (contentsApi.metadata ? renderProjectionSyncMessage(contentsApi.metadata) : null),
    [contentsApi.metadata]
  );
  const creatableContentTypes = React.useMemo(
    () => filterCreatableStudioContentTypes(studioContentTypes, effectivePermissionActions),
    [effectivePermissionActions]
  );
  const createDisabled =
    creatableContentTypes.length === 0 &&
    (contentAccessApi.access
      ? !contentAccessApi.access.canCreate
      : contentsApi.error?.code === 'forbidden');
  const selectedCreatableType = creatableContentTypes.find(
    (definition) => definition.contentType === routeState.type
  );
  const createLabel = selectedCreatableType
    ? t('content.actions.createForType', {
        type: resolveStudioContentTypeLabel(selectedCreatableType),
      })
    : t('content.actions.create');
  const specificCreateLabels: Readonly<Record<string, string>> = {
    'news.article': t('content.actions.createNews'),
    'events.event-record': t('content.actions.createEvent'),
    'poi.point-of-interest': t('content.actions.createPoi'),
    'surveys.survey': t('content.actions.createSurvey'),
    'faq.faq': t('content.actions.createFaq'),
    'generic-items.generic-item': t('content.actions.createGenericItem'),
    'cockpit-cards.cockpit-card': t('content.actions.createCockpitCard'),
    'projects.project': t('content.actions.createProject'),
  };
  const tableCreateLabel = selectedCreatableType
    ? (specificCreateLabels[selectedCreatableType.contentType] ?? createLabel)
    : createLabel;
  const tableCreatePath = selectedCreatableType?.createPath ?? '/admin/content/new';

  const registeredContents = React.useMemo(
    () =>
      filterRegisteredStudioContentItems(
        contentsApi.contents,
        studioContentTypes,
        effectivePermissionActions
      ).map(({ item, definition }) => ({
        ...item,
        typeLabel: resolveStudioContentTypeLabel(definition),
        editPath: definition.detailPath
          .replace('$contentId', encodeURIComponent(item.id))
          .replace('$id', encodeURIComponent(item.id)),
      })),
    [contentsApi.contents, effectivePermissionActions]
  );
  const navigateSearch = React.useCallback(
    (next: Partial<ContentListRouteState>) => {
      Promise.resolve(
        navigate({
          to: '/admin/content',
          search: (current: RouteSearchState) => updateRouteState(current, next),
        })
      ).catch(() => undefined);
    },
    [navigate]
  );

  const {
    destructiveResult,
    setDestructiveResult,
    pendingRowDeletion,
    rowDeletePrincipal,
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
  } = useContentListDeletion({
    contentsApi,
    routeState,
    registeredContents,
    principalControl,
    unscopedPermissionActions,
  });

  return (
    <section
      ref={deleteFocusFallbackRef}
      tabIndex={-1}
      aria-label={t('content.page.title')}
      className="space-y-5"
      aria-busy={contentsApi.isLoading || authSessionPending || contentAccessPending}
    >
      <StudioListPageTemplate
        title={t('content.page.title')}
        description={t('content.page.subtitle')}
      />

      {destructiveResult ? (
        <StudioPersistentActionResult
          kind={destructiveResult.kind}
          title={t('content.messages.deleteSuccessTitle')}
          description={destructiveResult.description}
          dismissLabel={t('content.actions.dismissFeedback')}
          onDismiss={() => setDestructiveResult(null)}
        />
      ) : null}

      {contentsApi.error ? (
        <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
          <AlertDescription>{contentErrorMessage(contentsApi.error)}</AlertDescription>
        </Alert>
      ) : null}

      {contentAccessApi.error && !contentsApi.error ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{t('content.messages.accessLoadError')}</AlertDescription>
        </Alert>
      ) : null}

      {projectionSyncMessage && !contentsApi.error ? (
        <Alert className="border-secondary/40 bg-secondary/5 text-secondary">
          <AlertDescription>{projectionSyncMessage}</AlertDescription>
        </Alert>
      ) : null}

      <ContentListTable
        contentsApi={contentsApi}
        contentAccessApi={contentAccessApi}
        authSessionPending={authSessionPending}
        contentAccessPending={contentAccessPending}
        routeState={routeState}
        registeredContents={registeredContents}
        bulkActionButtons={bulkActionButtons}
        readableContentTypes={readableContentTypes}
        effectivePermissionActions={effectivePermissionActions}
        enabledMainserverMutationActions={enabledMainserverMutationActions}
        principalControl={principalControl}
        projectionSyncMessage={projectionSyncMessage}
        createDisabled={createDisabled}
        tableCreateLabel={tableCreateLabel}
        tableCreatePath={tableCreatePath}
        navigateSearch={navigateSearch}
        onRequestDelete={(item) => {
          setRowDeleteError(null);
          setPendingRowDeletion(item);
        }}
      />

      <MainserverAuthoringDiagnosticsPanel
        enabled={effectivePermissionActions.includes('iam.monitoring.read')}
      />

      <StudioDestructiveActionDialog
        open={pendingRowDeletion !== null}
        linkedContent={
          pendingRowDeletion &&
          rowDeletePrincipal &&
          deletionImpactBasePath(pendingRowDeletion.contentType)
            ? {
                basePath: deletionImpactBasePath(pendingRowDeletion.contentType)!,
                contentId: pendingRowDeletion.id,
                actingPrincipalType: rowDeletePrincipal,
                load: loadMainserverDeletionImpact,
                translate: (key: string, values?: Readonly<Record<string, string | number>>) =>
                  t(`content.${key}`, values),
              }
            : undefined
        }
        title={t('content.actions.deleteConfirmTitle')}
        description={t('content.actions.deleteConfirmDescription', {
          title: pendingRowDeletion?.title ?? '',
        })}
        confirmLabel={t('content.actions.delete')}
        pendingLabel={t('content.actions.deletePending')}
        cancelLabel={t('content.actions.cancel')}
        pending={rowDeletePending}
        errorMessage={rowDeleteError}
        fallbackFocusRef={deleteFocusFallbackRef}
        onCancel={() => {
          setRowDeleteError(null);
          setPendingRowDeletion(null);
        }}
        onConfirm={(detachLinkedContent) => void confirmRowDeletion(detachLinkedContent)}
      />

      <StudioDestructiveActionDialog
        open={pendingBulkDeletion !== null}
        title={t('content.actions.deleteBulkConfirmTitle')}
        description={t('content.actions.deleteBulkConfirmDescription', {
          count: pendingBulkDeletion?.selectedRows.length ?? 0,
        })}
        confirmLabel={t('content.actions.delete')}
        pendingLabel={t('content.actions.deletePending')}
        cancelLabel={t('content.actions.cancel')}
        pending={bulkDeletePending}
        errorMessage={bulkDeleteError}
        fallbackFocusRef={deleteFocusFallbackRef}
        onCancel={() => {
          setBulkDeleteError(null);
          setPendingBulkDeletion(null);
        }}
        onConfirm={() => void confirmBulkDeletion()}
      />
    </section>
  );
};
