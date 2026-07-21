import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { StudioApiError, type StudioApiClient } from './api-client.js';
import { schemas } from './contracts.js';
import { createStudioMcpServer } from './index.js';

const config = {
  baseUrl: 'https://studio.example', tokenUrl: 'https://id.example/token', clientId: 'mcp', clientSecret: 'secret',
  readTimeoutMs: 1_000, mutationTimeoutMs: 1_000, processTimeoutMs: 1_000, tokenTimeoutMs: 1_000, diagnosisTimeoutMs: 1_000,
};

describe('Studio MCP tools', () => {
  it('advertises the complete tool surface with risk annotations', async () => {
    const api: StudioApiClient = { request: vi.fn().mockResolvedValue({ data: [] }) };
    const server = createStudioMcpServer(api, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(25);
    expect(tools.tools.find((tool) => tool.name === 'studio_instances_list')?.annotations?.readOnlyHint).toBe(true);
    expect(tools.tools.find((tool) => tool.name === 'studio_instance_archive')?.annotations?.destructiveHint).toBe(true);
    expect(tools.tools.find((tool) => tool.name === 'studio_instance_critical_action_prepare')?.annotations?.destructiveHint).toBe(false);
    expect(tools.tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
    expect(tools.tools.every((tool) => tool.outputSchema?.type === 'object')).toBe(true);
    await Promise.all([client.close(), server.close()]);
  });

  it('returns API failures as structured domain results without protocol failure', async () => {
    const { StudioApiError } = await import('./api-client.js');
    const server = createStudioMcpServer({ request: vi.fn().mockRejectedValue(
      new StudioApiError(409, { code: 'conflict', message: 'exists', clientSecret: 'leak' }, 'req-1', 'idem-1')
    ) }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({ name: 'studio_instance_get', arguments: { instanceId: 'demo' } });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(response.content).toEqual([{ type: 'text', text: 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.' }]);
    expect(JSON.stringify(response)).not.toContain('leak');
    await Promise.all([client.close(), server.close()]);
  });

  it('reports local schema failures as MCP tool errors', async () => {
    const { UpstreamSchemaError } = await import('./api-client.js');
    const server = createStudioMcpServer({ request: vi.fn().mockRejectedValue(new UpstreamSchemaError()) }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({ name: 'studio_instance_get', arguments: { instanceId: 'demo' } });
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toBeUndefined();
    await Promise.all([client.close(), server.close()]);
  });

  it('returns transport failures through the structured MCP error contract', async () => {
    const server = createStudioMcpServer({ request: vi.fn().mockRejectedValue(new TypeError('network unavailable')) }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_get', arguments: { instanceId: 'demo' } });

    expect(response.isError).not.toBe(true);
    expect(response.content).toEqual([{ type: 'text', text: 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.' }]);
    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'internal_unclassified', category: 'internal', retryable: false },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('calls create with idempotency and returns structured content', async () => {
    const request = vi.fn().mockResolvedValue({ data: { instanceId: 'demo' } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({ name: 'studio_instances_create', arguments: {
      instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio',
    } });
    expect(response.structuredContent).toMatchObject({ ok: true });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ instanceId: 'demo' }),
      idempotencyKey: expect.any(String),
    }));
    await Promise.all([client.close(), server.close()]);
  });

  it('orchestrates a create process and stops before challenge-protected activation', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'requested',
        keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: {
      mode: 'create', instanceId: 'demo', create: {
        instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio',
      },
    } });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: false, status: 'awaiting_human_action', nextAction: { actionId: 'instance.status.activate' } },
    });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo' }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' }));
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/execute' }));
    expect(request).toHaveBeenNthCalledWith(6, expect.objectContaining({ path: '/api/v1/iam/instances/demo/tenant-iam/roles/reconcile' }));
    expect(request).toHaveBeenNthCalledWith(7, expect.objectContaining({ path: '/api/v1/iam/instances/demo/tenant-iam/access-probe' }));
    expect(request).toHaveBeenNthCalledWith(8, expect.objectContaining({ path: '/api/v1/iam/instances/demo' }));
    await Promise.all([client.close(), server.close()]);
  });

  it('continues a create process after a conflict from an earlier attempt', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new StudioApiError(409, { code: 'conflict' }, 'req-1'))
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'active', assignedModules: [], keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } }, moduleIamStatus: { overall: { status: 'unknown' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: {
      mode: 'create', instanceId: 'demo', create: {
        instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio',
      },
    } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { completed: true, status: 'completed' } });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo' }));
    await Promise.all([client.close(), server.close()]);
  });

  it('returns process failures through the structured error contract', async () => {
    const { StudioApiError } = await import('./api-client.js');
    const request = vi.fn().mockRejectedValue(new StudioApiError(409, { code: 'conflict' }, 'req-1', 'idem-1'));
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: {
      mode: 'create', instanceId: 'demo', create: {
        instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio',
      },
    } });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ ok: false, error: { code: 'conflict' } });
    await Promise.all([client.close(), server.close()]);
  });

  it('adapts modules and only reports completion for an active, ready instance', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { assigned: true } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { bootstrapped: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'active',
        keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } },
        moduleIamStatus: { overall: { status: 'ready' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: {
      mode: 'adapt', instanceId: 'demo', moduleIds: ['news'], idempotencyKey: 'x'.repeat(200),
    } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { completed: true, status: 'completed' } });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/assign' }));
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/bootstrap-admin-structure' }));
    expect(request.mock.calls.map(([input]) => input.idempotencyKey).filter(Boolean).every((key) => key.length <= 200)).toBe(true);
    await Promise.all([client.close(), server.close()]);
  });

  it('uses reconcile and the resulting run for repairs', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { overallStatus: 'planned' } })
      .mockResolvedValueOnce({ data: { latestKeycloakProvisioningRun: { id: 'run-1' } } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'requested', keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } }, moduleIamStatus: { overall: { status: 'ready' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: { mode: 'repair', instanceId: 'demo' } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { status: 'awaiting_human_action' } });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/reconcile' }));
    await Promise.all([client.close(), server.close()]);
  });

  it('blocks completion when a present module-IAM status is malformed', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'active', assignedModules: ['news'], keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } }, moduleIamStatus: {},
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: { mode: 'adapt', instanceId: 'demo' } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { completed: false, status: 'blocked' } });
    await Promise.all([client.close(), server.close()]);
  });

  it('does not require module IAM readiness when no modules are assigned', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'active', keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } }, moduleIamStatus: { overall: { status: 'unknown' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: { mode: 'adapt', instanceId: 'demo' } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { completed: true, status: 'completed' } });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' }));
    await Promise.all([client.close(), server.close()]);
  });

  it('repeats module IAM steps after modules were assigned by an earlier attempt', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { bootstrapped: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({ data: {
        instanceId: 'demo', status: 'active', keycloakStatus: { realmExists: true, clientExists: true },
        tenantIamStatus: { overall: { status: 'ready' } }, moduleIamStatus: { overall: { status: 'ready' } },
      } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({ name: 'studio_instance_process', arguments: {
      mode: 'adapt', instanceId: 'demo', moduleIds: ['news'],
    } });

    expect(response.structuredContent).toMatchObject({ ok: true, data: { completed: true, status: 'completed' } });
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/bootstrap-admin-structure', body: { moduleIds: ['news'] } }));
    await Promise.all([client.close(), server.close()]);
  });

  it('rejects unknown fields in a process create payload', () => {
    expect(schemas.process.safeParse({
      mode: 'create', instanceId: 'demo', create: {
        instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio', unexpected: true,
      },
    }).success).toBe(false);
  });

  it('prepares and executes critical actions with the required confirmation data', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await client.callTool({ name: 'studio_instance_critical_action_prepare', arguments: {
      instanceId: 'demo', actionId: 'instance.status.archive',
    } });
    const response = await client.callTool({ name: 'studio_instance_archive', arguments: {
      instanceId: 'demo', challengeId: 'challenge-1', confirmationPhrase: 'ARCHIVE demo', idempotencyKey: 'request-1',
    } });
    expect(response.structuredContent).toMatchObject({ ok: true });
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      path: '/api/v1/iam/instances/demo/actions/instance.status.archive/confirmation', method: 'POST',
    }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/api/v1/iam/instances/demo/archive', method: 'POST', idempotencyKey: 'request-1',
      confirmationChallengeId: 'challenge-1', confirmationPhrase: 'ARCHIVE demo', body: { status: 'archived' },
    }));
    await Promise.all([client.close(), server.close()]);
  });

  it('maps audit filters, prevents reconcile rotation, and executes dedicated secret rotation', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await client.callTool({ name: 'studio_instances_audit', arguments: { instanceIds: ['first', 'second'] } });
    await client.callTool({ name: 'studio_instance_reconcile', arguments: { instanceId: 'demo', rotateClientSecret: true } });
    await client.callTool({ name: 'studio_instance_secret_rotate', arguments: {
      instanceId: 'demo', challengeId: 'challenge-1', confirmationPhrase: 'ROTATE SECRET FOR demo', idempotencyKey: 'request-1',
    } });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ query: { instanceId: ['first', 'second'], includeOnlyActive: undefined } }));
    expect(request).toHaveBeenNthCalledWith(2, expect.objectContaining({
      path: '/api/v1/iam/instances/demo/keycloak/reconcile', body: {},
    }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({
      path: '/api/v1/iam/instances/demo/keycloak/rotate-secret', body: { intent: 'rotate_client_secret' },
    }));
    await Promise.all([client.close(), server.close()]);
  });

  it('maps the remaining audit, provisioning, diagnostic, module, and update tools to their API contracts', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({ name: 'studio_instances_list', arguments: { status: 'active' } });
    await client.callTool({ name: 'studio_instance_audit', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_keycloak_status', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_keycloak_preflight', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_provisioning_run_get', arguments: { instanceId: 'demo', runId: 'run-1' } });
    await client.callTool({ name: 'studio_instance_update', arguments: {
      instanceId: 'demo', displayName: 'Demo', parentDomain: 'example.org', realmMode: 'new', authRealm: 'demo', authClientId: 'studio',
    } });
    await client.callTool({ name: 'studio_instance_provisioning_plan', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_provisioning_execute', arguments: { instanceId: 'demo', intent: 'provision' } });
    await client.callTool({ name: 'studio_instance_module_assign', arguments: { instanceId: 'demo', moduleId: 'news' } });
    await client.callTool({ name: 'studio_instance_iam_baseline_seed', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_tenant_iam_access_probe', arguments: { instanceId: 'demo' } });
    await client.callTool({ name: 'studio_instance_admin_bootstrap', arguments: { instanceId: 'demo', moduleIds: ['news'] } });
    await client.callTool({ name: 'studio_instance_module_revoke', arguments: {
      instanceId: 'demo', moduleId: 'news', challengeId: 'challenge-1', confirmationPhrase: 'REVOKE news FROM demo', idempotencyKey: 'request-1',
    } });

    expect(request).toHaveBeenCalledTimes(13);
    expect(request).toHaveBeenNthCalledWith(1, expect.objectContaining({ path: '/api/v1/iam/instances', query: { status: 'active' } }));
    expect(request).toHaveBeenNthCalledWith(3, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/status' }));
    expect(request).toHaveBeenNthCalledWith(4, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/preflight' }));
    expect(request).toHaveBeenNthCalledWith(5, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/runs/run-1' }));
    expect(request).toHaveBeenNthCalledWith(6, expect.objectContaining({ method: 'PATCH', path: '/api/v1/iam/instances/demo', body: expect.not.objectContaining({ instanceId: 'demo' }) }));
    expect(request).toHaveBeenNthCalledWith(8, expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/execute', body: { intent: 'provision' } }));
    expect(request).toHaveBeenNthCalledWith(9, expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/assign', body: { moduleId: 'news' } }));
    expect(request).toHaveBeenNthCalledWith(11, expect.objectContaining({ path: '/api/v1/iam/instances/demo/tenant-iam/access-probe', body: {} }));
    expect(request).toHaveBeenNthCalledWith(13, expect.objectContaining({
      path: '/api/v1/iam/instances/demo/modules/revoke', body: { moduleId: 'news', confirmation: 'REVOKE' },
      confirmationChallengeId: 'challenge-1', confirmationPhrase: 'REVOKE news FROM demo',
    }));
    await Promise.all([client.close(), server.close()]);
  });
});
