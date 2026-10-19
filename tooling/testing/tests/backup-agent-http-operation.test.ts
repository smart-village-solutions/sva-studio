import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const backupModuleUrl = (name: string): string =>
  pathToFileURL(resolve(import.meta.dirname, '../../../deploy/backup-agent', name)).href;

type RuntimeConfig = {
  operationState: { active: boolean; terminalRequests: Set<string> };
  routePaths: { request: string; restore: string; capability: string };
  targets: Record<'staging' | 'prod', { host: string }>;
  deriveWasteDatabaseName: (instanceId: string) => string;
};
type Execution = (request: Record<string, unknown>) => Promise<void>;
type ServerModule = { createBackupAgentServer: () => import('node:http').Server };
type Authorization = {
  canonicalRequest: (request: unknown) => string;
  canonicalRestoreRequest: (request: unknown) => string;
  verifyOidc: (token: string, environment: string, action: string) => Promise<void>;
};
type RuntimeIO = {
  readSecret: (name: string) => Promise<string>;
  objectExists: (target: unknown, key: string) => Promise<boolean>;
  uploadJson: (target: unknown, key: string, value: unknown) => Promise<void>;
};

import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const { createBackupAgentServer } = (await import(
  backupModuleUrl('http-server.mjs')
)) as ServerModule;
const { operationState, routePaths, targets } = (await import(
  backupModuleUrl('runtime-config.mjs')
)) as RuntimeConfig;
const { canonicalRequest, canonicalRestoreRequest, verifyOidc } = (await import(
  backupModuleUrl('request-authorization.mjs')
)) as Authorization;
const { objectExists, readSecret, uploadJson } = (await import(
  backupModuleUrl('runtime-io.mjs')
)) as RuntimeIO;
const { executeBackupForIntegration } = (await import(backupModuleUrl('backup-execution.mjs'))) as {
  executeBackupForIntegration: Execution;
};
const { executeRestoreForIntegration } = (await import(
  backupModuleUrl('restore-execution.mjs')
)) as { executeRestoreForIntegration: Execution };
const { executeWasteImportForIntegration } = (await import(
  backupModuleUrl('waste-import-execution.mjs')
)) as { executeWasteImportForIntegration: Execution };

vi.mock('../../../deploy/backup-agent/request-authorization.mjs', async (original) => ({
  ...(await original<Authorization>()),
  verifyOidc: vi.fn(async () => undefined),
}));
vi.mock('../../../deploy/backup-agent/runtime-io.mjs', async (original) => ({
  ...(await original<RuntimeIO>()),
  readSecret: vi.fn(async () => 'fixture-signing-key'),
  objectExists: vi.fn(async () => false),
  uploadJson: vi.fn(async () => undefined),
}));
vi.mock('../../../deploy/backup-agent/backup-execution.mjs', () => ({
  executeBackupForIntegration: vi.fn(),
}));
vi.mock('../../../deploy/backup-agent/restore-execution.mjs', () => ({
  executeRestoreForIntegration: vi.fn(),
}));
vi.mock('../../../deploy/backup-agent/waste-import-execution.mjs', () => ({
  executeWasteImportForIntegration: vi.fn(),
}));

const backupRequest = () => ({
  version: 1,
  action: 'backup-and-verify',
  requestId: 'fixture-12345678',
  environment: 'staging',
  deployImageDigest: `sha256:${'a'.repeat(64)}`,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});
const restoreRequest = () => ({
  version: 1,
  action: 'restore-and-verify-v1',
  requestId: 'fixture-restore-123',
  environment: 'staging',
  maintenanceWindowReference: 'INC-42',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  sourceObjectKey: `staging/archive/${'a'.repeat(64)}/fixture.dump`,
  sourceSha256: 'b'.repeat(64),
});

const send = async (
  body: unknown,
  options: { restore?: boolean; host?: string; bearer?: string | null; signature?: string } = {}
) => {
  const record = body as ReturnType<typeof backupRequest>;
  const canonical = options.restore ? canonicalRestoreRequest(record) : canonicalRequest(record);
  const signature =
    options.signature ??
    createHmac('sha256', 'fixture-signing-key').update(canonical).digest('hex');
  const server = createBackupAgentServer();
  return new Promise<{ status: number; body: unknown }>((resolve) => {
    const response = {
      status: 0,
      writeHead(status: number) {
        response.status = status;
      },
      end(value: string) {
        resolve({ status: response.status, body: JSON.parse(value) });
      },
    };
    const headers = {
      host:
        options.host ??
        targets[record.environment as keyof typeof targets]?.host ??
        targets.staging.host,
      ...(options.bearer === null
        ? {}
        : { authorization: options.bearer ?? 'Bearer fixture-oidc' }),
      [options.restore ? 'x-restore-request-signature' : 'x-backup-request-signature']: signature,
    };
    server.emit(
      'request',
      {
        method: 'POST',
        url: options.restore ? routePaths.restore : routePaths.request,
        headers,
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(body));
        },
      },
      response
    );
  });
};

beforeEach(() => {
  for (const mock of [
    verifyOidc,
    readSecret,
    objectExists,
    uploadJson,
    executeBackupForIntegration,
    executeRestoreForIntegration,
    executeWasteImportForIntegration,
  ]) {
    if (!vi.isMockFunction(mock))
      throw new Error('External IO must be mocked before HTTP requests');
  }
  vi.clearAllMocks();
  vi.mocked(verifyOidc).mockResolvedValue(undefined);
  vi.mocked(readSecret).mockResolvedValue('fixture-signing-key');
  vi.mocked(objectExists).mockResolvedValue(false);
  vi.mocked(uploadJson).mockResolvedValue(undefined);
  operationState.active = false;
  operationState.terminalRequests.clear();
});

