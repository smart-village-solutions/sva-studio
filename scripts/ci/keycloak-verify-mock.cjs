const { createHash, generateKeyPairSync, randomBytes, sign, timingSafeEqual } = require('node:crypto');
const { readFileSync } = require('node:fs');
const http = require('node:http');
const https = require('node:https');

const port = Number.parseInt(process.env.PORT || '38080', 10);
const adminRealm = process.env.KEYCLOAK_REALM || 'sva-studio';
const tenantRealm = process.env.VERIFY_TENANT_REALM || 'example-instance';
const clientId = process.env.VERIFY_AUTH_CLIENT_ID || 'sva-studio';
const clientSecret = process.env.VERIFY_AUTH_CLIENT_SECRET || 'verify-auth-client-secret';
const redirectUri = process.env.VERIFY_AUTH_REDIRECT_URI;
const rootRedirectUri = process.env.VERIFY_ROOT_REDIRECT_URI;
const subject = 'verify-ssf-user';
const keyId = 'verify-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = { ...publicKey.export({ format: 'jwk' }), alg: 'RS256', kid: keyId, use: 'sig' };
const pendingCodes = new Map();
let adminAuthorizations = 0;
const baseUrl = (process.env.KEYCLOAK_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/+$/u, '');

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = async (req) => {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new Error('request_too_large');
  }
  return new URLSearchParams(body);
};

const jwt = (claims) => {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const data = `${header}.${payload}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
};

const credentialsMatch = (req, body) => {
  const authorization = req.headers.authorization || '';
  const basic = authorization.startsWith('Basic ')
    ? Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    : `${body.get('client_id') || ''}:${body.get('client_secret') || ''}`;
  const expected = Buffer.from(`${clientId}:${clientSecret}`);
  const actual = Buffer.from(basic);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const handleRequest = async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    const realmPath = url.pathname.match(/^\/realms\/([^/]+)\/protocol\/openid-connect\/(auth|token|certs)$/u);
    const realm = realmPath?.[1];
    const endpoint = realmPath?.[2];

    if (req.method === 'GET' && url.pathname === `/admin/realms/${adminRealm}/roles`) {
      return json(res, 200, []);
    }

    if (req.method === 'GET' && [adminRealm, tenantRealm].some((name) =>
      url.pathname === `/realms/${name}/.well-known/openid-configuration`)) {
      const discoveryRealm = url.pathname.split('/')[2];
      const issuer = `${baseUrl}/realms/${discoveryRealm}`;
      return json(res, 200, {
        issuer,
        token_endpoint: `${issuer}/protocol/openid-connect/token`,
        authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
        end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
        jwks_uri: `${issuer}/protocol/openid-connect/certs`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code'],
        code_challenge_methods_supported: ['S256'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic'],
      });
    }

    if (req.method === 'GET' && (realm === tenantRealm || realm === adminRealm) && endpoint === 'certs') {
      return json(res, 200, { keys: [publicJwk] });
    }

    if (req.method === 'GET' && (realm === tenantRealm || realm === adminRealm) && endpoint === 'auth') {
      const expectedRedirectUri = realm === adminRealm ? rootRedirectUri : redirectUri;
      if (
        !expectedRedirectUri ||
        url.searchParams.get('response_type') !== 'code' ||
        url.searchParams.get('client_id') !== clientId ||
        url.searchParams.get('redirect_uri') !== expectedRedirectUri ||
        url.searchParams.get('code_challenge_method') !== 'S256' ||
        !url.searchParams.get('code_challenge') ||
        !url.searchParams.get('state') ||
        !url.searchParams.get('nonce')
      ) return json(res, 400, { error: 'invalid_request' });

      const code = randomBytes(32).toString('base64url');
      pendingCodes.set(code, {
        challenge: url.searchParams.get('code_challenge'),
        nonce: url.searchParams.get('nonce'),
        redirectUri: expectedRedirectUri,
        realm,
        adminRole: realm === adminRealm && ++adminAuthorizations >= 2,
      });
      const callback = new URL(expectedRedirectUri);
      callback.searchParams.set('code', code);
      callback.searchParams.set('state', url.searchParams.get('state'));
      callback.searchParams.set('iss', `${baseUrl}/realms/${realm}`);
      res.writeHead(302, { location: callback.href });
      return res.end();
    }

    if (req.method === 'POST' && (realm === tenantRealm || realm === adminRealm) && endpoint === 'token') {
      const body = await readBody(req);
      if (realm === adminRealm && body.get('grant_type') !== 'authorization_code') {
        return json(res, 200, { access_token: 'verify-admin-token', token_type: 'Bearer', expires_in: 300 });
      }
      const code = body.get('code');
      const authorization = code && pendingCodes.get(code);
      if (
        !authorization ||
        authorization.realm !== realm ||
        !credentialsMatch(req, body) ||
        body.get('grant_type') !== 'authorization_code' ||
        body.get('redirect_uri') !== authorization.redirectUri ||
        createHash('sha256').update(body.get('code_verifier') || '').digest('base64url') !== authorization.challenge
      ) return json(res, 400, { error: 'invalid_grant' });

      pendingCodes.delete(code);
      const now = Math.floor(Date.now() / 1000);
      const claims = {
        iss: `${baseUrl}/realms/${realm}`,
        sub: realm === adminRealm ? 'verify-platform-user' : subject,
        aud: clientId,
        iat: now,
        exp: now + 300,
        auth_time: now,
        nonce: authorization.nonce,
        preferred_username: realm === adminRealm ? 'verify-platform-user' : subject,
        ...(authorization.adminRole ? { realm_access: { roles: ['instance_registry_admin'] } } : {}),
      };
      return json(res, 200, {
        access_token: jwt(claims),
        id_token: jwt(claims),
        token_type: 'Bearer',
        expires_in: 300,
      });
    }

    return json(res, 404, { error: 'not_found' });
  } catch {
    return json(res, 400, { error: 'invalid_request' });
  }
};

const certPath = process.env.KEYCLOAK_TLS_CERT;
const keyPath = process.env.KEYCLOAK_TLS_KEY;
if (Boolean(certPath) !== Boolean(keyPath)) throw new Error('verify_tls_pair_required');
const server = certPath && keyPath
  ? https.createServer({ cert: readFileSync(certPath), key: readFileSync(keyPath) }, handleRequest)
  : http.createServer(handleRequest);

server.listen(port, '0.0.0.0');
