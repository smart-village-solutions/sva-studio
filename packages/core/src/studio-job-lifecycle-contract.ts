const studioJobStatuses = [
  'queued',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
] as const;
const terminalStudioJobStatuses = ['succeeded', 'failed', 'cancelled'] as const;
const studioJobErrorCategories = [
  'retryable',
  'permanent',
  'validation',
  'external_dependency',
] as const;
const studioJobEventTypes = [
  'job.queued',
  'job.started',
  'job.progressed',
  'job.retrying',
  'job.succeeded',
  'job.failed',
  'job.cancelled',
] as const;

export type StudioJobStatus = (typeof studioJobStatuses)[number];
export type TerminalStudioJobStatus = (typeof terminalStudioJobStatuses)[number];
export type StudioJobErrorCategory = (typeof studioJobErrorCategories)[number];
export type StudioJobEventType = (typeof studioJobEventTypes)[number];
export type StudioJobSource = 'plugin' | 'host';
export type StudioJobStaleState = 'fresh' | 'stale' | 'terminal';
export type StudioJobEventTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export type StudioJobListView = 'active' | 'history';
export type StudioJobFollowUpAction = 'cancel';

export const studioJobContract = {
  statuses: studioJobStatuses,
  terminalStatuses: terminalStudioJobStatuses,
  isStatus: (value: string): value is StudioJobStatus =>
    (studioJobStatuses as readonly string[]).includes(value),
  isTerminalStatus: (value: string): value is TerminalStudioJobStatus =>
    (terminalStudioJobStatuses as readonly string[]).includes(value),
} as const;

export const studioJobErrorContract = {
  categories: studioJobErrorCategories,
  isCategory: (value: string): value is StudioJobErrorCategory =>
    (studioJobErrorCategories as readonly string[]).includes(value),
} as const;

export const studioJobEventContract = {
  types: studioJobEventTypes,
  isType: (value: string): value is StudioJobEventType =>
    (studioJobEventTypes as readonly string[]).includes(value),
} as const;
