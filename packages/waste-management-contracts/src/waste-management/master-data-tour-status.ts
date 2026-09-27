export const wasteTourStatuses = ['draft', 'published', 'archived'] as const;

export type WasteTourStatus = (typeof wasteTourStatuses)[number];

export const wasteTourStatusBulkLimit = 1_000;

export type WasteTourStatusBulkUpdateInput = {
  readonly tourIds: readonly string[];
  readonly status: WasteTourStatus;
};

export type WasteTourStatusBulkUpdateResult = {
  readonly updatedCount: number;
};
