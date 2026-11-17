import { readNumber, readObject, readString } from '../shared/input-readers.js';
import { withTimeout } from './helpers.js';
import {
  KEYCLOAK_UNCLASSIFIED_ERROR_CODE,
  type KeycloakAdminFieldError,
  type KeycloakAdminRequestError,
} from './errors.js';

type KeycloakErrorDetails = Pick<KeycloakAdminRequestError, 'message' | 'fieldErrors'>;

type JsonRecord = Readonly<Record<string, unknown>>;

// Params only feed the diagnostic message; they are stripped from `fieldErrors`.
type ParsedErrorEntry = KeycloakAdminFieldError & {
  readonly params: readonly string[];
};

const REDACTED_PARAM = '[REDACTED]';
const MAX_MESSAGE_ENTRIES = 10;
const MAX_MESSAGE_DETAIL_LENGTH = 1_000;
// Standard user-profile attribute names are schema identifiers, never user input.
const PROFILE_ATTRIBUTE_PARAMS: ReadonlySet<string> = new Set([
  'username',
  'email',
  'firstName',
  'lastName',
]);
// Keycloak message references such as `${firstName}` name a display-name key.
const MESSAGE_REFERENCE_PARAM = /^\$\{[\w.-]{1,64}\}$/;

const isPresent = (value: unknown): boolean => value !== undefined && value !== null;

const isSafeTextParam = (param: string, field: string | undefined): boolean =>
  param === field || PROFILE_ATTRIBUTE_PARAMS.has(param) || MESSAGE_REFERENCE_PARAM.test(param);

// Any other string may carry user input and is redacted.
const toSafeParam = (param: unknown, field: string | undefined): string => {
  const numeric = readNumber(param);
  if (numeric !== undefined) {
    return String(numeric);
  }
  return typeof param === 'string' && isSafeTextParam(param, field) ? param : REDACTED_PARAM;
};

const toEntry = (node: JsonRecord): ParsedErrorEntry => {
  const field = readString(node.field);
  const params: readonly unknown[] = Array.isArray(node.params) ? node.params : [];
  return {
    ...(field ? { field } : {}),
    // A Keycloak ErrorRepresentation without a usable errorMessage stays visible as unclassified.
    code: readString(node.errorMessage) ?? KEYCLOAK_UNCLASSIFIED_ERROR_CODE,
    params: params.map((param) => toSafeParam(param, field)),
  };
};

const UNCLASSIFIED_ENTRY: ParsedErrorEntry = { code: KEYCLOAK_UNCLASSIFIED_ERROR_CODE, params: [] };

const hasOwnError = (node: JsonRecord): boolean =>
  readString(node.field) !== undefined ||
  isPresent(node.errorMessage) ||
  (Array.isArray(node.params) ? node.params.length > 0 : isPresent(node.params));

const isSameEntry = (left: ParsedErrorEntry, right: ParsedErrorEntry): boolean =>
  left.field === right.field && left.code === right.code;

/**
 * Flattens one Keycloak ErrorRepresentation, which may carry its own error, nested `errors`, or
 * both. A nested node without any content is unclassified; an empty root is not an error.
 */
const parseNode = (value: unknown, isRoot: boolean): readonly ParsedErrorEntry[] => {
  const node = readObject(value);
  if (!node) {
    return isRoot ? [] : [UNCLASSIFIED_ENTRY];
  }
  const rawNested: unknown = node.errors;
  const nestedNodes: readonly unknown[] = Array.isArray(rawNested) ? rawNested : [rawNested];
  const nested = isPresent(rawNested)
    ? nestedNodes.flatMap((entry) => parseNode(entry, false))
    : [];
  if (!hasOwnError(node)) {
    return isRoot || nested.length > 0 ? nested : [toEntry(node)];
  }
  const own = toEntry(node);
  // Keycloak mirrors a single nested error on its container; count it once.
  return nested.length === 1 && nested.every((entry) => isSameEntry(entry, own))
    ? nested
    : [own, ...nested];
};

// OAuth-style `error`/`error_description` is a request-level error the decision logic must see.
const parseRequestError = (root: JsonRecord): readonly ParsedErrorEntry[] =>
  isPresent(root.error) || isPresent(root.error_description)
    ? [{ code: readString(root.error) ?? KEYCLOAK_UNCLASSIFIED_ERROR_CODE, params: [] }]
    : [];

const formatEntry = ({ field, code, params }: ParsedErrorEntry): string =>
  `${field ? `${field}: ` : ''}${code}${params.length > 0 ? ` (${params.join(', ')})` : ''}`;

// Bounds the logged message; `fieldErrors` keeps every entry for the decision logic.
const formatDetail = (
  summary: string | undefined,
  entries: readonly ParsedErrorEntry[]
): string => {
  const shown = entries.slice(0, MAX_MESSAGE_ENTRIES).map(formatEntry);
  const hiddenCount = entries.length - shown.length;
  const detail = [
    ...(summary ? [summary] : []),
    ...shown,
    ...(hiddenCount > 0 ? [`+${hiddenCount} more`] : []),
  ].join('; ');
  return detail.length > MAX_MESSAGE_DETAIL_LENGTH
    ? `${detail.slice(0, MAX_MESSAGE_DETAIL_LENGTH - 1)}…`
    : detail;
};

const toDetails = (
  root: JsonRecord,
  operation: string,
  fallback: KeycloakErrorDetails
): KeycloakErrorDetails => {
  const entries = [...parseRequestError(root), ...parseNode(root, true)];
  if (entries.length === 0) {
    return fallback;
  }
  return {
    message: `Keycloak ${operation} failed: ${formatDetail(readString(root.error_description), entries)}`,
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
    const parsed = readObject(text ? JSON.parse(text) : undefined);
    return parsed ? toDetails(parsed, operation, fallback) : fallback;
  } catch {
    // Includes a RangeError from pathologically deep `errors` nesting: no field errors, fail closed.
    return fallback;
  }
};
