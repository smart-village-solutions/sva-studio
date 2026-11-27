import { Link, useParams, useSearch } from '@tanstack/react-router';
import { normalizeListSearch, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  useStudioTableQuery,
} from '@sva/studio-ui-react';

import { listGenericItems } from './generic-items.api.js';
import { GenericItemsDetailPage } from './generic-items.detail-page.js';
import { GenericItemsDataTable, GenericItemsPagination } from './generic-items.pages.parts.js';

export function GenericItemsListPage() {
  const pt = usePluginTranslation('genericItems');
  const search = useSearch({ strict: false }) as {
    readonly page?: number;
    readonly pageSize?: number;
  };
  const { page, pageSize } = normalizeListSearch(search);
  const list = useStudioTableQuery(['generic-items', page, pageSize], () =>
    listGenericItems({ page, pageSize })
  );
  const result = list.data ?? { data: [], pagination: { page, pageSize, hasNextPage: false } };
  const loading = list.state === 'loading';
  const error = list.error ? pt('messages.loadError') : null;

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/generic-items/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {error ? <StudioErrorState onRetry={() => void list.refetch()}>{error}</StudioErrorState> : null}
      {list.state === 'ready' && result.data.length === 0 ? (
        <StudioEmptyState>{pt('empty.title')}</StudioEmptyState>
      ) : null}
      {list.state === 'ready' && result.data.length > 0 ? (
        <div className="space-y-4">
          <GenericItemsDataTable data={result.data} pt={pt} />
          <GenericItemsPagination pagination={result.pagination} pt={pt} />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const GenericItemsCreatePage = ({
  principalControl,
}: Readonly<{
  principalControl?: import('@sva/studio-ui-react').MainserverPrincipalControlModel;
}> = {}) => <GenericItemsDetailPage mode="create" principalControl={principalControl} />;

export const GenericItemsEditPage = ({
  principalControl,
}: Readonly<{
  principalControl?: import('@sva/studio-ui-react').MainserverPrincipalControlModel;
}> = {}) => {
  const params = useParams({ strict: false }) as {
    readonly contentId?: string;
    readonly id?: string;
  };
  return (
    <GenericItemsDetailPage
      mode="edit"
      contentId={params.contentId ?? params.id}
      principalControl={principalControl}
    />
  );
};
