import { isInstanceStatus, type InstanceRealmMode, type InstanceStatus } from '@sva/core';

export const instanceRegistryCommands = [
  'list',
  'create',
  'activate',
  'suspend',
  'archive',
  'backfill-admin-client',
] as const;

export type Command = (typeof instanceRegistryCommands)[number];

export type CliOptions = {
  readonly actorId?: string;
  readonly authClientId?: string;
  readonly authIssuerUrl?: string;
  readonly authRealm?: string;
  readonly tenantAdminClientId?: string;
  readonly tenantAdminClientSecret?: string;
  readonly command: Command;
  readonly displayName?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly idempotencyKey: string;
  readonly instanceId?: string;
  readonly jsonOutput: boolean;
  readonly mainserverConfigRef?: string;
  readonly parentDomain?: string;
  readonly realmMode: InstanceRealmMode;
  readonly search?: string;
  readonly status?: InstanceStatus;
  readonly themeKey?: string;
};

export const parseFeatureFlags = (raw?: string): Readonly<Record<string, boolean>> | undefined => {
  if (!raw) {
    return undefined;
  }

  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, value] = entry.split('=', 2);
      if (!key || (value !== 'true' && value !== 'false')) {
        throw new Error(`Ungültiges Feature-Flag-Format: ${entry}. Erwartet wird key=true|false.`);
      }
      return [key, value === 'true'] as const;
    });

  return Object.fromEntries(entries);
};

export const parseStatusOption = (value: string | undefined): InstanceStatus | undefined => {
  if (!value) {
    return undefined;
  }

  if (!isInstanceStatus(value)) {
    throw new Error(`Ungültiger Statuswert für --status: ${value}.`);
  }

  return value;
};

export const deriveTenantAdminClientId = (authClientId: string, explicitTenantAdminClientId?: string): string =>
  explicitTenantAdminClientId?.trim() || `${authClientId.trim()}-admin`;

export const isReadCommand = (command: Command): boolean => command === 'list';
