import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getRuntimeProfileDefinition,
  getRuntimeProfileRequiredEnvKeys,
  type RuntimeProfile,
  validateRuntimeProfileEnv,
} from '../../packages/sdk/src/runtime-profile.ts';

type RuntimeCommand = 'down' | 'migrate' | 'smoke' | 'status' | 'up' | 'update';

type LocalState = {
  logFile: string;
  pid: number;
  profile: RuntimeProfile;
  startedAt: string;
};

const [, , rawCommand, rawProfile] = process.argv;

const command = rawCommand as RuntimeCommand | undefined;
const profile = rawProfile as RuntimeProfile | undefined;

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeArtifactsDir = resolve(rootDir, 'artifacts/runtime');
const localStateFile = resolve(runtimeArtifactsDir, 'local-app-state.json');
const appLogDir = resolve(runtimeArtifactsDir, 'logs');

const composeBaseArgs = ['compose', '-f', 'docker-compose.yml'];
const composeWithMonitoringArgs = ['compose', '-f', 'docker-compose.yml', '-f', 'docker-compose.monitoring.yml'];
const localProfiles: readonly RuntimeProfile[] = ['local-keycloak', 'local-builder'];

const usage = () => {
  console.error('Usage: tsx scripts/ops/runtime-env.ts <up|down|update|status|smoke|migrate> <profile>');
  process.exit(2);
};

const ensureKnownCommand = (value: RuntimeCommand | undefined): RuntimeCommand => {
  if (!value || !['up', 'down', 'update', 'status', 'smoke', 'migrate'].includes(value)) {
    usage();
    throw new Error('Unreachable');
  }

  return value as RuntimeCommand;
};

const ensureKnownProfile = (value: RuntimeProfile | undefined): RuntimeProfile => {
  if (!value || !['local-keycloak', 'local-builder', 'acceptance-hb'].includes(value)) {
    usage();
    throw new Error('Unreachable');
  }

  return value as RuntimeProfile;
};

