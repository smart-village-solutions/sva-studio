import { describe, expect, it } from 'vitest';
import { readStudioMcpConfig, resolveInterfaceSecret } from './config.js';

describe('Studio MCP configuration', () => {
  it('prefers the direct environment secret', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'direct-secret',
    });
    expect(config.clientSecret).toBe('direct-secret');
    expect(config).toMatchObject({ readTimeoutMs: 10_000, mutationTimeoutMs: 30_000, processTimeoutMs: 120_000, tokenTimeoutMs: 10_000 });
  });

  it('resolves a secret with an argv command without shell interpretation', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET_COMMAND: JSON.stringify([process.execPath, '-e', 'process.stdout.write("resolved-secret\\n")']),
    });
    expect(config.clientSecret).toBe('resolved-secret');
  });

  it('loads explicit platform and tenant contexts without secret fields', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'service-secret',
      SVA_STUDIO_MCP_PERSONAL_CONTEXTS: JSON.stringify([
        { id: 'platform-provider', name: 'Platform Provider', kind: 'platform', baseUrl: 'https://studio.example', issuer: 'https://id.example/realms/studio', clientId: 'sva-studio-mcp-personal' },
        { id: 'tenant-demo-provider', name: 'Demo Provider', kind: 'tenant', tenantId: 'demo', baseUrl: 'https://demo.studio.example', issuer: 'https://id.example/realms/demo', clientId: 'sva-studio-mcp-personal' },
      ]),
    });
    expect(config.personalContexts).toHaveLength(2);
    expect(config.personalContexts?.[1]).toMatchObject({ id: 'tenant-demo-provider', kind: 'tenant', tenantId: 'demo' });
    expect(config.personalContexts?.[0]).not.toHaveProperty('clientSecret');
  });

  it('rejects duplicate, non-HTTPS and non-realm personal contexts', async () => {
    const common = { name: 'Context', kind: 'tenant', tenantId: 'demo', baseUrl: 'https://demo.studio.example', issuer: 'https://id.example/realms/demo', clientId: 'sva-studio-mcp-personal' };
    const read = (contexts: unknown) => readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'service-secret',
      SVA_STUDIO_MCP_PERSONAL_CONTEXTS: JSON.stringify(contexts),
    });
    await expect(read([{ ...common, id: 'duplicate' }, { ...common, id: 'duplicate' }])).rejects.toThrow();
    await expect(read([{ ...common, id: 'insecure', baseUrl: 'http://demo.studio.example' }])).rejects.toThrow();
    await expect(read([{ ...common, id: 'bad-issuer', issuer: 'https://id.example/not-a-realm' }])).rejects.toThrow();
  });

  it('resolves interface secrets with argv placeholders and hides resolver diagnostics', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'service-secret',
      SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND: JSON.stringify([
        process.execPath, '-e', 'process.stdout.write(process.argv[1] + "\\n")',
        '{contextId}:{interfaceType}:{interfaceId}:{field}:{secretRef}',
      ]),
    });
    await expect(resolveInterfaceSecret(config, {
      contextId: 'tenant-a', interfaceType: 's3', interfaceId: 'interface-1',
      field: 'secretAccessKey', secretRef: 'vault/team/s3',
    })).resolves.toBe('tenant-a:s3:interface-1:secretAccessKey:vault/team/s3');

    const failingConfig = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'service-secret',
      SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND: JSON.stringify([
        process.execPath, '-e', 'process.stderr.write("private-diagnostic"); process.exit(1)', '{secretRef}',
      ]),
    });
    await expect(resolveInterfaceSecret(failingConfig, {
      contextId: 'tenant-a', interfaceType: 's3', field: 'secretAccessKey', secretRef: 'private-ref',
    })).rejects.toThrow('interface_secret_resolution_failed');

    const missingReferenceConfig = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'service-secret',
      SVA_STUDIO_MCP_INTERFACE_SECRET_COMMAND: JSON.stringify([process.execPath, '-e', 'process.stdout.write("secret")']),
    });
    await expect(resolveInterfaceSecret(missingReferenceConfig, {
      contextId: 'tenant-a', interfaceType: 's3', field: 'secretAccessKey', secretRef: 'private-ref',
    })).rejects.toThrow('interface_secret_reference_placeholder_missing');
  });
});
