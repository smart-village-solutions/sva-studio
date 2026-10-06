#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStudioApiClient } from './api-client.js';
import { readStudioMcpConfig } from './config.js';
import { createStudioMcpServer } from './index.js';
import { createStudioFetch } from './fetch.js';
import { createClientCredentialsTokenProvider } from './token-provider.js';
import { PersonalMcpContextManager } from './personal-auth.js';

const main = async (): Promise<void> => {
  const config = await readStudioMcpConfig();
  const fetchImpl = await createStudioFetch(config.caFilePath);
  const tokens = createClientCredentialsTokenProvider(config, fetchImpl);
  const client = createStudioApiClient(config, tokens, fetchImpl);
  const personalContexts = config.personalContexts?.length
    ? new PersonalMcpContextManager(config.personalContexts, { fetchImpl, tokenTimeoutMs: config.tokenTimeoutMs })
    : undefined;
  const transport = new StdioServerTransport();
  transport.onclose = () => { void personalContexts?.dispose(); };
  await createStudioMcpServer(client, config, fetchImpl, personalContexts).connect(transport);
};

main().catch(() => {
  process.stderr.write('SVA Studio MCP konnte nicht sicher gestartet werden. Konfiguration prüfen.\n');
  process.exitCode = 1;
});
