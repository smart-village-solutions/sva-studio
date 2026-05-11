import type { StudioJobResponse, WasteManagementHistoryOverview } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, StudioEmptyState, StudioJobSummaryCard } from '@sva/studio-ui-react';

import { formatUpdatedAt, toJobStatusTone } from './waste-management.page.support.js';

export const WasteToolsHistory = ({
  lastJob,
  technicalHistory,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly technicalHistory: readonly WasteManagementHistoryOverview['technical']['items'][number][];
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <StudioJobSummaryCard
        title={pt('tools.meta.lastJobTitle')}
        description={lastJob ? pt('tools.meta.lastJobDescription') : pt('tools.meta.noJobYet')}
        statusLabel={lastJob?.status ?? pt('tools.meta.noJobStatus')}
        statusTone={toJobStatusTone(lastJob?.status)}
        metadata={
          lastJob
            ? [
                { id: 'jobId', label: pt('tools.meta.jobIdLabel'), value: lastJob.id },
                { id: 'jobTypeId', label: pt('tools.meta.jobTypeLabel'), value: lastJob.jobTypeId },
                { id: 'jobStatus', label: pt('tools.meta.jobStatusLabel'), value: lastJob.status },
              ]
            : undefined
        }
        emptyState={pt('tools.meta.noJobYet')}
      />
      <div className="space-y-3 rounded-lg border border-border/70 bg-[rgba(255,255,255,0.32)] p-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">{pt('tools.meta.technicalHistoryTitle')}</h3>
          <p className="text-sm text-muted-foreground">{pt('tools.meta.technicalHistoryDescription')}</p>
        </div>
        {technicalHistory.length ? (
          <div className="space-y-2">
            {technicalHistory.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-md border border-border/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{item.eventType}</Badge>
                  <Badge variant={item.outcome === 'success' ? 'default' : item.outcome === 'failure' ? 'destructive' : 'secondary'}>
                    {pt(`overview.outcome.${item.outcome}`)}
                  </Badge>
                  <Badge variant="outline">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {item.jobId ? <p>{pt('overview.meta.jobId', { value: item.jobId })}</p> : null}
                  {item.jobTypeId ? <p>{pt('overview.meta.jobTypeId', { value: item.jobTypeId })}</p> : null}
                  {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
                  {item.errorCode ? <p>{pt('overview.meta.reasonCode', { value: item.errorCode })}</p> : null}
                  {item.message ? <p>{item.message}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StudioEmptyState>{pt('tools.meta.noTechnicalHistory')}</StudioEmptyState>
        )}
      </div>
    </>
  );
};
