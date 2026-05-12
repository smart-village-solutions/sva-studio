import type { WasteCustomTourDate } from '@sva/core';
import { z } from 'zod';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import { createApiError } from '../../shared/request-helpers.js';
import { wasteManagementTourSchemas } from './schemas.js';
import type { WasteManagementHandlerDeps } from './types.js';

const { wasteCustomTourDateSchema } = wasteManagementTourSchemas;

export const getRequestId = (deps: WasteManagementHandlerDeps): string | undefined => deps.getRequestId?.();

export const requireActorInstanceId = (
  ctx: AuthenticatedRequestContext,
  requestId: string | undefined
): string | Response =>
  ctx.user.instanceId?.trim()
    ? ctx.user.instanceId
    : createApiError(400, 'invalid_instance_id', 'Instanzkontext fehlt.', requestId);

export const requireDeps = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`missing_dependency:${name}`);
  }
  return value;
};

export const normalizeOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeCustomTourDates = (
  value: readonly z.infer<typeof wasteCustomTourDateSchema>[] | undefined
): readonly WasteCustomTourDate[] | undefined => {
  if (!value?.length) {
    return undefined;
  }

  return value.map((item) => ({
    date: item.date,
    description: normalizeOptionalString(item.description),
  }));
};
