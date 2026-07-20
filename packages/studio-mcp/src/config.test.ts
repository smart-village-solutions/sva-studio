import { describe, expect, it } from 'vitest';
import { readStudioMcpConfig } from './config.js';

describe('Studio MCP configuration', () => {
  it('prefers the direct environment secret', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET: 'direct-secret',
    });
    expect(config.clientSecret).toBe('direct-secret');
    expect(config).toMatchObject({ readTimeoutMs: 10_000, mutationTimeoutMs: 30_000, tokenTimeoutMs: 10_000 });
  });

  it('resolves a secret with an argv command without shell interpretation', async () => {
    const config = await readStudioMcpConfig({
      SVA_STUDIO_MCP_BASE_URL: 'https://studio.example',
      SVA_STUDIO_MCP_TOKEN_URL: 'https://id.example/token',
      SVA_STUDIO_MCP_CLIENT_SECRET_COMMAND: JSON.stringify([process.execPath, '-e', 'process.stdout.write("resolved-secret\\n")']),
    });
    expect(config.clientSecret).toBe('resolved-secret');
  });
});
