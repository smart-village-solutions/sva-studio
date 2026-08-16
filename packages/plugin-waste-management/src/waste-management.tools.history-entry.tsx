import type { WasteManagementHistoryOverview } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';

import { formatUpdatedAt } from './waste-management.page.support.js';

type TechnicalHistoryItem = WasteManagementHistoryOverview['technical']['items'][number];

export const WasteToolsHistoryEntry = ({
  canDelete,
  isOpen,
  item,
  onDelete,
  onToggle,
}: {
  readonly canDelete: boolean;
  readonly isOpen: boolean;
  readonly item: TechnicalHistoryItem;
  readonly onDelete?: (jobId: string) => void;
  readonly onToggle: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const jobId = item.jobId ?? undefined;
  const detailsId = `waste-technical-history-details-${item.id}`;
  const outcomeVariant =
    item.outcome === 'success'
      ? 'default'
      : item.outcome === 'failure'
        ? 'destructive'
        : 'secondary';

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.eventType}</Badge>
            <Badge variant={outcomeVariant}>{pt(`overview.outcome.${item.outcome}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}
          </p>
          {item.message ? <p className="text-sm text-foreground">{item.message}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="tertiary"
            aria-controls={detailsId}
            aria-expanded={isOpen}
            onClick={onToggle}
          >
            {pt(isOpen ? 'tools.meta.historyCloseDetailsAction' : 'tools.meta.historyDetailsAction')}
          </Button>
          {jobId && canDelete ? (
            <Button type="button" variant="tertiary" onClick={() => onDelete?.(jobId)}>
              {pt('tools.meta.historyDeleteAction')}
            </Button>
          ) : null}
        </div>
      </div>
      {isOpen ? (
        <div
          id={detailsId}
          className="mt-3 space-y-1 border-t border-border/60 pt-3 text-sm text-muted-foreground"
        >
          {jobId ? <p>{pt('overview.meta.jobId', { value: jobId })}</p> : null}
          {item.jobTypeId ? <p>{pt('overview.meta.jobTypeId', { value: item.jobTypeId })}</p> : null}
          {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
          {item.errorCode ? <p>{pt('overview.meta.reasonCode', { value: item.errorCode })}</p> : null}
        </div>
      ) : null}
    </div>
  );
};
