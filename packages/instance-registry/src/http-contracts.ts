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

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(instanceStatuses).optional(),
});

export const createInstanceSchema = z.object({
  instanceId: z.string().trim().min(1),
  displayName: z.string().trim().min(1),
  parentDomain: z.string().trim().min(1),
  realmMode: z.enum(['new', 'existing']),
  authRealm: z.string().trim().min(1),
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
  rotateClientSecret: z.boolean().optional(),
});

export const executeKeycloakProvisioningSchema = z.object({
  intent: z.enum(['provision', 'provision_admin_client', 'reset_tenant_admin', 'rotate_client_secret']),
  tenantAdminTemporaryPassword: z.string().min(1).optional(),
});

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
