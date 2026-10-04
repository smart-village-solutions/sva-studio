import type { StudioJobListView, StudioJobStaleState } from './studio-job-lifecycle-contract.js';
export * from './studio-job-lifecycle-contract.js';

export const studioJobRuntimeContract = {
  staleStates: ['fresh', 'stale', 'terminal'] as const,
  isStaleState: (value: string): value is StudioJobStaleState =>
    (['fresh', 'stale', 'terminal'] as readonly string[]).includes(value),
} as const;

export const studioJobListContract = {
  views: ['active', 'history'] as const,
  isView: (value: string): value is StudioJobListView =>
    (['active', 'history'] as readonly string[]).includes(value),
} as const;

const studioImportPhases = [
  'ingestion',
  'schema-validation',
  'mapping',
  'preview',
  'commit',
  'completed',
] as const;

export type StudioImportPhase = (typeof studioImportPhases)[number];

export const studioImportContract = {
  phases: studioImportPhases,
  isPhase: (value: string): value is StudioImportPhase =>
    (studioImportPhases as readonly string[]).includes(value),
} as const;
