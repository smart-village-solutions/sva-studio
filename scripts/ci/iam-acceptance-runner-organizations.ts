import type { AcceptanceConfig } from './iam-acceptance.ts';
import type { AcceptanceSession } from './iam-acceptance-runner-login.ts';
import type { AcceptanceRecorder, Pool } from './iam-acceptance-runner-runtime.ts';
import { buildMutationHeaders, requestJson } from './iam-acceptance-runner-runtime.ts';

type OrganizationRow = {
  depth: number;
  display_name: string;
  hierarchy_path: string[];
  id: string;
  is_active: boolean;
  organization_key: string;
  parent_organization_id: string | null;
};

type MembershipRow = {
  account_id: string;
  is_default_context: boolean;
  membership_visibility: string;
  organization_id: string;
};

export type AcceptanceOrganizationEvidence = {
  childOrganizationId: string;
  parentOrganizationId: string;
};

type OrganizationVerificationInput = {
  adminSession: AcceptanceSession;
  config: AcceptanceConfig;
  memberAccountId: string;
  pool: Pool;
  reportFileBase: string;
};

type OrganizationMutationEvidence = AcceptanceOrganizationEvidence & {
  childOrganizationKey: string;
  parentOrganizationKey: string;
};

const loadSeedRootId = async (
  recorder: AcceptanceRecorder,
  input: Pick<OrganizationVerificationInput, 'config' | 'pool'>
): Promise<string> => {
  const seedRoot = await input.pool.query<{ id: string }>(
    `SELECT id FROM iam.organizations
     WHERE instance_id = $1 AND organization_key = 'seed-org-default'
     LIMIT 1;`,
    [input.config.instanceId]
  );
  const seedRootId = seedRoot.rows[0]?.id;
  if (!seedRootId) {
    recorder.failStep({
      name: 'Organisationen Preflight',
      failureCode: 'acceptance_database_query_failed',
      details: 'Die Seed-Organisation `seed-org-default` fehlt.',
    });
  }
  return seedRootId as string;
};

const assignMembershipAndDeactivateChild = async (
  recorder: AcceptanceRecorder,
  input: OrganizationVerificationInput,
  evidence: AcceptanceOrganizationEvidence
): Promise<void> => {
  const request = input.adminSession.context.request;
  await requestJson(
    recorder,
    await request.post(
      new URL(
        `/api/v1/iam/organizations/${evidence.parentOrganizationId}/memberships`,
        input.config.baseUrl
      ).toString(),
      {
        data: { accountId: input.memberAccountId, isDefaultContext: true, visibility: 'external' },
        failOnStatusCode: false,
        headers: buildMutationHeaders(
          input.config.baseUrl,
          `${input.reportFileBase}-membership-parent-assign`
        ),
      }
    ),
    {
      expectedStatus: 200,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die Acceptance-Membership konnte nicht zugewiesen werden.',
      name: 'Membership-Zuweisung',
    }
  );
  await requestJson(
    recorder,
    await request.delete(
      new URL(
        `/api/v1/iam/organizations/${evidence.childOrganizationId}`,
        input.config.baseUrl
      ).toString(),
      {
        failOnStatusCode: false,
        headers: buildMutationHeaders(input.config.baseUrl),
      }
    ),
    {
      expectedStatus: 200,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die Acceptance-Child-Organisation konnte nicht deaktiviert werden.',
      name: 'Organisations-CRUD',
    }
  );
};

