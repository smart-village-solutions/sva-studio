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

type ParsedCliOptions = {
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
};

type ParsedCliOptionSetter = (parsed: ParsedCliOptions, value: string) => void;

const parseRealmModeOption = (value: string): InstanceRealmMode => {
  if (value !== 'new' && value !== 'existing') {
    throw new Error(`Ungültiger Realm-Modus: ${value}. Erlaubt: new, existing.`);
  }

  return value;
};

const optionSetters: Readonly<Record<string, ParsedCliOptionSetter>> = {
  '--actor-id': (parsed, value) => {
    parsed.actorId = value;
  },
  '--auth-client-id': (parsed, value) => {
    parsed.authClientId = value;
  },
  '--auth-issuer-url': (parsed, value) => {
    parsed.authIssuerUrl = value;
  },
  '--auth-realm': (parsed, value) => {
    parsed.authRealm = value;
  },
  '--tenant-admin-client-id': (parsed, value) => {
    parsed.tenantAdminClientId = value;
  },
  '--tenant-admin-client-secret': (parsed, value) => {
    parsed.tenantAdminClientSecret = value;
  },
  '--instance-id': (parsed, value) => {
    parsed.instanceId = value;
  },
  '--display-name': (parsed, value) => {
    parsed.displayName = value;
  },
  '--parent-domain': (parsed, value) => {
    parsed.parentDomain = value;
  },
  '--realm-mode': (parsed, value) => {
    parsed.realmMode = parseRealmModeOption(value);
  },
  '--theme-key': (parsed, value) => {
    parsed.themeKey = value;
  },
  '--mainserver-config-ref': (parsed, value) => {
    parsed.mainserverConfigRef = value;
  },
  '--feature-flags': (parsed, value) => {
    parsed.featureFlagsRaw = value;
  },
  '--search': (parsed, value) => {
    parsed.search = value;
  },
  '--status': (parsed, value) => {
    parsed.status = value;
  },
  '--idempotency-key': (parsed, value) => {
    parsed.idempotencyKey = value;
  },
};

const applyOption = (parsed: ParsedCliOptions, flag: string, value: string): void => {
  const setter = optionSetters[flag];
  if (!setter) {
    throw new Error(`Unbekannte Option: ${flag}`);
  }

  setter(parsed, value);
};

export const parseInstanceRegistryCliOptions = (argv: readonly string[]): CliOptions => {
  const [commandRaw, ...rawOptions] = argv;
  if (!commandRaw || !instanceRegistryCommands.includes(commandRaw as Command)) {
    throw new Error(
      'Befehl fehlt oder ist ungültig. Erlaubt: list, create, activate, suspend, archive, backfill-admin-client.'
    );
  }

  const parsed: ParsedCliOptions = {
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
    applyOption(parsed, flag, value);
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
