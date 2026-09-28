import { emitAuthAuditEvent } from './audit-events.js';
import {
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
} from '@sva/data-repositories/server';
import { withInstanceDb } from './db.js';
import { revealField } from './iam-account-management/encryption.js';
import {
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
  resolveActorInfo,
} from './iam-account-management/shared.js';
import { resolveEffectivePermissions } from './iam-authorization/permission-store.js';
import { buildLogContext } from './log-context.js';
import { withAuthenticatedUser } from './middleware.js';
import {
  readPluginOperationInput,
  storePluginOperationInput,
} from './plugin-operation-artifacts.server.js';
import {
  createJsonItemResponse,
  createPluginOperationJob,
  markPluginOperationEnqueueFailed,
} from './plugin-operations/core.shared.js';
import { withStudioJobRepository } from './plugin-operations/repository.js';
import { queuePluginOperationJob } from './plugin-operations/runner.js';
import { readConfiguredPluginTenantAccess } from './plugin-tenant-lifecycle/access.js';
import { translatePluginTenantLifecycleMessage } from './plugin-tenant-lifecycle/messages.js';
import { createApiError, toPayloadHash } from './shared/request-helpers.js';
import { validateCsrf } from './shared/request-security.js';

export const pluginServerHost = {
  emitAuthAuditEvent,
  listExternalInterfaceRecords,
  loadDefaultExternalInterfaceRecord,
  loadWasteTenantProvisioningRecord,
  requestWasteTenantProvisioning,
  failWasteTenantProvisioningRequest,
  saveExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck,
  withInstanceDb,
  revealField,
  completeIdempotency,
  hasIdempotentAuditEvent,
  releaseIdempotencyReservation,
  renewIdempotencyLease,
  reserveIdempotency,
  resolveActorInfo,
  resolveEffectivePermissions,
  buildLogContext,
  withAuthenticatedUser,
  readPluginOperationInput,
  storePluginOperationInput,
  createJsonItemResponse,
  createPluginOperationJob,
  markPluginOperationEnqueueFailed,
  withStudioJobRepository,
  queuePluginOperationJob,
  readConfiguredPluginTenantAccess,
  translatePluginTenantLifecycleMessage,
  createApiError,
  toPayloadHash,
  validateCsrf,
} as const;
