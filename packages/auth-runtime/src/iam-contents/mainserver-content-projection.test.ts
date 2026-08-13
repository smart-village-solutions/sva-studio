import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ query: vi.fn(), withInstanceScopedDb: vi.fn() }));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

const projectionRow = {
  id: 'news-1',
  instance_id: 'de-musterhausen',
  organization_id: null,
  owner_user_id: null,
  owner_organization_id: null,
  content_type: 'news.article',
  title: 'Admin-sichtbarer Inhalt',
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-08-13T12:00:00.000Z',
  created_by: 'Mainserver',
  updated_at: '2026-08-13T12:00:00.000Z',
  updated_by: 'Mainserver',
  author_display_mode: 'user',
  author_display_name: 'Redaktion',
  source_data_provider_id: 'provider-1',
  source_data_provider_name: 'Redaktion',
  credential_source: 'user',
  authorization_mode: 'credential_visible_compatibility',
  payload_json: {},
  status: 'draft',
  validation_state: 'valid',
  history_ref: 'mainserver:news.article:news-1',
  current_revision_ref: null,
  last_audit_event_ref: null,
};

describe('Mainserver content projection lookup', () => {
  let loadMainserverContentProjectionCandidates: typeof import('./mainserver-content-projection.js').loadMainserverContentProjectionCandidates;

  beforeAll(async () => {
    ({ loadMainserverContentProjectionCandidates } =
      await import('./mainserver-content-projection.js'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({ query: state.query })
    );
    state.query.mockResolvedValue({ rows: [projectionRow] });
  });

  it('uses only projection scopes belonging to the current actor for a global mutation', async () => {
    await expect(
      loadMainserverContentProjectionCandidates({
        instanceId: 'de-musterhausen',
        contentType: 'news.article',
        sourceEntityId: 'news-1',
        actorAccountId: 'account-1',
        activeOrganizationId: 'org-1',
        allowGlobalMutation: true,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'news-1',
        credentialSource: 'user',
        authorizationMode: 'credential_visible_compatibility',
      }),
    ]);

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('projection_scope_key = ANY($4::text[])'),
      [
        'de-musterhausen',
        'news.article',
        'news-1',
        [
          'de-musterhausen::account-1::org-1::news.article',
          'de-musterhausen::account-1::org-1::user::news.article',
          'de-musterhausen::account-1::org-1::organization::news.article',
        ],
      ]
    );
  });

  it('preserves exact ownership filtering without a global mutation grant', async () => {
    await loadMainserverContentProjectionCandidates({
      instanceId: 'de-musterhausen',
      contentType: 'news.article',
      sourceEntityId: 'news-1',
      actorAccountId: 'account-1',
      activeOrganizationId: 'org-1',
    });

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("authorization_mode = 'exact'"),
      ['de-musterhausen', 'news.article', 'news-1', 'account-1', 'org-1']
    );
  });
});
