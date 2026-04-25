import type { DsrExportFormat } from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

export type DsrExportStatusDeps = {
  readonly jsonResponse: (status: number, body: unknown) => Response;
  readonly textResponse: (status: number, body: string, contentType: string) => Response;
  readonly isExportFormat: (value: string | undefined) => value is DsrExportFormat;
};

type DsrExportJobRow = {
  id: string;
  format: DsrExportFormat;
  status: string;
  error_message: string | null;
  payload_json: Record<string, unknown> | null;
  payload_csv: string | null;
  payload_xml: string | null;
  created_at: string;
  completed_at: string | null;
};

const resolveRequesterAccountId = async (
  client: QueryClient,
  input: { instanceId: string; keycloakSubject: string }
): Promise<string | undefined> => {
  const lookup = await client.query<{ id: string }>(
    `
SELECT a.id
FROM iam.accounts a
JOIN iam.instance_memberships im
  ON im.account_id = a.id
 AND im.instance_id = $1
WHERE a.keycloak_subject = $2
LIMIT 1;
`,
    [input.instanceId, input.keycloakSubject]
  );

  return lookup.rowCount > 0 ? lookup.rows[0]?.id : undefined;
};

const getCompletedExportDownload = (
  deps: Pick<DsrExportStatusDeps, 'textResponse'>,
  job: DsrExportJobRow,
  downloadFormat: DsrExportFormat | undefined
): Response | undefined => {
  if (job.status !== 'completed' || !downloadFormat) {
    return undefined;
  }

  if (downloadFormat === 'json') {
    return deps.textResponse(200, JSON.stringify(job.payload_json ?? {}, null, 2), 'application/json');
  }
  if (downloadFormat === 'csv') {
    return deps.textResponse(200, job.payload_csv ?? '', 'text/csv; charset=utf-8');
  }
  return deps.textResponse(200, job.payload_xml ?? '', 'application/xml; charset=utf-8');
};

const toExportStatusResponse = (
  deps: Pick<DsrExportStatusDeps, 'jsonResponse' | 'textResponse'>,
  job: DsrExportJobRow,
  downloadFormat: DsrExportFormat | undefined
): Response => {
  const download = getCompletedExportDownload(deps, job, downloadFormat);
  if (download) {
    return download;
  }

  return deps.jsonResponse(200, {
    id: job.id,
    format: job.format,
    status: job.status,
    createdAt: job.created_at,
    completedAt: job.completed_at,
    errorMessage: job.error_message,
  });
};

export const createDsrExportStatusHandlers = (deps: DsrExportStatusDeps) => ({
  getSelfExportStatus: async (input: {
    client: QueryClient;
    instanceId: string;
    keycloakSubject: string;
    jobId: string;
    downloadFormat?: string;
  }): Promise<Response> => {
    const requester = await resolveRequesterAccountId(input.client, {
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
    });
    if (!requester) {
      return deps.jsonResponse(404, { error: 'account_not_found' });
    }

    const result = await input.client.query<DsrExportJobRow>(
      `
SELECT id, format, status, error_message, payload_json, payload_csv, payload_xml, created_at, completed_at
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
  AND requested_by_account_id = $3::uuid
LIMIT 1;
`,
      [input.instanceId, input.jobId, requester]
    );

    if (result.rowCount <= 0) {
      return deps.jsonResponse(404, { error: 'export_job_not_found' });
    }

    const job = result.rows[0];
    if (!job) {
      return deps.jsonResponse(404, { error: 'export_job_not_found' });
    }

    return toExportStatusResponse(deps, job, deps.isExportFormat(input.downloadFormat) ? input.downloadFormat : undefined);
  },

  getAdminExportStatus: async (input: {
    client: QueryClient;
    instanceId: string;
    jobId: string;
    downloadFormat?: string;
  }): Promise<Response> => {
    const result = await input.client.query<DsrExportJobRow>(
      `
SELECT id, format, status, error_message, payload_json, payload_csv, payload_xml, created_at, completed_at
FROM iam.data_subject_export_jobs
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
      [input.instanceId, input.jobId]
    );

    if (result.rowCount <= 0) {
      return deps.jsonResponse(404, { error: 'export_job_not_found' });
    }

    const job = result.rows[0];
    if (!job) {
      return deps.jsonResponse(404, { error: 'export_job_not_found' });
    }

    return toExportStatusResponse(deps, job, deps.isExportFormat(input.downloadFormat) ? input.downloadFormat : undefined);
  },
});
