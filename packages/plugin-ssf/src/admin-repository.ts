import type { Pool, PoolClient } from 'pg';

import type {
  SsfSystemConfigurationInput,
  SsfTenantConfigurationInput,
} from './admin-contracts.js';
import { sanitizeSsfHtmlV1 } from './html.js';
import { withTenantTransaction } from './repository.transaction.js';
import type { SsfConfigurationOverrides } from './repository.js';
import type { ServerLocaleRow, ServerSettingsRow } from './repository.rows.js';

export const readSsfSystemOverrides = async (
  pool: Pool
): Promise<Pick<SsfConfigurationOverrides, 'serverSettings' | 'serverLocales'>> => {
  const [settingsResult, localesResult] = await Promise.all([
    pool.query<ServerSettingsRow>(
      `SELECT default_locale, conversation_content_storage_allowed,
              conversation_content_storage_mode, logo_media_reference, icon_media_reference
         FROM ssf.server_settings
        WHERE singleton = true`
    ),
    pool.query<ServerLocaleRow>(
      `SELECT locale, available, authenticated_home_explanation_html,
              guest_explanation_html, conversation_content_storage_question_html
         FROM ssf.server_locales
        ORDER BY locale`
    ),
  ]);
  const settings = settingsResult.rows[0];
  return {
    serverSettings: settings
      ? {
          defaultLocale: settings.default_locale,
          conversationContentStorageAllowed: settings.conversation_content_storage_allowed,
          conversationContentStorageMode: settings.conversation_content_storage_mode,
          logoMediaReference: settings.logo_media_reference,
          iconMediaReference: settings.icon_media_reference,
        }
      : null,
    serverLocales: localesResult.rows.map((row) => ({
      locale: row.locale,
      available: row.available,
      authenticatedHomeExplanationHtml: row.authenticated_home_explanation_html,
      guestExplanationHtml: row.guest_explanation_html,
      conversationContentStorageQuestionHtml: row.conversation_content_storage_question_html,
    })),
  };
};

const writeLocales = async (
  client: PoolClient,
  table: 'server_locales' | 'tenant_locales',
  instanceId: string | null,
  locales: SsfSystemConfigurationInput['locales'] | SsfTenantConfigurationInput['locales']
) => {
  for (const locale of locales) {
    const tenant = table === 'tenant_locales';
    const activity = tenant
      ? 'enabled' in locale
        ? locale.enabled
        : null
      : 'available' in locale
        ? locale.available
        : null;
    const values = [
      ...(tenant ? [instanceId] : []),
      locale.locale,
      activity,
      locale.authenticatedHomeExplanationHtml === null
        ? null
        : sanitizeSsfHtmlV1(locale.authenticatedHomeExplanationHtml),
      locale.guestExplanationHtml === null ? null : sanitizeSsfHtmlV1(locale.guestExplanationHtml),
      locale.conversationContentStorageQuestionHtml === null
        ? null
        : sanitizeSsfHtmlV1(locale.conversationContentStorageQuestionHtml),
    ];
    await client.query(
      `INSERT INTO ssf.${table} (${tenant ? 'instance_id, ' : ''}locale, ${tenant ? 'enabled' : 'available'}, authenticated_home_explanation_html, guest_explanation_html, conversation_content_storage_question_html)
       VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')})
       ON CONFLICT (${tenant ? 'instance_id, ' : ''}locale) DO UPDATE SET
         ${tenant ? 'enabled' : 'available'} = EXCLUDED.${tenant ? 'enabled' : 'available'},
         authenticated_home_explanation_html = EXCLUDED.authenticated_home_explanation_html,
         guest_explanation_html = EXCLUDED.guest_explanation_html,
         conversation_content_storage_question_html = EXCLUDED.conversation_content_storage_question_html,
         updated_at = now()`,
      values
    );
  }
};

export const replaceSsfSystemConfiguration = async (
  pool: Pool,
  input: SsfSystemConfigurationInput
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO ssf.server_settings (singleton, default_locale, conversation_content_storage_allowed, conversation_content_storage_mode)
       VALUES (true, $1, true, $2)
       ON CONFLICT (singleton) DO UPDATE SET
         default_locale = EXCLUDED.default_locale,
         conversation_content_storage_allowed = EXCLUDED.conversation_content_storage_allowed,
         conversation_content_storage_mode = EXCLUDED.conversation_content_storage_mode,
         updated_at = now()`,
      [input.defaultLocale, input.conversationContentStorageMode]
    );
    await writeLocales(client, 'server_locales', null, input.locales);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const replaceSsfTenantConfiguration = async (
  pool: Pool,
  instanceId: string,
  input: SsfTenantConfigurationInput
) =>
  withTenantTransaction(pool, instanceId, false, async (client) => {
    if (input.defaultLocale !== null) {
      const availability = await client.query<{ available: boolean }>(
        `SELECT available
           FROM ssf.server_locales
          WHERE locale = $1
          FOR SHARE`,
        [input.defaultLocale]
      );
      if (availability.rows[0]?.available !== true) {
        throw new SsfTenantDefaultLocaleUnavailableError();
      }
    }
    await client.query(
      `INSERT INTO ssf.tenant_settings (instance_id, default_locale, conversation_content_storage_allowed, conversation_content_storage_mode)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (instance_id) DO UPDATE SET
       default_locale = EXCLUDED.default_locale,
       conversation_content_storage_allowed = EXCLUDED.conversation_content_storage_allowed,
       conversation_content_storage_mode = EXCLUDED.conversation_content_storage_mode,
       updated_at = now()`,
      [
        instanceId,
        input.defaultLocale,
        input.conversationContentStorageMode === null ? null : true,
        input.conversationContentStorageMode,
      ]
    );
    await writeLocales(client, 'tenant_locales', instanceId, input.locales);
  });

export class SsfTenantDefaultLocaleUnavailableError extends Error {
  public constructor() {
    super('ssf_tenant_default_locale_unavailable');
    this.name = 'SsfTenantDefaultLocaleUnavailableError';
  }
}
