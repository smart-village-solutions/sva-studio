import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  Button,
  StudioDestructiveActionDialog,
  StudioJobSummaryCard,
  StudioPersistentActionResult,
} from '@sva/studio-ui-react';

import { t } from '../../i18n';

type MonitoringJobDetailHeaderProps = Readonly<{
  jobId: string;
  statusLabel: string;
  statusTone: 'error' | 'success' | 'warning';
  announcement: string;
  runtimeLabel?: string;
  canCancel: boolean;
  cancelRequested: boolean;
  isCancelling: boolean;
  cancelErrorMessage?: string;
  onCancel: () => Promise<boolean>;
}>;

const MonitoringJobSummary = ({
  jobId,
  statusLabel,
  statusTone,
  announcement,
  runtimeLabel,
  canCancel,
  onRequestCancel,
}: Pick<
  MonitoringJobDetailHeaderProps,
  'jobId' | 'statusLabel' | 'statusTone' | 'announcement' | 'runtimeLabel' | 'canCancel'
> &
  Readonly<{ onRequestCancel: () => void }>) => (
  <StudioJobSummaryCard
    title={t('monitoring.jobs.detail.title')}
    description={t('monitoring.jobs.detail.subtitle')}
    statusLabel={statusLabel}
    statusTone={statusTone}
    announcement={announcement}
    metadata={[
      { id: 'jobId', label: t('monitoring.jobs.labels.jobId'), value: jobId },
      ...(runtimeLabel
        ? [{ id: 'runtime', label: t('monitoring.jobs.labels.runtime'), value: runtimeLabel }]
        : []),
    ]}
    actions={
      <>
        <Button asChild variant="secondary">
          <Link to="/monitoring/jobs">{t('monitoring.jobs.detail.back')}</Link>
        </Button>
        {canCancel ? (
          <Button type="button" variant="destructive" onClick={onRequestCancel}>
            {t('monitoring.jobs.actions.cancel')}
          </Button>
        ) : null}
      </>
    }
  />
);

export const MonitoringJobDetailHeader = ({
  jobId,
  statusLabel,
  statusTone,
  announcement,
  runtimeLabel,
  canCancel,
  cancelRequested,
  isCancelling,
  cancelErrorMessage,
  onCancel,
}: MonitoringJobDetailHeaderProps) => {
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);

  const requestCancellation = async () => {
    if (await onCancel()) setCancelDialogOpen(false);
  };

  return (
    <>
      <MonitoringJobSummary
        jobId={jobId}
        statusLabel={statusLabel}
        statusTone={statusTone}
        announcement={announcement}
        runtimeLabel={runtimeLabel}
        canCancel={canCancel}
        onRequestCancel={() => setCancelDialogOpen(true)}
      />
      <StudioDestructiveActionDialog
        open={cancelDialogOpen}
        title={t('monitoring.jobs.cancel.title')}
        description={t('monitoring.jobs.cancel.description', { jobId })}
        confirmLabel={t('monitoring.jobs.actions.cancel')}
        pendingLabel={t('monitoring.jobs.actions.cancelling')}
        cancelLabel={t('monitoring.jobs.actions.keepRunning')}
        pending={isCancelling}
        errorMessage={cancelErrorMessage}
        onCancel={() => setCancelDialogOpen(false)}
        onConfirm={() => void requestCancellation()}
      />
      {cancelRequested ? (
        <StudioPersistentActionResult
          kind="success"
          title={t('monitoring.jobs.cancel.requestedTitle')}
          description={t('monitoring.jobs.cancel.requestedDescription')}
        />
      ) : null}
    </>
  );
};
