import { Badge, StudioEmptyState } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementHistoryOverview } from './waste-management.api.js';
import { formatUpdatedAt } from './waste-management.page.support.js';

type TechnicalItem = WasteManagementHistoryOverview['technical']['items'][number];
type AuditItem = WasteManagementHistoryOverview['audit']['items'][number];

const TechnicalHistoryCard = ({ item }: { readonly item: TechnicalItem }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.eventType}</Badge>
        <Badge variant={item.outcome === 'success' ? 'default' : item.outcome === 'failure' ? 'destructive' : 'secondary'}>
          {pt(`overview.outcome.${item.outcome}`)}
        </Badge>
        <Badge variant="outline">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</Badge>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {item.jobId ? <p>{pt('overview.meta.jobId', { value: item.jobId })}</p> : null}
        {item.jobTypeId ? <p>{pt('overview.meta.jobTypeId', { value: item.jobTypeId })}</p> : null}
        {item.errorCode ? <p>{pt('overview.meta.reasonCode', { value: item.errorCode })}</p> : null}
        {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
      </div>
    </div>
  );
};

const AuditHistoryCard = ({ item }: { readonly item: AuditItem }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="space-y-2 rounded-lg border border-border/70 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{item.actionId}</Badge>
        <Badge variant={item.outcome === 'success' ? 'default' : item.outcome === 'failure' ? 'destructive' : 'secondary'}>
          {pt(`overview.outcome.${item.outcome}`)}
        </Badge>
        <Badge variant="outline">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</Badge>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {item.resourceType ? <p>{pt('overview.meta.resourceType', { value: item.resourceType })}</p> : null}
        {item.resourceId ? <p>{pt('overview.meta.resourceId', { value: item.resourceId })}</p> : null}
        {item.reasonCode ? <p>{pt('overview.meta.reasonCode', { value: item.reasonCode })}</p> : null}
        {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
      </div>
    </div>
  );
};

const OverviewSection = ({
  title,
  items,
  renderItem,
}: {
  readonly title: string;
  readonly items: readonly TechnicalItem[] | readonly AuditItem[];
  readonly renderItem: (item: TechnicalItem | AuditItem) => React.JSX.Element;
}) =>
  items.length ? (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {items.map((item) => renderItem(item))}
    </div>
  ) : null;

export const WasteOverviewContent = ({ overview }: { readonly overview: WasteManagementHistoryOverview | null }) => {
  const pt = usePluginTranslation('wasteManagement');
  const auditItems = overview?.audit.items ?? [];
  const technicalItems = overview?.technical.items ?? [];

  if (!auditItems.length && !technicalItems.length) {
    return (
      <StudioEmptyState>
        <div className="space-y-2 text-left">
          <p className="font-medium">{pt('overview.messages.emptyTitle')}</p>
          <p>{pt('overview.messages.emptyBody')}</p>
        </div>
      </StudioEmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('overview.meta.total', { value: (overview?.audit.total ?? 0) + (overview?.technical.total ?? 0) })}</Badge>
        <Badge variant="outline">{pt('overview.meta.visible', { value: auditItems.length + technicalItems.length })}</Badge>
      </div>
      <div className="space-y-3">
        <OverviewSection
          title={pt('overview.sections.technical')}
          items={technicalItems}
          renderItem={(item) => <TechnicalHistoryCard key={(item as TechnicalItem).id} item={item as TechnicalItem} />}
        />
        <OverviewSection
          title={pt('overview.sections.audit')}
          items={auditItems}
          renderItem={(item) => <AuditHistoryCard key={(item as AuditItem).id} item={item as AuditItem} />}
        />
      </div>
    </div>
  );
};
