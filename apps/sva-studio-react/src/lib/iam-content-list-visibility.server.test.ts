import { describe, expect, it } from 'vitest';

import type { EffectivePermission } from '@sva/core';

import {
  buildProjectionReadVisibilityRules,
  isProjectionRowVisibleForRead,
  type ProjectionReadVisibilityRule,
} from './iam-content-list-visibility.js';

const createPermission = (overrides: Partial<EffectivePermission>): EffectivePermission => ({
  action: 'content.read',
  resourceType: 'content',
  ...overrides,
});

const findRule = (
  rules: readonly ProjectionReadVisibilityRule[],
  contentType: string
): ProjectionReadVisibilityRule => {
  const rule = rules.find((entry) => entry.contentType === contentType);
  if (!rule) {
    throw new Error(`Missing rule for ${contentType}`);
  }
  return rule;
};

describe('iam content list visibility', () => {
  it('derives organization-scoped allow and deny rules for projected rows', () => {
    const rules = buildProjectionReadVisibilityRules(
      ['generic', 'news.article'],
      [
        createPermission({
          action: 'content.read',
          resourceType: 'content',
          organizationId: 'org-1',
          accessScope: 'organization',
        }),
        createPermission({
          action: 'content.read',
          resourceType: 'content',
          organizationId: 'org-2',
          effect: 'deny',
        }),
        createPermission({
          action: 'news.read',
          resourceType: 'news',
        }),
      ]
    );

    expect(findRule(rules, 'generic')).toEqual({
      contentType: 'generic',
      allowGlobal: false,
      allowOrganizationIds: ['org-1'],
      allowOwn: true,
      denyGlobal: false,
      denyOrganizationIds: ['org-2'],
      denyOwn: false,
    });
    expect(findRule(rules, 'news.article')).toEqual({
      contentType: 'news.article',
      allowGlobal: true,
      allowOrganizationIds: [],
      allowOwn: false,
      denyGlobal: false,
      denyOrganizationIds: [],
      denyOwn: false,
    });
  });

  it('keeps organization-scoped plugin read permissions scoped to matching organizations', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['news.article'],
      [
        createPermission({
          action: 'news.read',
          resourceType: 'news',
          organizationId: 'org-1',
          accessScope: 'organization',
        }),
      ]
    );

    expect(rule).toEqual({
      contentType: 'news.article',
      allowGlobal: false,
      allowOrganizationIds: ['org-1'],
      allowOwn: true,
      denyGlobal: false,
      denyOrganizationIds: [],
      denyOwn: false,
    });
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'news.article',
          organizationId: 'org-1',
          createdByAccountId: 'account-a',
        },
        undefined
      )
    ).toBe(true);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'news.article',
          organizationId: 'org-2',
          createdByAccountId: 'account-a',
        },
        undefined
      )
    ).toBe(false);
  });

  it('evaluates row visibility with deny precedence and own fallback', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['generic'],
      [
        createPermission({
          organizationId: 'org-1',
          accessScope: 'organization',
        }),
        createPermission({
          organizationId: 'org-2',
          effect: 'deny',
        }),
      ]
    );

    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-1',
          createdByAccountId: 'account-a',
        },
        'account-b'
      )
    ).toBe(true);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-9',
          createdByAccountId: 'account-a',
        },
        'account-a'
      )
    ).toBe(true);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-2',
          createdByAccountId: 'account-a',
        },
        'account-a'
      )
    ).toBe(false);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-9',
          createdByAccountId: 'account-x',
        },
        'account-a'
      )
    ).toBe(false);
  });

  it('keeps own-scoped read permissions invisible without an actor account id', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['generic'],
      [
        createPermission({
          accessScope: 'own',
        }),
      ]
    );

    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-1',
          createdByAccountId: 'account-a',
        },
        undefined
      )
    ).toBe(false);
  });

  it('handles plugin deny precedence, content type mismatches, and unscoped optional rows', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['events.event-record'],
      [
        createPermission({
          action: 'events.read',
          resourceType: 'events',
          organizationId: 'org-2',
          accessScope: 'organization',
        }),
        createPermission({
          action: 'events.read',
          resourceType: 'events',
          effect: 'deny',
          accessScope: 'own',
        }),
      ]
    );

    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'news.article', createdByAccountId: 'account-a' }, 'account-a')
    ).toBe(false);
    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'events.event-record', createdByAccountId: 'account-a' }, 'account-b')
    ).toBe(true);
    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'events.event-record', createdByAccountId: 'account-a' }, 'account-a')
    ).toBe(false);

    const [globalDenyRule] = buildProjectionReadVisibilityRules(
      ['content.custom'],
      [
        createPermission({ action: 'content.read', resourceType: 'content' }),
        createPermission({ action: 'content.read', resourceType: 'content', effect: 'deny' }),
      ]
    );
    expect(
      isProjectionRowVisibleForRead(
        globalDenyRule,
        { contentType: 'content.custom', organizationId: 'org-1', createdByAccountId: 'account-a' },
        'account-b'
      )
    ).toBe(false);
  });
});
