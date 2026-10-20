import { createHash } from 'node:crypto';

const encodePathSegment = (value) => encodeURIComponent(value);

const secretFingerprint = (secret) =>
  `sha256:${createHash('sha256').update(secret).digest('hex').slice(0, 16)}`;

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message =
      typeof body === 'string' ? body.slice(0, 220) : JSON.stringify(body).slice(0, 220);
    const error = new Error(`HTTP ${response.status} ${response.statusText}: ${message}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
};

export const getAdminToken = async ({ adminClientId, adminClientSecret, adminRealm, baseUrl }) => {
  const body = new URLSearchParams({
    client_id: adminClientId,
    client_secret: adminClientSecret,
    grant_type: 'client_credentials',
  });
  const token = await requestJson(
    `${baseUrl}/realms/${encodePathSegment(adminRealm)}/protocol/openid-connect/token`,
    { method: 'POST', body }
  );
  if (!token?.access_token) {
    throw new Error('Keycloak Token-Endpoint lieferte kein access_token.');
  }
  return token.access_token;
};

const getClientByClientId = async ({ baseUrl, realm, token, clientId }) => {
  const clients = await requestJson(
    `${baseUrl}/admin/realms/${encodePathSegment(realm)}/clients?clientId=${encodeURIComponent(clientId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return Array.isArray(clients)
    ? clients.find((client) => client.clientId === clientId)
    : undefined;
};

const getClientSecret = async ({ baseUrl, realm, token, clientUuid }) =>
  requestJson(
    `${baseUrl}/admin/realms/${encodePathSegment(realm)}/clients/${encodePathSegment(clientUuid)}/client-secret`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

const validateClientCredentials = async ({ baseUrl, realm, clientId, secret }) => {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: secret,
    grant_type: 'client_credentials',
  });
  const response = await fetch(
    `${baseUrl}/realms/${encodePathSegment(realm)}/protocol/openid-connect/token`,
    { method: 'POST', body }
  );
  if (response.ok) {
    return { httpStatus: response.status, status: 'ok' };
  }
  const text = await response.text().catch(() => '');
  const reason = text.includes('invalid_client')
    ? 'invalid_client'
    : text.includes('unauthorized_client')
      ? 'unauthorized_client'
      : response.status === 404
        ? 'not_found'
        : `http_${response.status}`;
  return { httpStatus: response.status, reason, status: 'failed' };
};

export const inspectClient = async ({ baseUrl, clientId, realm, reveal, token }) => {
  try {
    const client = await getClientByClientId({ baseUrl, realm, token, clientId });
    if (!client) {
      return { clientId, realm, status: 'missing_client' };
    }

    if (client.publicClient === true) {
      return {
        clientId,
        enabled: client.enabled === true,
        publicClient: true,
        realm,
        serviceAccountsEnabled: client.serviceAccountsEnabled === true,
        status: 'public_client_no_secret',
        uuid: client.id,
      };
    }

    const secretResponse = await getClientSecret({ baseUrl, realm, token, clientUuid: client.id });
    const secret = typeof secretResponse?.value === 'string' ? secretResponse.value : '';
    const validation = secret
      ? client.serviceAccountsEnabled === true
        ? await validateClientCredentials({ baseUrl, realm, clientId, secret })
        : { reason: 'service_account_disabled', status: 'skipped' }
      : { status: 'missing_secret' };

    return {
      clientId,
      enabled: client.enabled === true,
      fingerprint: secret ? secretFingerprint(secret) : '',
      length: secret.length,
      publicClient: false,
      realm,
      secret: reveal ? secret : undefined,
      serviceAccountsEnabled: client.serviceAccountsEnabled === true,
      status: secret ? 'secret_read' : 'missing_secret',
      tokenValidation: validation,
      uuid: client.id,
    };
  } catch (error) {
    return {
      clientId,
      error: error instanceof Error ? error.message : String(error),
      httpStatus: error?.status,
      realm,
      status: 'error',
    };
  }
};
