/** Runs against a migrated, disposable database only; never the Studio database. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import {
  catalogDigest,
  type CatalogScope,
  type CatalogManifest,
  type CatalogRelease,
  type ExternalInterfaceRecord,
} from '@sva/core';
import {
  createAppTranslationRepository,
  type AppTranslationRepository,
} from './app-translations.js';
import {
  saveDeepLInterfaceRecord,
  saveDeepLInterfaceCheck,
  loadExternalInterfaceRecordById,
} from './integrations/external-interfaces.server.js';
const url = process.env.APP_TRANSLATIONS_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 4 }) : null;
const suffix = randomUUID().slice(0, 8);
const contractId = `catalog-${suffix}`;
const orgA = randomUUID(),
  orgB = randomUUID(),
  orgC = randomUUID();
const tenantA = `catalog-a-${suffix}`,
  tenantB = `catalog-b-${suffix}`;
const global: CatalogScope = { kind: 'global' };
const a: CatalogScope = { kind: 'municipal', instanceId: tenantA, organizationId: orgA };
const b: CatalogScope = { kind: 'municipal', instanceId: tenantA, organizationId: orgB };
const c: CatalogScope = { kind: 'municipal', instanceId: tenantB, organizationId: orgC };
const manifest: CatalogManifest = {
  contractId,
  manifestVersion: '1',
  appCompatibility: { minVersion: '1.0.0' },
  keys: {
    title: { type: 'string', defaultValue: 'Meldung senden', placeholders: {}, allowEmpty: false },
    greeting: {
      type: 'string',
      defaultValue: 'Hallo {{name}}',
      placeholders: { name: 'string' },
      allowEmpty: false,
    },
  },
};
const transaction = async <T>(
  scope: CatalogScope,
  work: (repo: AppTranslationRepository, client: PoolClient) => Promise<T>
) => {
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    const repo = await createAppTranslationRepository(client, scope);
    const value = await work(repo, client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
let globalRelease: CatalogRelease;
describe.skipIf(!url)('fixed catalog PostgreSQL transactions and RLS', () => {
  beforeAll(async () => {
    if (!pool || !url || !/^\/[^/]+_test$/.test(new URL(url).pathname))
      throw new Error('disposable_test_database_required');
    await pool.query(
      `INSERT INTO iam.external_interface_types(type_key,owner_kind,owner_id,display_name,category,public_schema_json,secret_schema_json,status_check_kind) VALUES ('deepl','host','host','DeepL','api','{}','{}','deepl') ON CONFLICT DO NOTHING`
    );
    await pool.query(
      `INSERT INTO iam.instances(id, display_name, primary_hostname, tenant_admin_client_id, auth_realm, auth_client_id) VALUES ($1,'Catalog A',$3,'tenant-admin',$1,'studio'), ($2,'Catalog B',$4,'tenant-admin',$2,'studio')`,
      [tenantA, tenantB, `${tenantA}.test`, `${tenantB}.test`]
    );
    await pool.query(
      `INSERT INTO iam.organizations(id, instance_id, organization_key, display_name) VALUES ($1,$4,'a','A'), ($2,$4,'b','B'), ($3,$5,'c','C')`,
      [orgA, orgB, orgC, tenantA, tenantB]
    );
    globalRelease = await transaction(global, async (repo) => {
      let draft = await repo.importManifest(manifest, '0', ['de', 'en']);
      draft = await repo.editText(contractId, draft.draftRevision, 'en', 'title', 'Send a report');
      draft = await repo.editText(
        contractId,
        draft.draftRevision,
        'en',
        'greeting',
        'Hello {{name}}'
      );
      return repo.seal(contractId, draft.draftRevision);
    });
  });
  afterAll(async () => {
    await pool?.end();
  });
  it('isolates DeepL config with RLS and serializes config, checks and module revocation', async () => {
    if (
      !process.env.IAM_DATABASE_URL ||
      !new URL(process.env.IAM_DATABASE_URL).pathname.endsWith('_test')
    )
      throw new Error('disposable_interface_database_required');
    await pool!.query(
      "INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES ($1,'app-translations',true)",
      [tenantA]
    );
    await pool!.query(
      "INSERT INTO iam.instance_plugin_lifecycle(instance_id,plugin_id,readiness_status,completed_generation) VALUES ($1,'app-translations','ready',1)",
      [tenantA]
    );
    const record: ExternalInterfaceRecord = {
      id: `deepl-${suffix}`,
      instanceId: tenantA,
      typeKey: 'deepl',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'DeepL',
      alias: 'deepl',
      enabled: true,
      isDefault: true,
      category: 'api',
      statusCheckKind: 'deepl',
      visibleStatus: 'unknown',
      secretConfigCiphertext: 'synthetic-cipher',
      publicConfig: {
        revision: 'r1',
        credentialRevision: 'k1',
        plan: 'pro',
        englishVariant: 'en-GB',
        selectedLocales: [],
        availableLanguages: [],
      },
    };
    await saveDeepLInterfaceRecord(record, '0');
    expect(await loadExternalInterfaceRecordById(tenantB, record.id)).toBeNull();
    await expect(
      saveDeepLInterfaceRecord({ ...record, id: `second-${suffix}` }, '0')
    ).rejects.toMatchObject({ code: '23505' });
    const languages = [{ code: 'en-GB', name: 'English', tagHandling: true }];
    await saveDeepLInterfaceCheck({
      instanceId: tenantA,
      interfaceId: record.id,
      expectedRevision: 'r1',
      checkedAt: new Date().toISOString(),
      languages,
    });
    const checked = await loadExternalInterfaceRecordById(tenantA, record.id);
    expect(checked?.publicConfig.verifiedCredentialRevision).toBe('k1');
    const outcomes = await Promise.allSettled(
      ['r2', 'r3'].map((revision) =>
        saveDeepLInterfaceRecord(
          { ...record, publicConfig: { ...record.publicConfig, revision } },
          'r1'
        )
      )
    );
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(
      saveDeepLInterfaceCheck({
        instanceId: tenantA,
        interfaceId: record.id,
        expectedRevision: 'r1',
        checkedAt: new Date().toISOString(),
        languages,
      })
    ).rejects.toThrow('interface_conflict');
    const current = await loadExternalInterfaceRecordById(tenantA, record.id);
    await pool!.query(
      "UPDATE iam.instance_plugin_lifecycle SET access_state='suspended' WHERE instance_id=$1 AND plugin_id='app-translations'",
      [tenantA]
    );
    await expect(
      saveDeepLInterfaceCheck({
        instanceId: tenantA,
        interfaceId: record.id,
        expectedRevision: String(current?.publicConfig.revision),
        checkedAt: new Date().toISOString(),
        languages,
      })
    ).rejects.toThrow('deepl_module_unavailable');
    await expect(
      saveDeepLInterfaceRecord(current!, String(current?.publicConfig.revision))
    ).rejects.toThrow('deepl_module_unavailable');
    expect(
      (await loadExternalInterfaceRecordById(tenantA, record.id))?.secretConfigCiphertext
    ).toBe('synthetic-cipher');
  });
  it('seals German independently of incomplete translations and keeps retry identities separate', async () => {
    await transaction(global, async (repo) => {
      const id = `${contractId}-de`;
      const draft = await repo.importManifest({ ...manifest, contractId: id }, '0', ['de', 'en']);
      const german = await repo.seal(id, draft.draftRevision, true);
      expect(german.supportedLocales).toEqual(['de']);
      expect(Object.keys(german.catalogs)).toEqual(['de']);
      expect(await repo.seal(id, draft.draftRevision, true)).toEqual(german);
      await expect(repo.seal(id, draft.draftRevision)).rejects.toThrow('catalog_incomplete');
    });
    await transaction(global, async (repo) => {
      const id = `${contractId}-both`;
      let draft = await repo.importManifest({ ...manifest, contractId: id }, '0', ['de', 'en']);
      draft = await repo.editText(id, draft.draftRevision, 'en', 'title', 'Title');
      draft = await repo.editText(id, draft.draftRevision, 'en', 'greeting', 'Hello {{name}}');
      const german = await repo.seal(id, draft.draftRevision, true);
      const translated = await repo.seal(id, draft.draftRevision);
      expect(translated.id).not.toBe(german.id);
      expect(translated.supportedLocales).toEqual(['de', 'en']);
      expect(await repo.seal(id, draft.draftRevision, true)).toEqual(german);
      expect(await repo.seal(id, draft.draftRevision)).toEqual(translated);
    });
  });
  it('lists only scoped drafts and releases while offering immutable global bases', async () => {
    await transaction(a, (repo) => repo.createMunicipalDraft(globalRelease.id, ['de', 'en']));
    const globalOverview = await transaction(global, (repo) => repo.overview());
    expect(globalOverview.catalogs.some((row) => row.contractId === contractId)).toBe(true);
    expect(globalOverview.releases).toContainEqual(
      expect.objectContaining({
        id: globalRelease.id,
        draftRevision: globalRelease.draftRevision,
        supportedLocales: ['de', 'en'],
      })
    );
    const own = await transaction(a, (repo) => repo.overview());
    expect(own.catalogs.map((row) => row.contractId)).toContain(contractId);
    expect(own.bases).toContainEqual(expect.objectContaining({ id: globalRelease.id }));
    expect(JSON.stringify(own)).not.toContain('valuesByLocale');
    for (const scope of [b, c]) {
      const other = await transaction(scope, (repo) => repo.overview());
      expect(other.catalogs).toEqual([]);
      expect(other.releases).toEqual([]);
    }
    const effective = await transaction(a, (repo) => repo.readEffective(contractId));
    expect(effective.baseCatalogs.en?.values.title).toBe('Send a report');
  });
  it('imports idempotently, preserves edits and rolls back invalid/changed manifests', async () => {
    await transaction(global, async (repo) => {
      const first = await repo.loadDraft(contractId);
      expect(await repo.importManifest(manifest, '0', ['de', 'en'])).toEqual(first);
      const changed = structuredClone(manifest);
      changed.manifestVersion = '2';
      changed.keys.title!.defaultValue = 'Neuer Default';
      const next = await repo.importManifest(changed, first.draftRevision, ['de', 'en']);
      expect(next.valuesByLocale.de!.title!.value).toBe('Meldung senden');
      expect(await repo.loadRelease(globalRelease.id)).toEqual(globalRelease);
      await repo.editText(
        contractId,
        next.draftRevision,
        'de',
        'title',
        'Unveröffentlichter S2-Entwurf'
      );
    });
    await expect(
      transaction(global, (repo) =>
        repo.importManifest({ ...manifest, keys: {} }, '1', ['de', 'en'])
      )
    ).rejects.toThrow('invalid_catalog');
    const changed = structuredClone(manifest);
    changed.keys.title!.defaultValue = 'Manipulated';
    await expect(
      transaction(global, (repo) => repo.importManifest(changed, '1', ['de', 'en']))
    ).rejects.toThrow('catalog_conflict');
  });
  it('inherits per language, preserves a pinned S1 and resets only a selected override', async () => {
    await transaction(a, async (repo) => {
      let draft = await repo.createMunicipalDraft(globalRelease.id, ['de', 'en']);
      draft = await repo.editText(contractId, draft.draftRevision, 'de', 'title', 'Schaden melden');
      const effective = await repo.readEffective(contractId);
      expect(effective.values.en!.title!.value).toBe('Send a report');
      expect(effective.values.de!.title!.value).toBe('Schaden melden');
      draft = await repo.resetOverride(contractId, draft.draftRevision, 'de', 'title');
      expect((await repo.readEffective(contractId)).values.de!.title!.value).toBe('Meldung senden');
      const sealed = await repo.seal(contractId, draft.draftRevision);
      expect(sealed.catalogs.en!.values.title).toBe('Send a report');
    });
  });
  it('protects legacy manual corrections after actual source changes and never writes partial sets', async () => {
    await transaction(b, (repo) => repo.createMunicipalDraft(globalRelease.id, ['de', 'en']));
    let revision = await transaction(
      b,
      async (repo) =>
        (await repo.editText(contractId, '1', 'en', 'title', 'Send your report')).draftRevision
    );
    await transaction(b, async (_repo, client) => {
      await client.query(
        "UPDATE iam.app_translation_catalog_drafts SET values_by_locale=values_by_locale #- '{en,title,sourceKind}' WHERE contract_id=$1",
        [contractId]
      );
    });
    revision = await transaction(
      b,
      async (repo) =>
        (await repo.editText(contractId, revision, 'de', 'title', 'Schaden melden')).draftRevision
    );
    await expect(transaction(b, (repo) => repo.seal(contractId, revision))).rejects.toThrow(
      'catalog_review_required'
    );
    await transaction(b, async (repo) => {
      const { draft } = await repo.readEffective(contractId);
      expect(draft.valuesByLocale.en!.title!.value).toBe('Send your report');
      const confirmed = await repo.confirmCorrection(contractId, revision, 'en', 'title');
      const sealed = await repo.seal(contractId, confirmed.draftRevision);
      expect(sealed.state).toBe('sealed');
    });
    await transaction(c, (repo) => repo.createMunicipalDraft(globalRelease.id, ['de', 'en']));
  });
  it('serializes competing writers and duplicate seals', async () => {
    const rev = await transaction(
      c,
      async (repo) => (await repo.loadDraft(contractId)).draftRevision
    );
    const writes = await Promise.allSettled([
      transaction(c, (repo) => repo.editText(contractId, rev, 'de', 'title', 'A')),
      transaction(c, (repo) => repo.editText(contractId, rev, 'de', 'title', 'B')),
    ]);
    expect(writes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(writes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const newRev = await transaction(
      c,
      async (repo) => (await repo.loadDraft(contractId)).draftRevision
    );
    const [one, two] = await Promise.all([
      transaction(c, (repo) => repo.seal(contractId, newRev)),
      transaction(c, (repo) => repo.seal(contractId, newRev)),
    ]);
    expect(one).toEqual(two);
    await expect(
      transaction(c, async (_repo, client) => {
        await client.query(
          'UPDATE iam.app_translation_catalog_releases SET checksum = checksum WHERE id = $1',
          [one.id]
        );
      })
    ).rejects.toThrow();
    await expect(
      transaction(c, async (_repo, client) => {
        await client.query('DELETE FROM iam.app_translation_catalog_releases WHERE id = $1', [
          one.id,
        ]);
      })
    ).rejects.toThrow();
  });
  it('enforces real application-role RLS across organizations, instances and cleared pool context', async () => {
    for (const scope of [a, b, c])
      await transaction(scope, async (_repo, client) => {
        const rows = await client.query(
          'SELECT organization_id::text FROM iam.app_translation_catalog_drafts'
        );
        expect(rows.rows).toEqual([
          { organization_id: scope.kind === 'municipal' ? scope.organizationId : null },
        ]);
        const globalDrafts = await client.query(
          "SELECT id FROM iam.app_translation_catalog_drafts WHERE scope = 'global'"
        );
        expect(globalDrafts.rowCount).toBe(0);
      });
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE iam_app');
      const rows = await client.query('SELECT id FROM iam.app_translation_catalog_drafts');
      expect(rows.rowCount).toBe(0);
      const manifests = await client.query('SELECT id FROM iam.app_translation_manifests');
      expect(manifests.rowCount).toBe(0);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
  it('keeps imports and incomplete seals fully atomic', async () => {
    const incomplete = { ...manifest, contractId: `missing-${suffix}` };
    await transaction(global, (repo) => repo.importManifest(incomplete, '0', ['de', 'en']));
    await expect(
      transaction(global, (repo) => repo.seal(incomplete.contractId, '1'))
    ).rejects.toThrow('catalog_incomplete');
    await transaction(global, async (_repo, client) => {
      expect(
        (
          await client.query(
            'SELECT id FROM iam.app_translation_catalog_releases WHERE contract_id = $1',
            [incomplete.contractId]
          )
        ).rowCount
      ).toBe(0);
    });
  });
  it('validates tokens and wrong bases without committing draft or manifest changes', async () => {
    const prior = await transaction(a, (repo) => repo.loadDraft(contractId));
    await expect(
      transaction(a, (repo) =>
        repo.editText(contractId, prior.draftRevision, 'en', 'greeting', 'Missing token')
      )
    ).rejects.toThrow('invalid_catalog');
    await expect(
      transaction(a, (repo) => repo.editText(contractId, prior.draftRevision, 'en', 'greeting', 42))
    ).rejects.toThrow('invalid_catalog');
    expect(await transaction(a, (repo) => repo.loadDraft(contractId))).toEqual(prior);
    const invalid = structuredClone(manifest);
    invalid.manifestVersion = 'bad-import';
    invalid.keys.title!.placeholders = { absent: 'string' };
    await expect(
      transaction(global, (repo) => repo.importManifest(invalid, '1', ['de', 'en']))
    ).rejects.toThrow('invalid_catalog');
    await transaction(global, async (_repo, client) => {
      expect(
        (
          await client.query(
            'SELECT id FROM iam.app_translation_manifests WHERE contract_id = $1 AND manifest_version = $2',
            [contractId, 'bad-import']
          )
        ).rowCount
      ).toBe(0);
    });
    await expect(
      transaction(a, (repo) =>
        repo.changeBase(contractId, prior.draftRevision, randomUUID(), ['de', 'en'])
      )
    ).rejects.toThrow('catalog_not_found');
  });
  it('rejects cross-organization inserts through RLS and enforces organization-instance FK', async () => {
    await expect(
      transaction(a, async (_repo, client) => {
        await client.query(
          `INSERT INTO iam.app_translation_catalog_drafts(scope,instance_id,organization_id,contract_id,manifest_id,supported_locales,base_release_id) VALUES ('municipal',$1,$2,$3,$4,'["de"]',$5)`,
          [tenantA, orgB, contractId, globalRelease.manifestId, globalRelease.id]
        );
      })
    ).rejects.toMatchObject({ code: '42501' });
    const client = await pool!.connect();
    try {
      await expect(
        client.query(
          `INSERT INTO iam.app_translation_catalog_drafts(scope,instance_id,organization_id,contract_id,manifest_id,supported_locales,base_release_id) VALUES ('municipal',$1,$2,$3,$4,'["de"]',$5)`,
          [tenantB, orgA, contractId, globalRelease.manifestId, globalRelease.id]
        )
      ).rejects.toMatchObject({ code: '23503' });
    } finally {
      client.release();
    }
  });
  it('requires a new correction decision when explicitly moving to a newer global source', async () => {
    const before = await transaction(a, (repo) => repo.loadDraft(contractId));
    const corrected = await transaction(a, (repo) =>
      repo.editText(contractId, before.draftRevision, 'en', 'title', 'Municipal correction')
    );
    const s2 = await transaction(global, async (repo) => {
      const current = await repo.loadDraft(contractId);
      const confirmed = await repo.confirmCorrection(
        contractId,
        current.draftRevision,
        'en',
        'title'
      );
      return repo.seal(contractId, confirmed.draftRevision);
    });
    const rebased = await transaction(a, (repo) =>
      repo.changeBase(contractId, corrected.draftRevision, s2.id, ['de', 'en'])
    );
    await expect(
      transaction(a, (repo) => repo.seal(contractId, rebased.draftRevision))
    ).rejects.toThrow('catalog_review_required');
    await transaction(a, async (repo) => {
      const current = await repo.loadDraft(contractId);
      expect(current.valuesByLocale.en?.title?.value).toBe('Municipal correction');
      const confirmed = await repo.confirmCorrection(
        contractId,
        current.draftRevision,
        'en',
        'title'
      );
      expect((await repo.seal(contractId, confirmed.draftRevision)).catalogs.en?.values.title).toBe(
        'Municipal correction'
      );
    });
    expect(await transaction(global, (repo) => repo.loadRelease(globalRelease.id))).toEqual(
      globalRelease
    );
  });
  it('restores additional language selections across migration 109 rollback and reapply', async () => {
    const sql = await readFile(
      new URL('../../data/migrations/0109_instance_deepl_interface.sql', import.meta.url),
      'utf8'
    );
    const [up, down] = sql.split('-- +goose Down');
    if (!pool || !up || !down) throw new Error('migration_test_fixture_required');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locales = ['ar', 'fr-CA', 'pt-BR', 'zh-Hant'];
      await client.query(
        `UPDATE iam.instance_external_interfaces SET public_config_json = jsonb_set(public_config_json,'{selectedLocales}',$2::jsonb) WHERE id=$1`,
        [`deepl-${suffix}`, JSON.stringify(locales)]
      );
      const before = await client.query(
        'SELECT secret_config_ciphertext FROM iam.instance_external_interfaces WHERE id=$1',
        [`deepl-${suffix}`]
      );
      await client.query(down);
      const restored = await client.query(
        'SELECT locale FROM iam.instance_languages WHERE instance_id=$1 AND enabled ORDER BY locale',
        [tenantA]
      );
      expect(restored.rows.map((row: { locale: string }) => row.locale)).toEqual(locales);
      await client.query(up);
      const after = await client.query(
        'SELECT secret_config_ciphertext, public_config_json FROM iam.instance_external_interfaces WHERE id=$1',
        [`deepl-${suffix}`]
      );
      expect(after.rows[0].secret_config_ciphertext).toBe(before.rows[0].secret_config_ciphertext);
      expect(after.rows[0].public_config_json.selectedLocales).toEqual(locales);
      expect(
        await client.query('SELECT id FROM iam.app_translation_catalog_releases WHERE id=$1', [
          globalRelease.id,
        ])
      ).toMatchObject({ rowCount: 1 });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
  it('persists and seals additional canonical languages without changing German source texts', async () => {
    const base = await transaction(global, async (repo) => {
      const draft = await repo.importManifest(
        { ...manifest, contractId: `${contractId}-wide` },
        '0',
        ['de']
      );
      return repo.seal(draft.manifest.contractId, draft.draftRevision);
    });
    await transaction(a, async (repo) => {
      let draft = await repo.createMunicipalDraft(base.id, [
        'de',
        'ar',
        'fr-CA',
        'pt-BR',
        'zh-Hant',
      ]);
      for (const locale of ['ar', 'fr-CA', 'pt-BR', 'zh-Hant']) {
        draft = await repo.editText(
          draft.manifest.contractId,
          draft.draftRevision,
          locale,
          'title',
          `Title ${locale}`
        );
        draft = await repo.editText(
          draft.manifest.contractId,
          draft.draftRevision,
          locale,
          'greeting',
          `Hello {{name}} ${locale}`
        );
      }
      const release = await repo.seal(draft.manifest.contractId, draft.draftRevision);
      expect(release.supportedLocales).toEqual(['ar', 'de', 'fr-CA', 'pt-BR', 'zh-Hant']);
      expect(release.catalogs['pt-BR']?.values.title).toBe('Title pt-BR');
      expect(release.catalogs.de?.values.title).toBe('Meldung senden');
    });
  });
  it('blocks an unbound legacy English correction and seals it after explicit variant confirmation', async () => {
    const id = `${contractId}-legacy`;
    let draft = await transaction(global, (repo) =>
      repo.importManifest({ ...manifest, contractId: id }, '0', ['de', 'en'])
    );
    for (const [key, value] of [
      ['title', 'Send a report'],
      ['greeting', 'Hello {{name}}'],
    ] as const)
      draft = await transaction(global, (repo) =>
        repo.editText(id, draft.draftRevision, 'en', key, value)
      );
    const targets = { en: 'en-GB' };
    await expect(
      transaction(global, (repo) => repo.seal(id, draft.draftRevision, false, targets))
    ).rejects.toThrow('catalog_review_required');
    for (const key of ['title', 'greeting'])
      draft = await transaction(global, (repo) =>
        repo.confirmCorrection(id, draft.draftRevision, 'en', key, 'en-GB')
      );
    const release = await transaction(global, (repo) =>
      repo.seal(id, draft.draftRevision, false, targets)
    );
    expect(release.catalogs.en?.values.title).toBe('Send a report');
    expect(release.supportedLocales).toEqual(['de', 'en']);
    const overview = await transaction(global, (repo) => repo.overview());
    expect(overview.releases).toContainEqual(
      expect.objectContaining({
        id: release.id,
        draftRevision: draft.draftRevision,
        supportedLocales: ['de', 'en'],
      })
    );
  });
  it('keeps machine standards beneath manual corrections and applies each batch atomically', async () => {
    const id = `${contractId}-machine`;
    const basis = await transaction(global, async (repo) => {
      const draft = await repo.importManifest({ ...manifest, contractId: id }, '0', ['de']);
      return repo.seal(id, draft.draftRevision);
    });
    let draft = await transaction(a, (repo) => repo.createMunicipalDraft(basis.id, ['de', 'fr']));
    const sourceDigest = await catalogDigest('Meldung senden');
    const standard = {
      locale: 'fr',
      key: 'title',
      value: 'Envoyer',
      sourceKind: 'standard' as const,
      sourceDigest,
      targetCode: 'fr',
    };
    draft = await transaction(a, (repo) =>
      repo.applyMachineBatch(id, draft.draftRevision, [standard])
    );
    draft = await transaction(a, (repo) =>
      repo.editText(id, draft.draftRevision, 'fr', 'title', 'Ma correction', 'fr')
    );
    const own = draft.valuesByLocale.fr!.title!;
    await expect(
      transaction(a, (repo) => repo.applyMachineBatch(id, draft.draftRevision, [standard]))
    ).rejects.toThrow('catalog_conflict');
    expect((await transaction(a, (repo) => repo.readEffective(id))).values.fr!.title!.value).toBe(
      'Ma correction'
    );
    draft = await transaction(a, (repo) =>
      repo.editText(id, draft.draftRevision, 'de', 'title', 'Eigener Text')
    );
    const municipalDigest = await catalogDigest('Eigener Text');
    const overrideDigest = await catalogDigest(own);
    draft = await transaction(a, (repo) =>
      repo.applyMachineBatch(id, draft.draftRevision, [
        {
          ...standard,
          value: 'Nouvelle traduction',
          sourceKind: 'municipal',
          sourceDigest: municipalDigest,
          overrideDigest,
        },
      ])
    );
    expect(draft.valuesByLocale.fr!.title!.origin).toBe('machine');
    draft = await transaction(a, (repo) =>
      repo.resetOverride(id, draft.draftRevision, 'fr', 'title')
    );
    expect((await transaction(a, (repo) => repo.readEffective(id))).values.fr!.title!.value).toBe(
      'Envoyer'
    );
    draft = await transaction(a, (repo) =>
      repo.editText(id, draft.draftRevision, 'fr', 'title', 'Encore', 'fr')
    );
    const replacedDigest = await catalogDigest(draft.valuesByLocale.fr!.title);
    draft = await transaction(a, (repo) =>
      repo.applyMachineBatch(id, draft.draftRevision, [
        { ...standard, overrideDigest: replacedDigest },
      ])
    );
    expect(draft.valuesByLocale.fr?.title).toBeUndefined();
    expect(draft.machineStandardValuesByLocale?.fr?.title?.origin).toBe('machine');
    const before = draft;
    await expect(
      transaction(a, (repo) =>
        repo.applyMachineBatch(id, draft.draftRevision, [
          standard,
          { ...standard, key: 'greeting', value: 'Token missing' },
        ])
      )
    ).rejects.toThrow('invalid_catalog');
    expect(await transaction(a, (repo) => repo.loadDraft(id))).toEqual(before);
    draft = await transaction(a, (repo) =>
      repo.editText(id, draft.draftRevision, 'de', 'title', 'Eigener Text')
    );
    expect((await transaction(a, (repo) => repo.readEffective(id))).values.fr!.title!.value).toBe(
      'Envoyer'
    );
    const migration = await readFile(
      new URL('../../data/migrations/0110_app_translation_machine_standards.sql', import.meta.url),
      'utf8'
    );
    const [up, down] = migration.split('-- +goose Down');
    const preserved = await pool!.query(
      `SELECT values_by_locale, machine_standard_values_by_locale FROM iam.app_translation_catalog_drafts WHERE id=$1`,
      [draft.id]
    );
    await pool!.query(down!);
    await pool!.query(up!);
    expect(
      (
        await pool!.query(
          `SELECT values_by_locale, machine_standard_values_by_locale FROM iam.app_translation_catalog_drafts WHERE id=$1`,
          [draft.id]
        )
      ).rows
    ).toEqual(preserved.rows);
    expect(await transaction(global, (repo) => repo.loadRelease(basis.id))).toEqual(basis);
  });
});
