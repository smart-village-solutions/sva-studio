import { jwtVerify, type JWTPayload } from 'jose';
import type {
  BoundSsfRecordingRequest,
  SsfRecordingGatewayRequest,
} from './plugin-server-handlers/dispatcher.js';
import { resolveAuthConfigForInstance } from './config.js';
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

/** Bound by the dispatcher to one authenticated request, handler, user and tenant. */
export const forwardSsfRecordingRequest = async (
  ctx: BoundSsfRecordingRequest,
  operation: SsfRecordingGatewayRequest
): Promise<Response> => {
  const route = routes[ctx.handlerId];
  if (
    ctx.scope !== 'tenant' ||
    ctx.pluginId !== 'ssf' ||
    !ctx.actor.instanceId ||
    !route ||
    operation.method !== route[0] ||
    !route[1].test(operation.path.split('?')[0] ?? '')
  )
    return fail(403, 'PERMISSION_REQUIRED');
  try {
    const instanceId = ctx.actor.instanceId;
    const session = await getSession(ctx.sessionId, { decryptTokens: true });
    if (
      !session?.accessToken ||
      session.userId !== ctx.actor.id ||
      session.auth?.kind !== 'instance' ||
      session.auth.instanceId !== instanceId
    )
      return fail(403, 'STEP_UP_REQUIRED');
    const config = await resolveAuthConfigForInstance(instanceId);
    if (
      config.kind !== 'instance' ||
      config.instanceId !== instanceId ||
      config.issuer !== session.auth.issuer ||
      config.clientId !== session.auth.clientId
    )
      return fail(403, 'STEP_UP_REQUIRED');
    const audience = process.env.SVA_STUDIO_SSF_GATEWAY_AUDIENCE?.trim() || 'ssf-frontend';
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
    const verify = async (token: string) =>
      (
        await jwtVerify(token, getRemoteServiceJwks(config.issuer), {
          issuer: config.issuer,
          audience,
          algorithms: ['RS256'],
          requiredClaims: ['exp', 'sub', 'azp', 'sid'],
        })
      ).payload;
    const original = await verify(session.accessToken);
    if (
      original.sub !== ctx.actor.id ||
      original.azp !== config.clientId ||
      original.studio_tenant_id !== instanceId ||
      original.client_id ||
      String(original.preferred_username ?? '').startsWith('service-account-') ||
      !allowed(original, route[2])
    )
      return fail(403, 'PERMISSION_REQUIRED');
    if (typeof original.acr !== 'string' || !Number.isSafeInteger(original.auth_time))
      return fail(403, 'STEP_UP_REQUIRED');
    const signal = AbortSignal.any([ctx.request.signal, AbortSignal.timeout(15_000)]);
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
        subject_token: session.accessToken,
        subject_token_type: accessTokenType,
        requested_token_type: accessTokenType,
        audience,
      }),
    });
    if (!exchange.ok) return fail(503, 'RECORDING_UNAVAILABLE');
    const token = (await exchange.json()) as Record<string, unknown>;
    if (
      token.issued_token_type !== accessTokenType ||
      token.token_type !== 'Bearer' ||
      typeof token.access_token !== 'string'
    )
      return fail(503, 'RECORDING_UNAVAILABLE');
    const exchanged = await verify(token.access_token);
    if (
      exchanged.sub !== original.sub ||
      exchanged.sid !== original.sid ||
      exchanged.studio_tenant_id !== instanceId ||
      exchanged.azp !== config.clientId ||
      !allowed(exchanged, route[2])
    )
      return fail(403, 'PERMISSION_REQUIRED');
    if (exchanged.acr !== original.acr || exchanged.auth_time !== original.auth_time)
      return fail(503, 'RECORDING_UNAVAILABLE');
    return await fetch(origin.origin + '/api/admin/recording/v2' + operation.path, {
      method: operation.method,
      redirect: 'error',
      cache: 'no-store',
      signal,
      headers: {
        Authorization: 'Bearer ' + token.access_token,
        ...(operation.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(operation.body ? { body: operation.body } : {}),
    });
  } catch {
    return fail(503, 'RECORDING_UNAVAILABLE');
  }
};