const shellEscape = (value: string) => {
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`;
};

const parseVarsFile = (filePath: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    parsed[key] = value;
  }

  return parsed;
};

const buildProfileEnv = (runtimeProfile: RuntimeProfile): NodeJS.ProcessEnv => {
  const baseEnvPath = resolve(rootDir, 'config/runtime/base.vars');
  const profileEnvPath = resolve(rootDir, `config/runtime/${runtimeProfile}.vars`);
  const localOverridePath = resolve(rootDir, `config/runtime/${runtimeProfile}.local.vars`);
  const env = {
    ...process.env,
    ...parseVarsFile(baseEnvPath),
    ...parseVarsFile(profileEnvPath),
    ...(existsSync(localOverridePath) ? parseVarsFile(localOverridePath) : {}),
  };

  env.SVA_RUNTIME_PROFILE = runtimeProfile;
  env.VITE_SVA_RUNTIME_PROFILE = runtimeProfile;

  if (runtimeProfile === 'local-builder') {
    env.SVA_MOCK_AUTH = 'true';
    env.VITE_MOCK_AUTH = 'true';
    env.BUILDER_DEV_AUTH = 'true';
  }

  env.SVA_MAINSERVER_DEV_GRAPHQL_URL = env.SVA_MAINSERVER_GRAPHQL_URL;
  env.SVA_MAINSERVER_DEV_OAUTH_TOKEN_URL = env.SVA_MAINSERVER_OAUTH_TOKEN_URL;
  env.SVA_MAINSERVER_DEV_API_KEY = env.SVA_MAINSERVER_CLIENT_ID;
  env.SVA_MAINSERVER_DEV_API_SECRET = env.SVA_MAINSERVER_CLIENT_SECRET;

  return env;
};

const assertRuntimeEnv = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const validation = validateRuntimeProfileEnv(runtimeProfile, env);
  if (validation.missing.length === 0 && validation.placeholders.length === 0) {
    return;
  }

  const lines = [
    `Runtime-Profil ${runtimeProfile} ist nicht vollstaendig konfiguriert.`,
    validation.missing.length > 0 ? `Fehlend: ${validation.missing.join(', ')}` : null,
    validation.placeholders.length > 0 ? `Platzhalter: ${validation.placeholders.join(', ')}` : null,
    `Erwartete Variablen: ${getRuntimeProfileRequiredEnvKeys(runtimeProfile).join(', ')}`,
    `Optionaler Override: config/runtime/${runtimeProfile}.local.vars`,
  ].filter((entry): entry is string => entry !== null);

  throw new Error(lines.join('\n'));
};

const run = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${commandName} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
};

const runCapture = (commandName: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env) => {
  const result = spawnSync(commandName, args, {
    cwd: rootDir,
    env,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || `${commandName} ${args.join(' ')} failed`);
  }

  return result.stdout.trim();
};

const wait = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const ensureDirs = () => {
  mkdirSync(runtimeArtifactsDir, { recursive: true });
  mkdirSync(appLogDir, { recursive: true });
};

const isProcessAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const readLocalState = (): LocalState | null => {
  if (!existsSync(localStateFile)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(localStateFile, 'utf8')) as LocalState;
    return typeof parsed.pid === 'number' ? parsed : null;
  } catch {
    return null;
  }
};

const clearLocalState = () => {
  if (existsSync(localStateFile)) {
    unlinkSync(localStateFile);
  }
};

const stopKnownLocalDevServers = () => {
  const patterns = [
    'pnpm nx run sva-studio-react:serve',
    'vite.js dev --port 3000',
  ] as const;

  for (const pattern of patterns) {
    spawnSync('pkill', ['-f', pattern], {
      cwd: rootDir,
      stdio: 'ignore',
    });
  }
};

const stopLocalApp = () => {
  const state = readLocalState();
  if (!state) {
    stopKnownLocalDevServers();
    return;
  }

  if (!isProcessAlive(state.pid)) {
    clearLocalState();
    return;
  }

  try {
    process.kill(-state.pid, 'SIGTERM');
  } catch {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch {
      // Ignore stale process state.
    }
  }

  clearLocalState();
  stopKnownLocalDevServers();
};

const startLocalApp = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  ensureDirs();

  const existing = readLocalState();
  if (existing && isProcessAlive(existing.pid) && existing.profile !== runtimeProfile) {
    throw new Error(
      `Lokale App laeuft bereits mit Profil ${existing.profile}. Erst env:down:${existing.profile} ausfuehren.`,
    );
  }

  if (existing && isProcessAlive(existing.pid) && existing.profile === runtimeProfile) {
    console.log(`Lokale App fuer ${runtimeProfile} laeuft bereits (PID ${existing.pid}).`);
    return;
  }

  const logFile = resolve(appLogDir, `${runtimeProfile}.log`);
  const logFd = openSync(logFile, 'a');

  const child = spawn('pnpm', ['nx', 'run', 'sva-studio-react:serve'], {
    cwd: rootDir,
    env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });

  if (child.pid === undefined) {
    throw new Error(`Dev-Server fuer ${runtimeProfile} konnte nicht gestartet werden.`);
  }

  child.unref();

  writeFileSync(
    localStateFile,
    `${JSON.stringify(
      {
        pid: child.pid,
        profile: runtimeProfile,
        startedAt: new Date().toISOString(),
        logFile,
      } satisfies LocalState,
      null,
      2,
    )}\n`,
    'utf8',
  );

  await waitForHttpOk(new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString(), 60_000);
};

const waitForHttpOk = async (url: string, timeoutMs: number) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling.
    }

    await wait(1_000);
  }

  throw new Error(`Timeout waiting for ${url}`);
};

const getComposeArgs = (env: NodeJS.ProcessEnv) =>
  env.SVA_ENABLE_MONITORING === 'false' ? composeBaseArgs : composeWithMonitoringArgs;

const upLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...getComposeArgs(env), 'up', '-d'], env);
};

const bootstrapLocalAppUser = (env: NodeJS.ProcessEnv) => {
  run('pnpm', ['nx', 'run', 'data:db:bootstrap-app-user'], env);
};

const downLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...composeWithMonitoringArgs, 'down'], env);
};

const pullLocalInfra = (env: NodeJS.ProcessEnv) => {
  run('docker', [...getComposeArgs(env), 'pull'], env);
};

const checkHttpHealth = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  let payload: unknown = null;

  try {
    payload = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  return { response, payload };
};

const assertLoginFlow = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const loginUrl = new URL('/auth/login', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
  const response = await fetch(loginUrl, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';

  if (runtimeProfile === 'local-builder') {
    if (location !== '/?auth=mock-login') {
      throw new Error(`Builder-Mock-Login unerwartet: ${location}`);
    }

    return;
  }

  const issuer = env.SVA_AUTH_ISSUER ?? '';
  if (response.status !== 302 || !location.startsWith(issuer)) {
    throw new Error(`OIDC-Login redirect stimmt nicht. Erwartet Prefix ${issuer}, erhalten ${location}`);
  }
};

const assertMeEndpoint = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  const meUrl = new URL('/auth/me', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString();
  const response = await fetch(meUrl, { redirect: 'manual' });

  if (runtimeProfile === 'local-builder') {
    if (!response.ok) {
      throw new Error(`/auth/me fuer ${runtimeProfile} antwortet mit ${response.status}`);
    }

    const payload = (await response.json()) as {
      user?: {
        email?: string;
        instanceId?: string;
        name?: string;
      };
    };

    if (payload.user?.name !== (env.SVA_MOCK_AUTH_USER_NAME ?? 'Builder Mock User')) {
      throw new Error(`Mock-User stimmt nicht: ${JSON.stringify(payload)}`);
    }

    return;
  }

  if (response.status !== 401) {
    throw new Error(`/auth/me ohne Session sollte 401 liefern, erhielt ${response.status}`);
  }
};

const assertMainserverSmoke = async (env: NodeJS.ProcessEnv) => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: env.SVA_MAINSERVER_CLIENT_ID ?? '',
    client_secret: env.SVA_MAINSERVER_CLIENT_SECRET ?? '',
  });

  const tokenResponse = await fetch(env.SVA_MAINSERVER_OAUTH_TOKEN_URL ?? '', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Mainserver OAuth fehlgeschlagen: ${tokenResponse.status}`);
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new Error('Mainserver OAuth liefert kein access_token.');
  }

  const graphqlResponse = await fetch(env.SVA_MAINSERVER_GRAPHQL_URL ?? '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
    },
    body: JSON.stringify({ query: '{ __typename }' }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!graphqlResponse.ok) {
    throw new Error(`Mainserver GraphQL fehlgeschlagen: ${graphqlResponse.status}`);
  }

  const graphqlPayload = (await graphqlResponse.json()) as { data?: { __typename?: string }; errors?: unknown[] };
  if (Array.isArray(graphqlPayload.errors) && graphqlPayload.errors.length > 0) {
    throw new Error(`Mainserver GraphQL antwortete mit Fehlern: ${JSON.stringify(graphqlPayload.errors)}`);
  }
};

