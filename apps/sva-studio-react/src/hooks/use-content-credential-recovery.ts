import React from 'react';
import type { IamContentListItem, IamContentListQuery } from '@sva/core';
import { asIamError, refreshProjectedContents, type IamContentListMetadata } from '../lib/iam-api';
import type { ContentCredentialRecovery } from '../lib/iam-api-content-types';
import { credentialRecoveryErrorCodes } from '../lib/iam-content-list-api.shared';
import { useAuth } from '../providers/auth-provider';
import { useOrganizationContext } from './use-organization-context';
import type { useIamAdminList } from './use-iam-admin-list';
import { contentsLogger, SESSION_REFRESHED_EVENT } from './use-contents.shared.js';

type ContentList = Pick<
  ReturnType<typeof useIamAdminList<IamContentListItem>>,
  'isLoading' | 'error' | 'refetch' | 'refetchWithOutcome' | 'setError'
>;
type RecoveryState = {
  query: IamContentListQuery;
  enabled: boolean;
  metadata: IamContentListMetadata | null;
  adminList: ContentList;
  scope: string;
  mounted: React.RefObject<boolean>;
  currentScope: React.RefObject<string>;
  recoveryAttempted: React.RefObject<Set<string>>;
  refreshProjectionPending: boolean;
  setRefreshProjectionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setCredentialRecovery: React.Dispatch<React.SetStateAction<readonly ContentCredentialRecovery[]>>;
  user: ReturnType<typeof useAuth>['user'];
};
const getRefreshProjectionState = (
  metadata: IamContentListMetadata | null,
  visibleTypes: IamContentListQuery['visibleTypes']
): readonly string[] =>
  metadata?.mainserverSyncStates
    ?.map((entry) => entry.contentType)
    .filter((contentType) => typeof contentType === 'string' && contentType.length > 0) ??
  visibleTypes?.filter(
    (contentType) => typeof contentType === 'string' && contentType.length > 0
  ) ??
  [];

const failedRecovery = (
  cause: unknown,
  instanceId: string | undefined,
  query: IamContentListQuery,
  originalRequestId: string | undefined
): ContentCredentialRecovery => {
  const error = asIamError(cause);
  return {
    instanceId: instanceId ?? '',
    contentType: query.type ?? query.visibleTypes?.[0] ?? '',
    source: 'unknown',
    outcome: 'failed',
    reasonCode: 'recovery_failed',
    occurredAt: new Date().toISOString(),
    ...(error.requestId ? { requestId: error.requestId } : {}),
    ...(originalRequestId ? { originalRequestId } : {}),
  };
};

const useAutomaticCredentialRecovery = ({
  query,
  enabled,
  metadata,
  adminList,
  scope,
  mounted,
  currentScope,
  recoveryAttempted,
  refreshProjectionPending,
  setRefreshProjectionPending,
  setCredentialRecovery,
  user,
}: RecoveryState): void => {
  const failedState = metadata?.mainserverSyncStates.find(
    (entry) => entry.lastErrorCode && credentialRecoveryErrorCodes.has(entry.lastErrorCode)
  );
  const recoveryError = failedState?.lastErrorCode ?? adminList.error?.code;
  const failureKey = `${scope}:${failedState?.lastFailedAt ?? recoveryError}`;
  React.useEffect(() => {
    if (
      !enabled ||
      adminList.isLoading ||
      refreshProjectionPending ||
      !recoveryError ||
      !credentialRecoveryErrorCodes.has(recoveryError) ||
      failedState?.isSyncRunning ||
      failedState?.credentialRecovery ||
      recoveryAttempted.current.has(failureKey)
    )
      return;
    recoveryAttempted.current.add(failureKey);
    const capturedScope = scope;
    setRefreshProjectionPending(true);
    void refreshProjectedContents({
      visibleTypes: query.type ? [query.type] : query.visibleTypes,
      recoverCredentials: true,
      ...(adminList.error?.requestId ? { originalRequestId: adminList.error.requestId } : {}),
    })
      .then(async (response) => {
        if (!mounted.current || currentScope.current !== capturedScope) return;
        if (response.data.credentialRecovery)
          setCredentialRecovery(response.data.credentialRecovery);
        // The server may still be finishing the original refresh; ordinary reads keep observing it.
        if (response.data.status === 'already_running')
          recoveryAttempted.current.delete(failureKey);
        await adminList.refetch();
      })
      .catch((cause: unknown) => {
        if (!mounted.current || currentScope.current !== capturedScope) return;
        setCredentialRecovery([
          failedRecovery(cause, user?.instanceId, query, adminList.error?.requestId),
        ]);
      })
      .finally(() => {
        if (mounted.current && currentScope.current === capturedScope)
          setRefreshProjectionPending(false);
      });
  }, [
    enabled,
    scope,
    failureKey,
    recoveryError,
    failedState?.isSyncRunning,
    failedState?.credentialRecovery,
    adminList.isLoading,
    refreshProjectionPending,
    query.type,
    query.visibleTypes,
    adminList.error?.requestId,
    adminList.refetch,
    user?.instanceId,
  ]);
};

