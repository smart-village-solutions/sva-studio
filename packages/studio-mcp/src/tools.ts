import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StudioApiClient } from './api-client.js';
import type { StudioMcpConfig } from './config.js';
import { schemas } from './contracts.js';
import { registerCriticalTools } from './tools-critical.js';
import { registerReadTools } from './tools-read.js';
import {
  call,
  callProcess,
  createToolRegistrar,
  readAnnotations,
  writeAnnotations,
} from './tools-support.js';
import { registerWriteTools } from './tools-write.js';

export const registerStudioTools = (
  server: McpServer,
  client: StudioApiClient,
  config: StudioMcpConfig
): void => {
  const register = createToolRegistrar(server);
  registerReadTools(register, client, config);
  register(
    'studio_instance_process',
    'Studio-Instanzprozess ausführen',
    'Orchestriert Anlage, Reparatur oder Anpassung ausschließlich über bestehende Studio-Verträge. Kritische Aktivierung bleibt eine separate, challenge-geschützte Aktion.',
    schemas.process,
    writeAnnotations,
    (p) => callProcess(client, p, config.processTimeoutMs, config.diagnosisTimeoutMs)
  );
  register(
    'studio_instance_provisioning_run_get',
    'Provisioning-Lauf lesen',
    'Liest einen bestimmten Keycloak-Provisioning-Lauf.',
    schemas.run,
    readAnnotations,
    (p) =>
      call(client, {
        path: `/api/v1/iam/instances/${encodeURIComponent(p.instanceId)}/keycloak/runs/${encodeURIComponent(p.runId)}`,
      })
  );

  registerWriteTools(register, client, config);
  registerCriticalTools(register, client);
};
