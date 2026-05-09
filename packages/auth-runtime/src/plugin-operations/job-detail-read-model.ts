import type {
  StudioJobDetail,
  StudioJobEventHostDetails,
  StudioJobEventDetails,
  StudioJobEventPresentation,
  StudioJobEventRecord,
  StudioJobRuntimeDiagnostics,
} from '@sva/core';
import { studioJobContract } from '@sva/core';

type NormalizeStudioJobDetailOptions = {
  readonly now?: () => string;
  readonly staleAfterSeconds?: number;
};

const defaultStaleAfterSeconds = 120;

export const resolveLatestStudioJobEvent = (history: readonly StudioJobEventRecord[]): StudioJobEventRecord | undefined =>
  history.length > 0 ? history[history.length - 1] : undefined;

export const resolveStudioJobLastObservedAt = (
  job: Pick<StudioJobDetail, 'heartbeatAt' | 'lastProgressAt' | 'startedAt' | 'updatedAt'>
): string | undefined =>
  job.heartbeatAt ?? job.lastProgressAt ?? job.startedAt ?? job.updatedAt;

export const createStudioJobEventPresentation = (event: StudioJobEventRecord): StudioJobEventPresentation => {
  switch (event.eventType) {
    case 'job.queued':
      return { tone: 'info', title: 'Job eingeplant', isTerminal: false };
    case 'job.started':
      return { tone: 'info', title: 'Job gestartet', isTerminal: false };
    case 'job.progressed':
      return { tone: 'neutral', title: 'Fortschritt aktualisiert', isTerminal: false };
    case 'job.retrying':
      return { tone: 'warning', title: 'Neuer Versuch geplant', isTerminal: false };
    case 'job.succeeded':
      return { tone: 'success', title: 'Job erfolgreich abgeschlossen', isTerminal: true };
    case 'job.failed':
      return { tone: 'error', title: 'Job fehlgeschlagen', isTerminal: true };
    case 'job.cancelled':
      return { tone: 'warning', title: 'Job abgebrochen', isTerminal: true };
  }
};

export const createStudioJobDefaultEventMessage = (event: StudioJobEventRecord): string => {
  switch (event.eventType) {
    case 'job.queued':
      return 'Job wurde zur Ausführung eingeplant.';
    case 'job.started':
      return 'Job-Ausführung wurde gestartet.';
    case 'job.progressed':
      return event.progress?.currentStepLabel
        ? `Fortschritt aktualisiert: ${event.progress.currentStepLabel}.`
        : event.progress?.currentStepKey
          ? `Fortschritt aktualisiert: ${event.progress.currentStepKey}.`
          : 'Fortschritt des Jobs wurde aktualisiert.';
    case 'job.retrying':
      return 'Job wird nach einem Fehler erneut versucht.';
    case 'job.succeeded':
      return 'Job wurde erfolgreich abgeschlossen.';
    case 'job.failed':
      return 'Job ist fehlgeschlagen.';
    case 'job.cancelled':
      return 'Job wurde abgebrochen.';
  }
};

export const normalizeStudioJobEventDetails = (
  job: Pick<StudioJobDetail, 'workerId' | 'errorPayload' | 'cancelRequestedAt'>,
  event: StudioJobEventRecord
): StudioJobEventDetails | undefined => {
  const host: StudioJobEventHostDetails = {
    ...(job.workerId && !event.details?.host?.workerId ? { workerId: job.workerId } : {}),
    ...(event.eventType === 'job.failed' || event.eventType === 'job.retrying'
      ? {
          ...(job.errorPayload?.code && !event.details?.host?.errorCode ? { errorCode: job.errorPayload.code } : {}),
          ...(job.errorPayload?.category && !event.details?.host?.errorCategory
            ? { errorCategory: job.errorPayload.category }
            : {}),
        }
      : {}),
    ...(event.eventType === 'job.cancelled' && job.cancelRequestedAt && !event.details?.host?.cancellationRequestedAt
      ? { cancellationRequestedAt: job.cancelRequestedAt }
      : {}),
    ...(event.details?.host ?? {}),
  };

  return Object.keys(host).length > 0 || event.details?.plugin
    ? {
        ...(Object.keys(host).length > 0 ? { host } : {}),
        ...(event.details?.plugin ? { plugin: event.details.plugin } : {}),
      }
    : undefined;
};

const normalizeHistory = (job: StudioJobDetail): readonly StudioJobEventRecord[] =>
  [...job.history]
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .map((event) => ({
      ...event,
      message: event.message ?? createStudioJobDefaultEventMessage(event),
      details: normalizeStudioJobEventDetails(job, event),
      presentation: event.presentation ?? createStudioJobEventPresentation(event),
    }));

export const createStudioJobRuntimeDiagnostics = (
  job: Pick<StudioJobDetail, 'status' | 'heartbeatAt' | 'lastProgressAt' | 'startedAt' | 'updatedAt' | 'cancelRequestedAt'>,
  options?: NormalizeStudioJobDetailOptions
): StudioJobRuntimeDiagnostics => {
  const now = (options?.now ?? (() => new Date().toISOString()))();
  const staleAfterSeconds = options?.staleAfterSeconds ?? defaultStaleAfterSeconds;
  const lastObservedAt = resolveStudioJobLastObservedAt(job);

  const staleState = studioJobContract.isTerminalStatus(job.status)
    ? 'terminal'
    : lastObservedAt &&
        (job.status === 'running' || job.status === 'retrying') &&
        Date.parse(now) - Date.parse(lastObservedAt) > staleAfterSeconds * 1000
      ? 'stale'
      : 'fresh';

  return {
    cancellationRequested: Boolean(job.cancelRequestedAt),
    staleState,
    staleAfterSeconds,
    evaluatedAt: now,
    ...(lastObservedAt ? { lastObservedAt } : {}),
  };
};

export const normalizeStudioJobDetail = (
  job: StudioJobDetail,
  options?: NormalizeStudioJobDetailOptions
): StudioJobDetail => {
  const history = normalizeHistory(job);
  const normalizedJob = {
    ...job,
    history,
  } satisfies StudioJobDetail;
  const latestEvent = resolveLatestStudioJobEvent(history);

  return {
    ...normalizedJob,
    latestEvent,
    runtime: createStudioJobRuntimeDiagnostics(normalizedJob, options),
  };
};
