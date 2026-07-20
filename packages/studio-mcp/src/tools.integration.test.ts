import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import type { StudioApiClient } from './api-client.js';
import { createStudioMcpServer } from './index.js';

const config = {
  baseUrl: 'https://studio.example', tokenUrl: 'https://id.example/token', clientId: 'mcp', clientSecret: 'secret',
  readTimeoutMs: 1_000, mutationTimeoutMs: 1_000, tokenTimeoutMs: 1_000, diagnosisTimeoutMs: 1_000,
};

describe('Studio MCP tools', () => {
  it('advertises the complete tool surface with risk annotations', async () => {
    const api: StudioApiClient = { request: vi.fn().mockResolvedValue({ data: [] }) };
    const server = createStudioMcpServer(api, config);
    const client = new Client({ name: 'test-client', version: '1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const tools = await client.listTools();
    expect(tools.tools).toHaveLength(20);
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
    expect(response.content).toEqual([{ type: 'text', text: 'Studio-Operation fehlgeschlagen. Strukturierte Diagnose verfügbar.' }]);
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
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', idempotencyKey: expect.any(String) }));
    await Promise.all([client.close(), server.close()]);
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
});
