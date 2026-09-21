import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { StudioApiError, type StudioApiClient } from './api-client.js';
import { schemas } from './contracts.js';
import { createStudioMcpServer } from './index.js';

const config = {
  baseUrl: 'https://studio.example',
  tokenUrl: 'https://id.example/token',
  clientId: 'mcp',
  clientSecret: 'secret',
  readTimeoutMs: 1_000,
  mutationTimeoutMs: 1_000,
  processTimeoutMs: 1_000,
  tokenTimeoutMs: 1_000,
  diagnosisTimeoutMs: 1_000,
};

const completeTenantCreateFields = {
  tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
  tenantAdminBootstrap: {
    username: 'tenant-admin',
    email: 'tenant-admin@example.org',
    firstName: 'Tenant',
    lastName: 'Admin',
  },
};
const confirmedPlanFingerprint = 'a'.repeat(64);

describe('Studio MCP tools', () => {
  it('advertises the complete tool surface with risk annotations', async () => {
    const api: StudioApiClient = { request: vi.fn().mockResolvedValue({ data: [] }) };
    const server = createStudioMcpServer(api, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(27);
    expect(
      tools.tools.find((tool) => tool.name === 'studio_instances_list')?.annotations?.readOnlyHint
    ).toBe(true);
    expect(
      tools.tools.find((tool) => tool.name === 'studio_keycloak_realms_list')?.annotations
        ?.readOnlyHint
    ).toBe(true);
    expect(
      tools.tools.find((tool) => tool.name === 'studio_instance_draft_readiness')?.annotations
        ?.readOnlyHint
    ).toBe(true);
    expect(
      tools.tools.find((tool) => tool.name === 'studio_instance_iam_roles_reconcile')
    ).toBeDefined();
    expect(
      tools.tools.find((tool) => tool.name === 'studio_instance_archive')?.annotations
        ?.destructiveHint
    ).toBe(true);
    expect(
      tools.tools.find((tool) => tool.name === 'studio_instance_critical_action_prepare')
        ?.annotations?.destructiveHint
    ).toBe(false);
    expect(tools.tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
    expect(tools.tools.every((tool) => tool.outputSchema?.type === 'object')).toBe(true);
    await Promise.all([client.close(), server.close()]);
  });

  it('returns API failures as structured domain results without protocol failure', async () => {
    const { StudioApiError } = await import('./api-client.js');
    const server = createStudioMcpServer(
      {
        request: vi
          .fn()
          .mockRejectedValue(
            new StudioApiError(
              409,
              { code: 'conflict', message: 'exists', clientSecret: 'leak' },
              'req-1',
              'idem-1'
            )
          ),
      },
      config
    );
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({
      name: 'studio_instance_get',
      arguments: { instanceId: 'demo' },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(response.content).toEqual([
      { type: 'text', text: 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.' },
    ]);
    expect(JSON.stringify(response)).not.toContain('leak');
    await Promise.all([client.close(), server.close()]);
  });

  it('reports local schema failures as MCP tool errors', async () => {
    const { UpstreamSchemaError } = await import('./api-client.js');
    const server = createStudioMcpServer(
      { request: vi.fn().mockRejectedValue(new UpstreamSchemaError()) },
      config
    );
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({
      name: 'studio_instance_get',
      arguments: { instanceId: 'demo' },
    });
    expect(response.isError).toBe(true);
    expect(response.structuredContent).toBeUndefined();
    await Promise.all([client.close(), server.close()]);
  });

  it('returns transport failures through the structured MCP error contract', async () => {
    const server = createStudioMcpServer(
      { request: vi.fn().mockRejectedValue(new TypeError('network unavailable')) },
      config
    );
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_get',
      arguments: { instanceId: 'demo' },
    });

    expect(response.isError).not.toBe(true);
    expect(response.content).toEqual([
      { type: 'text', text: 'Studio-Operation fehlgeschlagen. Details stehen im Fehlervertrag.' },
    ]);
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
    const response = await client.callTool({
      name: 'studio_instances_create',
      arguments: {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        realmMode: 'new',
        ...completeTenantCreateFields,
      },
    });
    expect(response.structuredContent).toMatchObject({ ok: true });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({ instanceId: 'demo' }),
        idempotencyKey: expect.any(String),
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('stops a create process before every unconfirmed Keycloak mutation', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { fingerprint: confirmedPlanFingerprint, steps: [] } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        completed: false,
        status: 'awaiting_human_action',
        currentStep: 'keycloak_plan_confirmation',
        idempotencyKey: expect.any(String),
        nextAction: { actionId: 'instance.keycloak.plan.confirm' },
      },
    });
    expect(request).toHaveBeenCalledTimes(4);
    expect(request).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/plan' })
    );
    expect(request.mock.calls.map(([value]) => value.path)).not.toContain(
      '/api/v1/iam/instances/demo/keycloak/execute'
    );
    await Promise.all([client.close(), server.close()]);
  });

  it.each([
    [
      'completed parent provisioning',
      { state: 'awaiting_activation', nextAction: { action: 'instance.status.activate' } },
      'awaiting_human_action',
      'activation',
    ],
    [
      'incomplete parent provisioning',
      { state: 'provisioning_waiting', nextAction: { action: 'instance.readiness.refresh' } },
      'blocked',
      'doctor_validation',
    ],
  ] as const)(
    'continues the confirmed create plan and respects %s',
    async (_case, provisioningReadiness, expectedStatus, expectedStep) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
        .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
        .mockResolvedValueOnce({ data: { seeded: true } })
        .mockResolvedValueOnce({ data: { fingerprint: confirmedPlanFingerprint, steps: [] } })
        .mockResolvedValueOnce({ data: { id: 'run-1' } })
        .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
        .mockResolvedValueOnce({ data: { outcome: 'success' } })
        .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
        .mockResolvedValueOnce({
          data: {
            instanceId: 'demo',
            status: 'requested',
            assignedModules: [],
            keycloakStatus: { realmExists: true, clientExists: true },
            tenantIamStatus: { overall: { status: 'ready' } },
            moduleIamStatus: { overall: { status: 'unknown' } },
            provisioningReadiness,
          },
        });
      const server = createStudioMcpServer({ request }, config);
      const client = new Client({ name: 'test-client', version: '1' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

      const response = await client.callTool({
        name: 'studio_instance_process',
        arguments: {
          mode: 'create',
          instanceId: 'demo',
          planFingerprint: confirmedPlanFingerprint,
          create: {
            instanceId: 'demo',
            displayName: 'Demo',
            parentDomain: 'example.org',
            realmMode: 'new',
            authRealm: 'demo',
            authClientId: 'sva-studio-login',
            ...completeTenantCreateFields,
          },
        },
      });

      expect(response.structuredContent).toMatchObject({
        ok: true,
        data: {
          status: expectedStatus,
          currentStep: expectedStep,
          completedSteps: expect.arrayContaining([
            'registry_created_or_idempotently_reused',
            'keycloak_provisioned',
            'tenant_iam_roles_reconciled',
          ]),
        },
      });
      expect(request).toHaveBeenNthCalledWith(
        5,
        expect.objectContaining({
          path: '/api/v1/iam/instances/demo/keycloak/execute',
          body: { intent: 'provision', planFingerprint: confirmedPlanFingerprint },
        })
      );
      await Promise.all([client.close(), server.close()]);
    }
  );

  it('follows the automated create run without starting a second Keycloak run', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          latestProvisioningRun: { id: 'parent-run-1', status: 'provisioning' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'validated',
          assignedModules: ['news'],
          latestProvisioningRun: {
            id: 'parent-run-1',
            status: 'validated',
            completedAt: '2026-09-21T10:00:00.000Z',
          },
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'ready' } },
          provisioningReadiness: {
            state: 'awaiting_activation',
            nextAction: { action: 'instance.status.activate' },
          },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'dialog.kassel.de',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          moduleIds: ['news'],
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        status: 'awaiting_human_action',
        currentStep: 'activation',
        idempotencyKey: expect.any(String),
        completedSteps: [
          'registry_created_or_idempotently_reused',
          'parent_provisioning_completed',
        ],
      },
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/v1/iam/instances',
        body: expect.objectContaining({ moduleIds: ['news'] }),
      })
    );
    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/execute' })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('uses the projected recovery action for a non-retryable parent failure', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          latestProvisioningRun: { id: 'parent-run-1', status: 'provisioning' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          latestProvisioningRun: {
            id: 'parent-run-1',
            status: 'failed',
            errorCode: 'invalid_snapshot',
          },
          provisioningReadiness: {
            nextAction: { action: 'instance.diagnose', retryClass: 'never' },
          },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'dialog.kassel.de',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        status: 'blocked',
        currentStep: 'parent_provisioning',
        idempotencyKey: expect.any(String),
        nextAction: { actionId: 'instance.diagnose' },
      },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('returns the generated key while automated parent provisioning is pending', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          latestProvisioningRun: { id: 'parent-run-1', status: 'provisioning' },
        },
      })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          latestProvisioningRun: { id: 'parent-run-1', status: 'provisioning' },
        },
      });
    const server = createStudioMcpServer({ request }, { ...config, processTimeoutMs: 0 });
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'dialog.kassel.de',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        status: 'in_progress',
        currentStep: 'parent_provisioning',
        idempotencyKey: expect.any(String),
      },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('returns the resume key while an ordinary Keycloak run is pending', async () => {
    const request = vi.fn().mockResolvedValueOnce({
      data: { id: 'run-1', overallStatus: 'running' },
    });
    const server = createStudioMcpServer({ request }, { ...config, processTimeoutMs: 0 });
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        keycloakRunId: 'run-1',
        idempotencyKey: 'resume-key-1',
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        status: 'in_progress',
        currentStep: 'keycloak_provisioning',
        idempotencyKey: 'resume-key-1',
      },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('returns the generated create key when provisioning yields no run id', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { fingerprint: confirmedPlanFingerprint, steps: [] } })
      .mockResolvedValueOnce({ data: {} });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        planFingerprint: confirmedPlanFingerprint,
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        status: 'blocked',
        currentStep: 'keycloak_provisioning',
        idempotencyKey: expect.any(String),
      },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('rejects a stale confirmed plan while preserving completed registry progress', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { fingerprint: 'b'.repeat(64), steps: [] } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        planFingerprint: confirmedPlanFingerprint,
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'keycloak_plan_fingerprint_stale' },
      progress: {
        currentStep: 'keycloak_plan',
        completedSteps: ['registry_created_or_idempotently_reused'],
        idempotencyKey: expect.any(String),
      },
    });
    expect(request.mock.calls.map(([value]) => value.path)).not.toContain(
      '/api/v1/iam/instances/demo/keycloak/execute'
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('preserves a generated create key when plan loading fails after registry creation', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo' } })
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockRejectedValueOnce(new StudioApiError(503, { code: 'keycloak_unavailable' }, 'req-plan'));
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'keycloak_unavailable' },
      progress: {
        currentStep: 'keycloak_plan',
        completedSteps: ['registry_created_or_idempotently_reused'],
        idempotencyKey: expect.any(String),
        nextAction: { actionId: 'instance.process.resume' },
      },
    });
    expect(request.mock.calls[0]?.[0].idempotencyKey).toBe(
      (response.structuredContent as { progress: { idempotencyKey: string } }).progress
        .idempotencyKey
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('keeps a generic create conflict blocked and reports resumable partial progress', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new StudioApiError(409, { code: 'conflict' }, 'req-1'))
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          assignedModules: [],
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'unknown' } },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'conflict', retryable: false },
      progress: { instanceId: 'demo', currentStep: 'registry_create', completedSteps: [] },
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo' })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('returns process failures through the structured error contract', async () => {
    const { StudioApiError } = await import('./api-client.js');
    const request = vi
      .fn()
      .mockRejectedValue(new StudioApiError(409, { code: 'conflict' }, 'req-1', 'idem-1'));
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          ...completeTenantCreateFields,
        },
      },
    });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
      progress: { instanceId: 'demo', currentStep: 'registry_create' },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('adapts modules and only reports completion for an active, ready instance', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { assigned: true } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { bootstrapped: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'ready' } },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        moduleIds: ['news'],
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
        idempotencyKey: 'x'.repeat(200),
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: true, status: 'completed' },
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/assign' })
    );
    expect(request).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/modules/bootstrap-admin-structure',
      })
    );
    expect(
      request.mock.calls
        .map(([input]) => input.idempotencyKey)
        .filter(Boolean)
        .every((key) => key.length <= 200)
    ).toBe(true);
    await Promise.all([client.close(), server.close()]);
  });

  it('skips a requested companion module returned by an earlier MCP assignment', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { assignedModules: ['categories', 'news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { bootstrapped: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'ready' } },
          assignedModules: ['categories', 'news'],
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        moduleIds: ['news', 'categories'],
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: true, status: 'completed' },
    });
    expect(
      request.mock.calls.filter(
        ([requestInput]) => requestInput.path === '/api/v1/iam/instances/demo/modules/assign'
      )
    ).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/modules/assign',
        body: { moduleId: 'news' },
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('uses reconcile and the resulting run for repairs', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { fingerprint: confirmedPlanFingerprint, steps: [] } })
      .mockResolvedValueOnce({ data: { overallStatus: 'planned' } })
      .mockResolvedValueOnce({ data: { latestKeycloakProvisioningRun: { id: 'run-1' } } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'requested',
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'ready' } },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: { mode: 'repair', instanceId: 'demo', planFingerprint: confirmedPlanFingerprint },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { status: 'awaiting_human_action' },
    });
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/plan' })
    );
    expect(request).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/keycloak/reconcile',
        body: { planFingerprint: confirmedPlanFingerprint },
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('blocks completion when a present module-IAM status is malformed', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          assignedModules: ['news'],
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: {},
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: false, status: 'blocked' },
    });
    await Promise.all([client.close(), server.close()]);
  });

  it('blocks the process when tenant role reconciliation is not fully successful', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({
        data: { outcome: 'partial_failure', requiresManualActionCount: 1 },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: {
        completed: false,
        status: 'blocked',
        currentStep: 'tenant_iam_roles_reconcile',
        idempotencyKey: expect.any(String),
        nextAction: { actionId: 'instance.iam.roles.reconcile' },
      },
    });
    expect(request).toHaveBeenCalledTimes(4);
    expect(request.mock.calls.map(([input]) => input.path)).not.toContain(
      '/api/v1/iam/instances/demo/tenant-iam/access-probe'
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('does not require module IAM readiness when no modules are assigned', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: [] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'unknown' } },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: true, status: 'completed' },
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('repeats module IAM steps after modules were assigned by an earlier attempt', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: { instanceId: 'demo', assignedModules: ['news'] } })
      .mockResolvedValueOnce({ data: { seeded: true } })
      .mockResolvedValueOnce({ data: { bootstrapped: true } })
      .mockResolvedValueOnce({ data: { id: 'run-1', overallStatus: 'succeeded' } })
      .mockResolvedValueOnce({ data: { outcome: 'success' } })
      .mockResolvedValueOnce({ data: { overall: { status: 'ready' } } })
      .mockResolvedValueOnce({
        data: {
          instanceId: 'demo',
          status: 'active',
          keycloakStatus: { realmExists: true, clientExists: true },
          tenantIamStatus: { overall: { status: 'ready' } },
          moduleIamStatus: { overall: { status: 'ready' } },
        },
      });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'studio_instance_process',
      arguments: {
        mode: 'adapt',
        instanceId: 'demo',
        moduleIds: ['news'],
        keycloakRunId: 'run-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });

    expect(response.structuredContent).toMatchObject({
      ok: true,
      data: { completed: true, status: 'completed' },
    });
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/modules/seed-iam-baseline' })
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/modules/bootstrap-admin-structure',
        body: { moduleIds: ['news'] },
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('rejects unknown fields in a process create payload', () => {
    expect(
      schemas.process.safeParse({
        mode: 'create',
        instanceId: 'demo',
        create: {
          instanceId: 'demo',
          displayName: 'Demo',
          parentDomain: 'example.org',
          realmMode: 'new',
          authRealm: 'demo',
          authClientId: 'sva-studio-login',
          unexpected: true,
        },
      }).success
    ).toBe(false);
  });

  it('prepares and executes critical actions with the required confirmation data', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await client.callTool({
      name: 'studio_instance_critical_action_prepare',
      arguments: {
        instanceId: 'demo',
        actionId: 'instance.status.archive',
      },
    });
    const response = await client.callTool({
      name: 'studio_instance_archive',
      arguments: {
        instanceId: 'demo',
        challengeId: 'challenge-1',
        confirmationPhrase: 'ARCHIVE demo',
        idempotencyKey: 'request-1',
      },
    });
    expect(response.structuredContent).toMatchObject({ ok: true });
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/actions/instance.status.archive/confirmation',
        method: 'POST',
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/archive',
        method: 'POST',
        idempotencyKey: 'request-1',
        confirmationChallengeId: 'challenge-1',
        confirmationPhrase: 'ARCHIVE demo',
        body: { status: 'archived' },
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('maps audit filters, prevents reconcile rotation, and executes dedicated secret rotation', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    await client.callTool({
      name: 'studio_instances_audit',
      arguments: { instanceIds: ['first', 'second'] },
    });
    await client.callTool({
      name: 'studio_instance_reconcile',
      arguments: { instanceId: 'demo', planFingerprint: confirmedPlanFingerprint },
    });
    await client.callTool({
      name: 'studio_instance_secret_rotate',
      arguments: {
        instanceId: 'demo',
        challengeId: 'challenge-1',
        confirmationPhrase: 'ROTATE SECRET FOR demo',
        idempotencyKey: 'request-1',
        planFingerprint: confirmedPlanFingerprint,
      },
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: { instanceId: ['first', 'second'], includeOnlyActive: undefined },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/keycloak/reconcile',
        body: { planFingerprint: confirmedPlanFingerprint },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/keycloak/rotate-secret',
        body: { intent: 'rotate_client_secret', planFingerprint: confirmedPlanFingerprint },
      })
    );
    await Promise.all([client.close(), server.close()]);
  });

  it('maps the remaining audit, provisioning, diagnostic, module, and update tools to their API contracts', async () => {
    const request = vi.fn().mockResolvedValue({ data: { accepted: true } });
    const server = createStudioMcpServer({ request }, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    await client.callTool({ name: 'studio_instances_list', arguments: { status: 'active' } });
    await client.callTool({
      name: 'studio_keycloak_realms_list',
      arguments: { search: 'demo', page: 2, pageSize: 20 },
    });
    await client.callTool({
      name: 'studio_instance_draft_readiness',
      arguments: {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        realmMode: 'new',
        ...completeTenantCreateFields,
      },
    });
    await client.callTool({ name: 'studio_instance_audit', arguments: { instanceId: 'demo' } });
    await client.callTool({
      name: 'studio_instance_keycloak_status',
      arguments: { instanceId: 'demo' },
    });
    await client.callTool({
      name: 'studio_instance_keycloak_preflight',
      arguments: { instanceId: 'demo' },
    });
    await client.callTool({
      name: 'studio_instance_provisioning_run_get',
      arguments: { instanceId: 'demo', runId: 'run-1' },
    });
    await client.callTool({
      name: 'studio_instance_update',
      arguments: {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'example.org',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio-login',
        ...completeTenantCreateFields,
      },
    });
    await client.callTool({
      name: 'studio_instance_provisioning_plan',
      arguments: { instanceId: 'demo' },
    });
    await client.callTool({
      name: 'studio_instance_provisioning_execute',
      arguments: {
        instanceId: 'demo',
        intent: 'provision',
        planFingerprint: confirmedPlanFingerprint,
      },
    });
    await client.callTool({
      name: 'studio_instance_module_assign',
      arguments: { instanceId: 'demo', moduleId: 'news' },
    });
    await client.callTool({
      name: 'studio_instance_iam_baseline_seed',
      arguments: { instanceId: 'demo' },
    });
    await client.callTool({
      name: 'studio_instance_tenant_iam_access_probe',
      arguments: { instanceId: 'demo' },
    });
    await client.callTool({
      name: 'studio_instance_iam_roles_reconcile',
      arguments: { instanceId: 'demo', planFingerprint: confirmedPlanFingerprint },
    });
    await client.callTool({
      name: 'studio_instance_admin_bootstrap',
      arguments: { instanceId: 'demo', moduleIds: ['news'] },
    });
    await client.callTool({
      name: 'studio_instance_module_revoke',
      arguments: {
        instanceId: 'demo',
        moduleId: 'news',
        challengeId: 'challenge-1',
        confirmationPhrase: 'REVOKE news FROM demo',
        idempotencyKey: 'request-1',
      },
    });

    expect(request).toHaveBeenCalledTimes(16);
    expect(request).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ path: '/api/v1/iam/instances', query: { status: 'active' } })
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        path: '/api/v1/iam/instances/keycloak-realms',
        query: { search: 'demo', page: '2', pageSize: '20' },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/iam/instances/draft-readiness',
        body: expect.objectContaining({ instanceId: 'demo', realmMode: 'new' }),
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/status' })
    );
    expect(request).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/preflight' })
    );
    expect(request).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({ path: '/api/v1/iam/instances/demo/keycloak/runs/run-1' })
    );
    expect(request).toHaveBeenNthCalledWith(
      8,
      expect.objectContaining({
        method: 'PATCH',
        path: '/api/v1/iam/instances/demo',
        body: expect.not.objectContaining({ instanceId: 'demo' }),
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      10,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/keycloak/execute',
        body: { intent: 'provision', planFingerprint: confirmedPlanFingerprint },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/modules/assign',
        body: { moduleId: 'news' },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      13,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/tenant-iam/access-probe',
        body: {},
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      14,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/tenant-iam/roles/reconcile',
        body: { planFingerprint: confirmedPlanFingerprint },
      })
    );
    expect(request).toHaveBeenNthCalledWith(
      16,
      expect.objectContaining({
        path: '/api/v1/iam/instances/demo/modules/revoke',
        body: { moduleId: 'news', confirmation: 'REVOKE' },
        confirmationChallengeId: 'challenge-1',
        confirmationPhrase: 'REVOKE news FROM demo',
      })
    );
    await Promise.all([client.close(), server.close()]);
  });
});
