import { usePluginTranslation, type StudioJobResponse } from '@sva/plugin-sdk';
import {
  wasteManagementOperationsContract,
  type WasteManagementHistoryOverview,
} from '@sva/waste-management-contracts';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Button, StudioEmptyState, StudioJobSummaryCard } from '@sva/studio-ui-react';
import { toJobStatusTone } from './waste-management.page.support.js';
import { WasteToolsPostalCodeStatus } from './waste-management.tools.postal-code-status.js';
import { WasteToolsHistoryEntry } from './waste-management.tools.history-entry.js';
import { WasteToolsHistoryDeleteDialog } from './waste-management.tools.history-delete-dialog.js';
import { WasteToolsArtifactDownloads } from './waste-management.tools.artifact-downloads.js';
import {
  formatWasteJobPhase,
  isActiveImportJob,
  WasteToolsActiveImportProgress,
} from './waste-management.tools.import-progress.js';

export const WasteToolsHistory = ({
  lastJob,
  technicalHistory,
  canDeleteHistoryEntries = false,
  canOpenJobDetails = false,
  onDeleteEntry,
}: {
  readonly lastJob: StudioJobResponse['data'] | null;
  readonly technicalHistory: readonly WasteManagementHistoryOverview['technical']['items'][number][];
  readonly canDeleteHistoryEntries?: boolean;
  readonly canOpenJobDetails?: boolean;
  readonly onDeleteEntry?: (jobId: string) => boolean | Promise<boolean>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [pendingDeleteJobId, setPendingDeleteJobId] = useState<string | null>(null);
  const latestRecordedJob = technicalHistory.find(
    (item) => item.source === 'job' && item.jobId && item.jobTypeId
  );
  const displayedLastJob =
    lastJob ??
    (latestRecordedJob
      ? ({
          id: latestRecordedJob.jobId,
          jobTypeId: latestRecordedJob.jobTypeId,
          status:
            latestRecordedJob.jobStatus ??
            (latestRecordedJob.outcome === 'success' ? 'succeeded' : 'failed'),
        } as StudioJobResponse['data'])
      : null);

  const statusLabel = displayedLastJob
    ? pt(`tools.progress.jobStatuses.${displayedLastJob.status}`)
    : pt('tools.meta.noJobStatus');
  const phase =
    displayedLastJob?.status === 'succeeded'
      ? undefined
      : formatWasteJobPhase(pt, displayedLastJob?.progress?.currentPhase);
  const jobTypeId = displayedLastJob?.jobTypeId;
  const jobTypeLabel =
    jobTypeId && wasteManagementOperationsContract.isJobTypeId(jobTypeId)
      ? pt(`tools.progress.jobTypes.${jobTypeId.replace('waste-management.', '')}`)
      : pt('tools.meta.unknownJobType');

  return (
    <div className="space-y-4">
      <StudioJobSummaryCard
        title={pt('tools.meta.lastJobTitle')}
        description={
          displayedLastJob ? pt('tools.meta.lastJobDescription') : pt('tools.meta.noJobYet')
        }
        statusLabel={statusLabel}
        statusTone={toJobStatusTone(displayedLastJob?.status)}
        announcement={
          displayedLastJob
            ? pt('tools.meta.statusAnnouncement', {
                status: statusLabel,
                phase: phase ? ` ${phase}` : '',
              })
            : undefined
        }
        metadata={
          displayedLastJob
            ? [{ id: 'jobType', label: pt('tools.meta.jobTypeLabel'), value: jobTypeLabel }]
            : undefined
        }
        actions={
          displayedLastJob && canOpenJobDetails ? (
            <Button asChild variant="secondary">
              <Link to="/monitoring/jobs/$jobId" params={{ jobId: displayedLastJob.id }}>
                {pt('tools.actions.openJobDetails')}
              </Link>
            </Button>
          ) : undefined
        }
      />
      {isActiveImportJob(displayedLastJob) ? (
        <WasteToolsActiveImportProgress job={displayedLastJob} />
      ) : null}
      <WasteToolsPostalCodeStatus job={displayedLastJob} />
      {displayedLastJob ? <WasteToolsArtifactDownloads job={displayedLastJob} /> : null}
      <details className="rounded-lg border border-border-subtle bg-card p-4">
        <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {pt('tools.meta.historyTitle')}
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">{pt('tools.meta.historyDescription')}</p>
          {technicalHistory.length ? (
            <div className="space-y-2">
              {technicalHistory.slice(0, 5).map((item) => {
                const isOpen = openEntryId === item.id;
                return (
                  <WasteToolsHistoryEntry
                    key={item.id}
                    item={item}
                    isOpen={isOpen}
                    canDelete={canDeleteHistoryEntries && Boolean(onDeleteEntry)}
                    onToggle={() => setOpenEntryId(isOpen ? null : item.id)}
                    onDelete={setPendingDeleteJobId}
                  />
                );
              })}
            </div>
          ) : (
            <StudioEmptyState>{pt('tools.meta.noTechnicalHistory')}</StudioEmptyState>
          )}
        </div>
      </details>
      <WasteToolsHistoryDeleteDialog
        jobId={pendingDeleteJobId}
        onCancel={() => setPendingDeleteJobId(null)}
        onDelete={onDeleteEntry ?? (() => false)}
      />
    </div>
  );
};
