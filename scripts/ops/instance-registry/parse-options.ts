import { randomUUID } from 'node:crypto';

import type { InstanceRealmMode } from '@sva/core';

import {
  instanceRegistryCommands,
  parseFeatureFlags,
  parseStatusOption,
  type CliOptions,
  type Command,
} from './shared.js';

const readOptionValue = (args: readonly string[], index: number) => {
  const current = args[index];
  if (!current) {
    throw new Error('Fehlende Option.');
  }

  const [flag, inlineValue] = current.split('=', 2);
  if (inlineValue !== undefined) {
    return { flag, nextIndex: index, value: inlineValue };
  }

  const next = args[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`Option ${flag} erwartet einen Wert.`);
  }

  return { flag, nextIndex: index + 1, value: next };
};

export const assertRequired = (value: string | undefined, flag: string): string => {
  if (!value?.trim()) {
    throw new Error(`Option ${flag} ist erforderlich.`);
  }

  return value.trim();
};

export const parseInstanceRegistryCliOptions = (argv: readonly string[]): CliOptions => {
  const [commandRaw, ...rawOptions] = argv;
  if (!commandRaw || !instanceRegistryCommands.includes(commandRaw as Command)) {
    throw new Error(
      'Befehl fehlt oder ist ungültig. Erlaubt: list, create, activate, suspend, archive, backfill-admin-client.'
    );
  }

  const parsed: {
    actorId?: string;
    authClientId?: string;
    authIssuerUrl?: string;
    authRealm?: string;
    tenantAdminClientId?: string;
    tenantAdminClientSecret?: string;
    displayName?: string;
    featureFlagsRaw?: string;
    instanceId?: string;
    jsonOutput: boolean;
    mainserverConfigRef?: string;
    parentDomain?: string;
    realmMode?: InstanceRealmMode;
    search?: string;
    status?: string;
    themeKey?: string;
    idempotencyKey?: string;
  } = {
    jsonOutput: false,
    realmMode: 'new',
  };

  for (let index = 0; index < rawOptions.length; index += 1) {
    const option = rawOptions[index];
    if (option === '--json') {
      parsed.jsonOutput = true;
      continue;
    }

    const { flag, nextIndex, value } = readOptionValue(rawOptions, index);
    index = nextIndex;

    switch (flag) {
      case '--actor-id':
        parsed.actorId = value;
        break;
      case '--auth-client-id':
        parsed.authClientId = value;
        break;
      case '--auth-issuer-url':
        parsed.authIssuerUrl = value;
        break;
      case '--auth-realm':
        parsed.authRealm = value;
        break;
      case '--tenant-admin-client-id':
        parsed.tenantAdminClientId = value;
        break;
      case '--tenant-admin-client-secret':
        parsed.tenantAdminClientSecret = value;
        break;
      case '--instance-id':
        parsed.instanceId = value;
        break;
      case '--display-name':
        parsed.displayName = value;
        break;
      case '--parent-domain':
        parsed.parentDomain = value;
        break;
      case '--realm-mode':
        if (value !== 'new' && value !== 'existing') {
          throw new Error(`Ungültiger Realm-Modus: ${value}. Erlaubt: new, existing.`);
        }
        parsed.realmMode = value;
        break;
      case '--theme-key':
        parsed.themeKey = value;
        break;
      case '--mainserver-config-ref':
        parsed.mainserverConfigRef = value;
        break;
      case '--feature-flags':
        parsed.featureFlagsRaw = value;
        break;
      case '--search':
        parsed.search = value;
        break;
      case '--status':
        parsed.status = value;
        break;
      case '--idempotency-key':
        parsed.idempotencyKey = value;
        break;
      default:
        throw new Error(`Unbekannte Option: ${flag}`);
    }
  }

  return {
    actorId: parsed.actorId,
    authClientId: parsed.authClientId,
    authIssuerUrl: parsed.authIssuerUrl,
    authRealm: parsed.authRealm,
    tenantAdminClientId: parsed.tenantAdminClientId,
    tenantAdminClientSecret: parsed.tenantAdminClientSecret,
    command: commandRaw as Command,
    displayName: parsed.displayName,
    featureFlags: parseFeatureFlags(parsed.featureFlagsRaw),
    idempotencyKey: parsed.idempotencyKey ?? randomUUID(),
    instanceId: parsed.instanceId,
    jsonOutput: parsed.jsonOutput,
    mainserverConfigRef: parsed.mainserverConfigRef,
    parentDomain: parsed.parentDomain,
    realmMode: parsed.realmMode ?? 'new',
    search: parsed.search,
    status: parseStatusOption(parsed.status),
    themeKey: parsed.themeKey,
  };
};
