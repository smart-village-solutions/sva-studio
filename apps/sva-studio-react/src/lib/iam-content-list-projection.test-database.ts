import {
  createSyncStateQueryHandlers,
  type TestSyncState,
} from './iam-content-list-projection.test-database-sync-state.js';
import type { TestProjectionRow } from './iam-content-list-projection.test-database-types.js';
type TestQueryResult = { rows: unknown[]; rowCount: number };
const readNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;
const readPayloadJson = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
export const mapInsertedProjectionRow = (row: Record<string, unknown>): TestProjectionRow => ({
  id: String(row.id),
  instance_id: String(row.instance_id),
  projection_scope_key: String(row.projection_scope_key ?? ''),
  organization_id: readNullableString(row.organization_id),
  owner_subject_id: readNullableString(row.owner_subject_id),
  owner_user_id: readNullableString(row.owner_user_id),
  owner_organization_id: readNullableString(row.owner_organization_id),
  content_type: String(row.content_type),
  title: String(row.title),
  published_at: readNullableString(row.published_at),
  publish_from: readNullableString(row.publish_from),
  publish_until: readNullableString(row.publish_until),
  created_at: String(row.created_at),
  created_by: String(row.created_by),
  updated_at: String(row.updated_at),
  updated_by: String(row.updated_by),
  author_display_mode: row.author_display_mode === 'user' ? 'user' : 'organization',
  author_display_name: String(row.author_display_name),
  payload_json: readPayloadJson(row.payload_json),
  status: row.status as TestProjectionRow['status'],
  validation_state: row.validation_state as TestProjectionRow['validation_state'],
  history_ref: String(row.history_ref),
  current_revision_ref: readNullableString(row.current_revision_ref),
  last_audit_event_ref: readNullableString(row.last_audit_event_ref),
  source_data_provider_id: readNullableString(row.source_data_provider_id),
  source_data_provider_name: readNullableString(row.source_data_provider_name),
  credential_source:
    row.credential_source === 'organization' || row.credential_source === 'user'
      ? row.credential_source
      : null,
  credential_fingerprint: readNullableString(row.credential_fingerprint),
  authorization_mode:
    row.authorization_mode === 'exact' ? 'exact' : 'credential_visible_compatibility',
  source_system: 'mainserver',
  source_entity_type: String(row.source_entity_type),
  source_entity_id: String(row.source_entity_id),
});

export const fixture = {
  projectionRows: [] as TestProjectionRow[],
  syncStates: new Map<string, TestSyncState>(),
  projectionInsertArgs: null as readonly unknown[] | null,
  projectionInsertSql: null as string | null,
  projectionInsertPayloadSizes: [] as number[],
  simulateConcurrentProjectionConflict: false,
  simulateLegacyProjectionSchemaMismatchOnce: false,
  simulateLegacySyncStateSchemaMismatchOnce: false,
  syncScopeKeyColumnAvailable: true,
  projectionScopeKeyColumnAvailable: true,
};

const buildScopeKey = (
  row: Pick<
    TestProjectionRow,
    | 'instance_id'
    | 'projection_scope_key'
    | 'source_system'
    | 'source_entity_type'
    | 'source_entity_id'
    | 'organization_id'
    | 'owner_subject_id'
    | 'owner_user_id'
    | 'owner_organization_id'
  >
): string =>
  [
    row.instance_id,
    row.source_system,
    row.source_entity_type,
    row.source_entity_id,
    ...(fixture.projectionScopeKeyColumnAvailable ? [row.projection_scope_key] : []),
  ].join('::');

