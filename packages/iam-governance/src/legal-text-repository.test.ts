import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLegalTextRepository,
  LegalTextDeleteConflictError,
  type LegalTextRepositoryDeps,
} from './legal-text-repository.js';

const legalTextRow = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Privacy Policy',
  legal_text_version: '2026-03',
  locale: 'de-DE',
  content_html: '<p>Existing legal text</p>',
  status: 'valid',
  published_at: '2026-03-16T09:00:00.000Z',
  created_at: '2026-03-16T08:55:00.000Z',
  updated_at: '2026-03-16T09:30:00.000Z',
  acceptance_count: 4,
  active_acceptance_count: 3,
  last_accepted_at: '2026-03-16T10:00:00.000Z',
  target_role_ids: [],
  target_group_ids: [],
} as const;

const createDeps = () => {
  const client = {
    query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
  };
  const deps: LegalTextRepositoryDeps = {
    withInstanceScopedDb: vi.fn(async (_instanceId, work) => work(client)),
    emitActivityLog: vi.fn(),
  };
  return { client, deps, repository: createLegalTextRepository(deps) };
};

const expectPendingTargetingSql = (sql: string) => {
  expect(sql).toContain('legal_text_target_roles');
  expect(sql).toContain('legal_text_target_groups');
  expect(sql).toContain('account_role.role_id::text = ANY');
  expect(sql).toContain('account_role.valid_from <= NOW()');
  expect(sql).toContain('(account_role.valid_to IS NULL OR account_role.valid_to > NOW())');
  expect(sql).toContain('(account_group.valid_from IS NULL OR account_group.valid_from <= NOW())');
  expect(sql).toContain('(account_group.valid_until IS NULL OR account_group.valid_until > NOW())');
  expect(sql).toContain('group_target.is_active IS TRUE');
  expect(sql).toContain('group_target.id::text = ANY');
};

