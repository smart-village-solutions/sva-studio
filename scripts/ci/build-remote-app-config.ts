#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  PromoteContractError,
  redactPromoteFailure,
  writePromoteFailureRecord,
} from './promote-result.ts';
import {
  remoteConfigContract,
  requiredRemoteConfigKeys,
  type RemoteEnvironment,
} from './remote-config-contract.ts';
import { parseRemoteConfigLayer, validateRemoteConfigValue } from './remote-config-validation.ts';

export { parseRemoteConfigLayer } from './remote-config-validation.ts';

const fail = (
  environment: RemoteEnvironment,
  code:
    | 'PROMOTE_CONFIG_SOURCE_FORBIDDEN'
    | 'PROMOTE_CONFIG_INVALID'
    | 'PROMOTE_CONFIG_REQUIRED_KEY_MISSING',
  summary: string,
  nextAction: string
): never => {
  throw new PromoteContractError({
    code,
    environment,
    phase: 'config-build',
    summary,
    retryable: false,
    nextAction,
  });
};

const assertRemoteSource = (environment: RemoteEnvironment, sourcePath: string) => {
  if (basename(sourcePath).endsWith('.local.vars')) {
    fail(
      environment,
      'PROMOTE_CONFIG_SOURCE_FORBIDDEN',
      'Eine lokale Override-Datei wurde als Remote-Quelle abgelehnt.',
      'Ein getracktes Profil unter config/runtime/remote/ und das geschuetzte Override-Bundle verwenden.'
    );
  }
};

export const buildRemoteAppConfig = (input: {
  environment: RemoteEnvironment;
  profile: string;
  overrides: string;
}) => {
  const profile = parseRemoteConfigLayer(input.environment, 'Remote-Profil', input.profile);
  const overrides = parseRemoteConfigLayer(
    input.environment,
    'geschuetztes Override-Bundle',
    input.overrides
  );
  if (
    input.environment !== 'staging' &&
    (overrides.values.has('FALLOW_BROWSER_INGEST_KEY') || overrides.values.has('BEACON_API_KEY'))
  )
    fail(
      input.environment,
      'PROMOTE_CONFIG_SOURCE_FORBIDDEN',
      'Fallow-Beacon-Schluessel sind nur in Staging erlaubt.',
      'Die Fallow-Beacon-Schluessel aus dem Dev- oder Production-Override entfernen.'
    );
  for (const key of profile.values.keys()) {
    if (remoteConfigContract[key]?.kind === 'secret-value')
      fail(
        input.environment,
        'PROMOTE_CONFIG_SOURCE_FORBIDDEN',
        `Sensitiver Schluessel ${key} ist im getrackten Remote-Profil nicht erlaubt.`,
        'Den Secret-Wert in das geschuetzte Override-Bundle verschieben.'
      );
  }
  for (const key of overrides.values.keys()) {
    if (remoteConfigContract[key]?.kind === 'config')
      fail(
        input.environment,
        'PROMOTE_CONFIG_INVALID',
        `Nicht-sensitiver Schluessel ${key} ist im geschuetzten Override-Bundle nicht erlaubt.`,
        'Den Schluessel in das getrackte Remote-Profil verschieben.'
      );
  }
  const merged = new Map([...profile.values, ...overrides.values]);
  const missing = requiredRemoteConfigKeys.filter((key) => !merged.has(key));
  if (missing.length > 0)
    fail(
      input.environment,
      'PROMOTE_CONFIG_REQUIRED_KEY_MISSING',
      `Pflichtschluessel fehlen: ${missing.join(', ')}.`,
      'Remote-Profil und geschuetztes Override-Bundle vervollstaendigen.'
    );
  for (const [key, value] of merged) validateRemoteConfigValue(input.environment, key, value);
  const keys = [...merged.keys()].sort();
  const source = `${keys.map((key) => `${key}=${merged.get(key) ?? ''}`).join('\n')}\n`;
  const configRevision = createHash('sha256')
    .update(
      keys
        .filter((key) => remoteConfigContract[key]?.kind === 'config')
        .map((key) => `${key}=${merged.get(key)}`)
        .join('\n')
    )
    .digest('hex');
  return {
    source,
    configRevision,
    keys,
    secretReferences: keys
      .filter((key) => remoteConfigContract[key]?.kind === 'secret-reference')
      .map((key) => merged.get(key) ?? ''),
  };
};

const writeConfigEvidenceOutputs = (
  candidate: Readonly<{ configRevision: string; secretReferences: readonly string[] }>,
  outputPath: string | undefined
): void => {
  if (!outputPath) return;
  appendFileSync(
    outputPath,
    `config_revision=${candidate.configRevision}\nsecret_references=${JSON.stringify(candidate.secretReferences)}\n`,
    'utf8'
  );
};

export const runBuildRemoteAppConfig = (
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): number => {
  const argument = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index === -1 ? undefined : args[index + 1];
  };
  const environment = argument('--environment') as RemoteEnvironment | undefined;
  const profilePath = argument('--profile');
  const outputPath = argument('--output');
  if (!environment || !['dev', 'staging', 'prod'].includes(environment)) return 2;
  try {
    if (!profilePath || !outputPath) return 2;
    assertRemoteSource(environment, profilePath);
    const overrideSourceName = env.PROMOTE_CONFIG_OVERRIDE_SOURCE ?? 'github-environment-secret';
    assertRemoteSource(environment, overrideSourceName);
    const configuredOverrides = env.PROMOTE_CONFIG_OVERRIDES?.trim();
    const protectedOverrides = configuredOverrides
      ? configuredOverrides
      : fail(
          environment,
          'PROMOTE_CONFIG_REQUIRED_KEY_MISSING',
          'Das geschuetzte Override-Bundle fehlt.',
          'PROMOTE_CONFIG_OVERRIDES im geschuetzten GitHub Environment konfigurieren.'
        );
    const stagingBeaconOverrides =
      environment === 'staging'
        ? ([
            ['FALLOW_BROWSER_INGEST_KEY', env.FALLOW_BROWSER_INGEST_KEY, /^fallow_pub_k1_[A-Za-z0-9_-]{16,}$/u],
            ['BEACON_API_KEY', env.BEACON_API_KEY, /^fallow_live_k1_[A-Za-z0-9_-]{16,}$/u],
          ] as const).map(([key, value, pattern]) => {
            if (!value || !pattern.test(value))
              fail(
                environment,
                'PROMOTE_CONFIG_REQUIRED_KEY_MISSING',
                `Geschuetztes Staging-Secret ${key} fehlt oder ist ungueltig.`,
                `${key} im GitHub-Environment staging setzen.`
              );
            return `${key}=${value}`;
          })
        : [];
    const candidate = buildRemoteAppConfig({
      environment,
      profile: readFileSync(resolve(profilePath), 'utf8'),
      overrides: [protectedOverrides, ...stagingBeaconOverrides].join('\n'),
    });
    writeConfigEvidenceOutputs(candidate, env.GITHUB_OUTPUT);
    writeFileSync(resolve(outputPath), candidate.source, { mode: 0o600 });
    return 0;
  } catch (error) {
    const failure = redactPromoteFailure(error, { environment, phase: 'config-build' });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    process.stderr.write(`${JSON.stringify(failure)}\n`);
    return 2;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exit(runBuildRemoteAppConfig(process.argv.slice(2)));
