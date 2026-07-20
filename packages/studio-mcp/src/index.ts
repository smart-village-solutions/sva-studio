import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioApiClient } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { registerStudioTools } from './tools.js';

export const createStudioMcpServer = (client: StudioApiClient, config: StudioMcpConfig): McpServer => {
  const server = new McpServer({ name: 'sva-studio-mcp-server', version: '0.0.1' });
  registerStudioTools(server, client, config);
  return server;
};

export { createStudioApiClient, StudioApiError, UpstreamSchemaError, type StudioApiClient } from './api-client.js';
export { readStudioMcpConfig, type StudioMcpConfig } from './config.js';
