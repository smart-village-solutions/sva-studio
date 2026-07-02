import { describe, expect, it } from 'vitest';

import type { EffectivePermission } from '@sva/iam-core';

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
  it('derives organization-scoped allow rules for projected rows', () => {
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
    });
    expect(findRule(rules, 'news.article')).toEqual({
      contentType: 'news.article',
      allowGlobal: true,
      allowOrganizationIds: [],
      allowOwn: false,
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
    });
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'news.article',
          organizationId: 'org-1',
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-1',
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
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-2',
        },
        undefined
      )
    ).toBe(false);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'news.article',
          organizationId: 'org-1',
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-2',
        },
        undefined
      )
    ).toBe(false);
  });

  it('uses surveys.read for projected survey rows instead of the generic content.read fallback', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['surveys.survey'],
      [
        createPermission({
          action: 'surveys.read',
          resourceType: 'surveys',
          organizationId: 'org-1',
          accessScope: 'organization',
        }),
      ]
    );

    expect(rule).toEqual({
      contentType: 'surveys.survey',
      allowGlobal: false,
      allowOrganizationIds: ['org-1'],
      allowOwn: true,
    });
  });

  it('evaluates row visibility with own fallback', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['generic'],
      [
        createPermission({
          organizationId: 'org-1',
          accessScope: 'organization',
        }),
      ]
    );

    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-1',
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-1',
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
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-9',
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
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-2',
        },
        'account-a'
      )
    ).toBe(true);
    expect(
      isProjectionRowVisibleForRead(
        rule,
        {
          contentType: 'generic',
          organizationId: 'org-9',
          ownerUserId: 'account-x',
          ownerOrganizationId: 'org-9',
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
          ownerUserId: 'account-a',
          ownerOrganizationId: 'org-1',
        },
        undefined
      )
    ).toBe(false);
  });

  it('handles content type mismatches and ownerless optional rows', () => {
    const [rule] = buildProjectionReadVisibilityRules(
      ['events.event-record'],
      [
        createPermission({
          action: 'events.read',
          resourceType: 'events',
          organizationId: 'org-2',
          accessScope: 'organization',
        }),
      ]
    );

    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'news.article', ownerUserId: 'account-a' }, 'account-a')
    ).toBe(false);
    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'events.event-record', ownerUserId: 'account-a' }, 'account-b')
    ).toBe(false);
    expect(
      isProjectionRowVisibleForRead(rule, { contentType: 'events.event-record', ownerUserId: 'account-a' }, 'account-a')
    ).toBe(true);
  });
});