const readStringArrayQueryValue = (
  values: readonly unknown[] | undefined,
  match: RegExpMatchArray
): readonly string[] => {
  const value = values?.[Number.parseInt(match[1] ?? '0', 10) - 1];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

const isMainserverCompatibilityVisible = (
  row: TestProjectionRow,
  allowsAllMainserverRows: boolean,
  allowsCredentialCompatibility: boolean
): boolean =>
  row.source_system === 'mainserver' &&
  (allowsAllMainserverRows ||
    (allowsCredentialCompatibility && row.authorization_mode !== 'exact'));

const hasAllowedOrganizationOwner = (
  row: TestProjectionRow,
  allowedOrganizationIds: readonly string[]
): boolean => {
  const effectiveOwnerOrganizationId = row.owner_organization_id ?? row.organization_id;
  return (
    effectiveOwnerOrganizationId != null &&
    allowedOrganizationIds.includes(effectiveOwnerOrganizationId)
  );
};

const hasAllowedUserOwner = (
  row: TestProjectionRow,
  visibilityOwnerUserIds: readonly string[]
): boolean => row.owner_user_id != null && visibilityOwnerUserIds.includes(row.owner_user_id);

const isProjectionRowVisible = (
  row: TestProjectionRow,
  input: Readonly<{
    allowedOrganizationIds: readonly string[];
    visibilityOwnerUserIds: readonly string[];
    allowsCredentialCompatibility: boolean;
    allowsAllMainserverRows: boolean;
  }>
): boolean => {
  return (
    isMainserverCompatibilityVisible(
      row,
      input.allowsAllMainserverRows,
      input.allowsCredentialCompatibility
    ) ||
    hasAllowedOrganizationOwner(row, input.allowedOrganizationIds) ||
    hasAllowedUserOwner(row, input.visibilityOwnerUserIds)
  );
};

const applyProjectionFilters = (
  text: string,
  values: readonly unknown[] | undefined
): TestProjectionRow[] => {
  const scopedInstanceId = String(values?.[0] ?? '');
  let rows = fixture.projectionRows.filter((row) => row.instance_id === scopedInstanceId);

  const contentTypeMatches = [...text.matchAll(/projection\.content_type = \$(\d+)/g)];
  if (contentTypeMatches.length > 0) {
    const contentTypes = contentTypeMatches
      .map((match) => values?.[Number.parseInt(match[1] ?? '0', 10) - 1])
      .filter((value): value is string => typeof value === 'string');
    rows = rows.filter((row) => contentTypes.includes(row.content_type));
  }

  const languageCodeMatch = text.match(/payload_json ->> 'languageCode'\)\) = \$(\d+)/);
  if (languageCodeMatch) {
    const index = Number.parseInt(languageCodeMatch[1] ?? '0', 10) - 1;
    const languageCode = readNullableString(values?.[index])?.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        readNullableString(row.payload_json.languageCode)?.trim().toLowerCase() === languageCode
    );
  }
  const mainserverSourceGuardIndex = text.indexOf("projection.source_system <> 'mainserver'");
  const ownerOrgMatches = [
    ...text.matchAll(/projection\.owner_organization_id::text = ANY\(\$(\d+)::text\[\]\)/g),
  ];
  const allowedOrganizationIds = ownerOrgMatches.flatMap((match) =>
    readStringArrayQueryValue(values, match)
  );
  const visibilityOwnerUserIds = [...text.matchAll(/projection\.owner_user_id::text = \$(\d+)/g)]
    .filter((match) => match.index < mainserverSourceGuardIndex || mainserverSourceGuardIndex < 0)
    .map((match) => values?.[Number.parseInt(match[1] ?? '0', 10) - 1])
    .filter((value): value is string => typeof value === 'string');
  const allowsCredentialCompatibility = text.includes(
    "projection.authorization_mode = 'credential_visible_compatibility'"
  );
  const allowsAllMainserverRows = text.includes("(projection.source_system = 'mainserver')");

  if (allowedOrganizationIds.length > 0 || visibilityOwnerUserIds.length > 0) {
    rows = rows.filter((row) =>
      isProjectionRowVisible(row, {
        allowedOrganizationIds,
        visibilityOwnerUserIds,
        allowsCredentialCompatibility,
        allowsAllMainserverRows,
      })
    );
  }

  const projectionScopeMatches = [
    ...text.matchAll(/projection\.projection_scope_key = ANY\(\$(\d+)::text\[\]\)/g),
  ];
  if (projectionScopeMatches.length > 0) {
    const allowedScopeKeys = projectionScopeMatches.flatMap((match) =>
      readStringArrayQueryValue(values, match)
    );
    rows = rows.filter(
      (row) =>
        row.source_system !== 'mainserver' ||
        allowedScopeKeys.includes(row.projection_scope_key ?? '')
    );
  }

  return rows;
};

const schemaQueryResult = (text: string): TestQueryResult | null => {
  if (!text.includes('FROM information_schema.columns')) {
    return null;
  }
  const row = text.includes("column_name = 'projection_scope_key'")
    ? { has_projection_scope_key: fixture.projectionScopeKeyColumnAvailable }
    : { has_sync_scope_key: fixture.syncScopeKeyColumnAvailable };
  return { rows: [row], rowCount: 1 };
};

const distinctContentTypesQueryResult = (
  text: string,
  values: readonly unknown[] | undefined
): TestQueryResult | null => {
  if (!text.includes('SELECT DISTINCT projection.content_type')) {
    return null;
  }
  const instanceId = String(queryValue(values, 0));
  const rows = [
    ...new Set(
      fixture.projectionRows
        .filter((row) => row.instance_id === instanceId)
        .map((row) => row.content_type)
    ),
  ]
    .sort((left, right) => left.localeCompare(right))
    .map((content_type) => ({ content_type }));
  return { rows, rowCount: rows.length };
};

const queryValue = (
  values: readonly unknown[] | undefined,
  index: number,
  fallback: unknown = ''
): unknown => {
  if (!values) {
    return fallback;
  }
  const value = values[index];
  return value === undefined || value === null ? fallback : value;
};

const scopedCountQueryResult = (
  text: string,
  values: readonly unknown[] | undefined
): TestQueryResult | null => {
  if (
    !text.includes('FROM iam.content_list_projection') ||
    !text.includes("source_system = 'mainserver'") ||
    !text.includes('COUNT(*)::int AS total')
  ) {
    return null;
  }
  const instanceId = String(queryValue(values, 0));
  const contentType = String(queryValue(values, 1));
  const projectionScopeKey = fixture.projectionScopeKeyColumnAvailable
    ? String(queryValue(values, 2))
    : null;
  const total = fixture.projectionRows.filter(
    (row) =>
      row.instance_id === instanceId &&
      row.source_system === 'mainserver' &&
      row.content_type === contentType &&
      (!fixture.projectionScopeKeyColumnAvailable ||
        row.projection_scope_key === projectionScopeKey)
  ).length;
  return { rows: [{ total }], rowCount: 1 };
};

