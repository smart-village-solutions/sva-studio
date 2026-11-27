import {
  evaluateUiAccess,
  type EffectiveAccessSnapshot,
  type UiAccessDecision,
  type UiAccessRequirement,
} from '@sva/iam-core';
import React from 'react';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';
import { StudioTableQueryProvider } from '@sva/studio-ui-react';

import { asIamError, EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT } from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
} from '../lib/browser-operation-logging';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { useAuth } from './auth-provider';
import { loadPermissionsWithRetry } from './effective-access-permissions';
import {
  getEffectiveAccessInvalidationGeneration,
  requestEffectiveAccessInvalidation,
  subscribeToEffectiveAccessInvalidation,
} from './effective-access-invalidation';

export { evaluateUiAccess };

export type EffectiveAccessContextValue = Readonly<{
  snapshot: EffectiveAccessSnapshot;
  isCurrent: boolean;
  permissionActions: readonly string[];
  unscopedPermissionActions: readonly string[];
  decide: (requirement: UiAccessRequirement) => UiAccessDecision;
  invalidate: () => void;
  retry: () => void;
}>;

const EffectiveAccessContext = React.createContext<EffectiveAccessContextValue | null>(null);
const effectiveAccessLogger = createOperationLogger('effective-access-provider', 'debug');

const collectPermissionActions = (snapshot: EffectiveAccessSnapshot): readonly string[] =>
  snapshot.status === 'ready' && snapshot.scope.kind === 'tenant' && 'permissions' in snapshot
    ? [...new Set(snapshot.permissions.map((permission) => permission.action))].sort(
        (left, right) => left.localeCompare(right)
      )
    : [];

const collectGloballyAllowedPermissionActions = (
  snapshot: EffectiveAccessSnapshot
): readonly string[] =>
  collectPermissionActions(snapshot).filter(
    (action) =>
      evaluateUiAccess({
        isAuthenticated: true,
        requirement: { kind: 'tenant', actions: { mode: 'allOf', values: [action] } },
        snapshot,
      }).status === 'allowed'
  );

const usePublishSessionAccessSnapshot = (
  snapshot: EffectiveAccessSnapshot,
  roles: readonly string[] | undefined,
  subjectId: string | undefined,
  instanceId: string | undefined,
  organizationId: string | null,
  snapshotIsCurrent: boolean
): void => {
  React.useEffect(() => {
    const isResolved = snapshotIsCurrent && snapshot.status === 'ready';
    publishSessionAccessSnapshot({
      isResolved,
      hasError: snapshotIsCurrent && snapshot.status === 'error',
      ...(subjectId ? { subjectId } : {}),
      ...(instanceId ? { instanceId } : {}),
      organizationId,
      permissionActions: snapshotIsCurrent ? collectPermissionActions(snapshot) : [],
      unscopedPermissionActions:
        snapshotIsCurrent &&
        snapshot.status === 'ready' &&
        snapshot.scope.kind === 'tenant' &&
        'permissions' in snapshot
          ? collectGloballyAllowedPermissionActions(snapshot)
          : [],
      assignedModules:
        snapshotIsCurrent && snapshot.status === 'ready' && 'assignedModules' in snapshot
          ? snapshot.assignedModules
          : [],
      roles: snapshotIsCurrent && snapshot.status === 'ready' ? (roles ?? []) : [],
    });
  }, [instanceId, organizationId, roles, snapshot, snapshotIsCurrent, subjectId]);
};

