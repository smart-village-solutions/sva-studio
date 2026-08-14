import type { StudioJobResponse } from '@sva/plugin-sdk';
import { usePluginTranslation, wasteManagementOperationsContract } from '@sva/plugin-sdk';
import { Link } from '@tanstack/react-router';

const activeStatuses = new Set(['queued', 'running', 'retrying']);

const readNumber = (record: Readonly<Record<string, unknown>> | undefined, key: string) => {
  const value = record?.[key];
  return typeof value === 'number' ? value : 0;
};

const readBoolean = (record: Readonly<Record<string, unknown>> | undefined, key: string) =>
  record?.[key] === true;

const isPostalCodeJob = (job: StudioJobResponse['data'] | null) =>
  job?.jobTypeId === wasteManagementOperationsContract.jobTypeIds.enrichPostalCodes;

const isGeocodingDisabledError = (job: StudioJobResponse['data']) => {
  const pluginDetails = job.errorPayload?.details?.plugin;
  const code =
    pluginDetails && typeof pluginDetails === 'object' && 'code' in pluginDetails
      ? pluginDetails.code
      : undefined;
  return code === 'disabled';
};

const isTimeoutError = (job: StudioJobResponse['data']) => {
  if (job.errorPayload?.message === 'timeout') return true;
  const pluginDetails = job.errorPayload?.details?.plugin;
  return (
    pluginDetails !== null &&
    typeof pluginDetails === 'object' &&
    'code' in pluginDetails &&
    pluginDetails.code === 'timeout'
  );
};

const PostalCodeActiveStatus = ({ processed, total }: { processed: number; total: number }) => {
  const pt = usePluginTranslation('wasteManagement');
  const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <section role="status" className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{pt('tools.postalCodes.progressTitle')}</h3>
          <p className="text-sm text-muted-foreground">
            {pt('tools.postalCodes.progressSummary', { processed, total })}
          </p>
        </div>
        <span className="text-sm font-semibold">
          {pt('tools.progress.percentage', { value: percentage })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={pt('tools.postalCodes.progressTitle')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
      </div>
    </section>
  );
};

const PostalCodeFailedStatus = ({
  job,
  processed,
  total,
}: {
  job: StudioJobResponse['data'];
  processed: number;
  total: number;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const geocodingDisabled = isGeocodingDisabledError(job);
  const timedOut = isTimeoutError(job);
  return (
    <section role="alert" className="space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <h3 className="text-sm font-semibold">{pt('tools.postalCodes.errorTitle')}</h3>
      <p className="text-sm text-muted-foreground">
        {geocodingDisabled ? (
          <>
            {pt('tools.postalCodes.errors.geocodingDisabled')}{' '}
            <Link to="/interfaces" className="font-medium text-primary underline">
              {pt('tools.postalCodes.errors.openInterfaces')}
            </Link>
          </>
        ) : timedOut ? (
          pt('tools.postalCodes.errors.timeout', { processed, total })
        ) : (
          pt('tools.postalCodes.errors.generic')
        )}
      </p>
    </section>
  );
};

const PostalCodeResultStatus = ({ result }: { result: Readonly<Record<string, unknown>> }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <section role="status" className="space-y-1 rounded-xl border border-border/70 bg-muted/10 p-4">
      <h3 className="text-sm font-semibold">{pt('tools.postalCodes.resultTitle')}</h3>
      <p className="text-sm text-muted-foreground">
        {pt('tools.postalCodes.resultSummary', {
          updated: readNumber(result, 'updatedCount'),
          ambiguous: readNumber(result, 'ambiguousCount'),
          notFound: readNumber(result, 'notFoundCount'),
          failed: readNumber(result, 'failedCount'),
          skipped: readNumber(result, 'skippedExistingCount'),
        })}
      </p>
      {readBoolean(result, 'budgetExhausted') ? (
        <p className="text-sm font-medium text-amber-700" role="alert">
          {pt('tools.postalCodes.budgetSummary', {
            requests: readNumber(result, 'providerRequestCount'),
            budget: readNumber(result, 'requestBudget'),
            unprocessed: readNumber(result, 'unprocessedCount'),
          })}
        </p>
      ) : null}
    </section>
  );
};

export const WasteToolsPostalCodeStatus = ({
  job,
}: {
  readonly job: StudioJobResponse['data'] | null;
}) => {
  if (!job || !isPostalCodeJob(job)) return null;

  const progressDetails = job.progress?.details;
  const processed = readNumber(progressDetails, 'processedCities');
  const total = readNumber(progressDetails, 'totalCities');
  const result = job.resultPayload?.plugin;

  if (activeStatuses.has(job.status)) {
    return <PostalCodeActiveStatus processed={processed} total={total} />;
  }

  if (job.status === 'failed') {
    return <PostalCodeFailedStatus job={job} processed={processed} total={total} />;
  }

  return result ? <PostalCodeResultStatus result={result} /> : null;
};
