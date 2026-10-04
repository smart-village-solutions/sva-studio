import { resolveUserDisplayName, type IamOrganizationContextOption } from '@sva/core';
import { type MainserverPrincipalControlModel } from '@sva/studio-ui-react';
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
  if (resolution.kind === 'unavailable') {
    return <MainserverPrincipalAlert reason={resolution.reason} />;
  }
  return <>{children(resolution.control)}</>;
};
