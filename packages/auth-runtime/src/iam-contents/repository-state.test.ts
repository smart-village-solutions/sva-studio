import { describe, expect, it } from 'vitest';

import type { ContentRow } from './repository-types.js';
import { ContentStateValidationError, validateNextContentState } from './repository-state-validation.js';
import { resolveContentChangedFields } from './repository-state-changes.js';

const row = (payload: ContentRow['payload_json']): ContentRow => ({
  id: 'content-1',
  content_type: 'news.article',
  instance_id: 'instance-1',
  organization_id: null,
  owner_subject_id: null,
  title: 'Titel',
  published_at: null,
  publish_from: null,
  publish_until: null,
  created_at: '2026-04-26T10:00:00.000Z',
  created_by: 'creator-1',
  updated_at: '2026-04-26T10:00:00.000Z',
  updated_by: 'updater-1',
  author_display_name: 'Autor',
  payload_json: payload,
  status: 'draft',
  validation_state: 'valid',
  history_ref: 'history-1',
  current_revision_ref: null,
  last_audit_event_ref: null,
});

describe('iam content repository state helpers', () => {
  it('uses canonical payload comparison for changed fields', () => {
    expect(
      resolveContentChangedFields(row({ teaser: 'Kurz', body: { de: 'Text', en: 'Text' } }), {
        nextOrganizationId: null,
        nextOwnerSubjectId: null,
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
        nextOwnerSubjectId: null,
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
        nextOwnerSubjectId: null,
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
        nextOwnerSubjectId: null,
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
        nextOwnerSubjectId: null,
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
        nextOwnerSubjectId: null,
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
