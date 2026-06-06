import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { commandExists, runCapture } from '../runtime/process.ts';
import { resolveQuantumOperatorEnv, resolveRemoteDockerEndpointId } from '../runtime/remote-portainer.ts';

type StackEnvEntry = {
  readonly name: string;
  readonly value: string;
};

type PortainerStackEnvRecord = {
  readonly Name?: string;
  readonly Value?: string;
  readonly name?: string;
  readonly value?: string;
};

type PortainerStackRecord = {
  readonly EndpointId?: number;
  readonly Env?: readonly PortainerStackEnvRecord[];
  readonly Id?: number;
  readonly Name?: string;
};

type ReleaseDeps = {
  readonly commandExists: (commandName: string) => boolean;
  readonly fetch: typeof fetch;
  readonly runCapture: (commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
};

type ReleaseResult = {
  readonly endpointId: number;
  readonly gitTag: string;
  readonly imageTag: string;
  readonly previousImageTag: string | null;
  readonly stackId: number;
  readonly stackName: string;
  readonly version: string;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const currentScriptPath = fileURLToPath(import.meta.url);

const defaultDeps: ReleaseDeps = {
  commandExists: (commandName) => commandExists(rootDir, commandName),
  fetch: globalThis.fetch.bind(globalThis),
  runCapture: (commandName, args, env) => runCapture(rootDir, commandName, args, env),
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/u, '');

const requireEnvValue = (value: string | undefined, key: string): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${key} fehlt.`);
  }

  return normalized;
};

const normalizeStackEnv = (env: readonly PortainerStackEnvRecord[] | undefined): StackEnvEntry[] =>
  (env ?? [])
    .map((entry) => ({
      name: entry.name ?? entry.Name ?? '',
      value: entry.value ?? entry.Value ?? '',
    }))
    .filter((entry) => entry.name.length > 0);

const parseStackFileContent = (rawText: string): string => {
  try {
    const parsed = JSON.parse(rawText) as unknown;

    if (typeof parsed === 'string') {
      return parsed;
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'StackFileContent' in parsed &&
      typeof parsed.StackFileContent === 'string'
    ) {
      return parsed.StackFileContent;
    }
  } catch {
    return rawText;
  }

  return rawText;
};

const portainerRequest = async (input: {
  readonly deps: ReleaseDeps;
  readonly host: string;
  readonly apiKey: string;
  readonly path: string;
  readonly init?: RequestInit;
}): Promise<Response> => {
  const response = await input.deps.fetch(`${trimTrailingSlash(input.host)}${input.path}`, {
    ...input.init,
    headers: {
      'X-API-Key': input.apiKey,
      ...(input.init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response.text()).trim();
    throw new Error(
      `Portainer-API ${input.path} antwortet mit ${response.status}.${errorBody ? ` ${errorBody}` : ''}`
    );
  }

  return response;
};

export const parseWasteWebReleaseTag = (ref: string) => {
  const match = /^refs\/tags\/waste-web-v(\d+\.\d+\.\d+)$/u.exec(ref.trim());
  if (!match) {
    throw new Error(`Ungueltiges Waste-Web-Release-Tag: ${ref}`);
  }

  return {
    gitTag: `waste-web-v${match[1]}`,
    imageTag: `v${match[1]}`,
    version: match[1],
  } as const;
};

export const updateStackEnv = (env: readonly StackEnvEntry[], imageTag: string): StackEnvEntry[] => {
  const nextEnv = [...env];
  const imageTagIndex = nextEnv.findIndex((entry) => entry.name === 'PUBLIC_WASTE_IMAGE_TAG');

  if (imageTagIndex === -1) {
    nextEnv.push({
      name: 'PUBLIC_WASTE_IMAGE_TAG',
      value: imageTag,
    });
    return nextEnv;
  }

  nextEnv[imageTagIndex] = {
    name: 'PUBLIC_WASTE_IMAGE_TAG',
    value: imageTag,
  };
  return nextEnv;
};

export const releasePublicWasteStack = async (
  env: NodeJS.ProcessEnv = process.env,
  deps: ReleaseDeps = defaultDeps
): Promise<ReleaseResult> => {
  const release = parseWasteWebReleaseTag(requireEnvValue(env.GITHUB_REF, 'GITHUB_REF'));
  const operatorEnv = resolveQuantumOperatorEnv(env);
  const host = trimTrailingSlash(operatorEnv.QUANTUM_HOST?.trim() || 'https://console.planetary-quantum.com');
  const apiKey = requireEnvValue(operatorEnv.QUANTUM_API_KEY, 'QUANTUM_API_KEY');
  const stackName = requireEnvValue(
    env.PUBLIC_WASTE_STACK_NAME ?? operatorEnv.PUBLIC_WASTE_STACK_NAME,
    'PUBLIC_WASTE_STACK_NAME'
  );
  const endpointId = resolveRemoteDockerEndpointId(deps, operatorEnv, env.PORTAINER_ENDPOINT_NAME?.trim() || 'sva');

  const stacksResponse = await portainerRequest({
    deps,
    host,
    apiKey,
    path: '/api/stacks',
  });
  const stacks = (await stacksResponse.json()) as PortainerStackRecord[];
  const stack = stacks.find(
    (candidate) => candidate.Name === stackName && (candidate.EndpointId === undefined || candidate.EndpointId === endpointId)
  );

  if (!stack?.Id) {
    throw new Error(`Portainer-Stack ${stackName} wurde nicht gefunden.`);
  }

  const stackDetailsResponse = await portainerRequest({
    deps,
    host,
    apiKey,
    path: `/api/stacks/${String(stack.Id)}`,
  });
  const stackDetails = (await stackDetailsResponse.json()) as PortainerStackRecord;

  const stackFileResponse = await portainerRequest({
    deps,
    host,
    apiKey,
    path: `/api/stacks/${String(stack.Id)}/file`,
  });
  const stackFileContent = parseStackFileContent(await stackFileResponse.text());

  const currentEnv = normalizeStackEnv(stackDetails.Env ?? stack.Env);
  const previousImageTag = currentEnv.find((entry) => entry.name === 'PUBLIC_WASTE_IMAGE_TAG')?.value ?? null;
  const nextEnv = updateStackEnv(currentEnv, release.imageTag);

  await portainerRequest({
    deps,
    host,
    apiKey,
    path: `/api/stacks/${String(stack.Id)}?endpointId=${String(endpointId)}`,
    init: {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        Env: nextEnv,
        Prune: false,
        StackFileContent: stackFileContent,
      }),
    },
  });

  return {
    ...release,
    endpointId,
    previousImageTag,
    stackId: stack.Id,
    stackName,
  };
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  releasePublicWasteStack()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    });
}

export type { ReleaseDeps, ReleaseResult, StackEnvEntry };
