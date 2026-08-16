import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  defaultDeps,
  normalizeStackEnv,
  parseStackFileContent,
  portainerRequest,
  requireEnvValue,
  trimTrailingSlash,
  type PortainerStackRecord,
  type ReleaseDeps,
  type StackEnvEntry,
} from './portainer-release.ts';
import {
  resolveQuantumOperatorEnv,
  resolveRemoteDockerEndpointId,
} from '../runtime/remote-portainer.ts';

type DomainCutoverResult = {
  readonly changed: boolean;
  readonly endpointId: number;
  readonly previousBaseUrl: string;
  readonly previousHost: string;
  readonly routingChanged: boolean;
  readonly stackId: number;
  readonly stackName: string;
  readonly targetBaseUrl: string;
  readonly targetHost: string;
};

const readRequiredStackEnv = (env: readonly StackEnvEntry[], key: string): string => {
  const value = env.find((entry) => entry.name === key)?.value.trim();
  if (!value) throw new Error(`${key} fehlt im Public-Waste-Stack.`);
  return value;
};

const replaceRequiredStackEnv = (
  env: readonly StackEnvEntry[],
  key: string,
  value: string
): StackEnvEntry[] => {
  const index = env.findIndex((entry) => entry.name === key);
  if (index === -1) throw new Error(`${key} fehlt im Public-Waste-Stack.`);
  const nextEnv = [...env];
  nextEnv[index] = { name: key, value };
  return nextEnv;
};

const normalizePublicWasteTargetHost = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/\.$/u, '');
  let url: URL;
  try {
    url = new URL(`https://${normalized}`);
  } catch {
    throw new Error('PUBLIC_WASTE_TARGET_HOST ist ungueltig.');
  }
  if (
    !normalized ||
    url.hostname !== normalized ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('PUBLIC_WASTE_TARGET_HOST ist ungueltig.');
  }
  return normalized;
};

export const updatePublicWasteDomainEnv = (
  env: readonly StackEnvEntry[],
  expectedInstanceId: string,
  targetHost: string
): StackEnvEntry[] => {
  const currentInstanceId = readRequiredStackEnv(env, 'PUBLIC_WASTE_INSTANCE_ID');
  if (currentInstanceId !== expectedInstanceId) {
    throw new Error(
      `Public-Waste-Instanz stimmt nicht ueberein: erwartet ${expectedInstanceId}, gefunden ${currentInstanceId}.`
    );
  }
  const normalizedHost = normalizePublicWasteTargetHost(targetHost);
  const withHost = replaceRequiredStackEnv(env, 'PUBLIC_WASTE_PUBLIC_HOST', normalizedHost);
  return replaceRequiredStackEnv(withHost, 'PUBLIC_WASTE_BASE_URL', `https://${normalizedHost}`);
};

