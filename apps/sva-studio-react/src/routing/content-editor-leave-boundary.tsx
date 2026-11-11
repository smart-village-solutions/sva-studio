import { useBlocker } from '@tanstack/react-router';
import {
  Button,
  StudioConfirmDialog,
  StudioEditorLeaveGuardProvider,
  type StudioEditorLeaveActions,
} from '@sva/studio-ui-react';
import React from 'react';

import { t } from '../i18n';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../providers/auth-provider';
import { AUTH_RECOVERY_NAVIGATION_EVENT, parseAuthUser } from '../providers/auth-provider-helpers';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';
import {
  ORGANIZATION_CONTEXT_CHANGE_EVENT,
  type OrganizationContextChangeRequest,
  useOrganizationContext,
} from '../hooks/use-organization-context';
import { fetchAuthMeSingleFlight } from '../lib/auth-me-singleflight';
import { createLoginHref } from '../lib/auth-navigation';
import { fetchWithRequestTimeout, getMyOrganizationContext } from '../lib/iam-api';

type EditorContext = {
  userId: string;
  instanceId?: string;
  organizationId?: string;
};

const isSameEditorUser = (user: ReturnType<typeof useAuth>['user'], original: EditorContext) =>
  Boolean(user && user.id === original.userId && user.instanceId === original.instanceId);

const isRecoveryContextLoading = (
  auth: ReturnType<typeof useAuth>,
  organization: ReturnType<typeof useOrganizationContext>
) =>
  auth.isLoading || auth.isRecoveringSession || organization.isLoading || organization.isUpdating;

const isOriginalEditorContextConfirmed = (
  original: EditorContext | null,
  auth: ReturnType<typeof useAuth>,
  organization: ReturnType<typeof useOrganizationContext>
) =>
  Boolean(
    original &&
    isSameEditorUser(auth.user, original) &&
    (!original.instanceId ||
      (organization.context &&
        !organization.error &&
        organization.context.activeOrganizationId === original.organizationId))
  );

