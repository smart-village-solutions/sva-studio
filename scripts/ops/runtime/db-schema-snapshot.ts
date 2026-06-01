export const DEFAULT_IGNORED_SCHEMA_NAMES = ['graphile_worker'] as const;

export type SchemaSnapshotDiff = Readonly<{
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  unexpectedObjects: readonly string[];
}>;

const normalizeIdentifier = (value: string): string =>
  value
    .trim()
    .replace(/^"+|"+$/gu, '')
    .replace(/\(\s*/gu, '(')
    .replace(/\s+\)/gu, ')');

const isIgnoredSchema = (schemaName: string, ignoredSchemas: readonly string[]): boolean =>
  ignoredSchemas.includes(normalizeIdentifier(schemaName));

const extractSchemaAndName = (
  value: string,
  ignoredSchemas: readonly string[],
): Readonly<{ name: string; schema: string } | null> => {
  const match = value.match(/^(?<schema>"?[^".\s]+"?)\.(?<name>"?[^"\s(]+"?)/u);
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  const name = match?.groups?.name ? normalizeIdentifier(match.groups.name) : '';
  if (!schema || !name || isIgnoredSchema(schema, ignoredSchemas)) {
    return null;
  }

  return { schema, name };
};

const extractNamedObject = (
  line: string,
  prefix: string,
  type: string,
  ignoredSchemas: readonly string[],
): string | null => {
  if (!line.startsWith(prefix)) {
    return null;
  }

  const reference = extractSchemaAndName(line.slice(prefix.length), ignoredSchemas);
  if (!reference) {
    return null;
  }

  return `${type}:${reference.schema}.${reference.name}`;
};

const extractFunctionObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(/^CREATE FUNCTION (?<reference>.+)$/u);
  const reference = match?.groups?.reference?.trim();
  if (!reference) {
    return null;
  }

  const signature = reference.match(/^(?<signature>.+?\))/u)?.groups?.signature?.trim() ?? reference;
  const beforeArgs = signature.split('(', 1)[0] ?? '';
  const parsed = extractSchemaAndName(beforeArgs, ignoredSchemas);
  if (!parsed) {
    return null;
  }

  return `function:${parsed.schema}.${normalizeIdentifier(signature.slice(beforeArgs.length).length > 0 ? `${parsed.name}${signature.slice(beforeArgs.length)}` : parsed.name)}`;
};

const extractConstraintObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(
    /^ALTER TABLE ONLY (?<schema>"?[^".\s]+"?)\.(?<table>"?[^"\s]+"?) ADD CONSTRAINT (?<constraint>"?[^"\s]+"?)/u,
  );
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  const table = match?.groups?.table ? normalizeIdentifier(match.groups.table) : '';
  const constraint = match?.groups?.constraint ? normalizeIdentifier(match.groups.constraint) : '';
  if (!schema || !table || !constraint || isIgnoredSchema(schema, ignoredSchemas)) {
    return null;
  }

  return `constraint:${schema}.${table}.${constraint}`;
};

const extractPolicyObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(
    /^CREATE POLICY (?<policy>"?[^"\s]+"?) ON (?<schema>"?[^".\s]+"?)\.(?<table>"?[^"\s]+"?)/u,
  );
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  const table = match?.groups?.table ? normalizeIdentifier(match.groups.table) : '';
  const policy = match?.groups?.policy ? normalizeIdentifier(match.groups.policy) : '';
  if (!schema || !table || !policy || isIgnoredSchema(schema, ignoredSchemas)) {
    return null;
  }

  return `policy:${schema}.${table}.${policy}`;
};

const extractRlsObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(
    /^ALTER TABLE ONLY (?<schema>"?[^".\s]+"?)\.(?<table>"?[^"\s]+"?) (?<mode>ENABLE|FORCE) ROW LEVEL SECURITY;/u,
  );
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  const table = match?.groups?.table ? normalizeIdentifier(match.groups.table) : '';
  const mode = match?.groups?.mode?.toLowerCase();
  if (!schema || !table || !mode || isIgnoredSchema(schema, ignoredSchemas)) {
    return null;
  }

  return `rls:${mode}:${schema}.${table}`;
};

const extractIndexObject = (line: string): string | null => {
  const match = line.match(/^CREATE (?:UNIQUE )?INDEX (?<index>"?[^"\s]+"?) ON /u);
  const indexName = match?.groups?.index ? normalizeIdentifier(match.groups.index) : '';
  if (!indexName) {
    return null;
  }

  return `index:${indexName}`;
};

export const extractSchemaSnapshotObjects = (
  sql: string,
  ignoredSchemas: readonly string[] = DEFAULT_IGNORED_SCHEMA_NAMES,
): readonly string[] => {
  const objects = new Set<string>();

  for (const rawLine of sql.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('--')) {
      continue;
    }

    const extracted =
      extractNamedObject(line, 'CREATE TABLE ', 'table', ignoredSchemas) ??
      extractNamedObject(line, 'CREATE SEQUENCE ', 'sequence', ignoredSchemas) ??
      extractNamedObject(line, 'CREATE VIEW ', 'view', ignoredSchemas) ??
      extractNamedObject(line, 'CREATE MATERIALIZED VIEW ', 'materialized_view', ignoredSchemas) ??
      extractFunctionObject(line, ignoredSchemas) ??
      extractConstraintObject(line, ignoredSchemas) ??
      extractPolicyObject(line, ignoredSchemas) ??
      extractRlsObject(line, ignoredSchemas) ??
      extractIndexObject(line);

    if (extracted) {
      objects.add(extracted);
    }
  }

  return [...objects].sort((left, right) => left.localeCompare(right, 'de'));
};

export const diffSchemaSnapshots = (
  actualSql: string,
  expectedSql: string,
  ignoredSchemas: readonly string[] = DEFAULT_IGNORED_SCHEMA_NAMES,
): SchemaSnapshotDiff => {
  const actualObjects = new Set(extractSchemaSnapshotObjects(actualSql, ignoredSchemas));
  const expectedObjects = new Set(extractSchemaSnapshotObjects(expectedSql, ignoredSchemas));

  const missingObjects = [...expectedObjects]
    .filter((objectKey) => !actualObjects.has(objectKey))
    .sort((left, right) => left.localeCompare(right, 'de'));
  const unexpectedObjects = [...actualObjects]
    .filter((objectKey) => !expectedObjects.has(objectKey))
    .sort((left, right) => left.localeCompare(right, 'de'));

  return {
    ignoredSchemas: [...ignoredSchemas],
    missingObjects,
    unexpectedObjects,
  };
};
