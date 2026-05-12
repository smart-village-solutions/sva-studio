import type {
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
} from '@sva/core';

export type ExternalInterfaceTypeRow = {
  readonly type_key: string;
  readonly owner_kind: 'host' | 'plugin';
  readonly owner_id: string;
  readonly display_name: string;
  readonly category: 'api' | 'object_storage' | 'database' | 'feed';
  readonly public_schema_json: Record<string, unknown>;
  readonly secret_schema_json: Record<string, unknown>;
  readonly status_check_kind: 'none' | 'sva_mainserver' | 's3' | 'supabase';
  readonly enabled: boolean;
};

export type ExternalInterfaceRow = {
  readonly id: string;
  readonly instance_id: string;
  readonly type_key: string;
  readonly owner_kind: 'host' | 'plugin';
  readonly owner_id: string;
  readonly display_name: string;
  readonly alias: string;
  readonly enabled: boolean;
  readonly is_default: boolean;
  readonly category: 'api' | 'object_storage' | 'database' | 'feed';
  readonly base_url: string | null;
  readonly auth_mode: string | null;
  readonly public_config_json: Record<string, unknown>;
  readonly secret_config_ciphertext: string | null;
  readonly status_check_kind: 'none' | 'sva_mainserver' | 's3' | 'supabase';
  readonly visible_status: 'not_configured' | 'unknown' | 'ok' | 'error' | 'disabled';
  readonly last_checked_at: string | null;
  readonly last_check_status: 'succeeded' | 'failed' | null;
  readonly last_check_error_code: string | null;
  readonly last_check_error_message: string | null;
  readonly created_at: string | null;
  readonly updated_at: string | null;
};

export const mapTypeRow = (row: ExternalInterfaceTypeRow): ExternalInterfaceTypeDefinition => ({
  typeKey: row.type_key,
  ownerKind: row.owner_kind,
  ownerId: row.owner_id,
  displayName: row.display_name,
  category: row.category,
  publicSchema: row.public_schema_json,
  secretSchema: row.secret_schema_json,
  statusCheckKind: row.status_check_kind,
  enabled: row.enabled,
});

export const mapInterfaceRow = (row: ExternalInterfaceRow): ExternalInterfaceRecord => ({
  id: row.id,
  instanceId: row.instance_id,
  typeKey: row.type_key,
  ownerKind: row.owner_kind,
  ownerId: row.owner_id,
  displayName: row.display_name,
  alias: row.alias,
  enabled: row.enabled,
  isDefault: row.is_default,
  category: row.category,
  baseUrl: row.base_url ?? undefined,
  authMode: row.auth_mode ?? undefined,
  publicConfig: row.public_config_json,
  secretConfigCiphertext: row.secret_config_ciphertext ?? undefined,
  statusCheckKind: row.status_check_kind,
  visibleStatus: row.visible_status,
  lastCheckedAt: row.last_checked_at ?? undefined,
  lastCheckStatus: row.last_check_status ?? undefined,
  lastCheckErrorCode: row.last_check_error_code ?? undefined,
  lastCheckErrorMessage: row.last_check_error_message ?? undefined,
  createdAt: row.created_at ?? undefined,
  updatedAt: row.updated_at ?? undefined,
});
