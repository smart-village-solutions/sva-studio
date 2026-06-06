export const DEFAULT_IGNORED_SCHEMA_NAMES = ['graphile_worker'] as const;

export type SchemaSnapshotDiff = Readonly<{
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  unexpectedObjects: readonly string[];
}>;

export type SchemaSnapshotComparison = Readonly<{
  contentMatches: boolean;
  ignoredSchemas: readonly string[];
  missingObjects: readonly string[];
  unexpectedObjects: readonly string[];
}>;

type SchemaSnapshotSection = Readonly<{
  lines: readonly string[];
  metadata: Readonly<{
    name: string;
    schema: string;
    type: string;
  }> | null;
}>;

const SNAPSHOT_SECTION_HEADER_PATTERN =
  /^-- Name: (?<name>.+?); Type: (?<type>.+?); Schema: (?<schema>.+?); Owner: /u;

type NormalizedSchemaSnapshotSection = Readonly<{
  content: string;
  key: string;
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

const extractTriggerObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(
    /^CREATE TRIGGER (?<trigger>"?[^"\s]+"?) .+ ON (?<schema>"?[^".\s]+"?)\.(?<table>"?[^"\s]+"?) /u,
  );
  const trigger = match?.groups?.trigger ? normalizeIdentifier(match.groups.trigger) : '';
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  const table = match?.groups?.table ? normalizeIdentifier(match.groups.table) : '';
  if (!trigger || !schema || !table || isIgnoredSchema(schema, ignoredSchemas)) {
    return null;
  }

  return `trigger:${schema}.${table}.${trigger}`;
};

const extractIndexObject = (line: string, ignoredSchemas: readonly string[]): string | null => {
  const match = line.match(
    /^CREATE (?:UNIQUE )?INDEX (?<index>"?[^"\s]+"?) ON (?<schema>"?[^".\s]+"?)\.(?<table>"?[^"\s(]+"?)/u,
  );
  const indexName = match?.groups?.index ? normalizeIdentifier(match.groups.index) : '';
  const schema = match?.groups?.schema ? normalizeIdentifier(match.groups.schema) : '';
  if (!indexName || !schema || isIgnoredSchema(schema, ignoredSchemas)) {
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
      extractTriggerObject(line, ignoredSchemas) ??
      extractIndexObject(line, ignoredSchemas);

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

const splitSchemaSnapshotSections = (sql: string): readonly SchemaSnapshotSection[] => {
  const sections: SchemaSnapshotSection[] = [];
  let currentMetadata: SchemaSnapshotSection['metadata'] = null;
  let currentLines: string[] = [];

  const pushCurrentSection = (): void => {
    sections.push({
      lines: currentLines,
      metadata: currentMetadata,
    });
  };

  for (const rawLine of sql.split(/\r?\n/u)) {
    const headerMatch = rawLine.trimStart().match(SNAPSHOT_SECTION_HEADER_PATTERN);
    if (headerMatch?.groups) {
      pushCurrentSection();
      currentMetadata = {
        name: headerMatch.groups.name,
        schema: headerMatch.groups.schema,
        type: headerMatch.groups.type,
      };
      currentLines = [rawLine];
      continue;
    }

    currentLines.push(rawLine);
  }

  pushCurrentSection();

  return sections;
};

const isIgnoredSection = (
  metadata: SchemaSnapshotSection['metadata'],
  ignoredSchemas: readonly string[],
): boolean => {
  if (!metadata) {
    return false;
  }

  const normalizedSchema = normalizeIdentifier(metadata.schema);
  if (normalizedSchema && normalizedSchema !== '-' && isIgnoredSchema(normalizedSchema, ignoredSchemas)) {
    return true;
  }

  const normalizedType = normalizeIdentifier(metadata.type).toLowerCase();
  const normalizedName = normalizeIdentifier(metadata.name);
  if (normalizedType === 'schema' && isIgnoredSchema(normalizedName, ignoredSchemas)) {
    return true;
  }

  return false;
};

const normalizeSectionKey = (metadata: NonNullable<SchemaSnapshotSection['metadata']>): string => {
  const schema = normalizeIdentifier(metadata.schema);
  const type = normalizeIdentifier(metadata.type).toLowerCase();
  const name = normalizeIdentifier(metadata.name);
  return [type, schema, name].join(':');
};

const isVolatileDumpSettingLine = (line: string): boolean =>
  line === "SET default_tablespace = '';" || line === 'SET default_table_access_method = heap;';

const normalizeSchemaSnapshotSection = (
  section: SchemaSnapshotSection,
  ignoredSchemas: readonly string[],
): NormalizedSchemaSnapshotSection | null => {
  if (!section.metadata || isIgnoredSection(section.metadata, ignoredSchemas)) {
    return null;
  }

  const content = section.lines
    .map((line) => ({
      raw: line.trimEnd(),
      trimmed: line.trim(),
    }))
    .filter(({ trimmed }) => trimmed.length > 0)
    .filter(({ trimmed }) => !trimmed.startsWith('--'))
    .filter(({ trimmed }) => !trimmed.startsWith('\\restrict '))
    .filter(({ trimmed }) => !trimmed.startsWith('\\unrestrict '))
    .filter(({ trimmed }) => !isVolatileDumpSettingLine(trimmed))
    .map(({ raw }) => raw)
    .join('\n')
    .trim();

  if (!content) {
    return null;
  }

  return {
    content,
    key: normalizeSectionKey(section.metadata),
  };
};

const normalizeSchemaSnapshotSections = (
  sql: string,
  ignoredSchemas: readonly string[] = DEFAULT_IGNORED_SCHEMA_NAMES,
): readonly NormalizedSchemaSnapshotSection[] =>
  splitSchemaSnapshotSections(sql)
    .map((section) => normalizeSchemaSnapshotSection(section, ignoredSchemas))
    .filter((section): section is NormalizedSchemaSnapshotSection => section !== null)
    .sort((left, right) => left.key.localeCompare(right.key, 'de'));

export const normalizeSchemaSnapshotSql = (
  sql: string,
  ignoredSchemas: readonly string[] = DEFAULT_IGNORED_SCHEMA_NAMES,
): string =>
  normalizeSchemaSnapshotSections(sql, ignoredSchemas)
    .map(({ content }) => content)
    .join('\n')
    .trim();

export const compareSchemaSnapshots = (
  actualSql: string,
  expectedSql: string,
  ignoredSchemas: readonly string[] = DEFAULT_IGNORED_SCHEMA_NAMES,
): SchemaSnapshotComparison => {
  const diff = diffSchemaSnapshots(actualSql, expectedSql, ignoredSchemas);
  const normalizedActualSql = normalizeSchemaSnapshotSql(actualSql, ignoredSchemas);
  const normalizedExpectedSql = normalizeSchemaSnapshotSql(expectedSql, ignoredSchemas);

  return {
    contentMatches: normalizedActualSql === normalizedExpectedSql,
    ignoredSchemas: diff.ignoredSchemas,
    missingObjects: diff.missingObjects,
    unexpectedObjects: diff.unexpectedObjects,
  };
};