describe('backup HTTP operation authorization and slot boundaries', () => {
  it('validates request and host before authentication', async () => {
    expect(await send({})).toEqual({ status: 400, body: { error: 'invalid_request' } });
    expect(await send(backupRequest(), { host: 'foreign.invalid' })).toEqual({
      status: 400,
      body: { error: 'invalid_request' },
    });
    expect(verifyOidc).not.toHaveBeenCalled();
    expect(readSecret).not.toHaveBeenCalled();
  });

  it('checks Bearer, OIDC, then signature without changing operation error statuses', async () => {
    expect((await send(backupRequest(), { bearer: null })).status).toBe(401);
    expect(verifyOidc).not.toHaveBeenCalled();
    vi.mocked(verifyOidc).mockRejectedValueOnce(new Error('oidc_signature_invalid'));
    expect(await send(backupRequest())).toEqual({
      status: 400,
      body: { error: 'invalid_request' },
    });
    expect(readSecret).not.toHaveBeenCalled();
    expect((await send(backupRequest(), { signature: 'invalid' })).status).toBe(401);
    expect(readSecret).not.toHaveBeenCalled();
    expect((await send(backupRequest(), { signature: '0'.repeat(64) })).status).toBe(401);
    expect(readSecret).toHaveBeenCalledOnce();
    expect(objectExists).not.toHaveBeenCalled();
  });

  it('authenticates before busy and terminal replay checks', async () => {
    const body = backupRequest();
    operationState.active = true;
    expect(await send(body)).toEqual({ status: 409, body: { error: 'agent_busy' } });
    expect(verifyOidc).toHaveBeenCalledOnce();
    expect(readSecret).toHaveBeenCalledOnce();
    expect(objectExists).not.toHaveBeenCalled();
    operationState.active = false;
    operationState.terminalRequests.add(body.requestId);
    expect(await send(body)).toEqual({ status: 409, body: { error: 'request_replayed' } });
    expect(objectExists).not.toHaveBeenCalled();
  });

  it('releases a slot for persisted replay and failed request upload', async () => {
    vi.mocked(objectExists).mockResolvedValueOnce(true);
    expect((await send(backupRequest())).status).toBe(409);
    expect(operationState.active).toBe(false);
    expect(uploadJson).not.toHaveBeenCalled();
    vi.mocked(uploadJson).mockRejectedValueOnce(new Error('upload-failed'));
    expect((await send(backupRequest())).status).toBe(400);
    expect(operationState.active).toBe(false);
    expect(executeBackupForIntegration).not.toHaveBeenCalled();
  });

  it('preserves the existing slot boundary if persisted replay lookup itself throws', async () => {
    vi.mocked(objectExists).mockRejectedValueOnce(new Error('lookup-failed'));
    expect((await send(backupRequest())).status).toBe(400);
    expect(operationState.active).toBe(true);
    expect(uploadJson).not.toHaveBeenCalled();
  });

  it('persists the signed request before dispatching the selected operation', async () => {
    const trace: string[] = [];
    vi.mocked(verifyOidc).mockImplementation(async () => {
      trace.push('oidc');
    });
    vi.mocked(readSecret).mockImplementation(async () => {
      trace.push('signature-key');
      return 'fixture-signing-key';
    });
    vi.mocked(objectExists).mockImplementation(async () => {
      trace.push('persisted-replay');
      return false;
    });
    vi.mocked(uploadJson).mockImplementation(async () => {
      trace.push('request-upload');
    });
    vi.mocked(executeBackupForIntegration).mockImplementation(async () => {
      trace.push('execute');
    });
    const body = backupRequest();
    expect(await send(body)).toEqual({ status: 202, body: { requestId: body.requestId } });
    expect(trace).toEqual([
      'oidc',
      'signature-key',
      'persisted-replay',
      'request-upload',
      'execute',
    ]);
    expect(operationState.active).toBe(true);
    expect(executeBackupForIntegration).toHaveBeenCalledExactlyOnceWith(body);
  });

  it('keeps restore and waste-import dispatch separate', async () => {
    const restore = restoreRequest();
    expect((await send(restore, { restore: true })).status).toBe(202);
    expect(executeRestoreForIntegration).toHaveBeenCalledExactlyOnceWith(restore);
    operationState.active = false;
    const waste = {
      ...restoreRequest(),
      action: 'import-waste-data-v1',
      environment: 'prod',
      database: 'waste',
      tenantInstanceId: 'bb-prignitz',
      sourceObjectKey: 'prod/waste/bb-prignitz/import/2026-08-09/waste-data-pg16.sql',
      sourceSha256: 'df75392bee510be71444eec28914f704c0917a5a59ac46e6380ef050c3ffd5dc',
    };
    expect((await send(waste, { restore: true })).status).toBe(202);
    expect(executeWasteImportForIntegration).toHaveBeenCalledExactlyOnceWith(waste);
  });

  it('rejects oversized bodies before authorization', async () => {
    expect((await send({ ...backupRequest(), padding: 'x'.repeat(16_384) })).status).toBe(400);
    expect(verifyOidc).not.toHaveBeenCalled();
  });
});
