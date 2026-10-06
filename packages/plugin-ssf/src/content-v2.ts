import { createHash } from 'node:crypto';

import { canonicalize } from 'json-canonicalize';

import {
  ssfInstallationContentV2FieldsSchema,
  ssfInstallationContentV2Schema,
  ssfRuntimeConfigurationV2Schema,
  ssfRuntimeContentV2FieldsSchema,
  type SsfInstallationContentV2,
  type SsfRuntimeConfigurationV2,
} from './content-v2-contracts.js';
import { effectiveSsfRuntimeFieldsV2 } from './content-v2-overrides.js';
import { sanitizeSsfHtmlV1 } from './html.js';
import type { SsfTenantProfile } from './resolver-types.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const sanitizeSsfContentV2Fields = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeSsfContentV2Fields);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key.endsWith('Html') && typeof entry === 'string'
        ? sanitizeSsfHtmlV1(entry)
        : sanitizeSsfContentV2Fields(entry),
    ])
  );
};

const revision = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash('sha256').update(canonicalize(value), 'utf8').digest('hex')}`;

const assertSize = (value: unknown, limit: number): void => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > limit) {
    throw new Error('ssf_v2_response_too_large');
  }
};

export const resolveSsfInstallationContentV2 = (stored: unknown): SsfInstallationContentV2 => {
  const fields = ssfInstallationContentV2FieldsSchema.parse(sanitizeSsfContentV2Fields(stored));
  const base = { contractVersion: '2.0' as const, ...fields };
  const response = ssfInstallationContentV2Schema.parse({
    ...base,
    configurationRevision: revision(base),
  });
  assertSize(response, 1024 * 1024);
  return response;
};

export const resolveSsfRuntimeContentV2 = (input: {
  readonly tenant: SsfTenantProfile;
  readonly template: unknown;
  readonly overrides: unknown;
}): SsfRuntimeConfigurationV2 => {
  const template = sanitizeSsfContentV2Fields(input.template);
  if (!isRecord(template)) throw new Error('ssf_v2_runtime_template_invalid');
  const fields = ssfRuntimeContentV2FieldsSchema.parse(sanitizeSsfContentV2Fields(
    effectiveSsfRuntimeFieldsV2(template, input.overrides)
  ));
  const base = { contractVersion: '2.0' as const, tenant: input.tenant, ...fields };
  const response = ssfRuntimeConfigurationV2Schema.parse({
    ...base,
    configurationRevision: revision(base),
  });
  assertSize(response, 4 * 1024 * 1024);
  return response;
};
