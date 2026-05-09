import { describe, expect, it, vi } from 'vitest';

import {
  collectUpdatedFields,
  deriveLegalTextId,
  loadExistingLegalTextId,
  mapLegalTextListItem,
  mapPendingLegalTextItem,
  resolveLegalTextUpdateState,
} from './legal-text-repository-shared.js';

describe('legal-text-repository-shared', () => {
  it('derives stable legal text ids from mixed input names', () => {
    expect(deriveLegalTextId(' Datenschutzerklärung 2026 ')).toMatch(/^datenschutzerkl_rung_2026_[a-f0-9]{12}$/);
    expect(deriveLegalTextId('***')).toMatch(/^legal_text_[a-f0-9]{12}$/);

    const longName = 'A'.repeat(80);
    expect(deriveLegalTextId(longName)).toMatch(/^a{48}_[a-f0-9]{12}$/);
  });

  it('loads an existing legal text id and returns undefined when no row exists', async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ legal_text_id: 'privacy_policy_abc123def456' }] })
        .mockResolvedValueOnce({ rows: [] }),
    };

    await expect(loadExistingLegalTextId(client as never, 'instance-1', 'Privacy Policy')).resolves.toBe(
      'privacy_policy_abc123def456'
    );
    await expect(loadExistingLegalTextId(client as never, 'instance-1', 'Terms')).resolves.toBeUndefined();
  });

  it('resolves update state with sanitized html, hashes and published-at validation', () => {
    const current = {
      id: 'version-1',
      name: 'Privacy Policy',
      legalTextVersion: '2026-03',
      locale: 'de-DE',
      contentHtml: '<p>Current</p>',
      status: 'draft',
      publishedAt: undefined,
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T10:00:00.000Z',
      acceptanceCount: 0,
      activeAcceptanceCount: 0,
    };

    const next = resolveLegalTextUpdateState(current, {
      instanceId: 'instance-1',
      actorAccountId: 'account-1',
      legalTextVersionId: 'version-1',
      contentHtml: '<p onclick="evil()">Updated</p><script>alert(1)</script>',
      status: 'valid',
      publishedAt: '2026-05-09T11:00:00.000Z',
    });

    expect(next).toMatchObject({
      nextContentHtml: '<p>Updated</p>',
      nextPublishedAt: '2026-05-09T11:00:00.000Z',
      nextStatus: 'valid',
    });
    expect(next.nextContentHash).toMatch(/^sha256:/);

    expect(() =>
      resolveLegalTextUpdateState(current, {
        instanceId: 'instance-1',
        actorAccountId: 'account-1',
        legalTextVersionId: 'version-1',
        status: 'valid',
      })
    ).toThrow('legal_text_published_at_required');
  });

  it('collects updated fields in api field naming', () => {
    expect(
      collectUpdatedFields({
        instanceId: 'instance-1',
        actorAccountId: 'account-1',
        legalTextVersionId: 'version-1',
        name: 'Privacy Policy',
        legalTextVersion: '2026-04',
        locale: 'en-US',
        contentHtml: '<p>Hello</p>',
        status: 'archived',
        publishedAt: '2026-05-09T12:00:00.000Z',
      })
    ).toEqual(['name', 'legalTextVersion', 'locale', 'contentHtml', 'status', 'publishedAt']);
  });

  it('maps list and pending items with optional fields only when present', () => {
    expect(
      mapLegalTextListItem({
        id: 'version-1',
        name: 'Privacy Policy',
        legal_text_version: '2026-03',
        locale: 'de-DE',
        content_html: '<p>Current</p>',
        status: 'draft',
        published_at: null,
        created_at: '2026-05-09T10:00:00.000Z',
        updated_at: '2026-05-09T11:00:00.000Z',
        acceptance_count: 2,
        active_acceptance_count: 1,
        last_accepted_at: null,
      })
    ).toEqual({
      id: 'version-1',
      name: 'Privacy Policy',
      legalTextVersion: '2026-03',
      locale: 'de-DE',
      contentHtml: '<p>Current</p>',
      status: 'draft',
      createdAt: '2026-05-09T10:00:00.000Z',
      updatedAt: '2026-05-09T11:00:00.000Z',
      acceptanceCount: 2,
      activeAcceptanceCount: 1,
    });

    expect(
      mapPendingLegalTextItem({
        id: 'version-2',
        legal_text_id: undefined,
        name: 'Terms',
        legal_text_version: '1',
        locale: 'de-DE',
        content_html: '<p>Terms</p>',
        published_at: '2026-05-09T12:00:00.000Z',
      })
    ).toEqual({
      id: 'version-2',
      legalTextId: 'version-2',
      name: 'Terms',
      legalTextVersion: '1',
      locale: 'de-DE',
      contentHtml: '<p>Terms</p>',
      publishedAt: '2026-05-09T12:00:00.000Z',
    });
  });
});
