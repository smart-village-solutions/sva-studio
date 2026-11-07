import {
  createMainserverCrudClient,
  createMainserverReadHeaders,
  createMainserverMutationHeaders,
  MainserverApiError,
  requestMainserverJson,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import type { JobInput, JobRecord, JobList } from './contract.js';
export type JobWrite =
  { job: JobInput; baseFingerprint?: string } | { recover: true; inputHash: string };
const client = createMainserverCrudClient<JobRecord, JobWrite, JobList, JobList>({
  basePath: '/api/v1/mainserver/jobs',
  errorFactory: (code, message) => new MainserverApiError(code, message),
  mapListResponse: (response) => response,
});
export const getJob = client.getDetail;
export const saveJob = (
  id: string | undefined,
  body: JobWrite,
  principal: MainserverActingPrincipalType,
  operationId: string
) =>
  id
    ? client.update(id, body, principal, { operationId })
    : client.create(body, principal, { operationId });
export const listJobs = (
  query: Record<string, string | number>,
  principal: MainserverActingPrincipalType = 'user'
) =>
  requestMainserverJson<JobList>({
    init: { headers: createMainserverReadHeaders(principal) },
    url: `/api/v1/mainserver/jobs?${new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))}`,
  });
export const listJobCategories = async (principal: MainserverActingPrincipalType = 'user') =>
  (
    await requestMainserverJson<{ data: readonly { id: string; name: string }[] }>({
      init: { headers: createMainserverReadHeaders(principal) },
      url: '/api/v1/mainserver/categories?dataType=generic_item_job',
    })
  ).data;
// Only the operation identity is persisted, never editorial content or credentials.
export type JobPending = Readonly<{
  operationId: string;
  inputHash: string;
  id?: string;
  kind?: 'delete';
}>;
export function readJobPending(key: string): JobPending | undefined {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object' || !('operationId' in value) || !('inputHash' in value))
      return undefined;
    const { operationId, inputHash } = value;
    if (
      typeof operationId !== 'string' ||
      typeof inputHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(inputHash)
    )
      return undefined;
    return {
      operationId,
      inputHash,
      ...('kind' in value && value.kind === 'delete' ? { kind: 'delete' as const } : {}),
      ...('id' in value && typeof value.id === 'string' ? { id: value.id } : {}),
    };
  } catch {
    return undefined;
  }
}
export async function jobRequestHash(body: JobWrite | JobDelete) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(body))
  );
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function jobRejection(error: unknown): string | undefined {
  if (!(error instanceof MainserverApiError)) return undefined;
  return [
    'job_prewrite_failed',
    'job_external_id_conflict',
    'job_employment_type_invalid',
    'job_inactive_categories',
    'job_content_conflict',
    'job_invalid_input',
    'job_media_unavailable',
    'job_not_found',
    'job_incomplete',
    'job_dependents_unsupported',
    'forbidden',
    'csrf_validation_failed',
    'stale_mainserver_context',
    'mainserver_context_binding_missing',
  ].includes(error.code)
    ? error.code
    : undefined;
}

export type JobDelete = { baseFingerprint: string } | { recover: true; inputHash: string };
export async function removeJob(
  id: string,
  body: JobDelete,
  principal: MainserverActingPrincipalType,
  operationId: string
) {
  let binding: string | undefined;
  await requestMainserverJson({
    url: `/api/v1/mainserver/jobs/${encodeURIComponent(id)}?context=delete`,
    init: { headers: createMainserverReadHeaders(principal) },
    onResponse: (meta) => {
      if (meta.ok) binding = meta.contextBinding;
    },
  });
  if (!binding)
    throw new MainserverApiError(
      'mainserver_context_binding_missing',
      'mainserver_context_binding_missing'
    );
  const result = await requestMainserverJson<{
    data: { id: string; deleted: boolean; reconciliationRequired?: boolean };
  }>({
    url: `/api/v1/mainserver/jobs/${encodeURIComponent(id)}`,
    init: {
      method: 'DELETE',
      headers: createMainserverMutationHeaders(
        principal,
        { 'x-sva-context-binding': binding },
        operationId
      ),
      body: JSON.stringify(body),
    },
  });
  return result.data;
}
