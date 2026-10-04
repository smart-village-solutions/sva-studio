import { describe, expect, it } from 'vitest';

import type { ContentRow } from './repository-types.js';
import {
  ContentStateValidationError,
  validateNextContentState,
} from './repository-state-validation.js';
import { resolveContentChangedFields } from './repository-state-changes.js';
import { resolveNextContentStateValues } from './repository-state-values.js';

const row = (payload: ContentRow['payload_json']): ContentRow => ({
  id: 'content-1',
  content_type: 'news.article',
  instance_id: 'instance-1',
  organization_id: null,
  owner_subject_id: null,
  owner_user_id: null,
  owner_organization_id: null,
  title: 'Titel',
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-04-26T10:00:00.000Z',
  created_by: 'creator-1',
  updated_at: '2026-04-26T10:00:00.000Z',
  updated_by: 'updater-1',
  author_display_mode: 'organization',
  author_display_name: 'Autor',
  payload_json: payload,
  status: 'draft',
  validation_state: 'valid',
  history_ref: 'history-1',
  current_revision_ref: null,
  last_audit_event_ref: null,
});

describe('iam content repository state helpers', () => {
  it.each([
    [
      'personal to organization',
      null,
      '33333333-3333-4333-8333-333333333333',
      { type: 'organization', id: '22222222-2222-4222-8222-222222222222' },
      null,
      '22222222-2222-4222-8222-222222222222',
      ['organizationId', 'ownerUserId', 'ownerOrganizationId'],
    ],
    [
      'organization to personal',
      '11111111-1111-4111-8111-111111111111',
      null,
      { type: 'account', id: '44444444-4444-4444-8444-444444444444' },
      '44444444-4444-4444-8444-444444444444',
      null,
      ['organizationId', 'ownerUserId', 'ownerOrganizationId'],
    ],
    [
      'organization to organization',
      '11111111-1111-4111-8111-111111111111',
      null,
      { type: 'organization', id: '22222222-2222-4222-8222-222222222222' },
      null,
      '22222222-2222-4222-8222-222222222222',
      ['organizationId', 'ownerOrganizationId'],
    ],
  ] as const)(
    'sets a confirmed external owner for %s',
    (
      _name,
      currentOrganizationId,
      currentUserId,
      confirmedExternalOwner,
      nextUserId,
      nextOrganizationId,
      changedFields
    ) => {
      const current = {
        ...row({}),
        organization_id: currentOrganizationId,
        owner_user_id: currentUserId,
        owner_organization_id: currentOrganizationId,
      };
      const state = resolveNextContentStateValues(current, { confirmedExternalOwner });

      expect(state.nextOrganizationId).toBe(nextOrganizationId);
      expect(state.nextOwnerUserId).toBe(nextUserId);
      expect(state.nextOwnerOrganizationId).toBe(nextOrganizationId);
      expect(resolveContentChangedFields(current, state)).toEqual(changedFields);
    }
  );

  it('clears the current user owner when only the owner organization changes', () => {
    const state = resolveNextContentStateValues(
      {
        ...row({}),
        owner_user_id: '33333333-3333-4333-8333-333333333333',
        owner_organization_id: '11111111-1111-4111-8111-111111111111',
      },
      {
        ownerOrganizationId: '22222222-2222-4222-8222-222222222222',
      }
    );

    expect(state.nextOwnerUserId).toBeNull();
    expect(state.nextOwnerOrganizationId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('uses canonical payload comparison for changed fields', () => {
    expect(
      resolveContentChangedFields(row({ teaser: 'Kurz', body: { de: 'Text', en: 'Text' } }), {
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: { body: { en: 'Text', de: 'Text' }, teaser: 'Kurz' },
        nextStatus: 'draft',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: null,
        nextPublishUntil: null,
      })
    ).not.toContain('payload');
  });

  it('throws typed validation errors for state invariant violations', () => {
    expect(() =>
      validateNextContentState({
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: {},
        nextStatus: 'published',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: null,
        nextPublishUntil: null,
      })
    ).toThrow(new ContentStateValidationError('content_published_at_required'));

    expect(() =>
      validateNextContentState({
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: {},
        nextStatus: 'draft',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: '2026-04-27T10:00:00.000Z',
        nextPublishUntil: '2026-04-26T10:00:00.000Z',
      })
    ).toThrow(new ContentStateValidationError('content_publication_window_invalid'));

    expect(() =>
      validateNextContentState({
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: {},
        nextStatus: 'draft',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: '2026-04-26T10:00:00.123456790Z',
        nextPublishUntil: '2026-04-26T10:00:00.123456789Z',
      })
    ).toThrow(new ContentStateValidationError('content_publication_window_invalid'));

    expect(() =>
      validateNextContentState({
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayMode: 'organization',
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: {},
        nextStatus: 'draft',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: '2026-04-26T10:00:00.123456789Z',
        nextPublishUntil: '2026-04-26T10:00:00.123456790Z',
      })
    ).not.toThrow();

    expect(() =>
      validateNextContentState({
        nextOrganizationId: null,
        nextOwnerUserId: null,
        nextOwnerOrganizationId: null,
        nextAuthorDisplayName: 'Autor',
        nextTitle: 'Titel',
        nextPayload: {},
        nextStatus: 'draft',
        nextValidationState: 'valid',
        nextPublishedAt: null,
        nextPublishFrom: '2026-04-26T10:00:00.000Z',
        nextPublishUntil: '2026-04-26T10:00:00.000Z',
      })
    ).toThrow(new ContentStateValidationError('content_publication_window_invalid'));
  });
});