const useManualProjectionRefresh = ({
  query,
  metadata,
  adminList,
  scope,
  mounted,
  currentScope,
  setRefreshProjectionPending,
  setCredentialRecovery,
}: RecoveryState) => {
  const { refreshSession } = useAuth();
  const failedState = metadata?.mainserverSyncStates.find(
    (entry) => entry.lastErrorCode && credentialRecoveryErrorCodes.has(entry.lastErrorCode)
  );
  const recoveryError = failedState?.lastErrorCode ?? adminList.error?.code;
  const refreshProjectionState = React.useMemo(
    () => getRefreshProjectionState(metadata, query.visibleTypes),
    [metadata, query.visibleTypes]
  );

  return React.useCallback(
    async (input: { readonly force?: boolean } = {}) => {
      setRefreshProjectionPending(true);
      const capturedScope = scope;
      try {
        const response = await refreshProjectedContents({
          ...(refreshProjectionState.length > 0 ? { visibleTypes: refreshProjectionState } : {}),
          ...(input.force ? { force: true } : {}),
          ...(input.force && recoveryError && credentialRecoveryErrorCodes.has(recoveryError)
            ? { recoverCredentials: true }
            : {}),
        });
        if (!mounted.current || currentScope.current !== capturedScope) return false;
        if (response.data?.credentialRecovery)
          setCredentialRecovery(response.data.credentialRecovery);
        const refreshed = await adminList.refetchWithOutcome();
        return refreshed && response.data?.status !== 'failed';
      } catch (cause) {
        if (!mounted.current || currentScope.current !== capturedScope) return false;
        const resolvedError = asIamError(cause);
        if (resolvedError.status === 401) {
          await refreshSession();
          contentsLogger.info(SESSION_REFRESHED_EVENT, {
            operation: 'refresh_projected_contents',
            status: resolvedError.status,
            error_code: resolvedError.code,
          });
        }
        adminList.setError(resolvedError);
        return false;
      } finally {
        if (mounted.current && currentScope.current === capturedScope)
          setRefreshProjectionPending(false);
      }
    },
    [adminList, refreshSession, refreshProjectionState, scope, recoveryError]
  );
};

export const useContentCredentialRecovery = (
  query: IamContentListQuery,
  enabled: boolean,
  metadata: IamContentListMetadata | null,
  adminList: ContentList
) => {
  const { user } = useAuth();
  const organizationContext = useOrganizationContext();
  const [refreshProjectionPending, setRefreshProjectionPending] = React.useState(false);
  const [credentialRecovery, setCredentialRecovery] = React.useState<
    readonly ContentCredentialRecovery[]
  >([]);
  const recoveryAttempted = React.useRef(new Set<string>());
  const scope = JSON.stringify([
    user?.id,
    user?.instanceId,
    organizationContext.context?.activeOrganizationId,
    query.type,
    query.visibleTypes,
    enabled,
  ]);
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const currentScope = React.useRef(scope);
  currentScope.current = scope;
  React.useEffect(() => {
    setCredentialRecovery([]);
    setRefreshProjectionPending(false);
  }, [scope]);

  React.useEffect(() => {
    if (
      !metadata ||
      (!metadata.hasBlockingSyncGap &&
        metadata.mainserverSyncStates.every((entry) => !entry.lastErrorCode))
    )
      setCredentialRecovery([]);
  }, [metadata]);
  const shared = {
    query,
    enabled,
    metadata,
    adminList,
    scope,
    mounted,
    currentScope,
    recoveryAttempted,
    refreshProjectionPending,
    setRefreshProjectionPending,
    setCredentialRecovery,
    user,
  };
  useAutomaticCredentialRecovery(shared);
  const refreshProjection = useManualProjectionRefresh(shared);
  return { credentialRecovery, refreshProjectionPending, refreshProjection };
};