const assertOtelLocal = async (env: NodeJS.ProcessEnv) => {
  if (env.SVA_ENABLE_MONITORING === 'false') {
    return;
  }

  const collectorHealth = await fetch('http://127.0.0.1:13133/healthz', { signal: AbortSignal.timeout(5_000) });
  if (!collectorHealth.ok) {
    throw new Error(`OTEL Collector Healthcheck fehlgeschlagen: ${collectorHealth.status}`);
  }
};

const assertAcceptanceContainerHealth = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const services = ['app', 'redis', 'postgres', 'otel-collector'];

  for (const service of services) {
    const output = runCapture('docker', ['ps', '--filter', `name=${stackName}_${service}`, '--format', '{{.Status}}']);
    if (output.length === 0) {
      throw new Error(`Container fuer ${service} nicht gefunden.`);
    }
  }
};

const smokeRuntime = async (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
  assertRuntimeEnv(runtimeProfile, env);

  const live = await checkHttpHealth(new URL('/health/live', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
  if (!live.response.ok) {
    throw new Error(`Live-Healthcheck fehlgeschlagen: ${live.response.status}`);
  }

  const ready = await checkHttpHealth(new URL('/health/ready', env.SVA_PUBLIC_BASE_URL ?? 'http://localhost:3000').toString());
  if (!ready.response.ok) {
    throw new Error(`Ready-Healthcheck fehlgeschlagen: ${ready.response.status} ${JSON.stringify(ready.payload)}`);
  }

  await assertLoginFlow(runtimeProfile, env);
  await assertMeEndpoint(runtimeProfile, env);
  await assertMainserverSmoke(env);

  if (localProfiles.includes(runtimeProfile)) {
    await assertOtelLocal(env);
  } else {
    assertAcceptanceContainerHealth(env);
  }
};

const runLocalCommand = async (runtimeProfile: RuntimeProfile, runtimeCommand: RuntimeCommand) => {
  const env = buildProfileEnv(runtimeProfile);

  switch (runtimeCommand) {
    case 'up':
      assertRuntimeEnv(runtimeProfile, env);
      upLocalInfra(env);
      bootstrapLocalAppUser(env);
      await startLocalApp(runtimeProfile, env);
      console.log(`Profil ${runtimeProfile} gestartet.`);
      return;
    case 'down':
      stopLocalApp();
      downLocalInfra(env);
      console.log(`Profil ${runtimeProfile} gestoppt.`);
      return;
    case 'update':
      assertRuntimeEnv(runtimeProfile, env);
      pullLocalInfra(env);
      upLocalInfra(env);
      bootstrapLocalAppUser(env);
      stopLocalApp();
      await startLocalApp(runtimeProfile, env);
      console.log(`Profil ${runtimeProfile} aktualisiert.`);
      return;
    case 'status': {
      const state = readLocalState();
      console.log(JSON.stringify({ app: state, profile: runtimeProfile }, null, 2));
      run('docker', [...getComposeArgs(env), 'ps'], env);
      return;
    }
    case 'smoke':
      await smokeRuntime(runtimeProfile, env);
      console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      return;
    case 'migrate':
      assertRuntimeEnv(runtimeProfile, env);
      run('pnpm', ['nx', 'run', 'data:db:migrate'], env);
      bootstrapLocalAppUser(env);
      console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      return;
  }
};

const migrateAcceptance = (env: NodeJS.ProcessEnv) => {
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';
  const containerId = runCapture('docker', ['ps', '--filter', `name=${stackName}_postgres`, '--format', '{{.ID}}']);
  if (containerId.length === 0) {
    throw new Error(`Postgres-Container fuer Stack ${stackName} nicht gefunden.`);
  }

  const escapedRoot = shellEscape(rootDir);
  const command =
    `cd ${escapedRoot} && ` +
    `for f in packages/data/migrations/up/*.sql; do ` +
    `echo "Applying $f"; ` +
    `docker exec ${shellEscape(containerId)} psql -v ON_ERROR_STOP=1 -U sva -d sva_studio -f "$f"; ` +
    'done';

  run('sh', ['-lc', command], env);
};

const runAcceptanceCommand = async (runtimeProfile: RuntimeProfile, runtimeCommand: RuntimeCommand) => {
  const env = buildProfileEnv(runtimeProfile);
  assertRuntimeEnv(runtimeProfile, env);
  const stackName = env.SVA_STACK_NAME ?? 'sva-studio';

  switch (runtimeCommand) {
    case 'up':
    case 'update':
      run('docker', ['stack', 'deploy', '-c', 'deploy/portainer/docker-compose.yml', stackName], env);
      console.log(`Stack ${stackName} deployt.`);
      return;
    case 'down':
      run('docker', ['stack', 'rm', stackName], env);
      console.log(`Stack ${stackName} entfernt.`);
      return;
    case 'status':
      run('docker', ['stack', 'services', stackName], env);
      run('docker', ['stack', 'ps', stackName], env);
      return;
    case 'smoke':
      await smokeRuntime(runtimeProfile, env);
      console.log(`Smoke-Checks fuer ${runtimeProfile} erfolgreich.`);
      return;
    case 'migrate':
      migrateAcceptance(env);
      console.log(`Migrationen fuer ${runtimeProfile} abgeschlossen.`);
      return;
  }
};

const main = async () => {
  ensureDirs();

  const runtimeCommand = ensureKnownCommand(command);
  const runtimeProfile = ensureKnownProfile(profile);
  const definition = getRuntimeProfileDefinition(runtimeProfile);

  if (definition.isLocal) {
    await runLocalCommand(runtimeProfile, runtimeCommand);
    return;
  }

  await runAcceptanceCommand(runtimeProfile, runtimeCommand);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[runtime-env] ${message}`);
  process.exit(1);
});
