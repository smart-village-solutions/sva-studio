import type { MediaReferenceRecord } from './model-types.js';

export type MediaStorageUsageRecord = {
  readonly instanceId: string;
  readonly totalBytes: number;
  readonly assetCount: number;
  readonly updatedAt?: string;
};

export type MediaStorageUsageDelta = {
  readonly instanceId: string;
  readonly totalBytesDelta: number;
  readonly assetCountDelta: number;
};

export type MediaStorageUsageClaim = Readonly<{
  instanceId: string;
  totalBytes: number;
  assetCount: number;
}>;

export type MediaStorageQuotaRecord = {
  readonly instanceId: string;
  readonly maxBytes: number;
  readonly updatedAt?: string;
};

export type MediaStorageQuotaCheck = {
  readonly instanceId: string;
  readonly currentBytes: number;
  readonly additionalBytes: number;
  readonly maxBytes: number | null;
  readonly wouldExceed: boolean;
};

export type MediaUsageImpact = {
  readonly assetId: string;
  readonly totalReferences: number;
  readonly references: readonly MediaReferenceRecord[];
};

export type MediaAssetListFilter = {
  readonly instanceId: string;
  readonly search?: string;
  readonly visibility?: string;
  readonly afterStorageKey?: string;
  readonly order?: 'updatedAtDesc' | 'storageKeyAsc';
  readonly limit?: number;
  readonly offset?: number;
};
