import type { PluginViewBinding } from '@sva/plugin-sdk';
import {
  StudioLoadingState,
  type MainserverPrincipalContextOption,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import React from 'react';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { t } from '../i18n';
import { studioBuildTimeRegistry } from '../lib/plugins';
import { useAuth } from '../providers/auth-provider';
import { MainserverPrincipalBoundary } from './mainserver-principal-control';
import { MainserverResourcePrincipalBoundary } from './mainserver-resource-principal-boundary';

type PluginViewComponent = React.ComponentType<Record<string, unknown>>;

const CategoriesRoutePage = ({ Page }: Readonly<{ Page: PluginViewComponent }>) => {
  const mutationCapabilities = useMainserverMutationCapabilities();
  const organizationContext = useOrganizationContext();
  const dataTypeOptions = [...studioBuildTimeRegistry.mainserverGenericTypeRegistry.entries()].map(
    ([value, contentType]) => {
      const definition = studioBuildTimeRegistry.contentTypes.find(
        (candidate) => candidate.contentType === contentType
      );
      return {
        value,
        label: definition?.titleKey
          ? t(definition.titleKey)
          : (definition?.displayName ?? contentType),
      };
    }
  );
  if (organizationContext.isLoading || organizationContext.isUpdating)
    return <StudioLoadingState>{t('content.principal.contextLoading')}</StudioLoadingState>;
  if (organizationContext.context === null || organizationContext.error !== null)
    return (
      <Alert className="border-destructive/40 bg-destructive/5 text-destructive">
        <AlertDescription>{t('content.principal.contextUnavailable')}</AlertDescription>
      </Alert>
    );
  return (
    <Page
      key={organizationContext.context.activeOrganizationId ?? 'personal'}
      dataTypeOptions={dataTypeOptions}
      enabledMutationActions={mutationCapabilities.enabledActions}
      mutationActionsError={mutationCapabilities.error !== null}
      mutationActionsLoading={mutationCapabilities.isLoading}
      onReloadMutationActions={mutationCapabilities.reload}
    />
  );
};

const PluginContentView = ({
  Page,
  pluginId,
  binding,
  contentType,
  viewKind,
}: Readonly<{
  Page: PluginViewComponent;
  pluginId: string;
  binding: PluginViewBinding;
  contentType: string;
  viewKind: 'list' | 'detail' | 'editor';
}>) => {
  const { user } = useAuth();
  const mutationCapabilities = useMainserverMutationCapabilities();
  const organizationContext = useOrganizationContext();
  const makePage = (principalControl?: MainserverPrincipalControlModel) => (
    <Page
      principalControl={principalControl}
      instanceId={user?.instanceId}
      canUpdate={mutationCapabilities.enabledActions.includes(`${pluginId}.update`)}
    />
  );

  if (viewKind === 'list') return makePage();
  if (viewKind === 'detail') {
    return (
      <MainserverResourcePrincipalBoundary contentType={contentType}>
        {(principalControl) => makePage(principalControl)}
      </MainserverResourcePrincipalBoundary>
    );
  }

  return (
    <MainserverPrincipalBoundary>
      {(principalControl) => {
        if (!binding.allowPrincipalContextSwitch) return makePage(principalControl);
        const activeOrganizationId = organizationContext.context?.activeOrganizationId;
        const memberOrganizations = user?.roles?.includes('system_admin')
          ? (organizationContext.context?.organizations.filter(
              (organization) => organization.isActive
            ) ?? [])
          : [];
        const contextOptions: MainserverPrincipalContextOption[] = [
          ...(activeOrganizationId &&
          principalControl.kind === 'fixed' &&
          principalControl.value === 'organization'
            ? [{ value: 'personal' as const, label: t('shell.header.organizationContextPersonal') }]
            : []),
          ...memberOrganizations
            .filter((organization) => organization.organizationId !== activeOrganizationId)
            .map((organization) => ({
              value: `organization:${organization.organizationId}` as const,
              label: organization.displayName,
            })),
        ];
        return makePage({
          ...principalControl,
          contextOptions,
          onContextChange: (selection) => {
            if (selection === 'personal') {
              void organizationContext.switchOrganization(null);
              return;
            }
            const organization = memberOrganizations.find(
              (candidate) => `organization:${candidate.organizationId}` === selection
            );
            if (organization)
              void organizationContext.switchOrganization(organization.organizationId);
          },
        });
      }}
    </MainserverPrincipalBoundary>
  );
};

export const createHostOwnedPluginView = (
  pluginId: string,
  binding: PluginViewBinding,
  Page: React.ComponentType<never>
): React.ComponentType => {
  const Component = Page as unknown as PluginViewComponent;
  if (binding.bindingKey === 'categories') {
    return () => <CategoriesRoutePage Page={Component} />;
  }
  const resource = studioBuildTimeRegistry.adminResources.find((candidate) =>
    Object.values(candidate.contentUi?.bindings ?? {}).some(
      (view) => view?.bindingKey === binding.bindingKey
    )
  );
  const matchedView = Object.entries(resource?.contentUi?.bindings ?? {}).find(
    ([, view]) => view?.bindingKey === binding.bindingKey
  );
  if (!resource?.contentUi?.contentType || !matchedView) return () => <Component />;
  const viewKind = matchedView[0] as 'list' | 'detail' | 'editor';
  return () => (
    <PluginContentView
      Page={Component}
      pluginId={pluginId}
      binding={binding}
      contentType={resource.contentUi!.contentType}
      viewKind={viewKind}
    />
  );
};
