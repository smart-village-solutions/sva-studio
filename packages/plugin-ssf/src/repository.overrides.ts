import type { Pool } from 'pg';

import type {
  ServerLocaleRow,
  ServerSettingsRow,
  TenantLocaleRow,
  TenantSettingsRow,
} from './repository.rows.js';
import { withTenantTransaction } from './repository.transaction.js';
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
