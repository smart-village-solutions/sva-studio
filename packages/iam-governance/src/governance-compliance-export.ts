import { readString } from './input-readers.js';
import type { QueryClient } from './query-client.js';

export type GovernanceComplianceExportFormat = 'csv' | 'json' | 'siem';

export type GovernanceComplianceExportRow = {
  event_id: string | undefined;
  timestamp: string | undefined;
  instance_id: string | undefined;
  action: string | undefined;
  result: string | undefined;
  actor_pseudonym: string | undefined;
  target_ref: string | undefined;
  reason_code: string | undefined;
  request_id: string | undefined;
  trace_id: string | undefined;
  event_type: string;
};

export type GovernanceComplianceSiemRow = {
  '@timestamp': string | undefined;
  event_id: string | undefined;
  instance_id: string | undefined;
  action: string | undefined;
  result: string | undefined;
  actor_pseudonym: string | undefined;
  target_ref: string | undefined;
  reason_code: string | undefined;
  request_id: string | undefined;
  trace_id: string | undefined;
  event_type: string;
};

export type GovernanceComplianceExportResult =
  | {
      format: 'csv';
      body: string;
      contentType: 'text/csv; charset=utf-8';
    }
  | {
      format: 'json';
      body: {
        format: 'json';
        rows: GovernanceComplianceExportRow[];
      };
    }
  | {
      format: 'siem';
      body: {
        format: 'siem';
        rows: GovernanceComplianceSiemRow[];
      };
    };

type ComplianceRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  request_id: string | null;
  trace_id: string | null;
  created_at: string;
};

const csvHeader = [
  'event_id',
  'timestamp',
  'instance_id',
  'action',
  'result',
  'actor_pseudonym',
  'target_ref',
  'reason_code',
  'request_id',
  'trace_id',
  'event_type',
] as const;

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value);
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const readExportFormat = (format: string | undefined): GovernanceComplianceExportFormat => {
  if (format === 'csv' || format === 'siem') {
    return format;
  }
  return 'json';
};

export const loadGovernanceComplianceRows = async (
  client: QueryClient,
  input: { instanceId: string; from?: string; to?: string }
): Promise<ComplianceRow[]> => {
  const rows = await client.query<ComplianceRow>(
    `
SELECT
  id,
  event_type,
  payload,
  request_id,
  trace_id,
  created_at
FROM iam.activity_logs
WHERE instance_id = $1
  AND event_type LIKE 'governance_%'
  AND ($2::timestamptz IS NULL OR created_at >= $2::timestamptz)
  AND ($3::timestamptz IS NULL OR created_at <= $3::timestamptz)
ORDER BY created_at ASC;
`,
    [input.instanceId, input.from ?? null, input.to ?? null]
  );

  return rows.rows;
};

export const toGovernanceComplianceExportRows = (
  rows: readonly ComplianceRow[]
): GovernanceComplianceExportRow[] =>
  rows.map((row) => {
    const payload = row.payload ?? {};
    const payloadRecord = typeof payload === 'object' && payload !== null ? payload : {};
    return {
      event_id: readString(payloadRecord.event_id) ?? row.id,
      timestamp: readString(payloadRecord.timestamp) ?? row.created_at,
      instance_id: readString(payloadRecord.instance_id),
      action: readString(payloadRecord.action),
      result: readString(payloadRecord.result),
      actor_pseudonym: readString(payloadRecord.actor_pseudonym),
      target_ref: readString(payloadRecord.target_ref),
      reason_code: readString(payloadRecord.reason_code),
      request_id: readString(payloadRecord.request_id) ?? row.request_id ?? undefined,
      trace_id: readString(payloadRecord.trace_id) ?? row.trace_id ?? undefined,
      event_type: row.event_type,
    };
  });

export const serializeGovernanceComplianceCsv = (
  rows: readonly GovernanceComplianceExportRow[]
): string => {
  const lines = [csvHeader.join(',')];
  for (const row of rows) {
    lines.push(csvHeader.map((field) => csvEscape(row[field])).join(','));
  }
  return lines.join('\n');
};

export const toGovernanceComplianceSiemRows = (
  rows: readonly GovernanceComplianceExportRow[]
): GovernanceComplianceSiemRow[] =>
  rows.map((row) => ({
    '@timestamp': row.timestamp,
    event_id: row.event_id,
    instance_id: row.instance_id,
    action: row.action,
    result: row.result,
    actor_pseudonym: row.actor_pseudonym,
    target_ref: row.target_ref,
    reason_code: row.reason_code,
    request_id: row.request_id,
    trace_id: row.trace_id,
    event_type: row.event_type,
  }));

export const buildGovernanceComplianceExport = async (
  client: QueryClient,
  input: { instanceId: string; from?: string; to?: string; format?: string }
): Promise<GovernanceComplianceExportResult> => {
  const rows = toGovernanceComplianceExportRows(
    await loadGovernanceComplianceRows(client, input)
  );
  const format = readExportFormat(input.format?.toLowerCase());

  if (format === 'csv') {
    return {
      format,
      body: serializeGovernanceComplianceCsv(rows),
      contentType: 'text/csv; charset=utf-8',
    };
  }

  if (format === 'siem') {
    return {
      format,
      body: {
        format,
        rows: toGovernanceComplianceSiemRows(rows),
      },
    };
  }

  return {
    format,
    body: {
      format,
      rows,
    },
  };
};
