import {
  evaluateUiAccess,
  type EffectiveAccessSnapshot,
  type MePermissionsResponse,
  type UiAccessDecision,
  type UiAccessRequirement,
} from '@sva/iam-core';
import React from 'react';
import { publishSessionAccessSnapshot } from '@sva/plugin-sdk';

import {
  asIamError,
  EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT,
  fetchWithRequestTimeout,
} from '../lib/iam-api';
import {
  createOperationLogger,
  logBrowserOperationFailure,
} from '../lib/browser-operation-logging';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { useAuth } from './auth-provider';
import {
  getEffectiveAccessInvalidationGeneration,
  requestEffectiveAccessInvalidation,
  subscribeToEffectiveAccessInvalidation,
} from './effective-access-invalidation';

export type EffectiveAccessContextValue = Readonly<{
  snapshot: EffectiveAccessSnapshot;
  permissionActions: readonly string[];
  decide: (requirement: UiAccessRequirement) => UiAccessDecision;
  invalidate: () => void;
  retry: () => void;
}>;

const EffectiveAccessContext = React.createContext<EffectiveAccessContextValue | null>(null);
const effectiveAccessLogger = createOperationLogger('effective-access-provider', 'debug');

const buildPermissionsPath = (instanceId: string, organizationId: string | null): string => {
  const searchParams = new URLSearchParams({ instanceId });
  if (organizationId) {
    searchParams.set('organizationId', organizationId);
  }
  return `/iam/me/permissions?${searchParams.toString()}`;
};

const isMePermissionsResponse = (value: unknown): value is MePermissionsResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<MePermissionsResponse>;
  return (
    typeof candidate.instanceId === 'string' &&
    Array.isArray(candidate.permissions) &&
    candidate.permissions.every(
      (permission) =>
        Boolean(permission) &&
        typeof permission === 'object' &&
        typeof permission.action === 'string'
    )
  );
};

const collectPermissionActions = (snapshot: EffectiveAccessSnapshot): readonly string[] =>
  snapshot.status === 'ready' && snapshot.scope.kind === 'tenant' && 'permissions' in snapshot
    ? [...new Set(snapshot.permissions.map((permission) => permission.action))].sort(
        (left, right) => left.localeCompare(right)
      )
    : [];

const usePublishSessionAccessSnapshot = (
  snapshot: EffectiveAccessSnapshot,
  roles: readonly string[] | undefined
): void => {
  React.useEffect(() => {
    const isResolved = snapshot.status === 'ready' || snapshot.status === 'error';
    publishSessionAccessSnapshot({
      isResolved,
      permissionActions: collectPermissionActions(snapshot),
      assignedModules:
        snapshot.status === 'ready' && 'assignedModules' in snapshot
          ? snapshot.assignedModules
          : [],
      roles: snapshot.status === 'ready' ? (roles ?? []) : [],
    });
  }, [roles, snapshot]);
};

export const EffectiveAccessProvider = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const auth = useAuth();
  const organizationContext = useOrganizationContext();
  const generationRef = React.useRef(0);
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

  React.useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;

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
      setSnapshot({
        status: 'ready',
        scope: { kind: 'platform', authGeneration: generation },
        generation,
        platformRoles: auth.user.roles,
      });
      return;
    }

    const organizationId = organizationContext.context?.activeOrganizationId ?? null;
    const scope = {
      kind: 'tenant' as const,
      authGeneration: generation,
      instanceId: auth.user.instanceId,
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

    void fetchWithRequestTimeout(
      buildPermissionsPath(auth.user.instanceId, organizationId),
      { signal: abortController.signal },
      { timeoutMs: 10_000 }
    )
      .then(async (response) => {
        if (!response.ok) {
          throw asIamError({
            status: response.status,
            code: response.status === 403 ? 'forbidden' : `http_${response.status}`,
            message: `http_${response.status}`,
          });
        }
        const payload: unknown = await response.json();
        if (!isMePermissionsResponse(payload) || payload.instanceId !== auth.user?.instanceId) {
          throw asIamError({ status: 502, code: 'invalid_response', message: 'invalid_response' });
        }
        if (generationRef.current !== generation) {
          return;
        }
        setSnapshot({
          status: 'ready',
          scope,
          generation,
          assignedModules: auth.user?.assignedModules ?? [],
          permissions: payload.permissions,
          ...(payload.snapshotVersion ? { snapshotVersion: payload.snapshotVersion } : {}),
        });
      })
      .catch((cause: unknown) => {
        if (abortController.signal.aborted || generationRef.current !== generation) {
          return;
        }
        const error = asIamError(cause);
        setSnapshot({ status: 'error', scope, generation, errorCode: error.code });
        logBrowserOperationFailure(effectiveAccessLogger, 'effective_access_load_failed', error, {
          operation: 'load_effective_access',
          instance_id: auth.user?.instanceId,
        });
      });

    return () => {
      abortController.abort();
    };
  }, [
    assignedModulesKey,
    auth.hasResolvedSession,
    auth.isLoading,
    auth.user?.id,
    auth.user?.instanceId,
    invalidationGeneration,
    organizationContext.context?.activeOrganizationId,
    organizationContext.error,
    organizationContext.isLoading,
    platformRolesKey,
  ]);

  const invalidate = React.useCallback(() => {
    const snapshotGeneration = generationRef.current;
    if (lastInvalidatedSnapshotGenerationRef.current === snapshotGeneration) {
      return;
    }
    lastInvalidatedSnapshotGenerationRef.current = snapshotGeneration;
    requestEffectiveAccessInvalidation();
  }, []);

  React.useEffect(() => {
    globalThis.addEventListener(EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT, invalidate);
    return () => {
      globalThis.removeEventListener(EFFECTIVE_ACCESS_INVALIDATION_REQUIRED_EVENT, invalidate);
    };
  }, [invalidate]);

  usePublishSessionAccessSnapshot(snapshot, auth.user?.roles);

  const value = React.useMemo<EffectiveAccessContextValue>(
    () => ({
      snapshot,
      permissionActions: collectPermissionActions(snapshot),
      decide: (requirement) =>
        evaluateUiAccess({
          isAuthenticated: auth.isAuthenticated,
          requirement,
          snapshot,
        }),
      invalidate,
      retry: invalidate,
    }),
    [auth.isAuthenticated, invalidate, snapshot]
  );

  return React.createElement(EffectiveAccessContext.Provider, { value }, children);
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
