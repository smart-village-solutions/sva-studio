#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PromoteContractError, redactPromoteFailure } from './promote-result.ts';
import { remoteConfigContract, requiredRemoteConfigKeys, type RemoteEnvironment } from './remote-config-contract.ts';

const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const referencePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u;
const placeholderPattern = /^(?:__SET(?:_[A-Z0-9_]+)?__|changeme|todo)$/iu;

type ParsedLayer = Readonly<{ name: string; values: ReadonlyMap<string, string> }>;

const fail = (environment: RemoteEnvironment, code: 'PROMOTE_CONFIG_SOURCE_FORBIDDEN' | 'PROMOTE_CONFIG_INVALID' | 'PROMOTE_CONFIG_REQUIRED_KEY_MISSING', summary: string, nextAction: string): never => {
  throw new PromoteContractError({ code, environment, phase: 'config-build', summary, retryable: false, nextAction });
};

const assertRemoteSource = (environment: RemoteEnvironment, sourcePath: string) => {
  if (basename(sourcePath).endsWith('.local.vars')) {
    fail(environment, 'PROMOTE_CONFIG_SOURCE_FORBIDDEN', 'Eine lokale Override-Datei wurde als Remote-Quelle abgelehnt.', 'Ein getracktes Profil unter config/runtime/remote/ und das geschuetzte Override-Bundle verwenden.');
  }
};

export const parseRemoteConfigLayer = (environment: RemoteEnvironment, name: string, source: string): ParsedLayer => {
  const values = new Map<string, string>();
  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = line.indexOf('=');
    const key = separator > 0 ? line.slice(0, separator).trim() : '';
    if (!keyPattern.test(key)) fail(environment, 'PROMOTE_CONFIG_INVALID', `Ungueltiger Eintrag in ${name}, Zeile ${index + 1}.`, 'Nur KEY=VALUE-Eintraege mit gueltigen Umgebungsvariablennamen verwenden.');
    if (values.has(key)) fail(environment, 'PROMOTE_CONFIG_INVALID', `Doppelter Schluessel ${key} in ${name}.`, 'Jeden Schluessel pro Config-Schicht genau einmal definieren.');
    if (!remoteConfigContract[key]) fail(environment, 'PROMOTE_CONFIG_INVALID', `Unbekannter Remote-Config-Schluessel ${key}.`, 'Schluessel klassifizieren oder aus dem Remote-Bundle entfernen.');
    values.set(key, line.slice(separator + 1));
  });
  return { name, values };
};

const validateValue = (environment: RemoteEnvironment, key: string, value: string) => {
  const contract = remoteConfigContract[key];
  if (!contract) return;
  const normalizedValue = value.trim();
  if ((!normalizedValue && key !== 'SVA_ALLOWED_INSTANCE_IDS') || placeholderPattern.test(normalizedValue)) fail(environment, 'PROMOTE_CONFIG_INVALID', `Schluessel ${key} enthaelt keinen produktionsfaehigen Wert.`, 'Den Wert im zulaessigen Profil oder geschuetzten Override-Bundle setzen.');
  if (contract.kind === 'secret-reference' && !referencePattern.test(normalizedValue)) fail(environment, 'PROMOTE_CONFIG_INVALID', `Secret-Referenz ${key} ist ungueltig.`, 'Nur den Namen des vorhandenen externen Secrets eintragen.');
  if (contract.type === 'boolean' && normalizedValue !== 'true' && normalizedValue !== 'false') fail(environment, 'PROMOTE_CONFIG_INVALID', `Schluessel ${key} erwartet true oder false.`, 'Einen booleschen Wert setzen.');
  if (contract.type === 'integer' && (!/^\d+$/u.test(normalizedValue) || Number(normalizedValue) < 1)) fail(environment, 'PROMOTE_CONFIG_INVALID', `Schluessel ${key} erwartet eine positive Ganzzahl.`, 'Eine positive Ganzzahl setzen.');
  if (contract.type === 'url') {
    try { new URL(normalizedValue); } catch { fail(environment, 'PROMOTE_CONFIG_INVALID', `Schluessel ${key} erwartet eine absolute URL.`, 'Eine gueltige absolute URL setzen.'); }
  }
};

