import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioApiClient } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { registerStudioTools } from './tools.js';
import { PersonalMcpContextManager } from './personal-auth.js';
import { registerPersonalTools } from './tools-personal.js';

export const createStudioMcpServer = (
  client: StudioApiClient,
  config: StudioMcpConfig,
  fetchImpl: typeof fetch = fetch,
  personalContexts = config.personalContexts?.length
    ? new PersonalMcpContextManager(config.personalContexts, { fetchImpl, tokenTimeoutMs: config.tokenTimeoutMs })
    : undefined
): McpServer => {
  const server = new McpServer({ name: 'sva-studio-mcp-server', version: '0.0.1' });
  registerStudioTools(server, client, config);
  if (personalContexts) registerPersonalTools(server, config, personalContexts, fetchImpl);
  return server;
};

export { createStudioApiClient, StudioApiError, UpstreamSchemaError, type StudioApiClient } from './api-client.js';
export { readStudioMcpConfig, type StudioMcpConfig } from './config.js';
