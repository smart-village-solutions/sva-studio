import { randomUUID } from 'node:crypto';

import type {
  StudioJobEventCreateInput,
  StudioJobEventDetails,
  StudioJobEventHostDetails,
  StudioJobError,
  StudioJobProgress,
  StudioJobRecord,
} from '@sva/core';

type JobEventWriterDeps = {
  readonly appendJobEvent: (input: StudioJobEventCreateInput) => Promise<unknown>;
  readonly createId?: () => string;
};

type BaseEventInput = {
  readonly jobId: string;
  readonly instanceId: string;
  readonly attempts: number;
  readonly progress?: StudioJobProgress;
  readonly message?: string;
  readonly hostDetails?: StudioJobEventHostDetails;
  readonly pluginDetails?: Readonly<Record<string, unknown>>;
};

const toEventDetails = (input: {
  readonly hostDetails?: StudioJobEventHostDetails;
  readonly pluginDetails?: Readonly<Record<string, unknown>>;
}): StudioJobEventDetails | undefined =>
  input.hostDetails || input.pluginDetails
    ? {
        ...(input.hostDetails ? { host: input.hostDetails } : {}),
        ...(input.pluginDetails ? { plugin: input.pluginDetails } : {}),
      }
    : undefined;

const toErrorHostDetails = (
  errorPayload: StudioJobError,
  hostDetails?: StudioJobEventHostDetails
): StudioJobEventHostDetails => ({
  ...(errorPayload.details?.host ?? {}),
  ...hostDetails,
  errorCode: errorPayload.code,
  errorCategory: errorPayload.category,
});

const createEventFactory = (createId: () => string) => ({
  started: (input: BaseEventInput): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.started',
    status: 'running',
    progress: input.progress,
    attempts: input.attempts,
    details: toEventDetails({
      hostDetails: input.hostDetails,
      pluginDetails: input.pluginDetails,
    }),
  }),
  progressed: (input: BaseEventInput): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.progressed',
    status: 'running',
    progress: input.progress,
    attempts: input.attempts,
    message: input.message,
    details: toEventDetails({
      hostDetails: input.hostDetails,
      pluginDetails: input.pluginDetails,
    }),
  }),
  succeeded: (input: BaseEventInput): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.succeeded',
    status: 'succeeded',
    progress: input.progress,
    attempts: input.attempts,
    details: toEventDetails({
      hostDetails: input.hostDetails,
      pluginDetails: input.pluginDetails,
    }),
  }),
  retrying: (
    input: BaseEventInput & {
      readonly errorPayload: StudioJobError;
    }
  ): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.retrying',
    status: 'retrying',
    progress: input.progress,
    attempts: input.attempts,
    message: input.errorPayload.message,
    details: toEventDetails({
      hostDetails: toErrorHostDetails(input.errorPayload, input.hostDetails),
      pluginDetails: input.errorPayload.details?.plugin,
    }),
  }),
  failed: (
    input: BaseEventInput & {
      readonly errorPayload?: StudioJobError;
    }
  ): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.failed',
    status: 'failed',
    progress: input.progress,
    attempts: input.attempts,
    message: input.errorPayload?.message ?? input.message,
    details: toEventDetails({
      hostDetails: input.errorPayload ? toErrorHostDetails(input.errorPayload, input.hostDetails) : input.hostDetails,
      pluginDetails: input.errorPayload?.details?.plugin ?? input.pluginDetails,
    }),
  }),
  cancelled: (input: BaseEventInput): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.jobId,
    instanceId: input.instanceId,
    eventType: 'job.cancelled',
    status: 'cancelled',
    progress: input.progress,
    attempts: input.attempts,
    message: input.message,
    details: toEventDetails({
      hostDetails: input.hostDetails,
      pluginDetails: input.pluginDetails,
    }),
  }),
  queued: (
    input: Pick<StudioJobRecord, 'id' | 'instanceId'> & {
      readonly attempts: number;
      readonly progress?: StudioJobProgress;
    }
  ): StudioJobEventCreateInput => ({
    id: createId(),
    jobId: input.id,
    instanceId: input.instanceId,
    eventType: 'job.queued',
    status: 'queued',
    progress: input.progress,
    attempts: input.attempts,
  }),
});

export const createJobEventWriter = (deps: JobEventWriterDeps) => {
  const createId = deps.createId ?? randomUUID;
  const eventFactory = createEventFactory(createId);

  const appendEvent = async (input: StudioJobEventCreateInput): Promise<void> => {
    await deps.appendJobEvent(input);
  };

  return {
    appendStartedEvent: async (input: BaseEventInput & { readonly eventType?: 'job.started' }) =>
      appendEvent(eventFactory.started(input)),
    appendProgressedEvent: async (input: BaseEventInput) => appendEvent(eventFactory.progressed(input)),
    appendSucceededEvent: async (input: BaseEventInput & { readonly eventType?: 'job.succeeded' }) =>
      appendEvent(eventFactory.succeeded(input)),
    appendRetriedEvent: async (input: BaseEventInput & { readonly errorPayload: StudioJobError }) =>
      appendEvent(eventFactory.retrying(input)),
    appendFailedEvent: async (input: BaseEventInput & { readonly errorPayload?: StudioJobError }) =>
      appendEvent(eventFactory.failed(input)),
    appendCancelledEvent: async (input: BaseEventInput) => appendEvent(eventFactory.cancelled(input)),
    appendQueuedEvent: async (
      input: Pick<StudioJobRecord, 'id' | 'instanceId'> & {
        readonly attempts: number;
        readonly progress?: StudioJobProgress;
      }
    ) => appendEvent(eventFactory.queued(input)),
  };
};
