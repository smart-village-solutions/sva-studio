import type { ApiItemResponse } from '@sva/core';
import { postJson, requestJson } from './iam-http-client';

import type { CreateInstanceBusKey, InstanceBusKey, InstanceBusKeyCreated } from '@sva/core';
const busKeysPath = (instanceId: string) =>
  `/api/v1/iam/instances/${encodeURIComponent(instanceId)}/bus-api-keys`;
export const listInstanceBusKeys = (instanceId: string) =>
  requestJson<ApiItemResponse<InstanceBusKey[]>>(busKeysPath(instanceId), { cache: 'no-store' });
export const createInstanceBusKey = (instanceId: string, payload: CreateInstanceBusKey) =>
  postJson<ApiItemResponse<InstanceBusKeyCreated>, CreateInstanceBusKey>(
    busKeysPath(instanceId),
    payload
  );
export const mutateInstanceBusKey = (
  instanceId: string,
  keyId: string,
  action: 'revoke' | 'activate'
) =>
  postJson<ApiItemResponse<{ keyId: string; auditRecorded: boolean }>, Record<string, never>>(
    `${busKeysPath(instanceId)}/${encodeURIComponent(keyId)}/${action}`,
    {}
  );
