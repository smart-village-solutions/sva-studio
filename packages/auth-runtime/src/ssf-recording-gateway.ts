import { errors as joseErrors, jwtVerify, type JWTPayload } from 'jose';
import type {
  BoundSsfRecordingRequest,
  SsfRecordingGatewayRequest,
} from './plugin-server-handlers/dispatcher.js';
import { resolveAuthConfigForInstance } from './config.js';
import type { AuthConfig } from './types.js';
import { getSession } from './redis-session.js';
import { getRemoteServiceJwks } from './service-token.js';

const manage = 'ssf.configuration.tenant.manage';
const transfer = 'ssf.recording.access.transfer';
const accessTokenType = 'urn:ietf:params:oauth:token-type:access_token';
const routes: Record<string, readonly [string, RegExp, readonly string[]]> = {
  'ssf.organisation-keys.read': ['GET', /^\/organisation-keys$/, [manage, transfer]],
  'ssf.organisation-keys.prepare': ['POST', /^\/organisation-keys\/preparations$/, [manage]],
  'ssf.organisation-keys.activate': [
    'POST',
    /^\/organisation-keys\/preparations\/[a-f0-9-]{36}\/activate$/,
    [manage],
  ],
  'ssf.organisation-keys.abandon': [
    'DELETE',
    /^\/organisation-keys\/preparations\/[a-f0-9-]{36}$/,
    [manage],
  ],
  'ssf.access-transfer.candidates': ['GET', /^\/access-transfer\/candidates$/, [transfer]],
  'ssf.access-transfer.target': [
    'GET',
    /^\/access-transfer\/targets\/[a-zA-Z0-9][a-zA-Z0-9._:@%-]{0,762}$/,
    [transfer],
  ],
  'ssf.access-transfer.prepare': ['POST', /^\/access-transfer\/preparations$/, [transfer]],
  'ssf.access-transfer.commit': [
    'POST',
    /^\/access-transfer\/preparations\/[a-f0-9-]{36}\/commit$/,
    [transfer],
  ],
};
const fail = (status: number, code: string) =>
  Response.json({ error: { code } }, { status, headers: { 'Cache-Control': 'no-store' } });
const allowed = (payload: JWTPayload, required: readonly string[]) =>
  Array.isArray(payload.ssf_permissions) &&
  required.some((id) => (payload.ssf_permissions as unknown[]).includes(id));

type InstanceConfig = Extract<AuthConfig, { kind: 'instance' }>;

const boundSession = async (ctx: BoundSsfRecordingRequest, instanceId: string) => {
  const session = await getSession(ctx.sessionId, { decryptTokens: true });
  if (!session?.accessToken) return fail(401, 'AUTHENTICATION_REQUIRED');
  if (
    session.userId !== ctx.actor.id ||
    session.auth?.kind !== 'instance' ||
    session.auth.instanceId !== instanceId
  )
    return fail(403, 'PERMISSION_REQUIRED');
  const config = await resolveAuthConfigForInstance(instanceId);
  if (
    config.kind !== 'instance' ||
    config.instanceId !== instanceId ||
    config.issuer !== session.auth.issuer ||
    config.clientId !== session.auth.clientId
  )
    return fail(403, 'PERMISSION_REQUIRED');
  return { config, accessToken: session.accessToken };
};

const gatewayOrigin = () => {
  const origin = new URL(process.env.SVA_STUDIO_SSF_CONTROL_PLANE_BASE_URL ?? '');
  if (
    origin.protocol !== 'https:' ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    return fail(503, 'RECORDING_UNAVAILABLE');
  return origin.origin;
};

const verify = async (token: string, issuer: string, expectedAudience?: string) =>
  (
    await jwtVerify(token, getRemoteServiceJwks(issuer), {
      issuer,
      ...(expectedAudience ? { audience: expectedAudience } : {}),
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'sub', 'azp', 'sid'],
    })
  ).payload;

const validateOriginal = (
  original: JWTPayload,
  config: InstanceConfig,
  actorId: string,
  audience: string,
  permissions: readonly string[]
) => {
  if (
    original.sub !== actorId ||
    original.azp !== config.clientId ||
    original.client_id ||
    String(original.preferred_username ?? '').startsWith('service-account-')
  )
    return fail(403, 'PERMISSION_REQUIRED');
  // The subject token must already be provisioned for this Gateway audience.
  const audiences = Array.isArray(original.aud) ? original.aud : [original.aud];
  if (!audiences.includes(audience)) return fail(503, 'RECORDING_UNAVAILABLE');
  if (original.studio_tenant_id !== config.instanceId || !allowed(original, permissions))
    return fail(403, 'PERMISSION_REQUIRED');
};