export function ContentEditorLeaveBoundary({
  children,
  protectContextChanges = false,
}: Readonly<{ children: React.ReactNode; protectContextChanges?: boolean }>) {
  const auth = useAuth();
  const organization = useOrganizationContext();
  const [recoveryState, setRecoveryState] = React.useState<
    'idle' | 'required' | 'checking' | 'confirming' | 'failed'
  >('idle');
  const recoveryRequired = recoveryState !== 'idle';
  const checkingRecovery = recoveryState === 'checking' || recoveryState === 'confirming';
  const originalContext = React.useRef<EditorContext | null>(null);
  const checkers = React.useRef(new Map<() => boolean, StudioEditorLeaveActions | undefined>());
  const [contextRequest, setContextRequest] =
    React.useState<OrganizationContextChangeRequest | null>(null);
  const pendingContext = React.useRef<OrganizationContextChangeRequest | null>(null);
  const [saving, setSaving] = React.useState(false);
  const register = React.useCallback((check: () => boolean, actions?: StudioEditorLeaveActions) => {
    checkers.current.set(check, actions);
    return () => {
      checkers.current.delete(check);
    };
  }, []);
  const hasUnsavedChanges = React.useCallback(
    () => recoveryRequired || [...checkers.current.keys()].some((check) => check()),
    [recoveryRequired]
  );
  React.useLayoutEffect(() => {
    const original = originalContext.current;
    if (
      original &&
      hasUnsavedChanges() &&
      (!isSameEditorUser(auth.user, original) ||
        (protectContextChanges &&
          organization.context &&
          organization.context.activeOrganizationId !== original.organizationId))
    ) {
      if (!recoveryRequired) setRecoveryState('required');
      return;
    }
    if (
      !recoveryRequired &&
      auth.user &&
      (!auth.user.instanceId || (organization.context && !organization.error))
    ) {
      originalContext.current = {
        userId: auth.user.id,
        instanceId: auth.user.instanceId,
        organizationId: organization.context?.activeOrganizationId,
      };
    }
  }, [
    auth.user,
    organization.context,
    organization.error,
    recoveryRequired,
    hasUnsavedChanges,
    protectContextChanges,
  ]);
  React.useEffect(() => {
    const retainEditor = (event: Event) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      setRecoveryState((current) => (current === 'idle' ? 'required' : current));
    };
    window.addEventListener(AUTH_RECOVERY_NAVIGATION_EVENT, retainEditor);
    return () => window.removeEventListener(AUTH_RECOVERY_NAVIGATION_EVENT, retainEditor);
  }, [hasUnsavedChanges]);
  React.useLayoutEffect(() => {
    if (recoveryState !== 'confirming' || isRecoveryContextLoading(auth, organization)) return;
    const original = originalContext.current;
    const confirmed = isOriginalEditorContextConfirmed(original, auth, organization);
    setRecoveryState(confirmed ? 'idle' : 'failed');
  }, [
    recoveryState,
    auth.user,
    auth.isLoading,
    auth.isRecoveringSession,
    organization.context,
    organization.error,
    organization.isLoading,
    organization.isUpdating,
  ]);
  const resumeEditor = async () => {
    const original = originalContext.current;
    if (!original || checkingRecovery) return;
    setRecoveryState('checking');
    requestEffectiveAccessInvalidation();
    try {
      const result = await fetchAuthMeSingleFlight(() =>
        fetchWithRequestTimeout(
          '/auth/me',
          {
            credentials: 'include',
            cache: 'no-store',
          },
          { timeoutMs: 5_000 }
        )
      );
      const user = result.ok ? parseAuthUser(result.payload) : null;
      if (!isSameEditorUser(user, original)) {
        setRecoveryState('failed');
        return;
      }
      if (original.instanceId) {
        const context = (await getMyOrganizationContext({ fresh: true })).data;
        if (context.activeOrganizationId !== original.organizationId) {
          setRecoveryState('failed');
          return;
        }
      }
      await auth.refreshSession();
      if (original.instanceId) await organization.refetch();
      setRecoveryState('confirming');
    } catch {
      setRecoveryState('failed');
    }
  };
  React.useEffect(() => {
    if (!protectContextChanges) return;
    const guard = (event: Event) => {
      if (!hasUnsavedChanges()) return;
      const request = (event as CustomEvent<OrganizationContextChangeRequest>).detail;
      event.preventDefault();
      if (pendingContext.current) {
        request.resolve(false);
        return;
      }
      pendingContext.current = request;
      setContextRequest(request);
    };
    window.addEventListener(ORGANIZATION_CONTEXT_CHANGE_EVENT, guard);
    return () => {
      window.removeEventListener(ORGANIZATION_CONTEXT_CHANGE_EVENT, guard);
      pendingContext.current?.resolve(false);
      pendingContext.current = null;
    };
  }, [protectContextChanges, hasUnsavedChanges]);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && hasUnsavedChanges(),
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

  const finishDeparture = (allowed: boolean) => {
    if (pendingContext.current) {
      pendingContext.current.resolve(allowed);
      pendingContext.current = null;
      setContextRequest(null);
    } else if (allowed) blocker.proceed?.();
    else blocker.reset?.();
  };
  const saveBeforeLeaving = async () => {
    setSaving(true);
    try {
      for (const [check, actions] of checkers.current) {
        if (check() && (!actions?.save || !(await actions.save()))) return;
      }
      finishDeparture(true);
    } finally {
      setSaving(false);
    }
  };
  const canSave = [...checkers.current.values()].some((actions) => actions?.save);

  return (
    <>
      {recoveryRequired ? (
        <Alert className="mb-4">
          <AlertDescription className="space-y-3">
            <p>{t('content.leaveGuard.sessionRecovery')}</p>
            {recoveryState === 'failed' ? (
              <p role="alert">{t('content.leaveGuard.sessionRecoveryFailed')}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <a href={createLoginHref('/')} target="_blank" rel="noopener noreferrer">
                  {t('content.leaveGuard.signInNewTab')}
                </a>
              </Button>
              <Button type="button" disabled={checkingRecovery} onClick={() => void resumeEditor()}>
                {t('content.leaveGuard.resumeEditor')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <StudioEditorLeaveGuardProvider register={register} suspended={recoveryRequired}>
        <fieldset
          disabled={recoveryRequired}
          hidden={recoveryRequired}
          className="min-w-0 border-0 p-0"
        >
          {children}
        </fieldset>
      </StudioEditorLeaveGuardProvider>
      <StudioConfirmDialog
        open={blocker.status === 'blocked' || contextRequest !== null}
        title={t('content.leaveGuard.title')}
        description={t('content.leaveGuard.description')}
        confirmLabel={t('content.leaveGuard.discard')}
        cancelLabel={t('content.leaveGuard.stay')}
        confirmDisabled={saving}
        cancelDisabled={saving}
        onConfirm={() => {
          for (const actions of checkers.current.values()) actions?.discard?.();
          finishDeparture(true);
        }}
        onCancel={() => finishDeparture(false)}
      >
        {canSave ? (
          <Button
            type="button"
            disabled={saving || recoveryRequired}
            onClick={() => void saveBeforeLeaving()}
          >
            {t('content.leaveGuard.save')}
          </Button>
        ) : null}
      </StudioConfirmDialog>
    </>
  );
}
