import type { WasteManagementAuditQuery } from '@sva/core';

export type WasteAuditFilters = WasteManagementAuditQuery;

export type WasteAuditRow = {
  id: string;
  event_type: string;
  created_at: string;
  account_id: string | null;
  request_id: string | null;
  trace_id: string | null;
  payload: Record<string, unknown> | null;
};
