import type { StudioApiClient } from './api-client.js';
import type { McpError } from './contracts.js';

export type Diagnosis = Readonly<Record<string, unknown>>;

const settled = (result: PromiseSettledResult<unknown>): unknown =>
  result.status === 'fulfilled' ? { status: 'available', evidence: result.value } : { status: 'unavailable' };

export const diagnoseInstance = async (
  client: StudioApiClient,
  instanceId: string,
  timeoutMs: number,
  primaryError?: McpError
): Promise<Diagnosis> => {
  if (primaryError?.category === 'validation' || primaryError?.category === 'authentication' || primaryError?.category === 'authorization') {
    return { status: 'not_checked', reason: `primary_${primaryError.category}` };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    if (primaryError?.category === 'platform_readiness') {
      const readiness = await Promise.allSettled([
        client.request({ path: '/api/v1/iam/health/ready', signal: controller.signal }),
      ]);
      return { readiness: readiness[0] ? settled(readiness[0]) : { status: 'unavailable' } };
    }
    if (primaryError?.category === 'internal') {
      return { status: 'not_checked', reason: 'primary_internal_unclassified' };
    }
    const detail = await Promise.allSettled([
      client.request({ path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}`, signal: controller.signal }),
    ]);
    if (primaryError?.category === 'conflict') {
      return { instance: detail[0] ? settled(detail[0]) : { status: 'unavailable' } };
    }
    if (detail[0]?.status !== 'fulfilled') {
      return { instance: detail[0] ? settled(detail[0]) : { status: 'unavailable' }, keycloak: { status: 'not_checked', reason: 'instance_not_found' } };
    }
    const keycloak = await Promise.allSettled([
      client.request({ path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/status`, signal: controller.signal }),
      client.request({ path: `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/keycloak/preflight`, signal: controller.signal }),
    ]);
    return {
      instance: settled(detail[0]),
      keycloakStatus: keycloak[0] ? settled(keycloak[0]) : { status: 'unavailable' },
      keycloakPreflight: keycloak[1] ? settled(keycloak[1]) : { status: 'unavailable' },
    };
  } finally {
    clearTimeout(timer);
  }
};
