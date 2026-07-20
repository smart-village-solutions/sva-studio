import { instanceStatuses } from '@sva/core';
import { z } from 'zod';

const optionalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .superRefine((value, ctx) => {
    try {
      new URL(value);
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Ungültige URL',
      });
    }
  })
  .optional();

const authRealmSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Ungültiger Realm-Name');

const tenantAdminBootstrapSchema = z
  .object({
    username: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
  })
  .optional();

const tenantAdminClientSchema = z
  .object({
    clientId: z.string().trim().min(1),
    secret: z.string().trim().min(1).optional(),
  })
  .optional();

const reservedInstanceIds = new Set(['audit']);

const instanceIdSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !reservedInstanceIds.has(value), 'Reservierte Instanz-ID');

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(instanceStatuses).optional(),
});

export const createInstanceSchema = z.object({
  instanceId: instanceIdSchema,
  displayName: z.string().trim().min(1),
  parentDomain: z.string().trim().min(1),
  realmMode: z.enum(['new', 'existing']),
  authRealm: authRealmSchema,
  authClientId: z.string().trim().min(1),
  authIssuerUrl: optionalUrlSchema,
  authClientSecret: z.string().trim().min(1).optional(),
  tenantAdminClient: tenantAdminClientSchema,
  tenantAdminBootstrap: tenantAdminBootstrapSchema,
  themeKey: z.string().trim().min(1).optional(),
  mainserverConfigRef: z.string().trim().min(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
});

export const updateInstanceSchema = createInstanceSchema.omit({
  instanceId: true,
});

export const statusMutationSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
});

export const reconcileKeycloakSchema = z.object({
  tenantAdminTemporaryPassword: z.string().min(1).optional(),
}).strict();

export const executeKeycloakProvisioningSchema = z.object({
  intent: z.enum(['provision', 'provision_admin_client', 'reset_tenant_admin', 'rotate_client_secret']),
  tenantAdminTemporaryPassword: z.string().min(1).optional(),
});

export const probeTenantIamAccessSchema = z.object({});

export const assignModuleSchema = z.object({
  moduleId: z.string().trim().min(1),
});

export const bootstrapAdminStructureSchema = z.object({
  moduleIds: z.array(z.string().trim().min(1)).optional(),
});

export const revokeModuleSchema = z.object({
  moduleId: z.string().trim().min(1),
  confirmation: z.literal('REVOKE'),
});

export const seedIamBaselineSchema = z.object({});

export const readDetailInstanceId = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const instanceIndex = segments.findIndex((segment) => segment === 'instances');
  return instanceIndex >= 0 ? segments[instanceIndex + 1] : undefined;
};

export const readKeycloakRunId = (request: Request): string | undefined => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  const runsIndex = segments.findIndex((segment) => segment === 'runs');
  return runsIndex >= 0 ? segments[runsIndex + 1] : undefined;
};
