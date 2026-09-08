import type { Pool } from 'pg';

export {
  readSsfConfigurationOverrides,
  type SsfConfigurationOverrides,
} from './repository.overrides.js';
import {
  readCanonicalInstanceId,
  withTenantTransaction,
} from './repository.transaction.js';
import type {
  SsfServerLocaleOverride,
  SsfTenantLocaleOverride,
  SsfTenantSettings,
} from './resolver.js';

type SsfTenantRecord = Readonly<{
  instanceId: string;
  status: 'prepared';
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}>;

type SsfTenantRow = {
  instance_id: string;
  status: string;
  revision: string | number;
  created_at: Date;
  updated_at: Date;
};

const mapSsfTenantRow = (row: SsfTenantRow): SsfTenantRecord => {
  const revision = Number(row.revision);
  if (row.status !== 'prepared' || !Number.isSafeInteger(revision) || revision <= 0) {
    throw new Error('ssf_tenant_state_invalid');
  }
  return {
    instanceId: row.instance_id,
    status: 'prepared',
    revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export interface SsfServerSettingsWrite {
  readonly defaultLocale: string | null;
  readonly logoMediaReference: string | null;
  readonly iconMediaReference: string | null;
}

export interface SsfServerLocaleWrite extends SsfServerLocaleOverride {
  readonly available: boolean | null;
}

export interface SsfTenantSettingsWrite extends SsfTenantSettings {
  readonly instanceId: string;
  readonly defaultLocale: string | null;
  readonly customBrandingAllowed: boolean | null;
  readonly conversationContentStorageAllowed: boolean | null;
  readonly conversationContentStorageMode: 'ask' | 'disabled' | null;
  readonly logoMediaReference: string | null;
  readonly iconMediaReference: string | null;
}

export interface SsfTenantLocaleWrite extends SsfTenantLocaleOverride {
  readonly instanceId: string;
  readonly enabled: boolean | null;
}

const tenantColumns = 'instance_id, status, revision, created_at, updated_at';

export const provisionSsfTenant = async (
  pool: Pool,
  instanceId: string
): Promise<SsfTenantRecord> => {
  const normalizedInstanceId = readCanonicalInstanceId(instanceId);
  return withTenantTransaction(pool, normalizedInstanceId, false, async (client) => {
    await client.query(
      `INSERT INTO ssf.tenants (instance_id)
       VALUES ($1)
       ON CONFLICT (instance_id) DO NOTHING`,
      [normalizedInstanceId]
    );
    const result = await client.query<SsfTenantRow>(
      `SELECT ${tenantColumns}
         FROM ssf.tenants
        WHERE instance_id = $1`,
      [normalizedInstanceId]
    );
    const row = result.rows[0];
    if (!row) throw new Error('ssf_tenant_readback_failed');
    return mapSsfTenantRow(row);
  });
};

export const readSsfTenant = async (
  pool: Pool,
  instanceId: string
): Promise<SsfTenantRecord | null> => {
  const normalizedInstanceId = readCanonicalInstanceId(instanceId);
  return withTenantTransaction(pool, normalizedInstanceId, true, async (client) => {
    const result = await client.query<SsfTenantRow>(
      `SELECT ${tenantColumns}
         FROM ssf.tenants
        WHERE instance_id = $1`,
      [normalizedInstanceId]
    );
    const row = result.rows[0];
    return row ? mapSsfTenantRow(row) : null;
  });
};

export const upsertSsfServerSettings = async (
  pool: Pool,
  settings: SsfServerSettingsWrite
): Promise<void> => {
  await pool.query(
    `INSERT INTO ssf.server_settings (
       singleton, default_locale, logo_media_reference, icon_media_reference
     ) VALUES (true, $1, $2, $3)
     ON CONFLICT (singleton) DO UPDATE SET
       default_locale = EXCLUDED.default_locale,
       logo_media_reference = EXCLUDED.logo_media_reference,
       icon_media_reference = EXCLUDED.icon_media_reference,
       updated_at = now()`,
    [settings.defaultLocale, settings.logoMediaReference, settings.iconMediaReference]
  );
};

export const upsertSsfServerLocale = async (
  pool: Pool,
  locale: SsfServerLocaleWrite
): Promise<void> => {
  await pool.query(
    `INSERT INTO ssf.server_locales (
       locale, available, authenticated_home_explanation_html,
       guest_explanation_html, conversation_content_storage_question_html
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (locale) DO UPDATE SET
       available = EXCLUDED.available,
       authenticated_home_explanation_html = EXCLUDED.authenticated_home_explanation_html,
       guest_explanation_html = EXCLUDED.guest_explanation_html,
       conversation_content_storage_question_html =
         EXCLUDED.conversation_content_storage_question_html,
       updated_at = now()`,
    [
      locale.locale,
      locale.available,
      locale.authenticatedHomeExplanationHtml ?? null,
      locale.guestExplanationHtml ?? null,
      locale.conversationContentStorageQuestionHtml ?? null,
    ]
  );
};

export const upsertSsfTenantSettings = async (
  pool: Pool,
  settings: SsfTenantSettingsWrite
): Promise<void> =>
  withTenantTransaction(pool, settings.instanceId, false, async (client) => {
    await client.query(
      `INSERT INTO ssf.tenant_settings (
         instance_id, default_locale, custom_branding_allowed,
         conversation_content_storage_allowed, conversation_content_storage_mode,
         logo_media_reference, icon_media_reference
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (instance_id) DO UPDATE SET
         default_locale = EXCLUDED.default_locale,
         custom_branding_allowed = EXCLUDED.custom_branding_allowed,
         conversation_content_storage_allowed = EXCLUDED.conversation_content_storage_allowed,
         conversation_content_storage_mode = EXCLUDED.conversation_content_storage_mode,
         logo_media_reference = EXCLUDED.logo_media_reference,
         icon_media_reference = EXCLUDED.icon_media_reference,
         updated_at = now()
       WHERE ssf.tenant_settings.instance_id = $1`,
      [
        settings.instanceId,
        settings.defaultLocale,
        settings.customBrandingAllowed,
        settings.conversationContentStorageAllowed,
        settings.conversationContentStorageMode,
        settings.logoMediaReference,
        settings.iconMediaReference,
      ]
    );
  });

export const upsertSsfTenantLocale = async (
  pool: Pool,
  locale: SsfTenantLocaleWrite
): Promise<void> =>
  withTenantTransaction(pool, locale.instanceId, false, async (client) => {
    await client.query(
      `INSERT INTO ssf.tenant_locales (
         instance_id, locale, enabled, authenticated_home_explanation_html,
         guest_explanation_html, conversation_content_storage_question_html
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (instance_id, locale) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         authenticated_home_explanation_html = EXCLUDED.authenticated_home_explanation_html,
         guest_explanation_html = EXCLUDED.guest_explanation_html,
         conversation_content_storage_question_html =
           EXCLUDED.conversation_content_storage_question_html,
         updated_at = now()
       WHERE ssf.tenant_locales.instance_id = $1
         AND ssf.tenant_locales.locale = $2`,
      [
        locale.instanceId,
        locale.locale,
        locale.enabled,
        locale.authenticatedHomeExplanationHtml ?? null,
        locale.guestExplanationHtml ?? null,
        locale.conversationContentStorageQuestionHtml ?? null,
      ]
    );
  });
