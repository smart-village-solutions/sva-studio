import type {
  StudioImportPhase,
  StudioJobErrorCategory,
  StudioJobEventTone,
  StudioJobEventType,
  StudioJobSource,
  StudioJobStatus,
} from './studio-job-status-contract.js';

export type StudioJobProgress = {
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly currentPhase?: StudioImportPhase | string;
  readonly currentStepKey?: string;
  readonly currentStepLabel?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly lastUpdatedAt?: string;
};

export type StudioJobResultSummary = {
  readonly processedItems?: number;
  readonly acceptedItems?: number;
  readonly rejectedItems?: number;
  readonly skippedItems?: number;
  readonly warningCount?: number;
  readonly durationMs?: number;
};

export type StudioJobResultArtifact = {
  readonly artifactId: string;
  readonly contentType: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly expiresAt: string;
};

export type StudioJobResult = {
  readonly summary?: StudioJobResultSummary;
  readonly plugin?: Readonly<Record<string, unknown>>;
  readonly artifacts?: readonly StudioJobResultArtifact[];
};

export type StudioJobError = {
  readonly code: string;
  readonly category: StudioJobErrorCategory;
  readonly message?: string;
  readonly details?: {
    readonly host?: StudioJobEventHostDetails;
    readonly plugin?: Readonly<Record<string, unknown>>;
  };
};

export type StudioJobEventHostDetails = {
  readonly workerId?: string;
  readonly errorCode?: string;
  readonly errorCategory?: StudioJobErrorCategory;
  readonly cancellationRequestedAt?: string;
  readonly source?: StudioJobSource;
  readonly pluginId?: string;
  readonly jobTypeId?: string;
};

export type StudioJobEventDetails = {
  readonly host?: StudioJobEventHostDetails;
  readonly plugin?: Readonly<Record<string, unknown>>;
};

export type StudioJobEventPresentation = {
  readonly tone: StudioJobEventTone;
  readonly title: string;
  readonly isTerminal: boolean;
};

export type StudioJobEventRecord = {
  readonly id: string;
  readonly jobId: string;
  readonly instanceId: string;
  readonly eventType: StudioJobEventType;
  readonly status: StudioJobStatus;
  readonly progress?: StudioJobProgress;
  readonly attempts: number;
  readonly message?: string;
  readonly details?: StudioJobEventDetails;
  readonly presentation?: StudioJobEventPresentation;
  readonly createdAt: string;
};

export type StudioJobEventCreateInput = Omit<StudioJobEventRecord, 'createdAt'>;
