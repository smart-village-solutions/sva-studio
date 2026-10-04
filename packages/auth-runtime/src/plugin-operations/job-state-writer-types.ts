import type {
  StudioJobError,
  StudioJobEventHostDetails,
  StudioJobRecord,
  StudioJobUpdateInput,
  StudioJobEventCreateInput,
} from '@sva/core';

export type JobStateWriterDeps = {
  readonly updateJobState: (input: StudioJobUpdateInput) => Promise<unknown>;
  readonly appendStartedEvent: (input: {
    readonly eventType?: 'job.started';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendSucceededEvent: (input: {
    readonly eventType?: 'job.succeeded';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendRetriedEvent: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly errorPayload: StudioJobError;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendFailedEvent: (input: {
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly errorPayload?: StudioJobError;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly appendCancelledEvent?: (input: {
    readonly eventType?: 'job.cancelled';
    readonly jobId: string;
    readonly instanceId: string;
    readonly progress?: StudioJobRecord['progress'];
    readonly attempts: number;
    readonly message?: string;
    readonly hostDetails?: StudioJobEventHostDetails;
  }) => Promise<unknown>;
  readonly now?: () => string;
  readonly persistTerminalState?: (input: {
    readonly state: StudioJobUpdateInput;
    readonly event: Omit<StudioJobEventCreateInput, 'id' | 'jobId' | 'instanceId'>;
  }) => Promise<unknown>;
};

export type BaseStateInput = {
  readonly job: StudioJobRecord;
  readonly attempts: number;
  readonly startedAt: string;
  readonly workerId: string;
  readonly progress?: StudioJobRecord['progress'];
};
