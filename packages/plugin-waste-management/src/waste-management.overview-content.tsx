import { StudioEmptyState } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementHistoryOverview } from './waste-management.api.js';
import { formatUpdatedAt } from './waste-management.page.support.js';

type TechnicalItem = WasteManagementHistoryOverview['technical']['items'][number];
type AuditItem = WasteManagementHistoryOverview['audit']['items'][number];

const renderOutcomeBadge = (pt: ReturnType<typeof usePluginTranslation>, outcome: string) => (
  <span className="text-sm">{pt(`overview.outcome.${outcome}`)}</span>
);

const TechnicalHistoryTable = ({ items }: { readonly items: readonly TechnicalItem[] }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-shell">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse" aria-label={pt('overview.technical.table.ariaLabel')}>
          <caption className="sr-only">{pt('overview.technical.table.caption')}</caption>
          <thead className="bg-muted/40 text-left text-sm text-foreground">
            <tr className="border-b border-border/70">
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.eventType')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.outcome')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.occurredAt')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.jobId')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.jobTypeId')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.reasonCode')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.technical.table.requestId')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60 align-top last:border-b-0">
                <td className="px-3 py-3 text-sm">{item.eventType}</td>
                <td className="px-3 py-3">{renderOutcomeBadge(pt, item.outcome)}</td>
                <td className="px-3 py-3 text-sm">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</td>
                <td className="px-3 py-3 text-sm">{item.jobId ? pt('overview.meta.jobId', { value: item.jobId }) : ''}</td>
                <td className="px-3 py-3 text-sm">{item.jobTypeId ? pt('overview.meta.jobTypeId', { value: item.jobTypeId }) : ''}</td>
                <td className="px-3 py-3 text-sm">{item.errorCode ? pt('overview.meta.reasonCode', { value: item.errorCode }) : ''}</td>
                <td className="px-3 py-3 text-sm">{item.requestId ? pt('overview.meta.requestId', { value: item.requestId }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AuditHistoryTable = ({ items }: { readonly items: readonly AuditItem[] }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-shell">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse" aria-label={pt('overview.audit.table.ariaLabel')}>
          <caption className="sr-only">{pt('overview.audit.table.caption')}</caption>
          <thead className="bg-muted/40 text-left text-sm text-foreground">
            <tr className="border-b border-border/70">
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.actionId')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.outcome')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.occurredAt')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.resource')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.reasonCode')}</th>
              <th scope="col" className="px-3 py-3">{pt('overview.audit.table.requestId')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border/60 align-top last:border-b-0">
                <td className="px-3 py-3 text-sm">{item.actionId}</td>
                <td className="px-3 py-3">{renderOutcomeBadge(pt, item.outcome)}</td>
                <td className="px-3 py-3 text-sm">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</td>
                <td className="px-3 py-3 text-sm">
                  <div className="space-y-1">
                    {item.resourceType ? <p>{pt('overview.meta.resourceType', { value: item.resourceType })}</p> : null}
                    {item.resourceId ? <p>{pt('overview.meta.resourceId', { value: item.resourceId })}</p> : null}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm">{item.reasonCode ? pt('overview.meta.reasonCode', { value: item.reasonCode }) : ''}</td>
                <td className="px-3 py-3 text-sm">{item.requestId ? pt('overview.meta.requestId', { value: item.requestId }) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OverviewSection = ({
  title,
  items,
  children,
}: {
  readonly title: string;
  readonly items: readonly TechnicalItem[] | readonly AuditItem[];
  readonly children: React.JSX.Element;
}) =>
  items.length ? (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
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
      <div className="space-y-3">
        <OverviewSection
          title={pt('overview.sections.technical')}
          items={technicalItems}
        >
          <TechnicalHistoryTable items={technicalItems} />
        </OverviewSection>
        <OverviewSection
          title={pt('overview.sections.audit')}
          items={auditItems}
        >
          <AuditHistoryTable items={auditItems} />
        </OverviewSection>
      </div>
    </div>
  );
};
