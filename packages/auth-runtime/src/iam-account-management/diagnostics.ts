import type { ApiErrorCode } from '@sva/core';
import * as otelApi from '@opentelemetry/api';
export {
  classifyIamDiagnosticError,
  type IamDiagnosticErrorShape,
} from './diagnostics-classification.js';

type DiagnosticAttributes = Record<string, boolean | number | string | undefined>;

const sanitizeAttributeValue = (value: unknown): boolean | number | string | undefined => {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 256 ? value.slice(0, 256) : value;
  }

  return undefined;
};

const getActiveSpan = () => {
  try {
    return otelApi.trace?.getActiveSpan?.() ?? null;
  } catch {
    return null;
  }
};

export const annotateActiveSpan = (attributes: DiagnosticAttributes) => {
  const span = getActiveSpan();
  if (!span) {
    return;
  }

  const sanitized = Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, sanitizeAttributeValue(value)])
      .filter((entry): entry is [string, boolean | number | string] => entry[1] !== undefined)
  );

  if (Object.keys(sanitized).length > 0) {
    span.setAttributes(sanitized);
  }
};

export const addActiveSpanEvent = (name: string, attributes: DiagnosticAttributes = {}) => {
  const span = getActiveSpan();
  if (!span) {
    return;
  }

  const sanitized = Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [key, sanitizeAttributeValue(value)])
      .filter((entry): entry is [string, boolean | number | string] => entry[1] !== undefined)
  );

  span.addEvent(name, sanitized);
};

export const annotateApiErrorSpan = (input: {
  status: number;
  code: ApiErrorCode;
  details?: Readonly<Record<string, unknown>>;
}) => {
  const reasonCode =
    typeof input.details?.reason_code === 'string' ? input.details.reason_code : undefined;

  annotateActiveSpan({
    'iam.error_code': input.code,
    'iam.reason_code': reasonCode,
    'http.response.status_code': input.status,
    'dependency.name':
      typeof input.details?.dependency === 'string' ? input.details.dependency : undefined,
    'db.schema_object':
      typeof input.details?.schema_object === 'string' ? input.details.schema_object : undefined,
  });

  addActiveSpanEvent('iam.api_error', {
    'iam.error_code': input.code,
    'iam.reason_code': reasonCode,
    'http.response.status_code': input.status,
  });
};

export const createActorResolutionDetails = (input: {
  actorResolution: 'missing_actor_account' | 'missing_instance_membership';
  instanceId: string;
}) =>
  ({
    actor_resolution: input.actorResolution,
    instance_id: input.instanceId,
    reason_code: input.actorResolution,
  }) satisfies Readonly<Record<string, unknown>>;
