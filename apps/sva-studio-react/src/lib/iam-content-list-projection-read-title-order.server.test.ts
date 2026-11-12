import { describe, expect, it } from 'vitest';

import {
  registerProjectionFixture,
  ctx,
  fixture,
  listProjectedContentsForTest as listProjectedContents,
  getProjectionTestState,
} from './iam-content-list-projection.test-fixture.js';

const state = getProjectionTestState();

const projectionRow = (
  contentType: string,
  id: string,
  title: string,
  sourceDataProviderName: string
) => ({
  id,
  instance_id: 'de-musterhausen',
  projection_scope_key: `de-musterhausen::account-1::org-1::${contentType}`,
  organization_id: 'org-1',
  owner_subject_id: null,
  owner_user_id: 'account-1',
  owner_organization_id: 'org-1',
  content_type: contentType,
  title,
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-06-19T10:00:00.000Z',
  created_by: 'mainserver',
  updated_at: '2026-06-20T10:00:00.000Z',
  updated_by: 'mainserver',
  author_display_name: 'Redaktion',
  payload_json: {},
  status: 'published' as const,
  validation_state: 'valid' as const,
  history_ref: `history-${id}`,
  current_revision_ref: null,
  last_audit_event_ref: null,
  source_system: 'mainserver' as const,
  source_entity_type: contentType,
  source_entity_id: id,
  source_data_provider_name: sourceDataProviderName,
});

const listTitlePages = async (contentType: string, titles: readonly string[]) => {
  // Imported and Studio-created entries alternate so both kinds share one ordering.
  fixture.projectionRows = titles.map((title, index) =>
    projectionRow(contentType, `row-${index}`, title, index % 2 === 0 ? 'Biletado' : 'Studio')
  );
  fixture.syncStates.set(contentType, {
    last_started_at: null,
    last_succeeded_at: new Date().toISOString(),
    last_failed_at: null,
    last_error_code: null,
    last_error_message: null,
    projected_count: titles.length,
  });
  const [resourceType = contentType] = contentType.split('.');
  state.resolveEffectivePermissions.mockResolvedValue({
    ok: true,
    permissions: [{ action: `${resourceType}.read`, resourceType }],
  });

  const readPage = async (page: number, sortDirection: 'asc' | 'desc') => {
    const response = await listProjectedContents(ctx, {
      page,
      pageSize: 2,
      type: contentType,
      visibleTypes: [contentType],
      sortBy: 'title',
      sortDirection,
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: Array<{ title: string }>;
      pagination: { total: number };
    };
    expect(payload.pagination.total).toBe(titles.length);
    return payload.data.map(({ title }) => title);
  };

  return {
    asc: [await readPage(1, 'asc'), await readPage(2, 'asc')],
    desc: [await readPage(1, 'desc'), await readPage(2, 'desc')],
  };
};

describe('content projection title order', () => {
  registerProjectionFixture();

  it('sorts imported and Studio-created events by German title order before pagination', async () => {
    const pages = await listTitlePages('events.event-record', [
      '„IM OSTEN – Geschichten aus der Sonderzone“',
      'Ärger im Park',
      '"Zirkus Roncalli"',
      'Flohmarkt von A–Z',
    ]);

    expect(pages.asc).toEqual([
      ['Ärger im Park', 'Flohmarkt von A–Z'],
      ['„IM OSTEN – Geschichten aus der Sonderzone“', '"Zirkus Roncalli"'],
    ]);
    expect(pages.desc).toEqual([
      ['"Zirkus Roncalli"', '„IM OSTEN – Geschichten aus der Sonderzone“'],
      ['Flohmarkt von A–Z', 'Ärger im Park'],
    ]);
  });

  it.each(['poi.point-of-interest', 'faq.faq', 'cockpit-cards.cockpit-card', 'projects.project'])(
    'applies the same title order to %s across pages',
    async (contentType) => {
      const pages = await listTitlePages(contentType, ['Zentrum', '„Apfel“', 'ozean', 'Öko']);

      expect(pages.asc).toEqual([
        ['„Apfel“', 'Öko'],
        ['ozean', 'Zentrum'],
      ]);
      expect(pages.desc).toEqual([
        ['Zentrum', 'ozean'],
        ['Öko', '„Apfel“'],
      ]);
    }
  );
});
