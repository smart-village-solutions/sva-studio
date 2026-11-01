import { afterEach, describe, expect, it, vi } from 'vitest';
import { MainserverApiError } from '@sva/plugin-sdk';
import {
  getConstructionSite,
  saveConstructionSite,
  listConstructionSites,
  listConstructionSiteCategories,
  readConstructionSitePending,
  constructionSiteRequestHash,
  constructionSiteRejection,
} from '../src/construction-sites.api.js';
import { createConstructionSiteDefaults } from '../src/contract.js';
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
describe('construction site HTTP client', () => {
  it('sends create/update with exact operation and context binding headers', async () => {
    const site = { ...createConstructionSiteDefaults('2026-11-01'), title: 'Road' };
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: { id: '42', input: site } }), {
            headers: { 'Content-Type': 'application/json', 'X-SVA-Context-Binding': 'bound' },
          })
      );
    vi.stubGlobal('fetch', fetchMock);
    await getConstructionSite('42', 'user');
    await saveConstructionSite(
      '42',
      { site, baseFingerprint: 'a'.repeat(64) },
      'user',
      'operation-1'
    );
    await saveConstructionSite(undefined, { site }, 'user', 'operation-2');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/v1/mainserver/construction-sites/42');
    const update = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(update.headers).get('X-SVA-Context-Binding')).toBe('bound');
    expect(new Headers(update.headers).get('X-SVA-Operation-Id')).toBe('operation-1');
    expect(update.method).toBe('PATCH');
    expect(JSON.parse(update.body as string)).toMatchObject({
      site,
      baseFingerprint: 'a'.repeat(64),
    });
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('POST');
  });
  it('encodes filters and requests categories compatible with construction sites', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ data: [] }), {
            headers: { 'Content-Type': 'application/json' },
          })
      );
    vi.stubGlobal('fetch', fetchMock);
    await listConstructionSites({ search: 'Straße & Brücke', page: 2 });
    await listConstructionSiteCategories();
    expect(
      new URL(fetchMock.mock.calls[0]?.[0] as string, 'https://test.local').searchParams.get(
        'search'
      )
    ).toBe('Straße & Brücke');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('dataType=generic_item_construction_site');
  });
  it('keeps invalid persisted markers inert and hashes the exact request body', async () => {
    for (const value of ['{', 'null', '1', '{}', '{"operationId":1,"inputHash":"x"}']) {
      sessionStorage.setItem('pending', value);
      expect(readConstructionSitePending('pending')).toBeUndefined();
    }
    sessionStorage.setItem(
      'pending',
      JSON.stringify({ operationId: 'op', inputHash: 'a'.repeat(64), id: '42' })
    );
    expect(readConstructionSitePending('pending')).toMatchObject({ id: '42' });
    expect(await constructionSiteRequestHash({ recover: true, inputHash: 'a'.repeat(64) })).toMatch(
      /^[a-f0-9]{64}$/
    );
    expect(constructionSiteRejection(new MainserverApiError('forbidden'))).toBe('forbidden');
    expect(
      constructionSiteRejection(new MainserverApiError('construction_site_outcome_unknown'))
    ).toBeUndefined();
    expect(constructionSiteRejection(new TypeError())).toBeUndefined();
  });
});
