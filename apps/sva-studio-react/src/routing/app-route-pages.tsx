import { useMainserverMutationCapabilities } from '../hooks/use-mainserver-mutation-capabilities';
import { ContentListPage } from '../routes/content/-content-list-page';
import {
  MainserverPrincipalAlert,
  useMainserverPrincipalControl,
} from './mainserver-principal-control';

export const ContentListRoutePage = () => {
  const mutationCapabilities = useMainserverMutationCapabilities();
  const resolution = useMainserverPrincipalControl();

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
