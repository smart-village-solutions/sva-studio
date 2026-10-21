/** Runs against a migrated, disposable database only; never the Studio database. */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { type CatalogScope, type CatalogManifest, type CatalogRelease } from '@sva/core';
import {
  createAppTranslationRepository,
  type AppTranslationRepository,
} from './app-translations.js';
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
  it('protects manual corrections after actual source changes and never writes partial sets', async () => {
    await transaction(b, (repo) => repo.createMunicipalDraft(globalRelease.id, ['de', 'en']));
    let revision = await transaction(
      b,
      async (repo) =>
        (await repo.editText(contractId, '1', 'en', 'title', 'Send your report')).draftRevision
    );
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
});
