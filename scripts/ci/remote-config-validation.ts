import { PromoteContractError } from './promote-result.ts';
import { remoteConfigContract, type RemoteEnvironment } from './remote-config-contract.ts';

const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const referencePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,127}$/u;
const placeholderPattern = /^(?:__SET(?:_[A-Z0-9_]+)?__|changeme|todo)$/iu;

type ParsedLayer = Readonly<{ name: string; values: ReadonlyMap<string, string> }>;

const fail = (
  environment: RemoteEnvironment,
  code: 'PROMOTE_CONFIG_INVALID',
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

export const parseRemoteConfigLayer = (
  environment: RemoteEnvironment,
  name: string,
  source: string
): ParsedLayer => {
  const values = new Map<string, string>();
  const unknownKeys = new Set<string>();
  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = line.indexOf('=');
    const key = separator > 0 ? line.slice(0, separator).trim() : '';
    if (!keyPattern.test(key))
      fail(
        environment,
        'PROMOTE_CONFIG_INVALID',
        `Ungueltiger Eintrag in ${name}, Zeile ${index + 1}.`,
        'Nur KEY=VALUE-Eintraege mit gueltigen Umgebungsvariablennamen verwenden.'
      );
    if (values.has(key))
      fail(
        environment,
        'PROMOTE_CONFIG_INVALID',
        `Doppelter Schluessel ${key} in ${name}.`,
        'Jeden Schluessel pro Config-Schicht genau einmal definieren.'
      );
    if (!Object.hasOwn(remoteConfigContract, key)) {
      unknownKeys.add(key);
      return;
    }
    values.set(key, line.slice(separator + 1).trim());
  });
  if (unknownKeys.size > 0)
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Unbekannte Remote-Config-Schluessel: ${[...unknownKeys].sort().join(', ')}.`,
      'Schluessel klassifizieren oder aus dem Remote-Bundle entfernen.'
    );
  return { name, values };
};

export const validateRemoteConfigValue = (
  environment: RemoteEnvironment,
  key: string,
  value: string
) => {
  const contract = remoteConfigContract[key];
  if (!contract) return;
  const normalizedValue = value.trim();
  if (
    (!normalizedValue && key !== 'SVA_ALLOWED_INSTANCE_IDS') ||
    placeholderPattern.test(normalizedValue)
  )
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Schluessel ${key} enthaelt keinen produktionsfaehigen Wert.`,
      'Den Wert im zulaessigen Profil oder geschuetzten Override-Bundle setzen.'
    );
  if (contract.kind === 'secret-reference' && !referencePattern.test(normalizedValue))
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Secret-Referenz ${key} ist ungueltig.`,
      'Nur den Namen des vorhandenen externen Secrets eintragen.'
    );
  if (contract.type === 'boolean' && normalizedValue !== 'true' && normalizedValue !== 'false')
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Schluessel ${key} erwartet true oder false.`,
      'Einen booleschen Wert setzen.'
    );
  if (
    contract.type === 'integer' &&
    (!/^\d+$/u.test(normalizedValue) || Number(normalizedValue) < 1)
  )
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Schluessel ${key} erwartet eine positive Ganzzahl.`,
      'Eine positive Ganzzahl setzen.'
    );
  if (contract.allowedValues && !contract.allowedValues.includes(normalizedValue))
    fail(
      environment,
      'PROMOTE_CONFIG_INVALID',
      `Schluessel ${key} enthaelt keinen erlaubten Wert.`,
      `Einen der Werte ${contract.allowedValues.join(', ')} setzen.`
    );
  if (contract.type === 'url') {
    try {
      new URL(normalizedValue);
    } catch {
      fail(
        environment,
        'PROMOTE_CONFIG_INVALID',
        `Schluessel ${key} erwartet eine absolute URL.`,
        'Eine gueltige absolute URL setzen.'
      );
    }
  }
};
