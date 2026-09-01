export const SSF_RUNTIME_CONTRACT_VERSION = '1.0' as const;
export const SSF_RUNTIME_ENDPOINT_PATH = '/internal/plugins/ssf/v1/runtime-configuration' as const;
export const SSF_RUNTIME_SERVICE_ACTION = 'ssf.runtime-configuration.read' as const;

export const SSF_RUNTIME_LIMITS = {
  activeLocales: 20,
  localeCharacters: 35,
  htmlUtf8Bytes: 65_536,
  displayNameCharacters: 200,
  urlCharacters: 2_048,
  alternativeTextCharacters: 500,
  correlationIdCharacters: 128,
  responseUtf8Bytes: 4 * 1_024 * 1_024,
} as const;

export const SSF_RUNTIME_ERROR_CODES = [
  'service_authentication_invalid',
  'service_action_forbidden',
  'tenant_not_found',
  'tenant_suspended',
  'ssf_plugin_inactive',
  'ssf_tenant_not_ready',
  'runtime_configuration_unavailable',
] as const;

export type SsfRuntimeErrorCode = (typeof SSF_RUNTIME_ERROR_CODES)[number];
