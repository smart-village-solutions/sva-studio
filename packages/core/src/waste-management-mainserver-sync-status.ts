import type { StudioJobProgress, StudioJobStatus } from './plugin-operations-contract.js';

export type WasteMainserverSourceState = 'clean' | 'pending' | 'unknown';

export type WasteMainserverSourceRevisionRecord = Readonly<{
  sourceRevision: string;
  changedAt?: string;
}>;

export type WasteMainserverSyncJobSummary = Readonly<{
  id: string;
  status: StudioJobStatus;
  startedAt?: string;
  finishedAt?: string;
  progress?: StudioJobProgress;
}>;

export type WasteMainserverSuccessfulSyncSummary = WasteMainserverSyncJobSummary &
  Readonly<{
    status: 'succeeded';
    sourceRevision: string;
    yearWindow: readonly [number, number];
  }>;

export type WasteMainserverSyncStatusRecord = Readonly<{
  sourceState: WasteMainserverSourceState;
  expectedYearWindow: readonly [number, number];
  sourceChangedAt?: string;
  lastSuccessfulSync?: WasteMainserverSuccessfulSyncSummary;
  latestAttempt?: WasteMainserverSyncJobSummary;
  activeJob?: WasteMainserverSyncJobSummary;
}>;

export type WasteMainserverSyncStatusResponse = Readonly<{
  data: WasteMainserverSyncStatusRecord;
}>;

const isRevision = (value: string): boolean => /^[0-9]+$/u.test(value);

const parseRevision = (value: string | undefined): bigint | null =>
  value && isRevision(value) ? BigInt(value) : null;

const matchesYearWindow = (
  actual: readonly [number, number],
  expected: readonly [number, number]
): boolean => actual[0] === expected[0] && actual[1] === expected[1];

const deriveSourceState = (
  input: Readonly<{
    jobsAvailable: boolean;
    sourceRevision?: WasteMainserverSourceRevisionRecord | null;
    lastSuccessfulSync?: WasteMainserverSuccessfulSyncSummary;
    expectedYearWindow: readonly [number, number];
  }>
): WasteMainserverSourceState => {
  if (!input.jobsAvailable || !input.sourceRevision) return 'unknown';

  const sourceRevision = parseRevision(input.sourceRevision.sourceRevision);
  if (sourceRevision === null) return 'unknown';
  if (!input.lastSuccessfulSync) return 'pending';

  const successfulRevision = parseRevision(input.lastSuccessfulSync.sourceRevision);
  if (successfulRevision === null || sourceRevision < successfulRevision) return 'unknown';
  if (sourceRevision > successfulRevision) return 'pending';
  return matchesYearWindow(input.lastSuccessfulSync.yearWindow, input.expectedYearWindow)
    ? 'clean'
    : 'pending';
};

export const deriveWasteMainserverSyncStatus = (
  input: Readonly<{
    currentYear: number;
    jobsAvailable: boolean;
    sourceRevision?: WasteMainserverSourceRevisionRecord | null;
    lastSuccessfulSync?: WasteMainserverSuccessfulSyncSummary;
    latestAttempt?: WasteMainserverSyncJobSummary;
    activeJob?: WasteMainserverSyncJobSummary;
  }>
): WasteMainserverSyncStatusRecord => {
  const expectedYearWindow = [input.currentYear, input.currentYear + 1] as const;
  const sourceState = deriveSourceState({ ...input, expectedYearWindow });

  return {
    sourceState,
    expectedYearWindow,
    ...(input.sourceRevision?.changedAt ? { sourceChangedAt: input.sourceRevision.changedAt } : {}),
    ...(input.lastSuccessfulSync ? { lastSuccessfulSync: input.lastSuccessfulSync } : {}),
    ...(input.latestAttempt ? { latestAttempt: input.latestAttempt } : {}),
    ...(input.activeJob ? { activeJob: input.activeJob } : {}),
  };
};
