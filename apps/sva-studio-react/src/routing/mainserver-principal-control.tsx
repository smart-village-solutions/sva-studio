import { resolveUserDisplayName, type IamOrganizationContextOption } from '@sva/core';
import { Button, type MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import React from 'react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { useAuth } from '../providers/auth-provider';

const EMPTY_ORGANIZATIONS: readonly IamOrganizationContextOption[] = [];

export type MainserverPrincipalResolution =
  | Readonly<{ kind: 'ready'; control: MainserverPrincipalControlModel }>
  | Readonly<{ kind: 'unavailable'; reason: 'context_loading' | 'context_unavailable' }>;

export const resolveMainserverPrincipalControl = (input: {
  readonly contextAvailable: boolean;
  readonly contextLoading?: boolean;
  readonly activeOrganizationId?: string;
  readonly organizations: readonly IamOrganizationContextOption[];
  readonly userDisplayName?: string;
}): MainserverPrincipalResolution => {
  if (input.contextLoading) {
    return { kind: 'unavailable', reason: 'context_loading' };
  }
  if (!input.contextAvailable) {
    return { kind: 'unavailable', reason: 'context_unavailable' };
  }

  const activeOrganization = input.activeOrganizationId
    ? input.organizations.find(
        (organization) =>
          organization.organizationId === input.activeOrganizationId && organization.isActive
      )
    : undefined;
  const userDisplayName = input.userDisplayName?.trim() || t('content.principal.user');
  const organizationName = activeOrganization?.displayName.trim() ?? '';
  const policy = activeOrganization?.contentAuthorPolicy;
  const hasValidPolicy = policy === 'org_only' || policy === 'org_or_personal';

  if (
    input.activeOrganizationId &&
    (!activeOrganization || organizationName.length === 0 || !hasValidPolicy)
  ) {
    return { kind: 'unavailable', reason: 'context_unavailable' };
  }

  if (policy === 'org_only' && organizationName.length > 0) {
    return {
      kind: 'ready',
      control: { kind: 'fixed', value: 'organization', label: organizationName },
    };
  }

  if (policy === 'org_or_personal' && organizationName.length > 0) {
    return {
      kind: 'ready',
      control: {
        kind: 'selectable',
        value: 'organization',
        options: [
          { value: 'organization', label: organizationName },
          { value: 'user', label: userDisplayName },
        ],
      },
    };
  }

  return {
    kind: 'ready',
    control: { kind: 'fixed', value: 'user', label: userDisplayName },
  };
};

export const useMainserverPrincipalControl = () => {
  const { user } = useAuth();
  const organizationContext = useOrganizationContext();
  const organizations = organizationContext.context?.organizations ?? EMPTY_ORGANIZATIONS;

  return resolveMainserverPrincipalControl({
    contextAvailable: organizationContext.context !== null && organizationContext.error === null,
    contextLoading: organizationContext.isLoading || organizationContext.isUpdating,
    activeOrganizationId: organizationContext.context?.activeOrganizationId,
    organizations,
    userDisplayName: user ? resolveUserDisplayName(user) : undefined,
  });
};

export const MainserverPrincipalAlert = ({
  reason,
}: Readonly<{ reason: 'context_loading' | 'context_unavailable' }>) => (
  <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
    <AlertDescription>
      {t(
        reason === 'context_loading'
          ? 'content.principal.contextLoading'
          : 'content.principal.contextUnavailable'
      )}
    </AlertDescription>
  </Alert>
);

export const MainserverPrincipalBoundary = ({
  children,
}: Readonly<{
  children: (control: MainserverPrincipalControlModel) => React.ReactNode;
}>) => {
  const resolution = useMainserverPrincipalControl();
  const organizationContext = useOrganizationContext();
  const lastReadyControl = React.useRef<MainserverPrincipalControlModel | null>(null);
  React.useEffect(() => {
    if (resolution.kind === 'ready') {
      lastReadyControl.current = resolution.control;
    }
  }, [resolution]);
  const control = resolution.kind === 'ready' ? resolution.control : lastReadyControl.current;
  const retry =
    resolution.kind === 'unavailable' && resolution.reason === 'context_unavailable' ? (
      <Button type="button" variant="secondary" onClick={() => void organizationContext.refetch()}>
        {t('shared.errorFallback.retry')}
      </Button>
    ) : null;
  if (!control) {
    return resolution.kind === 'unavailable' ? (
      <div className="space-y-3">
        <MainserverPrincipalAlert reason={resolution.reason} />
        {retry}
      </div>
    ) : null;
  }
  return (
    <>
      {resolution.kind === 'unavailable' ? (
        <MainserverPrincipalAlert reason={resolution.reason} />
      ) : null}
      {retry}
      <fieldset
        disabled={resolution.kind === 'unavailable'}
        aria-busy={resolution.kind === 'unavailable'}
        className="min-w-0 border-0 p-0"
      >
        {children(control)}
      </fieldset>
    </>
  );
};
