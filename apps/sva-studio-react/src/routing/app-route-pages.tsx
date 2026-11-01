import { useSearch } from '@tanstack/react-router';
import type React from 'react';
import { studioPlugins } from '../lib/plugins';
import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { ContentListPage } from '../routes/content/-content-list-page';
import {
  MainserverPrincipalAlert,
  useMainserverPrincipalControl,
} from './mainserver-principal-control';

export const ContentListRoutePage = () => {
  const search = useSearch({ strict: false }) as { type?: string };
  const listBinding =
    search.type === 'construction-sites.construction-site'
      ? studioPlugins
          .find((plugin) => plugin.id === 'construction-sites')
          ?.viewBindings?.find((binding) => binding.bindingKey === 'constructionSitesList')
      : undefined;
  const ConstructionSitesList = listBinding?.component as React.ComponentType | undefined;
  const mutationCapabilities = useMainserverMutationCapabilities();
  const resolution = useMainserverPrincipalControl();

  if (ConstructionSitesList) return <ConstructionSitesList />;
  if (resolution.kind === 'unavailable') {
    return (
      <div className="space-y-5">
        <MainserverPrincipalAlert reason={resolution.reason} />
        <ContentListPage enabledMainserverMutationActions={[]} />
      </div>
    );
  }

  return (
    <ContentListPage
      enabledMainserverMutationActions={mutationCapabilities.enabledActions}
      principalControl={resolution.control}
    />
  );
};
