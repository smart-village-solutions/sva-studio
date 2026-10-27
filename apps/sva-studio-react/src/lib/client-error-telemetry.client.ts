import { readMainserverErrorRequestId } from '@sva/plugin-sdk';

const CLIENT_WINDOW_MS = 5 * 60_000;
const CLIENT_EVENT_LIMIT = 10;
type PendingClientError = {
  readonly clientEventId: string;
  readonly errorCode: 'client_unhandled_error' | 'client_unhandled_rejection';
  readonly identityKey: string;
  readonly expiresAt: number;
  expiryTimer: ReturnType<typeof setTimeout>;
  attempts: number;
  inFlight: boolean;
};

let currentIdentityKey: string | null = null;
const pendingReports: PendingClientError[] = [];

const dropPendingReport = (report: PendingClientError): void => {
  const index = pendingReports.indexOf(report);
  if (index >= 0) pendingReports.splice(index, 1);
  clearTimeout(report.expiryTimer);
};

const flushPendingReports = async (fetcher: typeof fetch, now: () => number): Promise<void> => {
  for (const report of [...pendingReports]) {
    if (report.expiresAt <= now() || report.identityKey !== currentIdentityKey) {
      dropPendingReport(report);
      continue;
    }
    if (report.inFlight || report.attempts >= 2) continue;
    report.attempts += 1;
    report.inFlight = true;
    try {
      const response = await fetcher('/api/v1/monitoring/client-errors', {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({ clientEventId: report.clientEventId, errorCode: report.errorCode }),
      });
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        dropPendingReport(report);
      }
    } catch {
      if (report.attempts >= 2) dropPendingReport(report);
    } finally {
      report.inFlight = false;
    }
  }
};

export const installClientErrorTelemetry = (
  target: Window = window,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  now: () => number = Date.now
): (() => void) => {
  const reportedAt: number[] = [];
  const report = (errorCode: 'client_unhandled_error' | 'client_unhandled_rejection') => {
    const currentTime = now();
    while (reportedAt[0] !== undefined && currentTime - reportedAt[0] >= CLIENT_WINDOW_MS) {
      reportedAt.shift();
    }
    if (reportedAt.length >= CLIENT_EVENT_LIMIT || !currentIdentityKey) return;
    reportedAt.push(currentTime);
    const pendingReport: PendingClientError = {
      clientEventId: crypto.randomUUID(),
      errorCode,
      identityKey: currentIdentityKey,
      expiresAt: currentTime + CLIENT_WINDOW_MS,
      attempts: 0,
      inFlight: false,
      expiryTimer: setTimeout(() => dropPendingReport(pendingReport), CLIENT_WINDOW_MS),
    };
    pendingReports.push(pendingReport);
    if (pendingReports.length > CLIENT_EVENT_LIMIT) {
      const oldest = pendingReports[0];
      if (oldest) dropPendingReport(oldest);
    }
    void flushPendingReports(fetcher, now);
  };
  const onError = (event: ErrorEvent) => {
    if (readMainserverErrorRequestId(event.error)) return;
    report('client_unhandled_error');
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (readMainserverErrorRequestId(event.reason)) return;
    report('client_unhandled_rejection');
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onUnhandledRejection);
  const retryWhenAvailable = () => void flushPendingReports(fetcher, now);
  target.addEventListener('online', retryWhenAvailable);
  target.addEventListener('pageshow', retryWhenAvailable);
  target.addEventListener('visibilitychange', retryWhenAvailable);
  const onSessionIdentity = (event: Event) => {
    const token = (event as CustomEvent<unknown>).detail;
    setClientErrorTelemetryIdentity(typeof token === 'string' ? token : null, fetcher);
  };
  target.addEventListener('studio:session-telemetry-identity', onSessionIdentity);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onUnhandledRejection);
    target.removeEventListener('online', retryWhenAvailable);
    target.removeEventListener('pageshow', retryWhenAvailable);
    target.removeEventListener('visibilitychange', retryWhenAvailable);
    target.removeEventListener('studio:session-telemetry-identity', onSessionIdentity);
  };
};

export const setClientErrorTelemetryIdentity = (
  identityKey: string | null,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis)
): void => {
  currentIdentityKey = identityKey;
  for (let index = pendingReports.length - 1; index >= 0; index -= 1) {
    const report = pendingReports[index];
    if (report?.identityKey !== currentIdentityKey && report) dropPendingReport(report);
  }
  if (currentIdentityKey) void flushPendingReports(fetcher, Date.now);
};
