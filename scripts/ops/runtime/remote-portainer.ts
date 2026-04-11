import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

import { withoutDebugEnv } from './process.ts';

type RunCapture = (commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
type CommandExists = (commandName: string) => boolean;

export type RemotePortainerDeps = {
  commandExists: CommandExists;
  runCapture: RunCapture;
};

type QuantumEndpointRecord = {
  Id?: number;
  Name?: string;
};

const parseEnvFile = (filePath: string) => {
  if (!existsSync(filePath)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)] as const;
      }),
  );
};

const parseEndpointId = (value: string | undefined) => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Ungueltige Portainer-Endpoint-ID: ${normalized}`);
  }

  return parsed;
};

export const resolveQuantumOperatorEnv = (env: NodeJS.ProcessEnv) => ({
  ...parseEnvFile(resolve(homedir(), '.config/quantum/env')),
  ...env,
});

export const resolveRemoteDockerEndpointId = (
  deps: RemotePortainerDeps,
  env: NodeJS.ProcessEnv,
  endpointName: string,
) => {
  const configuredId = parseEndpointId(env.QUANTUM_ENDPOINT_ID ?? env.PORTAINER_ENDPOINT_ID);
  if (configuredId !== null) {
    return configuredId;
  }

  if (!deps.commandExists('quantum-cli')) {
    throw new Error(
      `Quantum-Endpoint ${endpointName} konnte nicht aufgeloest werden. Setze QUANTUM_ENDPOINT_ID oder verwende quantum-cli als Legacy-Fallback.`,
    );
  }

  const endpoints = JSON.parse(
    deps.runCapture('quantum-cli', ['endpoints', 'list', '-o', 'json'], withoutDebugEnv(env)),
  ) as QuantumEndpointRecord[];
  const match = endpoints.find((endpoint) => endpoint.Name === endpointName);

  if (!match?.Id) {
    throw new Error(`Quantum-Endpoint ${endpointName} konnte nicht aufgeloest werden.`);
  }

  return match.Id;
};

export const fetchPortainerDockerJson = async <T>(
  deps: RemotePortainerDeps,
  env: NodeJS.ProcessEnv,
  input: {
    quantumEndpoint: string;
    resourcePath: string;
  },
): Promise<T> => {
  const operatorEnv = resolveQuantumOperatorEnv(env);
  const endpointId = resolveRemoteDockerEndpointId(deps, operatorEnv, input.quantumEndpoint);
  const apiKey = operatorEnv.QUANTUM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('QUANTUM_API_KEY fehlt fuer den Portainer-Read-only-Pfad.');
  }

  const host = operatorEnv.QUANTUM_HOST?.trim() || 'https://console.planetary-quantum.com';
  const response = await fetch(`${host}/api/endpoints/${String(endpointId)}/docker/${input.resourcePath}`, {
    headers: {
      'X-API-Key': apiKey,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Portainer-API fuer ${input.resourcePath} antwortet mit ${response.status}.`);
  }

  return (await response.json()) as T;
};
