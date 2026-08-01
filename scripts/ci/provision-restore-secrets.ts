#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

type RestoreEnvironment = 'prod' | 'staging';

type DockerSecret = {
  Spec?: {
    Name?: string;
  };
};

type ProvisionRestoreSecretsInput = {
  apiKey: string;
  endpointId: string;
  environment: RestoreEnvironment;
  postgresPassword: string;
  portainerHost: string;
  signingKey: string;
};

const secretNames = (environment: RestoreEnvironment) => ({
  postgres: `restore_${environment}_postgres_password`,
  signing: `restore_${environment}_signing_key`,
});

const required = (value: string | undefined, label: string) => {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} darf nicht leer sein.`);
  return normalized;
};

const normalizeHost = (value: string) => value.replace(/\/+$/u, '');

const assertEndpointId = (value: string) => {
  if (!/^[1-9][0-9]*$/u.test(value))
    throw new Error('QUANTUM_ENDPOINT_ID muss eine positive Ganzzahl sein.');
  return value;
};

const request = async (input: ProvisionRestoreSecretsInput, path: string, init?: RequestInit) => {
  const response = await fetch(
    `${normalizeHost(input.portainerHost)}/api/endpoints/${encodeURIComponent(input.endpointId)}/docker/${path}`,
    {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': input.apiKey,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(20_000),
    }
  );
  if (!response.ok) throw new Error(`Portainer-API ${path} antwortet mit ${response.status}.`);
  return response;
};

export const provisionRestoreSecrets = async (input: ProvisionRestoreSecretsInput) => {
  const names = secretNames(input.environment);
  const response = await request(input, 'secrets');
  const existing = (await response.json()) as DockerSecret[];
  const existingNames = new Set(existing.map((secret) => secret.Spec?.Name).filter(Boolean));
  const desired = [
    { name: names.postgres, value: input.postgresPassword },
    { name: names.signing, value: input.signingKey },
  ];
  const created: string[] = [];
  const preserved: string[] = [];

  for (const secret of desired) {
    if (existingNames.has(secret.name)) {
      preserved.push(secret.name);
      continue;
    }
    await request(input, 'secrets/create', {
      body: JSON.stringify({
        Data: Buffer.from(secret.value, 'utf8').toString('base64'),
        Name: secret.name,
      }),
      method: 'POST',
    });
    created.push(secret.name);
  }

  return { created, preserved };
};

const main = async () => {
  const environment = process.argv[2];
  if (environment !== 'staging' && environment !== 'prod') {
    throw new Error('Erwartet wird staging oder prod.');
  }
  const input: ProvisionRestoreSecretsInput = {
    apiKey: required(process.env.QUANTUM_API_KEY, 'QUANTUM_API_KEY'),
    endpointId: assertEndpointId(required(process.env.QUANTUM_ENDPOINT_ID, 'QUANTUM_ENDPOINT_ID')),
    environment,
    portainerHost: required(
      process.env.QUANTUM_HOST ?? 'https://console.planetary-quantum.com',
      'QUANTUM_HOST'
    ),
    postgresPassword: required(process.env.RESTORE_POSTGRES_PASSWORD, 'RESTORE_POSTGRES_PASSWORD'),
    signingKey: required(process.env.RESTORE_AGENT_SIGNING_KEY, 'RESTORE_AGENT_SIGNING_KEY'),
  };
  const result = await provisionRestoreSecrets(input);
  process.stdout.write(
    `Restore-Secrets für ${environment}: ${String(result.created.length)} angelegt, ${String(result.preserved.length)} unverändert vorhanden.\n`
  );
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
