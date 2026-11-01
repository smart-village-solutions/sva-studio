import { useBlocker } from '@tanstack/react-router';
import { Button, StudioConfirmDialog, StudioEditorLeaveGuardProvider } from '@sva/studio-ui-react';
import React from 'react';

import { t } from '../i18n';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useAuth } from '../providers/auth-provider';
import { AUTH_RECOVERY_NAVIGATION_EVENT, parseAuthUser } from '../providers/auth-provider-helpers';
import { requestEffectiveAccessInvalidation } from '../providers/effective-access-invalidation';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { fetchAuthMeSingleFlight } from '../lib/auth-me-singleflight';
import { createLoginHref } from '../lib/auth-navigation';
import { fetchWithRequestTimeout, getMyOrganizationContext } from '../lib/iam-api';

export function ContentEditorLeaveBoundary({ children }: Readonly<{ children: React.ReactNode }>) {
  const auth = useAuth();
  const organization = useOrganizationContext();
  const [recoveryState, setRecoveryState] = React.useState<
    'idle' | 'required' | 'checking' | 'confirming' | 'failed'
  >('idle');
  const recoveryRequired = recoveryState !== 'idle';
  const checkingRecovery = recoveryState === 'checking' || recoveryState === 'confirming';
  const originalContext = React.useRef<{
    userId: string;
    instanceId?: string;
    organizationId?: string;
  } | null>(null);
  const checkers = React.useRef(new Set<() => boolean>());
  const register = React.useCallback((check: () => boolean) => {
    checkers.current.add(check);
    return () => {
      checkers.current.delete(check);
    };
  }, []);
  const hasUnsavedChanges = React.useCallback(
    () => recoveryRequired || [...checkers.current].some((check) => check()),
    [recoveryRequired]
  );
  React.useLayoutEffect(() => {
    const original = originalContext.current;
    if (
      original &&
      hasUnsavedChanges() &&
      (!auth.user ||
        auth.user.id !== original.userId ||
        auth.user.instanceId !== original.instanceId)
    ) {
      if (!recoveryRequired) setRecoveryState('required');
      return;
    }
    if (!recoveryRequired && auth.user && organization.context && !organization.error) {
      originalContext.current = {
        userId: auth.user.id,
        instanceId: auth.user.instanceId,
        organizationId: organization.context.activeOrganizationId,
      };
    }
  }, [auth.user, organization.context, organization.error, recoveryRequired, hasUnsavedChanges]);
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
    if (
      recoveryState !== 'confirming' ||
      auth.isLoading ||
      auth.isRecoveringSession ||
      organization.isLoading ||
      organization.isUpdating
    )
      return;
    const original = originalContext.current;
    const confirmed =
      original &&
      auth.user?.id === original.userId &&
      auth.user?.instanceId === original.instanceId &&
      organization.context &&
      !organization.error &&
      organization.context.activeOrganizationId === original.organizationId;
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
      if (!user || user.id !== original.userId || user.instanceId !== original.instanceId) {
        setRecoveryState('failed');
        return;
      }
      const context = (await getMyOrganizationContext({ fresh: true })).data;
      if (context.activeOrganizationId !== original.organizationId) {
        setRecoveryState('failed');
        return;
      }
      await auth.refreshSession();
      await organization.refetch();
      setRecoveryState('confirming');
    } catch {
      setRecoveryState('failed');
    }
  };
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => current.pathname !== next.pathname && hasUnsavedChanges(),
    enableBeforeUnload: hasUnsavedChanges,
    withResolver: true,
  });

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
        open={blocker.status === 'blocked'}
        title={t('content.leaveGuard.title')}
        description={t('content.leaveGuard.description')}
        confirmLabel={t('content.leaveGuard.discard')}
        cancelLabel={t('content.leaveGuard.stay')}
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </>
  );
}