const deleteProjectionQueryResult = (
  text: string,
  values: readonly unknown[] | undefined
): TestQueryResult | null => {
  if (!text.includes('DELETE FROM iam.content_list_projection')) {
    return null;
  }
  const contentType = String(queryValue(values, 1));
  const projectionScopeKey = fixture.projectionScopeKeyColumnAvailable
    ? String(queryValue(values, 2))
    : null;
  const entityValue = queryValue(values, fixture.projectionScopeKeyColumnAvailable ? 4 : 3, null);
  const sourceEntityId = typeof entityValue === 'string' ? entityValue : null;
  const retainedEntityIds = Array.isArray(entityValue)
    ? entityValue.filter((value): value is string => typeof value === 'string')
    : null;
  fixture.projectionRows = fixture.projectionRows.filter((row) => {
    const matchingScope =
      row.source_system === 'mainserver' &&
      row.content_type === contentType &&
      (!fixture.projectionScopeKeyColumnAvailable ||
        row.projection_scope_key === projectionScopeKey);
    const matchingEntity = retainedEntityIds
      ? !retainedEntityIds.includes(row.source_entity_id)
      : sourceEntityId === null || row.source_entity_id === sourceEntityId;
    return !(matchingScope && matchingEntity);
  });
  return { rows: [], rowCount: 0 };
};

const throwLegacyProjectionConflict = (): never => {
  fixture.simulateLegacyProjectionSchemaMismatchOnce = false;
  const error = new Error(
    'duplicate key value violates unique constraint "content_list_projection_scope_key"'
  ) as Error & { code?: string; constraint?: string };
  error.code = '23505';
  error.constraint = 'content_list_projection_scope_key';
  throw error;
};

const insertMappedProjectionRows = (text: string, rows: TestProjectionRow[]): void => {
  if (fixture.simulateConcurrentProjectionConflict && rows.length > 0) {
    fixture.projectionRows.push({ ...rows[0], id: 'concurrent-row' });
    fixture.simulateConcurrentProjectionConflict = false;
  }
  for (const row of rows) {
    const existingIndex = fixture.projectionRows.findIndex(
      (candidate) => buildScopeKey(candidate) === buildScopeKey(row)
    );
    if (existingIndex < 0) {
      fixture.projectionRows.push(row);
    } else if (text.includes('ON CONFLICT ON CONSTRAINT content_list_projection_scope_key')) {
      fixture.projectionRows[existingIndex] = row;
    } else {
      throwLegacyProjectionConflict();
    }
  }
};

const insertProjectionQueryResult = (
  text: string,
  values: readonly unknown[] | undefined
): TestQueryResult | null => {
  if (!text.includes('INSERT INTO iam.content_list_projection')) {
    return null;
  }
  if (
    fixture.simulateLegacyProjectionSchemaMismatchOnce &&
    !text.includes('ON CONFLICT ON CONSTRAINT content_list_projection_scope_key') &&
    fixture.projectionScopeKeyColumnAvailable
  ) {
    throwLegacyProjectionConflict();
  }
  fixture.projectionInsertArgs = values ?? null;
  fixture.projectionInsertSql = text;
  const rawRows = JSON.parse(String(queryValue(values, 0, '[]'))) as Array<Record<string, unknown>>;
  fixture.projectionInsertPayloadSizes.push(rawRows.length);
  const rows = rawRows.map(mapInsertedProjectionRow);
  insertMappedProjectionRows(text, rows);
  return { rows: [], rowCount: rows.length };
};

const listQueryResult = (
  text: string,
  values: readonly unknown[] | undefined
): TestQueryResult | null => {
  if (text.includes('SELECT COUNT(*)::int AS total')) {
    const rows = applyProjectionFilters(text, values);
    return { rows: [{ total: rows.length }], rowCount: 1 };
  }
  if (text.includes('FROM iam.content_list_projection AS projection')) {
    const rows = applyProjectionFilters(text, values);
    return { rows, rowCount: rows.length };
  }
  return null;
};

export const createProjectionDatabaseQuery =
  () =>
  async <TRow>(text: string, values?: readonly unknown[]) => {
    const syncStateHandlers = createSyncStateQueryHandlers(fixture, queryValue);
    const handlers = [
      schemaQueryResult,
      syncStateHandlers.read,
      distinctContentTypesQueryResult,
      syncStateHandlers.insert,
      syncStateHandlers.update,
      scopedCountQueryResult,
      deleteProjectionQueryResult,
      insertProjectionQueryResult,
      listQueryResult,
    ];
    for (const handler of handlers) {
      const result = handler(text, values);
      if (result) {
        return result as { rows: TRow[]; rowCount: number };
      }
    }
    return { rows: [] as TRow[], rowCount: 0 };
  };
