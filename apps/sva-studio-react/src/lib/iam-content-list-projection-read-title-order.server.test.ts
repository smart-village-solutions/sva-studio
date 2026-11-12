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

// A local content row from `iam.contents`; the projection deduplicates these by id.
const localContentRow = (id: string, title: string) => ({
  ...projectionRow('generic', id, title, 'Studio'),
  source_system: 'iam' as const,
  source_entity_type: 'iam.contents',
});

const markProjected = (contentType: string, count: number) => {
  fixture.syncStates.set(contentType, {
    last_started_at: null,
    last_succeeded_at: new Date().toISOString(),
    last_failed_at: null,
    last_error_code: null,
    last_error_message: null,
    projected_count: count,
  });
};

const readPermission = (contentType: string) => {
  const [resourceType = contentType] = contentType.split('.');
  return { action: `${resourceType}.read`, resourceType };
};

// Reads the first two pages (page size 2) in both directions.
const readTitlePages = async (
  query: { readonly type?: string; readonly visibleTypes: readonly string[] },
  total: number
) => {
  const readPage = async (page: number, sortDirection: 'asc' | 'desc') => {
    const response = await listProjectedContents(ctx, {
      ...query,
      visibleTypes: [...query.visibleTypes],
      page,
      pageSize: 2,
      sortBy: 'title',
      sortDirection,
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: Array<{ title: string }>;
      pagination: { total: number };
    };
    expect(payload.pagination.total).toBe(total);
    return payload.data.map(({ title }) => title);
  };

  return {
    asc: [await readPage(1, 'asc'), await readPage(2, 'asc')],
    desc: [await readPage(1, 'desc'), await readPage(2, 'desc')],
  };
};

const listTitlePages = async (contentType: string, titles: readonly string[]) => {
  // Imported and editorially created entries (different data providers) alternate so both kinds
  // share one ordering.
  fixture.projectionRows = titles.map((title, index) =>
    projectionRow(contentType, `row-${index}`, title, index % 2 === 0 ? 'Biletado' : 'Studio')
  );
  markProjected(contentType, titles.length);
  state.resolveEffectivePermissions.mockResolvedValue({
    ok: true,
    permissions: [readPermission(contentType)],
  });

  return readTitlePages({ type: contentType, visibleTypes: [contentType] }, titles.length);
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

  it('sorts local Studio contents and Mainserver events together in the unfiltered list', async () => {
    fixture.projectionRows = [
      projectionRow('events.event-record', 'event-1', '„IM OSTEN“', 'Biletado'),
      localContentRow('content-1', '"Zirkus"'),
      projectionRow('events.event-record', 'event-2', 'Öko-Markt', 'Studio'),
      localContentRow('content-2', 'apfelfest'),
    ];
    markProjected('events.event-record', 2);
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.read', resourceType: 'content' },
        readPermission('events.event-record'),
      ],
    });

    const pages = await readTitlePages({ visibleTypes: ['generic', 'events.event-record'] }, 4);

    expect(pages.asc).toEqual([
      ['apfelfest', '„IM OSTEN“'],
      ['Öko-Markt', '"Zirkus"'],
    ]);
    expect(pages.desc).toEqual([
      ['"Zirkus"', 'Öko-Markt'],
      ['„IM OSTEN“', 'apfelfest'],
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
