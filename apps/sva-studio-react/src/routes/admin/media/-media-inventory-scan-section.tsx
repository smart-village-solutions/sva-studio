import React from 'react';
import { studioJobContract } from '@sva/core';
import { Button, Input } from '@sva/studio-ui-react';
import { mediaScanLimits, type MediaInventoryScanReport } from '@sva/media';
import { Label } from '../../../components/ui/label';
import { t } from '../../../i18n';
import {
  getMediaInventoryScan,
  startMediaInventoryScan,
  type MediaInventoryScanJob,
} from '../../../lib/iam-api';

const InventoryReport = ({ report }: { report: MediaInventoryScanReport }) => (
  <div className="space-y-2">
    <p>{t('media.inventory.completedAt', { value: report.completedAt })}</p>
    {report.entries.length === 0 ? (
      <p>{t('media.inventory.empty')}</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{t('media.inventory.report')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('media.inventory.file')}</th>
              <th scope="col">{t('media.inventory.result')}</th>
              <th scope="col">{t('media.inventory.reason')}</th>
              <th scope="col">{t('media.inventory.checkedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {report.entries.map((entry) => (
              <tr key={entry.storageKey}>
                <th scope="row" className="break-all font-normal">
                  {entry.storageKey}
                </th>
                <td>{t(`media.inventory.${entry.verdict}`)}</td>
                <td>{entry.reason ? t(`media.inventory.reasons.${entry.reason}`) : null}</td>
                <td>{entry.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export const MediaInventoryScanSection = () => {
  const [limit, setLimit] = React.useState<number>(mediaScanLimits.maxInventoryFiles);
  const [job, setJob] = React.useState<MediaInventoryScanJob | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [error, setError] = React.useState(false);
  const id = React.useId();
  const pending = Boolean(job && !studioJobContract.isTerminalStatus(job.status));

  const jobId = job?.id;
  React.useEffect(() => {
    if (!pending || !jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const response = await getMediaInventoryScan(jobId, controller.signal);
        if (controller.signal.aborted) return;
        setJob(response.data);
        if (!studioJobContract.isTerminalStatus(response.data.status))
          timer = setTimeout(() => void refresh(), 1500);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setJob(null);
        }
      }
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, pending]);

  const start = async (cursor?: string) => {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > mediaScanLimits.maxInventoryFiles ||
      starting ||
      pending
    )
      return;
    setStarting(true);
    setError(false);
    try {
      setJob((await startMediaInventoryScan({ limit, ...(cursor ? { cursor } : {}) })).data);
    } catch {
      setError(true);
    } finally {
      setStarting(false);
    }
  };
  const report = job?.report;
  const nextCursor = report?.nextCursor;
  const failed = error || job?.status === 'failed' || job?.status === 'cancelled';

  return (
    <section className="space-y-3 rounded-lg border p-4" aria-labelledby={id}>
      <h2 id={id} className="font-semibold">
        {t('media.inventory.title')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('media.inventory.hint')}</p>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void start();
        }}
      >
        <div className="space-y-1">
          <Label htmlFor={`${id}-limit`}>{t('media.inventory.limit')}</Label>
          <Input
            id={`${id}-limit`}
            type="number"
            min={1}
            max={mediaScanLimits.maxInventoryFiles}
            step={1}
            required
            value={limit}
            onChange={(event) => setLimit(event.currentTarget.valueAsNumber)}
            disabled={starting || pending}
          />
        </div>
        <Button type="submit" disabled={starting || pending}>
          {t('media.inventory.start')}
        </Button>
      </form>
      <div role="status" aria-live="polite">
        {starting || pending ? <p>{t('media.inventory.pending')}</p> : null}
        {failed ? <p className="text-destructive">{t('media.inventory.error')}</p> : null}
      </div>
      {report ? <InventoryReport report={report} /> : null}
      {nextCursor ? (
        <Button type="button" disabled={starting || pending} onClick={() => void start(nextCursor)}>
          {t('media.inventory.next')}
        </Button>
      ) : null}
    </section>
  );
};