export const ensurePublicWasteCertificateResolver = (stackFileContent: string): string => {
  const resolverMatches = [
    ...stackFileContent.matchAll(
      /^(\s*-\s*)(['"])traefik\.http\.routers\.public-waste\.tls\.certresolver=([^\s'"]+)\2[ \t]*$/gmu
    ),
  ];
  if (resolverMatches.length > 1) {
    throw new Error('Der Public-Waste-Stack besitzt mehrere TLS-Certificate-Resolver-Labels.');
  }
  const resolverMatch = resolverMatches[0];
  if (resolverMatch?.[1] && resolverMatch[2]) {
    if (resolverMatch[3] === 'default') return stackFileContent;
    return stackFileContent.replace(
      resolverMatch[0],
      `${resolverMatch[1]}${resolverMatch[2]}traefik.http.routers.public-waste.tls.certresolver=default${resolverMatch[2]}`
    );
  }
  const matches = [
    ...stackFileContent.matchAll(
      /^(\s*-\s*)(['"])traefik\.http\.routers\.public-waste\.tls=true\2[ \t]*$/gmu
    ),
  ];
  const match = matches[0];
  if (matches.length !== 1 || !match?.[1] || !match[2]) {
    throw new Error('Der Public-Waste-Stack besitzt kein eindeutiges TLS-Router-Label.');
  }
  const resolverLabel = `${match[1]}${match[2]}traefik.http.routers.public-waste.tls.certresolver=default${match[2]}`;
  return stackFileContent.replace(match[0], `${match[0]}\n${resolverLabel}`);
};

export const cutoverPublicWasteStackDomain = async (
  env: NodeJS.ProcessEnv = process.env,
  deps: ReleaseDeps = defaultDeps
): Promise<DomainCutoverResult> => {
  const operatorEnv = resolveQuantumOperatorEnv(env);
  const host = trimTrailingSlash(
    operatorEnv.QUANTUM_HOST?.trim() || 'https://console.planetary-quantum.com'
  );
  const apiKey = requireEnvValue(operatorEnv.QUANTUM_API_KEY, 'QUANTUM_API_KEY');
  const stackName = requireEnvValue(
    env.PUBLIC_WASTE_STACK_NAME ?? operatorEnv.PUBLIC_WASTE_STACK_NAME,
    'PUBLIC_WASTE_STACK_NAME'
  );
  const expectedInstanceId = requireEnvValue(
    env.PUBLIC_WASTE_EXPECTED_INSTANCE_ID,
    'PUBLIC_WASTE_EXPECTED_INSTANCE_ID'
  );
  const targetHost = normalizePublicWasteTargetHost(
    requireEnvValue(env.PUBLIC_WASTE_TARGET_HOST, 'PUBLIC_WASTE_TARGET_HOST')
  );
  const targetBaseUrl = `https://${targetHost}`;
  const endpointId = resolveRemoteDockerEndpointId(
    deps,
    operatorEnv,
    env.PORTAINER_ENDPOINT_NAME?.trim() || 'sva'
  );
  const stacks = (await (
    await portainerRequest({ deps, host, apiKey, path: '/api/stacks' })
  ).json()) as PortainerStackRecord[];
  const stack = stacks.find(
    (candidate) =>
      candidate.Name === stackName &&
      (candidate.EndpointId === undefined || candidate.EndpointId === endpointId)
  );
  if (!stack?.Id) throw new Error(`Portainer-Stack ${stackName} wurde nicht gefunden.`);
  const details = (await (
    await portainerRequest({ deps, host, apiKey, path: `/api/stacks/${String(stack.Id)}` })
  ).json()) as PortainerStackRecord;
  const stackFileContent = parseStackFileContent(
    await (
      await portainerRequest({ deps, host, apiKey, path: `/api/stacks/${String(stack.Id)}/file` })
    ).text()
  );
  const currentEnv = normalizeStackEnv(details.Env ?? stack.Env);
  const previousHost = readRequiredStackEnv(currentEnv, 'PUBLIC_WASTE_PUBLIC_HOST');
  const previousBaseUrl = readRequiredStackEnv(currentEnv, 'PUBLIC_WASTE_BASE_URL');
  const nextStackFileContent = ensurePublicWasteCertificateResolver(stackFileContent);
  const domainChanged = previousHost !== targetHost || previousBaseUrl !== targetBaseUrl;
  const routingChanged = nextStackFileContent !== stackFileContent;
  const changed = domainChanged || routingChanged;
  const nextEnv = updatePublicWasteDomainEnv(currentEnv, expectedInstanceId, targetHost);

  if (changed) {
    await portainerRequest({
      deps,
      host,
      apiKey,
      path: `/api/stacks/${String(stack.Id)}?endpointId=${String(endpointId)}`,
      init: {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          Env: nextEnv,
          Prune: false,
          StackFileContent: nextStackFileContent,
        }),
      },
    });
  }

  return {
    changed,
    endpointId,
    previousBaseUrl,
    previousHost,
    routingChanged,
    stackId: stack.Id,
    stackName,
    targetBaseUrl,
    targetHost,
  };
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  cutoverPublicWasteStackDomain()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

export type { DomainCutoverResult };
