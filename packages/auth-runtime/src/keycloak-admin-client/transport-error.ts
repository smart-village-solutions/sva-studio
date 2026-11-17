import { withTimeout } from './helpers.js';
import { KEYCLOAK_UNCLASSIFIED_ERROR_CODE, type KeycloakAdminFieldError } from './errors.js';

type KeycloakErrorDetails = {
  readonly message: string;
  readonly fieldErrors: readonly KeycloakAdminFieldError[];
};

type ParsedErrorEntry = KeycloakAdminFieldError & {
  readonly params: readonly string[];
};

type JsonRecord = Readonly<Record<string, unknown>>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const REDACTED_PARAM = '[REDACTED]';
const MAX_MESSAGE_ENTRIES = 10;

const readText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const isPresent = (value: unknown): boolean => value !== undefined && value !== null;

// Keycloak echoes the attribute name and numeric validator limits; strings may be user input.
const toSafeParam = (param: unknown, field: string | undefined): string => {
  if (field !== undefined && param === field) {
    return field;
  }
  return typeof param === 'number' && Number.isFinite(param) ? String(param) : REDACTED_PARAM;
};

const toSafeParams = (params: unknown, field: string | undefined): readonly string[] =>
  Array.isArray(params) ? params.map((param: unknown) => toSafeParam(param, field)) : [];

// A Keycloak ErrorRepresentation without a usable errorMessage stays visible as unclassified.
const parseEntry = (node: unknown): ParsedErrorEntry => {
  if (!isJsonRecord(node)) {
    return { code: KEYCLOAK_UNCLASSIFIED_ERROR_CODE, params: [] };
  }
  const field = readText(node.field);
  return {
    ...(field ? { field } : {}),
    code: readText(node.errorMessage) ?? KEYCLOAK_UNCLASSIFIED_ERROR_CODE,
    params: toSafeParams(node.params, field),
  };
};

const hasOwnError = (root: JsonRecord): boolean =>
  readText(root.field) !== undefined ||
  isPresent(root.errorMessage) ||
  (Array.isArray(root.params) ? root.params.length > 0 : isPresent(root.params));

const isSameEntry = (left: ParsedErrorEntry, right: ParsedErrorEntry): boolean =>
  left.field === right.field && left.code === right.code;

const parseNestedEntries = (nested: unknown): readonly ParsedErrorEntry[] => {
  if (!isPresent(nested)) {
    return [];
  }
  return Array.isArray(nested)
    ? nested.map((entry: unknown) => parseEntry(entry))
    : [parseEntry(nested)];
};

// Keycloak returns either one top-level ErrorRepresentation or a container with `errors`;
// a container may also mirror its single nested error, which must not be counted twice.
const parseEntries = (root: JsonRecord): readonly ParsedErrorEntry[] => {
  const nestedEntries = parseNestedEntries(root.errors);
  if (!hasOwnError(root)) {
    return nestedEntries;
  }
  const rootEntry = parseEntry(root);
  return nestedEntries.some((entry) => isSameEntry(entry, rootEntry))
    ? nestedEntries
    : [rootEntry, ...nestedEntries];
};

const formatEntry = ({ field, code, params }: ParsedErrorEntry): string =>
  `${field ? `${field}: ` : ''}${code}${params.length > 0 ? ` (${params.join(', ')})` : ''}`;

// Bounds the logged message; `fieldErrors` keeps every entry for the decision logic.
const formatEntries = (entries: readonly ParsedErrorEntry[]): readonly string[] => {
  const shown = entries.slice(0, MAX_MESSAGE_ENTRIES).map(formatEntry);
  const hiddenCount = entries.length - shown.length;
  return hiddenCount > 0 ? [...shown, `+${hiddenCount} more`] : shown;
};

const toDetails = (
  root: JsonRecord,
  operation: string,
  fallback: KeycloakErrorDetails
): KeycloakErrorDetails => {
  const entries = parseEntries(root);
  const summary = readText(root.error_description) ?? readText(root.error);
  const parts = [...(summary ? [summary] : []), ...formatEntries(entries)];
  if (parts.length === 0) {
    return fallback;
  }
  return {
    message: `Keycloak ${operation} failed: ${parts.join('; ')}`,
    fieldErrors: entries.map(({ field, code }) => (field ? { field, code } : { code })),
  };
};

export const buildErrorDetails = async (
  response: Response,
  operation: string,
  readTimeoutMs: number
): Promise<KeycloakErrorDetails> => {
  const fallback: KeycloakErrorDetails = {
    message: `Keycloak ${operation} failed with HTTP ${response.status}`,
    fieldErrors: [],
  };
  try {
    const text = await withTimeout(response.text(), readTimeoutMs, 'read');
    const parsed: unknown = text ? JSON.parse(text) : undefined;
    return isJsonRecord(parsed) ? toDetails(parsed, operation, fallback) : fallback;
  } catch {
    return fallback;
  }
};
