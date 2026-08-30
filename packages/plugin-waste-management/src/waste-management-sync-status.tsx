import type { WasteMainserverSyncStatusRecord } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

type PluginTranslation = (
  key: string,
  options?: Readonly<Record<string, string | number>>
) => string;

const readProgressCount = (
  status: WasteMainserverSyncStatusRecord,
  key: 'plannedCreateCount' | 'plannedDeleteCount'
): number | null => {
  const value = status.activeJob?.progress?.details?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const formatFinishedAt = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

const formatPlannedCounts = (
  pt: PluginTranslation,
  createCount: number,
  deleteCount: number
): string =>
  [
    pt(
      createCount === 1
        ? 'page.syncStatus.runningCreateCountOne'
        : 'page.syncStatus.runningCreateCountOther',
      { count: createCount }
    ),
    pt(
      deleteCount === 1
        ? 'page.syncStatus.runningDeleteCountOne'
        : 'page.syncStatus.runningDeleteCountOther',
      { count: deleteCount }
    ),
  ].join(' ');

type WasteManagementMainserverSyncStatusProps = Readonly<{
  canOpenJobDetails: boolean;
  canRunMainserverSync: boolean;
  error: boolean;
  loading: boolean;
  onStartSync: () => Promise<void>;
  pt: PluginTranslation;
  starting: boolean;
  status: WasteMainserverSyncStatusRecord | null;
}>;

const SyncStatusLoading = ({ pt }: Pick<WasteManagementMainserverSyncStatusProps, 'pt'>) => (
  <section className="min-h-24 rounded-xl border bg-muted/30 p-4" aria-busy="true">
    <p className="font-medium">{pt('page.syncStatus.loadingTitle')}</p>
    <p className="mt-1 text-sm text-muted-foreground">{pt('page.syncStatus.loadingText')}</p>
  </section>
);

const SyncStatusError = ({ pt }: Pick<WasteManagementMainserverSyncStatusProps, 'pt'>) => (
  <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4" role="alert">
    <p className="font-medium text-destructive">{pt('page.syncStatus.errorTitle')}</p>
    <p className="mt-1 text-sm text-muted-foreground">{pt('page.syncStatus.errorText')}</p>
  </section>
);

const SyncStatusRunning = ({
  canOpenJobDetails,
  pt,
  status,
}: Pick<WasteManagementMainserverSyncStatusProps, 'canOpenJobDetails' | 'pt'> & {
  status: WasteMainserverSyncStatusRecord;
}) => {
  const activeJob = status.activeJob;
  if (!activeJob) return null;
  const createCount = readProgressCount(status, 'plannedCreateCount');
  const deleteCount = readProgressCount(status, 'plannedDeleteCount');

  return (
    <section
      className="rounded-xl border border-primary/30 bg-primary/5 p-4"
      aria-live="polite"
      aria-labelledby="waste-mainserver-sync-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="waste-mainserver-sync-title" className="font-medium">
            {pt('page.syncStatus.runningTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {createCount === null || deleteCount === null
              ? pt('page.syncStatus.runningPreparing')
              : formatPlannedCounts(pt, createCount, deleteCount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pt('page.syncStatus.runningDuration')}
          </p>
        </div>
        {canOpenJobDetails ? (
          <Button asChild variant="secondary">
            <Link to="/monitoring/jobs/$jobId" params={{ jobId: activeJob.id }}>
              {pt('page.syncStatus.openJob')}
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
};

const SyncStatusClean = ({
  pt,
  status,
}: Pick<WasteManagementMainserverSyncStatusProps, 'pt'> & {
  status: WasteMainserverSyncStatusRecord;
}) => {
  const lastFinishedAt = formatFinishedAt(status.lastSuccessfulSync?.finishedAt);
  return (
    <section className="rounded-xl border bg-muted/20 p-4" aria-live="polite">
      <p className="font-medium">{pt('page.syncStatus.cleanTitle')}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {lastFinishedAt
          ? pt('page.syncStatus.cleanWithDate', { date: lastFinishedAt })
          : pt('page.syncStatus.cleanText')}
      </p>
    </section>
  );
};

const SyncStatusActionable = ({
  canRunMainserverSync,
  onStartSync,
  pt,
  starting,
  status,
}: Pick<
  WasteManagementMainserverSyncStatusProps,
  'canRunMainserverSync' | 'onStartSync' | 'pt' | 'starting'
> & { status: WasteMainserverSyncStatusRecord }) => {
  const isUnknown = status.sourceState === 'unknown';
  const latestAttemptFailed = status.latestAttempt?.status === 'failed';
  const lastFinishedAt = formatFinishedAt(status.lastSuccessfulSync?.finishedAt);
  const titleKey = latestAttemptFailed
    ? 'page.syncStatus.failedTitle'
    : isUnknown
      ? 'page.syncStatus.unknownTitle'
      : 'page.syncStatus.pendingTitle';

  return (
    <section
      className={`rounded-xl border p-4 ${
        latestAttemptFailed
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-amber-500/40 bg-amber-500/5'
      }`}
      aria-live="polite"
      aria-labelledby="waste-mainserver-sync-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p id="waste-mainserver-sync-title" className="font-medium">
            {pt(titleKey)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {pt(isUnknown ? 'page.syncStatus.unknownText' : 'page.syncStatus.pendingText')}
          </p>
          {!isUnknown ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {pt('page.syncStatus.finishChangesFirst')}
            </p>
          ) : null}
          {lastFinishedAt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {pt('page.syncStatus.lastSuccess', { date: lastFinishedAt })}
            </p>
          ) : null}
          {!canRunMainserverSync ? (
            <p className="mt-2 text-sm font-medium">{pt('page.syncStatus.permissionRequired')}</p>
          ) : null}
        </div>
        {canRunMainserverSync ? (
          <Button
            type="button"
            variant={isUnknown ? 'secondary' : 'primary'}
            disabled={starting}
            onClick={() => void onStartSync()}
          >
            {pt(starting ? 'page.syncStatus.startingAction' : 'page.syncStatus.startAction')}
          </Button>
        ) : null}
      </div>
    </section>
  );
};

export const WasteManagementMainserverSyncStatus = (
  props: WasteManagementMainserverSyncStatusProps
) => {
  if (props.loading && !props.status) return <SyncStatusLoading pt={props.pt} />;
  if (props.error || !props.status) return <SyncStatusError pt={props.pt} />;
  if (props.status.activeJob) {
    return (
      <SyncStatusRunning
        canOpenJobDetails={props.canOpenJobDetails}
        pt={props.pt}
        status={props.status}
      />
    );
  }
  const latestAttemptFailed = props.status.latestAttempt?.status === 'failed';
  if (props.status.sourceState === 'clean' && !latestAttemptFailed) {
    return <SyncStatusClean pt={props.pt} status={props.status} />;
  }
  return (
    <SyncStatusActionable
      canRunMainserverSync={props.canRunMainserverSync}
      onStartSync={props.onStartSync}
      pt={props.pt}
      starting={props.starting}
      status={props.status}
    />
  );
};