const performOrganizationMutations = async (
  recorder: AcceptanceRecorder,
  input: OrganizationVerificationInput
): Promise<OrganizationMutationEvidence> => {
  const seedRootId = await loadSeedRootId(recorder, input);
  const request = input.adminSession.context.request;
  const parentPayload = {
    organizationKey: `${input.config.organizationKeyPrefix}-parent`,
    displayName: 'Acceptance Parent',
    organizationType: 'municipality',
    parentOrganizationId: seedRootId,
    contentAuthorPolicy: 'org_or_personal',
  };
  const parentCreated = await requestJson<{ data: { id: string; displayName: string } }>(
    recorder,
    await request.post(new URL('/api/v1/iam/organizations', input.config.baseUrl).toString(), {
      data: parentPayload,
      failOnStatusCode: false,
      headers: buildMutationHeaders(
        input.config.baseUrl,
        `${input.reportFileBase}-organization-parent-create`
      ),
    }),
    {
      expectedStatus: 201,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die Acceptance-Parent-Organisation konnte nicht angelegt werden.',
      name: 'Organisations-CRUD',
    }
  );

  const childPayload = {
    organizationKey: `${input.config.organizationKeyPrefix}-child`,
    displayName: 'Acceptance Child',
    organizationType: 'district',
    parentOrganizationId: parentCreated.data.id,
    contentAuthorPolicy: 'org_only',
  };
  const childCreated = await requestJson<{ data: { id: string } }>(
    recorder,
    await request.post(new URL('/api/v1/iam/organizations', input.config.baseUrl).toString(), {
      data: childPayload,
      failOnStatusCode: false,
      headers: buildMutationHeaders(
        input.config.baseUrl,
        `${input.reportFileBase}-organization-child-create`
      ),
    }),
    {
      expectedStatus: 201,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die Acceptance-Child-Organisation konnte nicht angelegt werden.',
      name: 'Organisations-CRUD',
    }
  );

  await requestJson(
    recorder,
    await request.patch(
      new URL(`/api/v1/iam/organizations/${childCreated.data.id}`, input.config.baseUrl).toString(),
      {
        data: { displayName: 'Acceptance Child Updated', contentAuthorPolicy: 'org_or_personal' },
        failOnStatusCode: false,
        headers: buildMutationHeaders(input.config.baseUrl),
      }
    ),
    {
      expectedStatus: 200,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die Acceptance-Child-Organisation konnte nicht aktualisiert werden.',
      name: 'Organisations-CRUD',
    }
  );

  const childReadPayload = await requestJson<{
    data: { displayName: string; id: string; parentOrganizationId: string | null };
  }>(
    recorder,
    await request.get(
      new URL(`/api/v1/iam/organizations/${childCreated.data.id}`, input.config.baseUrl).toString(),
      {
        failOnStatusCode: false,
      }
    ),
    {
      expectedStatus: 200,
      failureCode: 'acceptance_http_request_failed',
      details: 'Die aktualisierte Acceptance-Child-Organisation konnte nicht gelesen werden.',
      name: 'Organisations-CRUD',
    }
  );
  if (
    childReadPayload.data.id !== childCreated.data.id ||
    childReadPayload.data.displayName !== 'Acceptance Child Updated' ||
    childReadPayload.data.parentOrganizationId !== parentCreated.data.id
  ) {
    recorder.failStep({
      name: 'Organisations-CRUD',
      failureCode: 'acceptance_organization_assertion_failed',
      details: 'Der API-Readback der Acceptance-Child-Organisation ist inkonsistent.',
      metadata: childReadPayload,
    });
  }

  await assignMembershipAndDeactivateChild(recorder, input, {
    childOrganizationId: childCreated.data.id,
    parentOrganizationId: parentCreated.data.id,
  });

  return {
    childOrganizationId: childCreated.data.id,
    childOrganizationKey: childPayload.organizationKey,
    parentOrganizationId: parentCreated.data.id,
    parentOrganizationKey: parentPayload.organizationKey,
  };
};

