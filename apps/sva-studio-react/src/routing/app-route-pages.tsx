import { useSearch } from '@tanstack/react-router';
import type React from 'react';
import type { MainserverPrincipalControlModel } from '@sva/studio-ui-react';
import { studioPlugins } from '../lib/plugins';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { useOrganizationContext } from '../hooks/use-organization-context';
import { useAuth } from '../providers/auth-provider';
import { ContentListPage } from '../routes/content/-content-list-page';
import {
  MainserverPrincipalAlert,
  useMainserverPrincipalControl,
} from './mainserver-principal-control';

export const ContentListRoutePage = () => {
  const search = useSearch({ strict: false }) as { type?: string };
  const listBinding =
    search.type === 'jobs.job'
      ? studioPlugins
          .find((plugin) => plugin.id === 'jobs')
          ?.viewBindings?.find((binding) => binding.bindingKey === 'jobsList')
      : search.type === 'construction-sites.construction-site'
        ? studioPlugins
            .find((plugin) => plugin.id === 'construction-sites')
            ?.viewBindings?.find((binding) => binding.bindingKey === 'constructionSitesList')
        : undefined;
  const PluginList = listBinding?.component as
    React.ComponentType<{ principalControl?: MainserverPrincipalControlModel }> | undefined;
  const mutationCapabilities = useMainserverMutationCapabilities();
  const resolution = useMainserverPrincipalControl();
  const { user } = useAuth();
  const { context, isUpdating } = useOrganizationContext();

  if (PluginList)
    return resolution.kind === 'ready' ? (
      <PluginList principalControl={resolution.control} />
    ) : (
      <MainserverPrincipalAlert reason={resolution.reason} />
    );
  return (
    <div className="space-y-5">
      {resolution.kind === 'unavailable' ? (
        <MainserverPrincipalAlert reason={resolution.reason} />
      ) : null}
      <ContentListPage
        key={JSON.stringify([
          user?.id,
          user?.instanceId,
          context?.activeOrganizationId,
          isUpdating,
        ])}
        enabledMainserverMutationActions={
          resolution.kind === 'ready' ? mutationCapabilities.enabledActions : []
        }
        principalControl={resolution.kind === 'ready' ? resolution.control : undefined}
      />
    </div>
  );
};
