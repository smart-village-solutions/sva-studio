import type { LiveRuntimeFlags, OidcClientSecretProbe, OidcClientSecretProbePayload, OidcClientSecretProbeResult } from './runtime-health.types.ts';

export const isTruthyFlag = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
};

export const resolveObservabilityMode = (env: NodeJS.ProcessEnv): 'console_to_loki' | 'otel_to_loki' | 'degraded' => {
  const otelEnabled = !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase());
  const consoleEnabled = isTruthyFlag(env.SVA_ENABLE_SERVER_CONSOLE_LOGS);
  if (otelEnabled) return 'otel_to_loki';
  if (consoleEnabled) return 'console_to_loki';
  return 'degraded';
};

export const getObservabilitySummary = (env: NodeJS.ProcessEnv) => ({
  consoleEnabled: isTruthyFlag(env.SVA_ENABLE_SERVER_CONSOLE_LOGS),
  loggerMode: resolveObservabilityMode(env),
  lokiConfigured: Boolean(env.SVA_LOKI_URL?.trim() && env.SVA_GRAFANA_TOKEN?.trim()),
  otelEnabled: !['false', '0'].includes((env.ENABLE_OTEL?.trim() || '').toLowerCase()),
  otelEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || null,
});

export const parseLiveRuntimeFlags = (raw: string): LiveRuntimeFlags => {
  const entries = new Map<string, string>();
  for (const line of raw.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key.length > 0) entries.set(key, value);
  }

  return {
    ENABLE_OTEL: entries.get('ENABLE_OTEL') ?? '',
    SVA_ENABLE_SERVER_CONSOLE_LOGS: entries.get('SVA_ENABLE_SERVER_CONSOLE_LOGS') ?? '',
    SVA_RUNTIME_PROFILE: entries.get('SVA_RUNTIME_PROFILE') ?? '',
  };
};

export const normalizeBaseUrl = (value: string) => value.replace(/\/+$/u, '');

export const resolveRemoteShortServiceName = (stackName: string, serviceName: string) =>
  serviceName.startsWith(`${stackName}_`) ? serviceName.slice(stackName.length + 1) : serviceName;

export const resolveRemoteStackServiceName = (stackName: string, serviceName: string) =>
  `${stackName}_${resolveRemoteShortServiceName(stackName, serviceName)}`;

export const readJsonResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { raw: text };
  }
};

const buildOidcIssuerUrl = (keycloakBaseUrl: string, realm: string) =>
  `${normalizeBaseUrl(keycloakBaseUrl)}/realms/${realm}`;

export const buildOidcClientSecretProbes = (env: NodeJS.ProcessEnv): readonly OidcClientSecretProbe[] => {
  const keycloakBaseUrl = env.KEYCLOAK_ADMIN_BASE_URL?.trim();
  const authIssuer = env.SVA_AUTH_ISSUER?.trim();
  const authClientId = env.SVA_AUTH_CLIENT_ID?.trim();
  const authClientSecret = env.SVA_AUTH_CLIENT_SECRET?.trim();
  const adminRealm = env.KEYCLOAK_ADMIN_REALM?.trim();
  const adminClientId = env.KEYCLOAK_ADMIN_CLIENT_ID?.trim();
  const adminClientSecret = env.KEYCLOAK_ADMIN_CLIENT_SECRET?.trim();
  const provisionerRealm = env.KEYCLOAK_PROVISIONER_REALM?.trim();
  const provisionerClientId = env.KEYCLOAK_PROVISIONER_CLIENT_ID?.trim();
  const provisionerClientSecret = env.KEYCLOAK_PROVISIONER_CLIENT_SECRET?.trim();
  const probes: OidcClientSecretProbe[] = [];

  if (authIssuer && authClientId && authClientSecret) probes.push({ allowClientAuthOnly: true, clientId: authClientId, clientSecret: authClientSecret, issuerUrl: authIssuer, name: 'auth-client' });
  if (keycloakBaseUrl && adminRealm && adminClientId && adminClientSecret) probes.push({ clientId: adminClientId, clientSecret: adminClientSecret, issuerUrl: buildOidcIssuerUrl(keycloakBaseUrl, adminRealm), name: 'admin-client' });
  if (keycloakBaseUrl && provisionerRealm && provisionerClientId && provisionerClientSecret) probes.push({ clientId: provisionerClientId, clientSecret: provisionerClientSecret, issuerUrl: buildOidcIssuerUrl(keycloakBaseUrl, provisionerRealm), name: 'provisioner-client' });

  return probes;
};

export const resolveAcceptanceContainerServices = (
  env: NodeJS.ProcessEnv,
  appServiceName = 'app',
): readonly string[] =>
  (env.ENABLE_OTEL?.trim() || 'true').toLowerCase() === 'false'
    ? [appServiceName, 'redis', 'postgres']
    : [appServiceName, 'redis', 'postgres', 'otel-collector'];

export const evaluateOidcClientSecretProbeResponse = (
  probe: OidcClientSecretProbe,
  response: { ok: boolean; status: number },
  payload: OidcClientSecretProbePayload,
): OidcClientSecretProbeResult => {
  if (response.ok) {
    const accessToken = typeof payload.access_token === 'string' ? payload.access_token.trim() : '';
    if (!accessToken) throw new Error(`${probe.name}: Token-Endpoint liefert kein access_token.`);
    return { mode: 'authenticated', name: probe.name, status: 'ok' };
  }

  const oauthError = typeof payload.error === 'string' ? payload.error : '';
  const oauthDescription = typeof payload.error_description === 'string' ? payload.error_description : '';
  if (probe.allowClientAuthOnly && response.status < 500 && oauthError.length > 0 && oauthError !== 'invalid_client') {
    return { mode: 'authenticated', name: probe.name, reason: oauthDescription || oauthError, status: 'ok' };
  }

  throw new Error(
    `${probe.name}: Client-Secret-Pruefung fehlgeschlagen (${response.status}${oauthError ? ` ${oauthError}` : ''}${oauthDescription ? `: ${oauthDescription}` : ''}).`,
  );
};
