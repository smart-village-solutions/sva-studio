import {
  catalogAssert,
  type AppTranslationLocale,
  type AvailableLanguage,
  type InstanceLanguage,
} from '@sva/core';
import type { CatalogSqlClient } from './app-translations.js';

export const createLanguageRepository = (client: CatalogSqlClient) => ({
  list: async () =>
    (
      await client.query<AvailableLanguage>(
        'SELECT locale, available, revision::text FROM iam.available_languages ORDER BY locale'
      )
    ).rows,
  assignments: async (instanceId: string) =>
    (
      await client.query<InstanceLanguage>(
        'SELECT locale, enabled, revision::text FROM iam.instance_languages WHERE instance_id=$1 ORDER BY locale',
        [instanceId]
      )
    ).rows,
  enabledLocales: async (instanceId: string): Promise<AppTranslationLocale[]> => [
    'de',
    ...(
      await client.query<{ locale: AppTranslationLocale }>(
        `SELECT l.locale FROM iam.instance_languages l JOIN iam.available_languages a USING(locale) WHERE l.instance_id=$1 AND l.enabled AND a.available ORDER BY l.locale`,
        [instanceId]
      )
    ).rows.map((row) => row.locale),
  ],
  setAvailable: async (
    locale: AppTranslationLocale,
    available: boolean,
    expectedRevision: string
  ) => {
    catalogAssert(locale !== 'de' || available, 'catalog_forbidden');
    const result = await client.query(
      `UPDATE iam.available_languages SET available=$2, revision=revision+1 WHERE locale=$1 AND revision=$3::bigint RETURNING locale`,
      [locale, available, expectedRevision]
    );
    catalogAssert(result.rowCount === 1, 'catalog_conflict');
  },
  setInstance: async (
    instanceId: string,
    locale: AppTranslationLocale,
    enabled: boolean,
    expectedRevision: string
  ) => {
    catalogAssert(locale !== 'de', 'catalog_forbidden');
    const language = await client.query<{ available: boolean }>(
      'SELECT available FROM iam.available_languages WHERE locale=$1 FOR SHARE',
      [locale]
    );
    catalogAssert(
      language.rows[0] && (!enabled || language.rows[0].available),
      'catalog_forbidden'
    );
    const instance = await client.query(
      "SELECT id FROM iam.instances WHERE id=$1 AND status='active' FOR SHARE",
      [instanceId]
    );
    catalogAssert(instance.rows[0], 'catalog_forbidden');
    if (enabled) {
      // Lifecycle rows use the existing tenant RLS policy even for Root configuration.
      await client.query("SELECT set_config('app.instance_id',$1,true)", [instanceId]);
      const module = await client.query(
        "SELECT module_id FROM iam.instance_modules WHERE instance_id=$1 AND module_id='app-translations' AND effective_active FOR SHARE",
        [instanceId]
      );
      catalogAssert(module.rows[0], 'catalog_forbidden');
      const lifecycle = await client.query(
        "SELECT plugin_id FROM iam.instance_plugin_lifecycle WHERE instance_id=$1 AND plugin_id='app-translations' AND access_state='active' AND readiness_status IN ('ready','degraded') AND desired_generation=completed_generation FOR SHARE",
        [instanceId]
      );
      catalogAssert(lifecycle.rows[0], 'catalog_forbidden');
      await client.query("SELECT set_config('app.instance_id','',true)");
    }
    const result =
      expectedRevision === '0'
        ? await client.query(
            'INSERT INTO iam.instance_languages(instance_id,locale,enabled) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING locale',
            [instanceId, locale, enabled]
          )
        : await client.query(
            'UPDATE iam.instance_languages SET enabled=$3, revision=revision+1 WHERE instance_id=$1 AND locale=$2 AND revision=$4::bigint RETURNING locale',
            [instanceId, locale, enabled, expectedRevision]
          );
    catalogAssert(result.rowCount === 1, 'catalog_conflict');
  },
});