const useLoadEffectiveAccessSnapshot = (input: {
  readonly auth: ReturnType<typeof useAuth>;
  readonly organizationContext: ReturnType<typeof useOrganizationContext>;
  readonly invalidationGeneration: number;
  readonly currentScopeKey: string;
  readonly assignedModulesKey: string;
  readonly platformRolesKey: string;
  readonly generationRef: React.MutableRefObject<number>;
  readonly resolvedScopeKeyRef: React.MutableRefObject<string | null>;
  readonly resolvedInvalidationGenerationRef: React.MutableRefObject<number | null>;
  readonly setSnapshot: React.Dispatch<React.SetStateAction<EffectiveAccessSnapshot>>;
}): void => {
  const {
    auth,
    organizationContext,
    invalidationGeneration,
    currentScopeKey,
    assignedModulesKey,
    platformRolesKey,
    generationRef,
    resolvedScopeKeyRef,
    resolvedInvalidationGenerationRef,
    setSnapshot,
  } = input;

  React.useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    resolvedScopeKeyRef.current = null;
    resolvedInvalidationGenerationRef.current = null;

    if (!auth.hasResolvedSession) {
      setSnapshot({
        status: auth.isLoading ? 'loading' : 'unresolved',
        scope: { kind: 'platform', authGeneration: generation },
        generation,
      });
      return;
    }

    if (!auth.user) {
      setSnapshot({
        status: 'unresolved',
        scope: { kind: 'platform', authGeneration: generation },
        generation,
      });
      return;
    }

    if (!auth.user.instanceId) {
      resolvedScopeKeyRef.current = currentScopeKey;
      resolvedInvalidationGenerationRef.current = invalidationGeneration;
      setSnapshot({
        status: 'ready',
        scope: { kind: 'platform', authGeneration: generation },
        generation,
        platformRoles: auth.user.roles,
      });
      return;
    }

    const instanceId = auth.user.instanceId;
    const organizationId = organizationContext.context?.activeOrganizationId ?? null;
    const scope = {
      kind: 'tenant' as const,
      authGeneration: generation,
      instanceId,
      organizationId,
      moduleAssignmentGeneration: generation,
    };

    if (organizationContext.isLoading) {
      setSnapshot({ status: 'loading', scope, generation });
      return;
    }
    if (organizationContext.error) {
      setSnapshot({
        status: 'error',
        scope,
        generation,
        errorCode: organizationContext.error.code,
      });
      return;
    }

    const abortController = new AbortController();
    setSnapshot({ status: 'loading', scope, generation });

    void loadPermissionsWithRetry(instanceId, organizationId, abortController.signal)
      .then((payload) => {
        if (!payload || generationRef.current !== generation) return;
        setSnapshot({
          status: 'ready',
          scope,
          generation,
          assignedModules: auth.user?.assignedModules ?? [],
          permissions: payload.permissions,
          ...(payload.snapshotVersion ? { snapshotVersion: payload.snapshotVersion } : {}),
        });
        resolvedScopeKeyRef.current = currentScopeKey;
        resolvedInvalidationGenerationRef.current = invalidationGeneration;
      })
      .catch((cause: unknown) => {
        if (abortController.signal.aborted || generationRef.current !== generation) return;
        const error = asIamError(cause);
        resolvedScopeKeyRef.current = currentScopeKey;
        resolvedInvalidationGenerationRef.current = invalidationGeneration;
        setSnapshot({ status: 'error', scope, generation, errorCode: error.code });
        logBrowserOperationFailure(effectiveAccessLogger, 'effective_access_load_failed', error, {
          operation: 'load_effective_access',
          instance_id: instanceId,
        });
      });

    return () => abortController.abort();
  }, [
    assignedModulesKey,
    auth.hasResolvedSession,
    auth.isLoading,
    auth.user?.id,
    auth.user?.instanceId,
    invalidationGeneration,
    currentScopeKey,
    organizationContext.context?.activeOrganizationId,
    organizationContext.error,
    organizationContext.isLoading,
    platformRolesKey,
  ]);
};

