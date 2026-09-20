import { instanceStatuses, isReservedTenantHostname, isValidInstanceId } from '@sva/core';
import { z } from 'zod';
import { isValidKeycloakRealmName, KEYCLOAK_REALM_BASELINE } from './keycloak-realm-baseline.js';

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
  .refine(isValidKeycloakRealmName, 'Ungültiger Realm-Name');

const tenantAdminBootstrapSchema = z
  .object({
    username: z.string().trim().min(1),
    email: z.string().trim().email(),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
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
  .min(1)
  .refine(isValidInstanceId, 'Ungültige Instanz-ID')
  .refine(
    (value) => !reservedInstanceIds.has(value) && !isReservedTenantHostname(value),
    'Reservierte Instanz-ID'
  );

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  status: z.enum(instanceStatuses).optional(),
});
export const realmCatalogQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

const sharedInstanceWriteSchemaFields = {
  displayName: z.string().trim().min(1),
  parentDomain: z.string().trim().min(1),
  realmMode: z.enum(['new', 'existing']),
  authIssuerUrl: optionalUrlSchema,
  authClientSecret: z.string().trim().min(1).optional(),
  tenantAdminBootstrap: tenantAdminBootstrapSchema,
  themeKey: z.string().trim().min(1).optional(),
  mainserverConfigRef: z.string().trim().min(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
} as const;

export const createInstanceSchema = z
  .object({
    instanceId: instanceIdSchema,
    ...sharedInstanceWriteSchemaFields,
    authRealm: authRealmSchema.optional(),
    authClientId: z.string().trim().min(1).optional(),
    tenantAdminClient: tenantAdminClientSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.tenantAdminBootstrap) {
      ctx.addIssue({
        code: 'custom',
        path: ['tenantAdminBootstrap'],
        message: 'Vollständiges Tenant-Admin-Profil fehlt',
      });
    }
    if (value.realmMode === 'existing') {
      if (!value.authRealm) {
        ctx.addIssue({ code: 'custom', path: ['authRealm'], message: 'Auth-Realm fehlt' });
      }
      if (!value.authClientId) {
        ctx.addIssue({ code: 'custom', path: ['authClientId'], message: 'Auth-Client-ID fehlt' });
      }
      return;
    }

    if (!authRealmSchema.safeParse(value.instanceId).success) {
      ctx.addIssue({
        code: 'custom',
        path: ['instanceId'],
        message: 'Instanz-ID kann nicht als Realm-Name verwendet werden',
      });
    }

    const conflicts = [
      value.authRealm && value.authRealm !== value.instanceId ? 'authRealm' : undefined,
      value.authClientId && value.authClientId !== KEYCLOAK_REALM_BASELINE.loginClientId
        ? 'authClientId'
        : undefined,
      value.tenantAdminClient?.clientId &&
      value.tenantAdminClient.clientId !== KEYCLOAK_REALM_BASELINE.tenantAdminClientId
        ? 'tenantAdminClient'
        : undefined,
    ].filter((field): field is string => Boolean(field));
    for (const field of conflicts) {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: 'Widerspricht der serverseitigen New-Realm-Baseline',
      });
    }
  });

export const resolveCreateInstanceDefaults = (value: z.output<typeof createInstanceSchema>) =>
  value.realmMode === 'new'
    ? {
        ...value,
        authRealm: value.instanceId,
        authClientId: KEYCLOAK_REALM_BASELINE.loginClientId,
        tenantAdminClient: {
          ...value.tenantAdminClient,
          clientId: KEYCLOAK_REALM_BASELINE.tenantAdminClientId,
        },
      }
    : {
        ...value,
        authRealm: value.authRealm!,
        authClientId: value.authClientId!,
      };

export const updateInstanceSchema = z.object({
  ...sharedInstanceWriteSchemaFields,
  authRealm: authRealmSchema,
  authClientId: z.string().trim().min(1),
  tenantAdminClient: tenantAdminClientSchema,
});

export const statusMutationSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
});

export const reconcileKeycloakSchema = z
  .object({
    planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    tenantAdminTemporaryPassword: z.string().min(1).optional(),
  })
  .strict();

export const executeKeycloakProvisioningSchema = z.object({
  intent: z.enum([
    'provision',
    'provision_admin_client',
    'reset_tenant_admin',
    'rotate_client_secret',
  ]),
  planFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
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
