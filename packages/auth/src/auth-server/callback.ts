import { randomUUID } from 'node:crypto';
import { createSdkLogger } from '@sva/sdk/server';

import { getAuthConfig } from '../config';
import { jitProvisionAccount } from '../jit-provisioning.server';
import { client, getOidcConfig } from '../oidc.server';
import { consumeLoginState, createSession } from '../redis-session.server';
import { createPoolResolver } from '../shared/db-helpers';
import { isUuid } from '../shared/input-readers';
import { resolveInstanceId as resolveInstanceIdFromDb } from '../shared/instance-id-resolution';
import type { LoginState } from '../types';
import { buildLogContext } from '../shared/log-context';
import { buildSessionUser, resolveExpiresAt } from './shared';

const logger = createSdkLogger({ component: 'iam-auth', level: 'info' });
const resolvePool = createPoolResolver(() => process.env.IAM_DATABASE_URL);

/**
 * Löst einen beliebigen instanceId-Claim (z.B. 'tenant-1') über die
 * `iam.instances.instance_key`-Tabelle in die korrespondierende UUID auf.
 * Ist der Wert bereits eine UUID oder nicht vorhanden, wird er unverändert
 * zurückgegeben. Fehler werden geloggt aber geschluckt – in dem Fall bleibt
 * der Rohwert erhalten, und nachgelagerte Handler geben einen kontrollierten
 * 400 zurück.
 */
const tryResolveInstanceIdToUuid = async (raw: string | undefined): Promise<string | undefined> => {
  if (!raw || isUuid(raw)) return raw;

  try {
    const result = await resolveInstanceIdFromDb({
      resolvePool,
      candidate: raw,
      createIfMissingFromKey: process.env.NODE_ENV !== 'production',
      displayNameForCreate: raw,
    });
    if (result.ok) {
      logger.info('Resolved non-UUID instanceId to UUID', {
        operation: 'instance_id_resolve',
        raw_instance_id: raw,
        resolved_instance_id: result.instanceId,
        from_instance_key: result.fromInstanceKey,
        created: result.created,
      });
      return result.instanceId;
    }
    logger.warn('Could not resolve instanceId to UUID', {
      operation: 'instance_id_resolve',
      raw_instance_id: raw,
      reason: result.reason,
    });
  } catch (error) {
    logger.warn('Instance ID resolution failed, using raw value', {
      operation: 'instance_id_resolve',
      raw_instance_id: raw,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return raw;
};

const persistSession = async (input: {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  claims: Record<string, unknown>;
  clientId: string;
  expiresAt?: number;
  resolvedInstanceId?: string;
}) => {
  const sessionId = randomUUID();
  const user = buildSessionUser({
    accessToken: input.accessToken,
    claims: input.claims,
    clientId: input.clientId,
  });

  // Überschreibe instanceId mit dem aufgelösten UUID-Wert (falls vorhanden)
  if (input.resolvedInstanceId) {
    user.instanceId = input.resolvedInstanceId;
  }

  await createSession(sessionId, {
    id: sessionId,
    userId: user.id,
    user,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    idToken: input.idToken,
    expiresAt: input.expiresAt,
    createdAt: Date.now(),
  });

  return { sessionId, user };
};

const syncJitProvisioning = async (instanceId: string | undefined, keycloakSubject: string) => {
  try {
    await jitProvisionAccount({ instanceId, keycloakSubject });
  } catch (error) {
    logger.error('JIT provisioning failed after callback', {
      operation: 'jit_provision',
      user_id: keycloakSubject,
      instance_id: instanceId,
      error: error instanceof Error ? error.message : String(error),
      ...buildLogContext(instanceId),
    });
  }
};

export const handleCallback = async (params: {
  code: string;
  state: string;
  iss?: string | null;
  loginState?: LoginState | null;
}) => {
  const authConfig = getAuthConfig();
  const config = await getOidcConfig();
  const loginState = params.loginState ?? (await consumeLoginState(params.state));

  if (!loginState) {
    throw new Error('Invalid login state');
  }

  const callbackUrl = new URL(authConfig.redirectUri);
  callbackUrl.searchParams.set('code', params.code);
  callbackUrl.searchParams.set('state', params.state);
  if (params.iss) {
    callbackUrl.searchParams.set('iss', params.iss);
  }

  const tokenSet = await client.authorizationCodeGrant(config, callbackUrl, {
    pkceCodeVerifier: loginState.codeVerifier,
    expectedState: params.state,
    expectedNonce: loginState.nonce,
  });
  const claims = (tokenSet.claims() ?? {}) as Record<string, unknown>;

  // Keycloak-Claim kann ein beliebiger String sein (z.B. 'tenant-1').
  // Wir lösen ihn vor der Session-Erstellung zur DB-UUID auf, damit alle
  // nachgelagerten Handler direkt mit der UUID arbeiten können.
  const rawInstanceId = buildSessionUser({ claims, clientId: authConfig.clientId }).instanceId;
  const resolvedInstanceId = await tryResolveInstanceIdToUuid(rawInstanceId);

  const persisted = await persistSession({
    accessToken: tokenSet.access_token,
    refreshToken: tokenSet.refresh_token,
    idToken: tokenSet.id_token,
    claims,
    clientId: authConfig.clientId,
    expiresAt: resolveExpiresAt(tokenSet.expiresIn()),
    resolvedInstanceId,
  });

  await syncJitProvisioning(persisted.user.instanceId, persisted.user.id);

  logger.debug('Session created for authenticated user', {
    operation: 'session_create',
    user_id: persisted.user.id,
    has_refresh_token: Boolean(tokenSet.refresh_token),
    ...buildLogContext(persisted.user.instanceId),
  });

  return persisted;
};