describe('legal-text-repository', () => {
  let state: ReturnType<typeof createDeps>;

  beforeEach(() => {
    state = createDeps();
  });

  it('loads legal text list items with mapped acceptance metadata', async () => {
    state.client.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [legalTextRow],
    });

    await expect(state.repository.loadLegalTextListItems('de-musterhausen')).resolves.toEqual([
      {
        id: legalTextRow.id,
        name: 'Privacy Policy',
        legalTextVersion: '2026-03',
        locale: 'de-DE',
        contentHtml: '<p>Existing legal text</p>',
        status: 'valid',
        publishedAt: '2026-03-16T09:00:00.000Z',
        createdAt: '2026-03-16T08:55:00.000Z',
        updatedAt: '2026-03-16T09:30:00.000Z',
        acceptanceCount: 4,
        activeAcceptanceCount: 3,
        lastAcceptedAt: '2026-03-16T10:00:00.000Z',
        targets: {
          roleIds: [],
          groupIds: [],
        },
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('ORDER BY version.name ASC');
  });

  it('loads a legal text by id and returns undefined when no row exists', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [legalTextRow] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      state.repository.loadLegalTextById('de-musterhausen', legalTextRow.id)
    ).resolves.toMatchObject({
      id: legalTextRow.id,
      name: 'Privacy Policy',
      legalTextVersion: '2026-03',
    });
    await expect(
      state.repository.loadLegalTextById('de-musterhausen', '22222222-2222-2222-2222-222222222222')
    ).resolves.toBeUndefined();

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('AND version.id = $2::uuid');
  });

  it('loads pending legal texts via status without relying on the legacy active flag', async () => {
    state.client.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'pending-version-1',
          legal_text_id: 'legal-text-1',
          name: 'Nutzungsbedingungen',
          legal_text_version: '2',
          locale: 'de-DE',
          content_html: '<p>Bitte akzeptieren</p>',
          published_at: '2026-03-22T19:00:00.000Z',
          target_role_ids: [],
          target_group_ids: [],
        },
      ],
    });

    await expect(state.repository.loadPendingLegalTexts('de-musterhausen', 'kc-user-1')).resolves.toEqual([
      {
        id: 'pending-version-1',
        legalTextId: 'legal-text-1',
        name: 'Nutzungsbedingungen',
        legalTextVersion: '2',
        locale: 'de-DE',
        contentHtml: '<p>Bitte akzeptieren</p>',
        publishedAt: '2026-03-22T19:00:00.000Z',
        targets: {
          roleIds: [],
          groupIds: [],
        },
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.client.query.mock.calls[0]?.[0]).toContain("version.status = 'valid'");
    expect(state.client.query.mock.calls[0]?.[0]).not.toContain('version.is_active = true');
  });

  it('keeps tenant-wide pending legal texts visible with empty targets', async () => {
    state.client.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'pending-tenant-wide',
          legal_text_id: 'legal-text-tenant-wide',
          name: 'Allgemeine Nutzungsbedingungen',
          legal_text_version: '1',
          locale: 'de-DE',
          content_html: '<p>Tenant-wide</p>',
          published_at: '2026-03-21T19:00:00.000Z',
          target_role_ids: [],
          target_group_ids: [],
        },
      ],
    });

    await expect(state.repository.loadPendingLegalTexts('de-musterhausen', 'kc-user-2')).resolves.toEqual([
      {
        id: 'pending-tenant-wide',
        legalTextId: 'legal-text-tenant-wide',
        name: 'Allgemeine Nutzungsbedingungen',
        legalTextVersion: '1',
        locale: 'de-DE',
        contentHtml: '<p>Tenant-wide</p>',
        publishedAt: '2026-03-21T19:00:00.000Z',
        targets: {
          roleIds: [],
          groupIds: [],
        },
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    const sql = state.client.query.mock.calls[0]?.[0] ?? '';
    expectPendingTargetingSql(sql);
    expect(sql).toContain('COALESCE(array_length(role_targets.role_ids, 1), 0) = 0');
    expect(sql).toContain('COALESCE(array_length(group_targets.group_ids, 1), 0) = 0');
  });

  it('returns targeted pending legal texts for matching role memberships', async () => {
    state.client.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'pending-role-targeted',
          legal_text_id: 'legal-text-role-targeted',
          name: 'Datenschutz Redaktion',
          legal_text_version: '2',
          locale: 'de-DE',
          content_html: '<p>Role targeted</p>',
          published_at: '2026-03-22T19:00:00.000Z',
          target_role_ids: ['role-editor'],
          target_group_ids: [],
        },
      ],
    });

    await expect(state.repository.loadPendingLegalTexts('de-musterhausen', 'kc-user-role')).resolves.toEqual([
      {
        id: 'pending-role-targeted',
        legalTextId: 'legal-text-role-targeted',
        name: 'Datenschutz Redaktion',
        legalTextVersion: '2',
        locale: 'de-DE',
        contentHtml: '<p>Role targeted</p>',
        publishedAt: '2026-03-22T19:00:00.000Z',
        targets: {
          roleIds: ['role-editor'],
          groupIds: [],
        },
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    const sql = state.client.query.mock.calls[0]?.[0] ?? '';
    expectPendingTargetingSql(sql);
  });

  it('returns targeted pending legal texts for matching active group memberships', async () => {
    state.client.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          id: 'pending-group-targeted',
          legal_text_id: 'legal-text-group-targeted',
          name: 'Datenschutz Beirat',
          legal_text_version: '3',
          locale: 'de-DE',
          content_html: '<p>Group targeted</p>',
          published_at: '2026-03-23T19:00:00.000Z',
          target_role_ids: [],
          target_group_ids: ['group-privacy'],
        },
      ],
    });

    await expect(state.repository.loadPendingLegalTexts('de-musterhausen', 'kc-user-group')).resolves.toEqual([
      {
        id: 'pending-group-targeted',
        legalTextId: 'legal-text-group-targeted',
        name: 'Datenschutz Beirat',
        legalTextVersion: '3',
        locale: 'de-DE',
        contentHtml: '<p>Group targeted</p>',
        publishedAt: '2026-03-23T19:00:00.000Z',
        targets: {
          roleIds: [],
          groupIds: ['group-privacy'],
        },
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    const sql = state.client.query.mock.calls[0]?.[0] ?? '';
    expectPendingTargetingSql(sql);
  });

  it('creates a legal text version and emits an activity log', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ legal_text_id: 'privacy_policy_existing' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: legalTextRow.id }] });

    await expect(
      state.repository.createLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-legal-text',
        traceId: 'trace-legal-text',
        name: 'Privacy Policy',
        legalTextVersion: '2026-04',
        locale: 'de-DE',
        contentHtml: '<p>Legal text</p><script>alert(1)</script>',
        status: 'valid',
        publishedAt: '2026-03-16T09:00:00.000Z',
      })
    ).resolves.toBe(legalTextRow.id);

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('SELECT legal_text_id');
    expect(state.client.query.mock.calls[1]?.[0]).toContain('INSERT INTO iam.legal_text_versions');
    expect(state.deps.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        eventType: 'iam.legal_text.created',
        payload: expect.objectContaining({
          legal_text_version_id: legalTextRow.id,
          legal_text_version: '2026-04',
          status: 'valid',
        }),
      })
    );
  });

  it('returns undefined without emitting an activity log when create hits the uniqueness guard', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      state.repository.createLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        name: 'Privacy Policy',
        legalTextVersion: '2026-04',
        locale: 'de-DE',
        contentHtml: '<p>Legal text</p>',
        status: 'draft',
      })
    ).resolves.toBeUndefined();

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('updates a legal text version within a single instance-scoped transaction', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [legalTextRow] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: legalTextRow.id }] });

    await expect(
      state.repository.updateLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-legal-text',
        traceId: 'trace-legal-text',
        legalTextVersionId: legalTextRow.id,
        name: 'Updated Privacy Policy',
        status: 'archived',
      })
    ).resolves.toBe(legalTextRow.id);

    expect(state.deps.withInstanceScopedDb).toHaveBeenCalledTimes(1);
    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('FROM iam.legal_text_versions version');
    expect(state.client.query.mock.calls[1]?.[0]).toContain('UPDATE iam.legal_text_versions');
    expect(state.deps.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        eventType: 'iam.legal_text.updated',
        payload: expect.objectContaining({ legal_text_version_id: legalTextRow.id }),
      })
    );
  });

  it('returns undefined when the current legal text version does not exist during update', async () => {
    state.client.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      state.repository.updateLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        legalTextVersionId: legalTextRow.id,
        status: 'archived',
      })
    ).resolves.toBeUndefined();

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('returns undefined when the update statement affects no row', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [legalTextRow] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      state.repository.updateLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        legalTextVersionId: legalTextRow.id,
        status: 'archived',
      })
    ).resolves.toBeUndefined();

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('rejects deleting legal text versions that already have acceptances', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ has_acceptances: true }] });

    await expect(
      state.repository.deleteLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        legalTextVersionId: legalTextRow.id,
      })
    ).rejects.toBeInstanceOf(LegalTextDeleteConflictError);

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('DELETE FROM iam.legal_text_versions version');
    expect(state.client.query.mock.calls[1]?.[0]).toContain('SELECT EXISTS');
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('returns undefined when delete affects no row and no acceptances exist', async () => {
    state.client.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ has_acceptances: false }] });

    await expect(
      state.repository.deleteLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        legalTextVersionId: legalTextRow.id,
      })
    ).resolves.toBeUndefined();

    expect(state.client.query).toHaveBeenCalledTimes(2);
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });

  it('deletes a legal text version and emits an activity log', async () => {
    state.client.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: legalTextRow.id }] });

    await expect(
      state.repository.deleteLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        requestId: 'req-legal-text',
        traceId: 'trace-legal-text',
        legalTextVersionId: legalTextRow.id,
      })
    ).resolves.toBe(legalTextRow.id);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.deps.emitActivityLog).toHaveBeenCalledWith(
      state.client,
      expect.objectContaining({
        eventType: 'iam.legal_text.deleted',
        payload: { legal_text_version_id: legalTextRow.id },
      })
    );
  });

  it('maps foreign-key violations during legal text deletion to a conflict error', async () => {
    state.client.query.mockRejectedValueOnce({ code: '23503' });

    await expect(
      state.repository.deleteLegalTextVersion({
        instanceId: 'de-musterhausen',
        actorAccountId: 'account-1',
        legalTextVersionId: legalTextRow.id,
      })
    ).rejects.toBeInstanceOf(LegalTextDeleteConflictError);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.client.query.mock.calls[0]?.[0]).toContain('DELETE FROM iam.legal_text_versions version');
    expect(state.deps.emitActivityLog).not.toHaveBeenCalled();
  });
});
