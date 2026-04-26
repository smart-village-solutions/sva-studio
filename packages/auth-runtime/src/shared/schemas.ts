import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const optionalRecord = z.record(z.string(), z.unknown()).optional();

export const authorizeRequestSchema = z.object({
  instanceId: nonEmptyString,
  action: nonEmptyString,
  resource: z.object({
    type: nonEmptyString,
    id: nonEmptyString.optional(),
    organizationId: z.string().uuid().optional(),
    attributes: optionalRecord,
  }),
  context: z
    .object({
      organizationId: z.string().uuid().optional(),
      requestId: nonEmptyString.optional(),
      traceId: nonEmptyString.optional(),
      actingAsUserId: nonEmptyString.optional(),
      attributes: optionalRecord,
    })
    .optional(),
});

export const governanceRequestSchema = z.object({
  operation: z.enum([
    'submit_permission_change',
    'approve_permission_change',
    'apply_permission_change',
    'create_delegation',
    'revoke_delegation',
    'start_impersonation',
    'end_impersonation',
    'accept_legal_text',
    'revoke_legal_acceptance',
  ]),
  instanceId: nonEmptyString,
  payload: z.record(z.string(), z.unknown()),
});

export const dataSubjectRightsRequestSchema = z
  .object({
    instanceId: nonEmptyString.optional(),
    requestType: nonEmptyString.optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    email: nonEmptyString.optional(),
    displayName: nonEmptyString.optional(),
    reason: nonEmptyString.optional(),
    targetKeycloakSubject: nonEmptyString.optional(),
    holdReason: nonEmptyString.optional(),
    holdUntil: nonEmptyString.optional(),
    releaseReason: nonEmptyString.optional(),
  })
  .passthrough();

export type GovernanceRequestInput = z.infer<typeof governanceRequestSchema>;