export const buildRemoteAppConfig = (input: { environment: RemoteEnvironment; profile: string; overrides: string }) => {
  const profile = parseRemoteConfigLayer(input.environment, 'Remote-Profil', input.profile);
  const overrides = parseRemoteConfigLayer(input.environment, 'geschuetztes Override-Bundle', input.overrides);
  for (const key of overrides.values.keys()) {
    if (remoteConfigContract[key]?.kind === 'config') fail(input.environment, 'PROMOTE_CONFIG_INVALID', `Nicht-sensitiver Schluessel ${key} ist im geschuetzten Override-Bundle nicht erlaubt.`, 'Den Schluessel in das getrackte Remote-Profil verschieben.');
  }
  const merged = new Map([...profile.values, ...overrides.values]);
  const missing = requiredRemoteConfigKeys.filter((key) => !merged.has(key));
  if (missing.length > 0) fail(input.environment, 'PROMOTE_CONFIG_REQUIRED_KEY_MISSING', `Pflichtschluessel fehlen: ${missing.join(', ')}.`, 'Remote-Profil und geschuetztes Override-Bundle vervollstaendigen.');
  for (const [key, value] of merged) validateValue(input.environment, key, value);
  const keys = [...merged.keys()].sort();
  const source = `${keys.map((key) => `${key}=${merged.get(key) ?? ''}`).join('\n')}\n`;
  const configRevision = createHash('sha256').update(keys.filter((key) => remoteConfigContract[key]?.kind === 'config').map((key) => `${key}=${merged.get(key)}`).join('\n')).digest('hex');
  return { source, configRevision, keys, secretReferences: keys.filter((key) => remoteConfigContract[key]?.kind === 'secret-reference').map((key) => merged.get(key) ?? '') };
};

export const compareRemoteConfigShadow = (environment: RemoteEnvironment, legacySource: string, candidate: ReturnType<typeof buildRemoteAppConfig>) => {
  const legacy = parseRemoteConfigLayer(environment, 'bestehender APP_CONFIG-Pfad', legacySource);
  const legacyKeys = [...legacy.values.keys()].sort();
  const missing = legacyKeys.filter((key) => !candidate.keys.includes(key));
  const additional = candidate.keys.filter((key) => !legacy.values.has(key));
  const configValueMismatches = candidate.keys.filter((key) => remoteConfigContract[key]?.kind === 'config' && legacy.values.has(key) && legacy.values.get(key) !== parseRemoteConfigLayer(environment, 'Candidate', candidate.source).values.get(key));
  return { equivalent: missing.length === 0 && additional.length === 0 && configValueMismatches.length === 0, missing, additional, configValueMismatches };
};

export const runBuildRemoteAppConfig = (args: readonly string[], env: NodeJS.ProcessEnv = process.env): number => {
  const environment = args[args.indexOf('--environment') + 1] as RemoteEnvironment | undefined;
  const profilePath = args[args.indexOf('--profile') + 1];
  const outputPath = args[args.indexOf('--output') + 1];
  const shadow = args.includes('--shadow');
  if (!environment || !['dev', 'staging', 'prod'].includes(environment) || !profilePath || !outputPath) return 2;
  try {
    assertRemoteSource(environment, profilePath);
    const overrideSourceName = env.PROMOTE_CONFIG_OVERRIDE_SOURCE ?? 'github-environment-secret';
    assertRemoteSource(environment, overrideSourceName);
    const legacySource = env.APP_CONFIG ?? '';
    const explicitOverrides = env.PROMOTE_CONFIG_OVERRIDES?.trim() ? env.PROMOTE_CONFIG_OVERRIDES : undefined;
    const shadowOverrides = shadow && explicitOverrides === undefined
      ? [...parseRemoteConfigLayer(environment, 'bestehender APP_CONFIG-Pfad', legacySource).values]
          .filter(([key]) => remoteConfigContract[key]?.kind !== 'config')
          .map(([key, value]) => `${key}=${value}`)
          .join('\n')
      : undefined;
    const candidate = buildRemoteAppConfig({ environment, profile: readFileSync(resolve(profilePath), 'utf8'), overrides: explicitOverrides ?? shadowOverrides ?? '' });
    if (shadow) {
      const comparison = compareRemoteConfigShadow(environment, legacySource, candidate);
      process.stdout.write(`${JSON.stringify({ mode: 'shadow', configRevision: candidate.configRevision, secretReferences: candidate.secretReferences, ...comparison })}\n`);
      if (!comparison.equivalent) process.stdout.write('::warning::PROMOTE_CONFIG_SHADOW_MISMATCH: Der neue Config-Builder ist noch nicht aequivalent zum bestehenden Pfad.\n');
      return 0;
    }
    writeFileSync(resolve(outputPath), candidate.source, { mode: 0o600 });
    return 0;
  } catch (error) {
    const failure = redactPromoteFailure(error, { environment, phase: 'config-build' });
    process.stderr.write(`${JSON.stringify(failure)}\n`);
    return 2;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(runBuildRemoteAppConfig(process.argv.slice(2)));
