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

export const buildSelectedRemoteConfigEvidence = (
  environment: RemoteEnvironment,
  source: string
) => {
  const selected = parseRemoteConfigLayer(environment, 'selektiertes Deploy-Bundle', source);
  const missing = requiredRemoteConfigKeys.filter((key) => !selected.values.has(key));
  if (missing.length > 0)
    fail(
      environment,
      'PROMOTE_CONFIG_REQUIRED_KEY_MISSING',
      `Pflichtschluessel fehlen: ${missing.join(', ')}.`,
      'Das selektierte Deploy-Bundle vervollstaendigen.'
    );
  for (const [key, value] of selected.values) validateRemoteConfigValue(environment, key, value);
  const keys = [...selected.values.keys()].sort();
  const configRevision = createHash('sha256')
    .update(
      keys
        .filter((key) => remoteConfigContract[key]?.kind === 'config')
        .map((key) => `${key}=${selected.values.get(key)}`)
        .join('\n')
    )
    .digest('hex');
  return {
    configRevision,
    secretReferences: keys
      .filter((key) => remoteConfigContract[key]?.kind === 'secret-reference')
      .map((key) => selected.values.get(key) ?? ''),
  };
};

export const compareRemoteConfigShadow = (
  environment: RemoteEnvironment,
  legacySource: string,
  candidate: ReturnType<typeof buildRemoteAppConfig>
) => {
  const legacy = parseRemoteConfigLayer(environment, 'bestehender APP_CONFIG-Pfad', legacySource);
  const candidateLayer = parseRemoteConfigLayer(environment, 'Candidate', candidate.source);
  const legacyKeys = [...legacy.values.keys()].sort();
  const missing = legacyKeys.filter((key) => !candidate.keys.includes(key));
  const additional = candidate.keys.filter((key) => !legacy.values.has(key));
  const configValueMismatches = candidate.keys.filter(
    (key) =>
      remoteConfigContract[key]?.kind === 'config' &&
      legacy.values.has(key) &&
      legacy.values.get(key) !== candidateLayer.values.get(key)
  );
  const secretReferenceMismatches = candidate.keys.filter(
    (key) =>
      remoteConfigContract[key]?.kind === 'secret-reference' &&
      legacy.values.has(key) &&
      legacy.values.get(key) !== candidateLayer.values.get(key)
  );
  return {
    equivalent:
      missing.length === 0 &&
      additional.length === 0 &&
      configValueMismatches.length === 0 &&
      secretReferenceMismatches.length === 0,
    missing,
    additional,
    configValueMismatches,
    secretReferenceMismatches,
  };
};

export const selectProtectedOverrides = (
  environment: RemoteEnvironment,
  legacySource: string,
  explicitOverrides?: string
): string => {
  if (explicitOverrides?.trim()) return explicitOverrides;
  return [
    ...parseRemoteConfigLayer(environment, 'bestehender APP_CONFIG-Pfad', legacySource).values,
  ]
    .filter(([key]) => remoteConfigContract[key]?.kind !== 'config')
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
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
  const selectedInputPath = argument('--selected-input');
  const profilePath = argument('--profile');
  const outputPath = argument('--output');
  const shadow = args.includes('--shadow');
  if (!environment || !['dev', 'staging', 'prod'].includes(environment)) return 2;
  try {
    if (selectedInputPath) {
      writeConfigEvidenceOutputs(
        buildSelectedRemoteConfigEvidence(
          environment,
          readFileSync(resolve(selectedInputPath), 'utf8')
        ),
        env.GITHUB_OUTPUT
      );
      return 0;
    }
    if (!profilePath || !outputPath) return 2;
    assertRemoteSource(environment, profilePath);
    const overrideSourceName = env.PROMOTE_CONFIG_OVERRIDE_SOURCE ?? 'github-environment-secret';
    assertRemoteSource(environment, overrideSourceName);
    const legacySource = env.APP_CONFIG ?? '';
    const explicitOverrides = env.PROMOTE_CONFIG_OVERRIDES?.trim()
      ? env.PROMOTE_CONFIG_OVERRIDES
      : undefined;
    const protectedOverrides = selectProtectedOverrides(
      environment,
      legacySource,
      explicitOverrides
    );
    const candidate = buildRemoteAppConfig({
      environment,
      profile: readFileSync(resolve(profilePath), 'utf8'),
      overrides: protectedOverrides,
    });
    writeConfigEvidenceOutputs(candidate, env.GITHUB_OUTPUT);
    if (shadow) {
      const comparison = compareRemoteConfigShadow(environment, legacySource, candidate);
      process.stdout.write(
        `${JSON.stringify({ mode: 'shadow', configRevision: candidate.configRevision, secretReferences: candidate.secretReferences, ...comparison })}\n`
      );
      if (!comparison.equivalent)
        process.stdout.write(
          '::warning::PROMOTE_CONFIG_SHADOW_MISMATCH: Der neue Config-Builder ist noch nicht aequivalent zum bestehenden Pfad.\n'
        );
      return 0;
    }
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
