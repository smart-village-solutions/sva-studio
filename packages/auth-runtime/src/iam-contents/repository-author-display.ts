import type { IamContentAuthorDisplayMode } from '@sva/core';
import type { withInstanceScopedDb } from '../iam-account-management/shared.js';
import { resolveContentPublicationInvariant } from './content-publication-invariants.js';
import { ContentStateValidationError } from './repository-state-validation.js';
import type { ContentRow, CreateContentInput, UpdateContentInput } from './repository-types.js';

type InstanceScopedClient = Parameters<Parameters<typeof withInstanceScopedDb>[1]>[0];

type OrganizationAuthorPolicyRow = {
  readonly display_name: string;
  readonly content_author_policy: 'org_only' | 'org_or_personal';
};

const loadOrganizationAuthorPolicy = async (
  client: InstanceScopedClient,
  input: { readonly instanceId: string; readonly organizationId: string }
): Promise<OrganizationAuthorPolicyRow | null> => {
  const result = await client.query<OrganizationAuthorPolicyRow>(
    `
SELECT display_name, content_author_policy
FROM iam.organizations
WHERE instance_id = $1
  AND id = $2::uuid
LIMIT 1;
`,
    [input.instanceId, input.organizationId]
  );

  return result.rows[0] ?? null;
};

const assertAuthorDisplayPolicy = (
  mode: IamContentAuthorDisplayMode,
  organization: OrganizationAuthorPolicyRow | null
) => {
  if (!organization && mode === 'organization') {
    throw new ContentStateValidationError('content_author_organization_not_found');
  }

  if (organization?.content_author_policy === 'org_only' && mode === 'user') {
    throw new ContentStateValidationError('content_author_display_mode_not_allowed');
  }
};

const resolveAuthorDisplayName = (input: {
  readonly actorDisplayName: string;
  readonly mode: IamContentAuthorDisplayMode;
  readonly organization: OrganizationAuthorPolicyRow | null;
  readonly requestedDisplayName?: string;
}): string => {
  if (input.requestedDisplayName) {
    return input.requestedDisplayName;
  }
  if (input.mode === 'organization') {
    return input.organization?.display_name ?? input.actorDisplayName;
  }
  return input.actorDisplayName;
};

export const resolveCreateAuthorDisplay = async (
  client: InstanceScopedClient,
  input: CreateContentInput
): Promise<{
  readonly authorDisplayMode: IamContentAuthorDisplayMode;
  readonly authorDisplayName: string;
}> => {
  const organization = input.organizationId
    ? await loadOrganizationAuthorPolicy(client, {
        instanceId: input.instanceId,
        organizationId: input.organizationId,
      })
    : null;
  const authorDisplayMode =
    input.authorDisplayMode ?? (input.organizationId ? 'organization' : 'user');
  assertAuthorDisplayPolicy(authorDisplayMode, organization);

  return {
    authorDisplayMode,
    authorDisplayName: resolveAuthorDisplayName({
      actorDisplayName: input.actorDisplayName,
      mode: authorDisplayMode,
      organization,
    }),
  };
};

export const resolveUpdateAuthorDisplay = async (
  client: InstanceScopedClient,
  current: ContentRow,
  input: UpdateContentInput
): Promise<{
  readonly authorDisplayMode: IamContentAuthorDisplayMode;
  readonly authorDisplayName: string;
}> => {
  const nextOrganizationId = input.confirmedExternalOwner
    ? input.confirmedExternalOwner.type === 'organization'
      ? input.confirmedExternalOwner.id
      : null
    : (input.organizationId ?? current.organization_id ?? null);
  const organization = nextOrganizationId
    ? await loadOrganizationAuthorPolicy(client, {
        instanceId: input.instanceId,
        organizationId: nextOrganizationId,
      })
    : null;
  const preserveCurrentAuthor =
    input.preserveExistingContentState &&
    (current.author_display_mode === 'organization'
      ? organization !== null
      : organization?.content_author_policy !== 'org_only');
  if (preserveCurrentAuthor) {
    return {
      authorDisplayMode: current.author_display_mode,
      authorDisplayName:
        current.author_display_mode === 'organization' && organization
          ? organization.display_name
          : current.author_display_name,
    };
  }
  const authorDisplayMode = input.authorDisplayMode ?? current.author_display_mode;
  assertAuthorDisplayPolicy(authorDisplayMode, organization);
  if (input.confirmedExternalOwner?.type === 'organization' && authorDisplayMode === 'organization') {
    return {
      authorDisplayMode,
      authorDisplayName: organization?.display_name ?? input.actorDisplayName,
    };
  }
  const hasExplicitAuthorDisplayChange =
    input.authorDisplayMode !== undefined || input.authorDisplayName !== undefined;

  return {
    authorDisplayMode,
    authorDisplayName:
      !hasExplicitAuthorDisplayChange && authorDisplayMode === 'user'
        ? current.author_display_name
        : resolveAuthorDisplayName({
            actorDisplayName: input.actorDisplayName,
            mode: authorDisplayMode,
            organization,
            requestedDisplayName: input.authorDisplayName,
          }),
  };
};

export const validatePublicationWindow = (input: {
  publishFrom?: string;
  publishUntil?: string;
}) => {
  if (
    resolveContentPublicationInvariant({
      publishFrom: input.publishFrom,
      publishUntil: input.publishUntil,
    }) === 'content_publication_window_invalid'
  ) {
    throw new ContentStateValidationError('content_publication_window_invalid');
  }
};
