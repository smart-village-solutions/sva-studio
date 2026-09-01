import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

export interface ServiceTokenVerificationConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly clientId: string;
}

const remoteJwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export const getRemoteServiceJwks = (issuer: string): ReturnType<typeof createRemoteJWKSet> => {
  const normalizedIssuer = issuer.replace(/\/$/u, '');
  const existing = remoteJwksByIssuer.get(normalizedIssuer);
  if (existing) return existing;
  const jwks = createRemoteJWKSet(new URL(`${normalizedIssuer}/protocol/openid-connect/certs`));
  remoteJwksByIssuer.set(normalizedIssuer, jwks);
  return jwks;
};

export const verifyServiceJwt = async (
  token: string,
  config: ServiceTokenVerificationConfig,
  getKey: JWTVerifyGetKey = getRemoteServiceJwks(config.issuer)
): Promise<JWTPayload> => {
  const result = await jwtVerify(token, getKey, {
    issuer: config.issuer,
    audience: config.audience,
    algorithms: ['RS256'],
  });
  if (typeof result.payload.exp !== 'number') {
    throw new Error('service_token_exp_required');
  }
  return result.payload;
};

export const readServiceTokenStringArray = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export const readServiceTokenClientActions = (
  payload: JWTPayload,
  clientId: string
): readonly string[] =>
  readServiceTokenStringArray(
    (payload.resource_access as Record<string, { roles?: unknown }> | undefined)?.[clientId]?.roles
  );

export const isServiceIdentityProviderUnavailable = (error: unknown): boolean =>
  error instanceof TypeError || error instanceof errors.JWKSTimeout;

export const readBearerToken = (request: Request): string | null | undefined => {
  const authorization = request.headers.get('authorization');
  if (authorization === null) return undefined;
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
};
