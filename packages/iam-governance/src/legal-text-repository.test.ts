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

describe('legal-text-repository', () => {
  let state: ReturnType<typeof createDeps>;

  beforeEach(() => {
    state = createDeps();
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
      },
    ]);

    expect(state.client.query).toHaveBeenCalledTimes(1);
    expect(state.client.query.mock.calls[0]?.[0]).toContain("version.status = 'valid'");
    expect(state.client.query.mock.calls[0]?.[0]).not.toContain('version.is_active = true');
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
