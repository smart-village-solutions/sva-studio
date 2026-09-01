import type { Pool, PoolClient } from 'pg';

import type {
  ServerLocaleRow,
  ServerSettingsRow,
  TenantLocaleRow,
  TenantSettingsRow,
} from './repository.rows.js';
import type {
  SsfServerLocaleOverride,
  SsfServerSettings,
  SsfTenantLocaleOverride,
  SsfTenantSettings,
} from './resolver.js';

export interface SsfConfigurationOverrides {
  readonly serverSettings: SsfServerSettings | null;
  readonly serverLocales: readonly SsfServerLocaleOverride[];
  readonly tenantSettings: SsfTenantSettings | null;
  readonly tenantLocales: readonly SsfTenantLocaleOverride[];
}

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

const withTenantTransaction = async <T>(
  pool: Pool,
  instanceId: string,
  readOnly: boolean,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN READ ONLY' : 'BEGIN');
    await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', instanceId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the operation failure; a broken connection may also reject ROLLBACK.
    }
    throw error;
  } finally {
    client.release();
  }
};

export const readSsfConfigurationOverrides = async (
  pool: Pool,
  instanceId: string
): Promise<SsfConfigurationOverrides> =>
  withTenantTransaction(pool, instanceId, true, async (client) => {
    const serverSettingsResult = await client.query<ServerSettingsRow>(
      `SELECT default_locale, logo_media_reference, icon_media_reference
         FROM ssf.server_settings
        WHERE singleton = true`
    );
    const serverLocalesResult = await client.query<ServerLocaleRow>(
      `SELECT locale, available, authenticated_home_explanation_html,
              guest_explanation_html, conversation_content_storage_question_html
         FROM ssf.server_locales
        ORDER BY locale`
    );
    const tenantSettingsResult = await client.query<TenantSettingsRow>(
      `SELECT default_locale, custom_branding_allowed,
              conversation_content_storage_allowed, conversation_content_storage_mode,
              logo_media_reference, icon_media_reference
         FROM ssf.tenant_settings
        WHERE instance_id = $1`,
      [instanceId]
    );
    const tenantLocalesResult = await client.query<TenantLocaleRow>(
      `SELECT locale, enabled, authenticated_home_explanation_html,
              guest_explanation_html, conversation_content_storage_question_html
         FROM ssf.tenant_locales
        WHERE instance_id = $1
        ORDER BY locale`,
      [instanceId]
    );

    const serverSettingsRow = serverSettingsResult.rows[0];
    const tenantSettingsRow = tenantSettingsResult.rows[0];
    return {
      serverSettings: serverSettingsRow
        ? {
            defaultLocale: serverSettingsRow.default_locale,
            logoMediaReference: serverSettingsRow.logo_media_reference,
            iconMediaReference: serverSettingsRow.icon_media_reference,
          }
        : null,
      serverLocales: serverLocalesResult.rows.map((row) => ({
        locale: row.locale,
        available: row.available,
        authenticatedHomeExplanationHtml: row.authenticated_home_explanation_html,
        guestExplanationHtml: row.guest_explanation_html,
        conversationContentStorageQuestionHtml: row.conversation_content_storage_question_html,
      })),
      tenantSettings: tenantSettingsRow
        ? {
            defaultLocale: tenantSettingsRow.default_locale,
            customBrandingAllowed: tenantSettingsRow.custom_branding_allowed,
            conversationContentStorageAllowed:
              tenantSettingsRow.conversation_content_storage_allowed,
            conversationContentStorageMode: tenantSettingsRow.conversation_content_storage_mode,
            logoMediaReference: tenantSettingsRow.logo_media_reference,
            iconMediaReference: tenantSettingsRow.icon_media_reference,
          }
        : null,
      tenantLocales: tenantLocalesResult.rows.map((row) => ({
        locale: row.locale,
        enabled: row.enabled,
        authenticatedHomeExplanationHtml: row.authenticated_home_explanation_html,
        guestExplanationHtml: row.guest_explanation_html,
        conversationContentStorageQuestionHtml: row.conversation_content_storage_question_html,
      })),
    };
  });

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
