import {
  assignModuleSchema,
  bootstrapAdminStructureSchema,
  createInstanceSchema,
  executeKeycloakProvisioningSchema,
  listQuerySchema,
  reconcileKeycloakSchema,
  updateInstanceSchema,
} from '@sva/instance-registry/http-contracts';
import { z } from 'zod';

export const instanceId = z.string().trim().min(1).describe('Eindeutige Studio-Instanz-ID');
export const idempotencyKey = z.string().trim().min(8).max(200).optional()
  .describe('Optionaler stabiler Schlüssel für eine sichere Wiederholung');
export const mutationMeta = { idempotencyKey };
export const emptyInput = z.object({}).strict();
export const instanceInput = z.object({ instanceId }).strict();
export const instanceMutationInput = z.object({ instanceId, ...mutationMeta }).strict();

export const schemas = {
  list: listQuerySchema.strict(),
  instance: instanceInput,
  auditAll: z.object({
    instanceIds: z.array(instanceId).max(100).optional(),
    includeOnlyActive: z.boolean().optional(),
  }).strict(),
  run: z.object({ instanceId, runId: z.string().trim().min(1) }).strict(),
  diagnose: z.object({ instanceId }).strict(),
  create: createInstanceSchema.extend(mutationMeta).strict(),
  update: updateInstanceSchema.extend({ instanceId, ...mutationMeta }).strict(),
  plan: instanceMutationInput,
  execute: executeKeycloakProvisioningSchema
    .omit({ intent: true })
    .extend({
      instanceId,
      intent: z.enum(['provision', 'provision_admin_client', 'reset_tenant_admin']),
      ...mutationMeta,
    }).strict(),
  reconcile: reconcileKeycloakSchema.extend({ instanceId, ...mutationMeta }).strict(),
  assignModule: assignModuleSchema.extend({ instanceId, ...mutationMeta }).strict(),
  bootstrap: bootstrapAdminStructureSchema.extend({ instanceId, ...mutationMeta }).strict(),
  seed: instanceMutationInput,
  prepareCritical: z.object({
    instanceId,
    actionId: z.enum([
      'instance.status.activate', 'instance.status.suspend', 'instance.status.archive',
      'instance.module.revoke', 'instance.secret.rotate',
    ]),
    moduleId: z.string().trim().min(1).optional(),
  }).strict().superRefine((value, ctx) => {
    if (value.actionId === 'instance.module.revoke' && !value.moduleId) {
      ctx.addIssue({ code: 'custom', path: ['moduleId'], message: 'moduleId ist für Modulentzug erforderlich.' });
    }
  }),
  critical: z.object({
    instanceId,
    challengeId: z.string().trim().min(1),
    confirmationPhrase: z.string().min(1),
    idempotencyKey: z.string().trim().min(8).max(200),
  }).strict(),
  revoke: z.object({
    instanceId,
    moduleId: z.string().trim().min(1),
    challengeId: z.string().trim().min(1),
    confirmationPhrase: z.string().min(1),
    idempotencyKey: z.string().trim().min(8).max(200),
  }).strict(),
} as const;

export type ErrorCategory =
  | 'validation' | 'authentication' | 'authorization' | 'conflict'
  | 'platform_readiness' | 'dependency' | 'internal';

export type McpError = {
  readonly version: '1';
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly summary: string;
  readonly recommendedAction: string;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly httpStatus?: number;
};
