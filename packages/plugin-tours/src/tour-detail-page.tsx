import {
  normalizeListSearch,
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  isMainserverPrincipalReady,
  StudioDetailPageTemplate,
  StudioErrorState,
  StudioLoadingState,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { useState, useSyncExternalStore } from 'react';

import { toursPath } from './descriptor.js';
import { TourDetailContent, type TourDetailFields } from './tour-detail-content.js';
import { TourEditPage } from './tour-edit-page.js';
import { apiPath, summaryFields, useTourRead, type TourSummary } from './tours.pages.js';

type TourDetail = TourSummary & TourDetailFields;

export function TourDetailPage({
  canUpdate,
  principalControl,
}: {
  canUpdate?: boolean;
  principalControl?: MainserverPrincipalControlModel;
}) {
  const pt = usePluginTranslation('tours');
  const id = useParams({ strict: false, select: (params) => (params as { id: string }).id });
  const search = normalizeListSearch(useSearch({ strict: false }));
  const result = useTourRead<{ data: TourDetail }>(`${apiPath}/${encodeURIComponent(id)}`);
  const tour = result.data?.data;
  const [editing, setEditing] = useState<{
    id: string;
    scope: string;
    control: MainserverPrincipalControlModel;
  }>();
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const scope = JSON.stringify([access.subjectId, access.instanceId, access.organizationId]);
  const editControl =
    canUpdate && access.permissionActions.includes('tours.update') ? principalControl : undefined;
  if (editing?.id === id)
    return (
      <TourEditPage
        key={id}
        id={id}
        principalControl={editing.control}
        canSave={scope === editing.scope && editControl?.value === editing.control.value}
      />
    );

  return (
    <StudioDetailPageTemplate
      title={tour?.name || pt('title')}
      primaryAction={
        tour && editControl && isMainserverPrincipalReady(editControl, editControl.value) ? (
          <Button type="button" onClick={() => setEditing({ id, scope, control: editControl })}>
            {pt('edit')}
          </Button>
        ) : undefined
      }
      actions={
        <Button asChild variant="secondary">
          <Link to={toursPath} search={search}>
            {pt('back')}
          </Link>
        </Button>
      }
    >
      {result.loading ? <StudioLoadingState>{pt('loading')}</StudioLoadingState> : null}
      {result.error ? (
        <StudioErrorState onRetry={tour ? () => void result.refetch() : undefined}>
          {pt(result.error)}
        </StudioErrorState>
      ) : null}
      {tour ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaryFields(pt).map(({ id, header, cell }) => (
              <div key={id}>
                <dt className="font-medium">{header}</dt>
                <dd>{cell(tour)}</dd>
              </div>
            ))}
          </dl>
          <TourDetailContent tour={tour} pt={pt} />
        </>
      ) : null}
    </StudioDetailPageTemplate>
  );
}