const exchangeToken = async (
  config: InstanceConfig,
  accessToken: string,
  audience: string,
  signal: AbortSignal
) => {
  const exchange = await fetch(config.issuer + '/protocol/openid-connect/token', {
    method: 'POST',
    redirect: 'error',
    cache: 'no-store',
    signal,
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(
          encodeURIComponent(config.clientId) + ':' + encodeURIComponent(config.clientSecret)
        ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: accessToken,
      subject_token_type: accessTokenType,
      requested_token_type: accessTokenType,
      audience,
    }),
  });
  if (!exchange.ok) {
    const rejection = (await exchange.json().catch(() => ({}))) as { error?: string };
    if (rejection.error === 'invalid_grant' || rejection.error === 'invalid_token')
      return fail(401, 'AUTHENTICATION_REQUIRED');
    return fail(503, 'RECORDING_UNAVAILABLE');
  }
  const token = (await exchange.json()) as Record<string, unknown>;
  if (
    token.issued_token_type !== accessTokenType ||
    token.token_type !== 'Bearer' ||
    typeof token.access_token !== 'string'
  )
    return fail(503, 'RECORDING_UNAVAILABLE');
  return token.access_token;
};

const validateExchange = (
  exchanged: JWTPayload,
  original: JWTPayload,
  config: InstanceConfig,
  permissions: readonly string[]
) => {
  if (
    exchanged.sub !== original.sub ||
    exchanged.sid !== original.sid ||
    exchanged.studio_tenant_id !== config.instanceId ||
    exchanged.azp !== config.clientId
  )
    return fail(503, 'RECORDING_UNAVAILABLE');
  if (!allowed(exchanged, permissions)) return fail(403, 'PERMISSION_REQUIRED');
  if (exchanged.acr !== original.acr || exchanged.auth_time !== original.auth_time)
    return fail(503, 'RECORDING_UNAVAILABLE');
};

const authorizedBearer = async (
  config: InstanceConfig,
  actorId: string,
  accessToken: string,
  permissions: readonly string[],
  audience: string,
  requestSignal: AbortSignal
) => {
  const original = await verify(accessToken, config.issuer);
  const denied = validateOriginal(original, config, actorId, audience, permissions);
  if (denied) return denied;
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(15_000)]);
  const token = await exchangeToken(config, accessToken, audience, signal);
  if (token instanceof Response) return token;
  const exchanged = await verify(token, config.issuer, audience).catch(() => null);
  if (!exchanged) return fail(503, 'RECORDING_UNAVAILABLE');
  return validateExchange(exchanged, original, config, permissions) ?? { token, signal };
};

const recordingError = (error: unknown) => {
  if (
    error instanceof joseErrors.JWTExpired ||
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    error instanceof joseErrors.JWTClaimValidationFailed ||
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSInvalid
  )
    return fail(401, 'AUTHENTICATION_REQUIRED');
  return fail(503, 'RECORDING_UNAVAILABLE');
};

/** Bound by the dispatcher to one authenticated request, handler, user and tenant. */
export const forwardSsfRecordingRequest = async (
  ctx: BoundSsfRecordingRequest,
  operation: SsfRecordingGatewayRequest
): Promise<Response> => {
  const route = routes[ctx.handlerId];
  const instanceId = ctx.actor.instanceId;
  if (
    ctx.scope !== 'tenant' ||
    ctx.pluginId !== 'ssf' ||
    !instanceId ||
    !route ||
    operation.method !== route[0] ||
    !route[1].test(operation.path.split('?')[0] ?? '')
  )
    return fail(403, 'PERMISSION_REQUIRED');
  try {
    const session = await boundSession(ctx, instanceId);
    if (session instanceof Response) return session;
    const audience = process.env.SVA_STUDIO_SSF_GATEWAY_AUDIENCE?.trim() || 'ssf-frontend';
    const origin = gatewayOrigin();
    if (origin instanceof Response) return origin;
    const bearer = await authorizedBearer(
      session.config,
      ctx.actor.id,
      session.accessToken,
      route[2],
      audience,
      ctx.request.signal
    );
    if (bearer instanceof Response) return bearer;
    return await fetch(origin + '/api/admin/recording/v2' + operation.path, {
      method: operation.method,
      redirect: 'error',
      cache: 'no-store',
      signal: bearer.signal,
      headers: {
        Authorization: 'Bearer ' + bearer.token,
        ...(operation.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(operation.body ? { body: operation.body } : {}),
    });
  } catch (error) {
    return recordingError(error);
  }
};
