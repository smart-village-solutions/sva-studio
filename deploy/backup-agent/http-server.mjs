import { executeRestoreForIntegration } from './restore-execution.mjs';
import { executeWasteImportForIntegration } from './waste-import-execution.mjs';
import { executeBackupForIntegration } from './backup-execution.mjs';
import {
  canonicalRequest,
  canonicalRestoreRequest,
  validRequest,
  validRestoreRequest,
  verifyOidc,
} from './request-authorization.mjs';
import {
  operationState,
  routePaths,
  targets,
  validRequestHost,
  resolveCapabilityEnvironment,
  readBackupAgentRevision,
  controlKeysFor,
  restoreControlKeysFor,
} from './runtime-config.mjs';
import { readSecret, uploadJson, objectExists } from './runtime-io.mjs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const maxBodyBytes = 16_384;

const readBody = async (incoming) => {
  const chunks = [];
  let length = 0;
  for await (const chunk of incoming) {
    length += chunk.length;
    if (length > maxBodyBytes) throw new Error('request_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const respond = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body)}\n`);
};

const respondCapabilities = async (incoming, response) => {
  try {
    const environment = resolveCapabilityEnvironment(incoming.url, incoming.headers.host);
    if (environment !== 'staging' && environment !== 'prod')
      return respond(response, 400, { error: 'invalid_request' });
    if (!validRequestHost(environment, incoming.headers.host))
      return respond(response, 400, { error: 'invalid_request' });
    const auth = incoming.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer '))
      return respond(response, 401, { error: 'unauthorized' });
    await verifyOidc(auth.slice('Bearer '.length), environment, 'backup-and-verify');
    const agentRevision = readBackupAgentRevision();
    if (!agentRevision) return respond(response, 503, { error: 'agent_misconfigured' });
    return respond(response, 200, {
      protocolVersions: [2],
      agentRevision,
      databaseTargets: ['ssf', 'studio', 'waste'],
      resultFields: [
        'bytes',
        'database',
        'deployImageDigest',
        'environment',
        'objectKey',
        'requestId',
        'sha256',
        'status',
        'steps',
      ],
      wasteInventory: true,
    });
  } catch {
    return respond(response, 401, { error: 'unauthorized' });
  }
};

const authorizeOperation = async (incoming, response, isBackup) => {
  const request = await readBody(incoming);
  if (isBackup ? !validRequest(request) : !validRestoreRequest(request))
    return respond(response, 400, { error: 'invalid_request' });
  if (!validRequestHost(request.environment, incoming.headers.host))
    return respond(response, 400, { error: 'invalid_request' });
  const auth = incoming.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer '))
    return respond(response, 401, { error: 'unauthorized' });
  await verifyOidc(auth.slice('Bearer '.length), request.environment, request.action);
  const signature =
    incoming.headers[isBackup ? 'x-backup-request-signature' : 'x-restore-request-signature'];
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/u.test(signature))
    return respond(response, 401, { error: 'unauthorized' });
  const keyFile = isBackup
    ? targets[request.environment].signingKeyFile
    : targets[request.environment].restoreSigningKeyFile;
  const key = await readSecret(keyFile);
  const canonical = isBackup ? canonicalRequest(request) : canonicalRestoreRequest(request);
  const actual = Buffer.from(createHmac('sha256', key).update(canonical).digest('hex'), 'hex');
  const expected = Buffer.from(signature, 'hex');
  if (!timingSafeEqual(actual, expected)) return respond(response, 401, { error: 'unauthorized' });
  return request;
};

const respondOperation = async (incoming, response, isBackup) => {
  try {
    const request = await authorizeOperation(incoming, response, isBackup);
    if (!request) return;
    if (operationState.active) return respond(response, 409, { error: 'agent_busy' });
    if (operationState.terminalRequests.has(request.requestId))
      return respond(response, 409, { error: 'request_replayed' });
    operationState.active = true;
    const target = targets[request.environment];
    const requestKey = isBackup
      ? controlKeysFor(request.requestId).request
      : restoreControlKeysFor(request.requestId).request;
    if (await objectExists(target, requestKey)) {
      operationState.active = false;
      return respond(response, 409, { error: 'request_replayed' });
    }
    try {
      await uploadJson(target, requestKey, request);
    } catch (error) {
      operationState.active = false;
      throw error;
    }
    if (isBackup) void executeBackupForIntegration(request);
    else if (request.action === 'import-waste-data-v1')
      void executeWasteImportForIntegration(request);
    else void executeRestoreForIntegration(request);
    return respond(response, 202, { requestId: request.requestId });
  } catch {
    return respond(response, 400, { error: 'invalid_request' });
  }
};

export const createBackupAgentServer = () =>
  createServer(async (incoming, response) => {
    if (incoming.method === 'GET' && incoming.url === '/health/live')
      return respond(response, 200, { status: 'ok' });
    if (
      incoming.method === 'GET' &&
      new URL(incoming.url ?? '', 'http://backup-agent.internal').pathname === routePaths.capability
    ) {
      return respondCapabilities(incoming, response);
    }
    const isBackup = incoming.url === routePaths.request;
    const isRestore = incoming.url === routePaths.restore;
    if (incoming.method !== 'POST' || (!isBackup && !isRestore))
      return respond(response, 404, { error: 'not_found' });
    return respondOperation(incoming, response, isBackup);
  });