export const EffectiveAccessProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const auth = useAuth();
  const organizationContext = useOrganizationContext();
  const generationRef = React.useRef(0);
  const resolvedScopeKeyRef = React.useRef<string | null>(null);
  const resolvedInvalidationGenerationRef = React.useRef<number | null>(null);
  const lastInvalidatedSnapshotGenerationRef = React.useRef<number | null>(null);
  const invalidationGeneration = React.useSyncExternalStore(
    subscribeToEffectiveAccessInvalidation,
    getEffectiveAccessInvalidationGeneration,
    getEffectiveAccessInvalidationGeneration
  );
  const [snapshot, setSnapshot] = React.useState<EffectiveAccessSnapshot>({
    status: 'unresolved',
    scope: { kind: 'platform', authGeneration: 0 },
    generation: 0,
  });

  const assignedModulesKey = (auth.user?.assignedModules ?? []).join('\u0000');
  const platformRolesKey = (auth.user?.roles ?? []).join('\u0000');
  const currentScopeKey = JSON.stringify([
    auth.user?.id,
    auth.user?.instanceId,
    organizationContext.context?.activeOrganizationId,
    assignedModulesKey,
    platformRolesKey,
  ]);

  useLoadEffectiveAccessSnapshot({
    auth,
    organizationContext,
    invalidationGeneration,
    currentScopeKey,
    assignedModulesKey,
    platformRolesKey,
    generationRef,
    resolvedScopeKeyRef,
    resolvedInvalidationGenerationRef,
    setSnapshot,
  });

  const invalidate = React.useCallback(() => {
    const snapshotGeneration = generationRef.current;
    if (lastInvalidatedSnapshotGenerationRef.current === snapshotGeneration) return;
    lastInvalidatedSnapshotGenerationRef.current = snapshotGeneration;
    requestEffectiveAccessInvalidation();
  }, []);

  const retry = React.useCallback(() => {
    if (!organizationContext.error) {
      invalidate();
      return;
    }

    void organizationContext.refetch().finally(invalidate);
  }, [invalidate, organizationContext.error, organizationContext.refetch]);

  React.useEffect(() => {
    globalThis.addEventListener(EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT, invalidate);
    return () =>
      globalThis.removeEventListener(EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT, invalidate);
  }, [invalidate]);

  const snapshotIsCurrent =
    snapshot.generation === generationRef.current &&
    resolvedScopeKeyRef.current === currentScopeKey &&
    resolvedInvalidationGenerationRef.current === invalidationGeneration;

  usePublishSessionAccessSnapshot(
    snapshot,
    auth.user?.roles,
    auth.user?.id,
    auth.user?.instanceId,
    organizationContext.context?.activeOrganizationId ?? null,
    snapshotIsCurrent
  );

  const isCurrent =
    snapshotIsCurrent &&
    !auth.isLoading &&
    !auth.isRecoveringSession &&
    !organizationContext.isLoading &&
    !organizationContext.isUpdating &&
    !organizationContext.error;
  const value = React.useMemo<EffectiveAccessContextValue>(
    () => ({
      snapshot,
      isCurrent,
      permissionActions: collectPermissionActions(snapshot),
      unscopedPermissionActions: collectGloballyAllowedPermissionActions(snapshot),
      decide: (requirement) =>
        evaluateUiAccess({
          isAuthenticated: auth.isAuthenticated,
          requirement,
          snapshot,
        }),
      invalidate,
      retry,
    }),
    [auth.isAuthenticated, invalidate, isCurrent, retry, snapshot]
  );

  return React.createElement(
    EffectiveAccessContext.Provider,
    { value },
    React.createElement(StudioTableQueryProvider, {
      scope: isCurrent && snapshot.status === 'ready' ? snapshot.generation : null,
      children,
    })
  );
};

export const useEffectiveAccess = (): EffectiveAccessContextValue => {
  const context = React.useContext(EffectiveAccessContext);
  if (!context) {
    throw new Error('useEffectiveAccess must be used within EffectiveAccessProvider');
  }
  return context;
};

export const useAccessDecision = (requirement: UiAccessRequirement): UiAccessDecision =>
  useEffectiveAccess().decide(requirement);

export const useEffectiveAuth = () => {
  const auth = useAuth();
  const effectiveAccess = useEffectiveAccess();
  const user = React.useMemo(
    () =>
      auth.user
        ? { ...auth.user, permissionActions: effectiveAccess.permissionActions }
        : auth.user,
    [auth.user, effectiveAccess.permissionActions]
  );

  return React.useMemo(() => ({ ...auth, user }), [auth, user]);
};