const verifyOrganizationPersistence = async (
  recorder: AcceptanceRecorder,
  input: Pick<OrganizationVerificationInput, 'config' | 'memberAccountId' | 'pool'>,
  evidence: OrganizationMutationEvidence
): Promise<AcceptanceOrganizationEvidence> => {
  const organizationRows = await input.pool.query<OrganizationRow>(
    `SELECT id, organization_key, display_name, parent_organization_id, hierarchy_path, depth, is_active
     FROM iam.organizations
     WHERE instance_id = $1 AND organization_key IN ($2, $3)
     ORDER BY organization_key ASC;`,
    [input.config.instanceId, evidence.parentOrganizationKey, evidence.childOrganizationKey]
  );
  const parentRow = organizationRows.rows.find(
    (row) => row.organization_key === evidence.parentOrganizationKey
  );
  const childRow = organizationRows.rows.find(
    (row) => row.organization_key === evidence.childOrganizationKey
  );
  if (!parentRow || !childRow) {
    recorder.failStep({
      name: 'Organisations-CRUD',
      failureCode: 'acceptance_organization_assertion_failed',
      details: 'Die Acceptance-Organisationen sind nicht konsistent in der Datenbank vorhanden.',
      metadata: { rows: organizationRows.rows },
    });
  }
  const verifiedParentRow = parentRow as OrganizationRow;
  const verifiedChildRow = childRow as OrganizationRow;
  if (
    verifiedChildRow.parent_organization_id !== verifiedParentRow.id ||
    verifiedChildRow.is_active !== false ||
    verifiedChildRow.depth !== verifiedParentRow.depth + 1 ||
    !Array.isArray(verifiedChildRow.hierarchy_path) ||
    verifiedChildRow.hierarchy_path.length !== verifiedParentRow.hierarchy_path.length + 1 ||
    verifiedChildRow.hierarchy_path.at(-1) !== verifiedParentRow.id
  ) {
    recorder.failStep({
      name: 'Organisations-CRUD',
      failureCode: 'acceptance_organization_assertion_failed',
      details: 'Parent-/Child-Beziehung oder Hierarchiefelder stimmen nicht.',
      metadata: { childRow: verifiedChildRow, parentRow: verifiedParentRow },
    });
  }
  recorder.recordStep({
    name: 'Organisations-CRUD',
    status: 'passed',
    details:
      'Anlegen, Aktualisieren und Deaktivieren der Acceptance-Organisationen wurden über API und DB verifiziert.',
    metadata: {
      childDepth: verifiedChildRow.depth,
      childHierarchyPath: verifiedChildRow.hierarchy_path,
      childOrganizationId: verifiedChildRow.id,
      parentOrganizationId: verifiedParentRow.id,
    },
  });

  const membershipRows = await input.pool.query<MembershipRow>(
    `SELECT account_id, organization_id, is_default_context, membership_visibility
     FROM iam.account_organizations
     WHERE instance_id = $1 AND account_id = $2::uuid AND organization_id = $3::uuid;`,
    [input.config.instanceId, input.memberAccountId, verifiedParentRow.id]
  );
  const membershipRow = membershipRows.rows[0];
  if (
    !membershipRow ||
    !membershipRow.is_default_context ||
    membershipRow.membership_visibility !== 'external'
  ) {
    recorder.failStep({
      name: 'Membership-Zuweisung',
      failureCode: 'acceptance_membership_missing',
      details: 'Membership oder Default-Kontext fehlt in der Datenbank.',
      metadata: { rows: membershipRows.rows },
    });
  }
  recorder.recordStep({
    name: 'Membership-Zuweisung',
    status: 'passed',
    details: 'Membership und Default-Kontext wurden per API und Datenbank nachgewiesen.',
    metadata: membershipRow,
  });
  return { childOrganizationId: verifiedChildRow.id, parentOrganizationId: verifiedParentRow.id };
};

export const verifyOrganizationsAndMembership = async (
  recorder: AcceptanceRecorder,
  input: OrganizationVerificationInput
): Promise<AcceptanceOrganizationEvidence> => {
  const evidence = await performOrganizationMutations(recorder, input);
  return verifyOrganizationPersistence(recorder, input, evidence);
};
