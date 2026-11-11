import { createMainserverJsonRequestHeaders } from '@sva/plugin-sdk';

import {
  SSF_CONTENT_REVISION_HEADER,
  SSF_EXPECTED_CONTENT_REVISION_HEADER,
  ssfAdminContentRevisionSchema,
  type SsfVersionedContent,
  SSF_SYSTEM_CONTENT_V2_ADMIN_PATH,
  SSF_TENANT_CONTENT_V2_ADMIN_PATH,
  ssfRecordingPolicyConflictSchema,
  ssfSystemContentV2ViewSchema,
  ssfTenantContentV2ViewSchema,
  type SsfSystemContentV2Input,
  type SsfSystemContentV2View,
  type SsfTenantContentV2View,
} from './content-v2-admin-contracts.js';

export class SsfRecordingPolicyConflictError extends Error {
  constructor(readonly affectedTenants: readonly string[]) {
    super('ssf_configuration_recording_policy_conflict');
  }
}

const requestResponse = async (url: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    if (
      url === SSF_SYSTEM_CONTENT_V2_ADMIN_PATH &&
      init?.method === 'PUT' &&
      response.status === 422
    ) {
      const conflict = ssfRecordingPolicyConflictSchema.safeParse(
        await response.json().catch(() => null)
      );
      if (conflict.success)
        throw new SsfRecordingPolicyConflictError(conflict.data.affectedTenants);
    }
    if (response.status === 412) throw new SsfContentConflictError();
    throw new Error(`ssf_configuration_http_${response.status}`);
  }
  return response;
};
/** A stale draft stays local until the administrator deliberately reloads/discards it. */
export class SsfContentConflictError extends Error {
  constructor() {
    super('ssf_content_revision_conflict');
  }
}

const requestContent = async <T>(
  url: string,
  parse: (value: unknown) => T,
  init?: RequestInit
): Promise<SsfVersionedContent<T>> => {
  const response = await requestResponse(url, init);
  const contentRevision = ssfAdminContentRevisionSchema.parse(
    response.headers.get(SSF_CONTENT_REVISION_HEADER)
  );
  return { ...parse(await response.json()), contentRevision };
};
const contentWrite = (input: unknown, revision: string): RequestInit => ({
  method: 'PUT',
  headers: {
    ...createMainserverJsonRequestHeaders(),
    [SSF_EXPECTED_CONTENT_REVISION_HEADER]: ssfAdminContentRevisionSchema.parse(revision),
  },
  body: JSON.stringify(input),
});

export const readSsfSystemContentV2 = (): Promise<SsfVersionedContent<SsfSystemContentV2View>> =>
  requestContent(SSF_SYSTEM_CONTENT_V2_ADMIN_PATH, (value) =>
    ssfSystemContentV2ViewSchema.parse(value)
  );

export const writeSsfSystemContentV2 = (
  input: SsfSystemContentV2Input,
  expectedRevision: string
): Promise<SsfVersionedContent<SsfSystemContentV2View>> =>
  requestContent(
    SSF_SYSTEM_CONTENT_V2_ADMIN_PATH,
    (value) => ssfSystemContentV2ViewSchema.parse(value),
    contentWrite(input, expectedRevision)
  );

export const readSsfTenantContentV2 = (): Promise<SsfVersionedContent<SsfTenantContentV2View>> =>
  requestContent(SSF_TENANT_CONTENT_V2_ADMIN_PATH, (value) =>
    ssfTenantContentV2ViewSchema.parse(value)
  );

export const writeSsfTenantContentV2 = (
  input: Record<string, unknown>,
  expectedRevision: string
): Promise<SsfVersionedContent<SsfTenantContentV2View>> =>
  requestContent(
    SSF_TENANT_CONTENT_V2_ADMIN_PATH,
    (value) => ssfTenantContentV2ViewSchema.parse(value),
    contentWrite(input, expectedRevision)
  );
