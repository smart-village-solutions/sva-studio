import React from 'react';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { listGenericItems } from './generic-items.api.js';
import { GenericItemsDetailPage } from './generic-items.detail-page.js';
import { normalizeListSearch } from './list-pagination.js';
import type { GenericItemListResult } from './generic-items.api-types.js';
import { GenericItemsDataTable, GenericItemsPagination } from './generic-items.pages.parts.js';

export function GenericItemsListPage() {
  const pt = usePluginTranslation('genericItems');
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const [result, setResult] = React.useState<GenericItemListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    listGenericItems({ page, pageSize })
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError(pt('messages.loadError'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, pageSize, pt]);

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
      {error ? <StudioErrorState>{error}</StudioErrorState> : null}
      {!loading && !error && result.data.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
      {!loading && !error && result.data.length > 0 ? (
        <div className="space-y-4">
          <GenericItemsDataTable data={result.data} pt={pt} />
          <GenericItemsPagination pagination={result.pagination} pt={pt} />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const GenericItemsCreatePage = () => <GenericItemsDetailPage mode="create" />;

export const GenericItemsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <GenericItemsDetailPage mode="edit" contentId={params.contentId ?? params.id} />;
};
