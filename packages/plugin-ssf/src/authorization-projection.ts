import { createHash } from 'node:crypto';

import { canonicalize } from 'json-canonicalize';
import { z } from 'zod';

export const SSF_AUTHORIZATION_PROJECTION_VERSION = '1.0' as const;

export const SSF_TOKEN_CLAIMS = {
  instanceId: 'studio_instance_id',
  roles: 'ssf_roles',
  permissions: 'ssf_permissions',
  authorizationRevision: 'ssf_authorization_revision',
} as const;

export const SSF_TENANT_PERMISSION_IDS = [
  'ssf.configuration.tenant.manage',
  'ssf.configuration.tenant.read',
] as const;

export const SSF_TENANT_ROLE_IDS = ['tenant_admin', 'user'] as const;

const sortedUnique = <T extends string>(values: readonly T[]): T[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const subjectSchema = z.string().trim().min(1).max(255);
const instanceIdSchema = z.string().trim().min(1).max(128);
const roleSchema = z.enum(SSF_TENANT_ROLE_IDS);
const permissionSchema = z.enum(SSF_TENANT_PERMISSION_IDS);

export const ssfAuthorizationProjectionSubjectSchema = z
  .object({
    subject: subjectSchema,
    roles: z.array(roleSchema),
    permissions: z.array(permissionSchema),
  })
  .strict();

export const ssfAuthorizationProjectionSchema = z
  .object({
    contractVersion: z.literal(SSF_AUTHORIZATION_PROJECTION_VERSION),
    instanceId: instanceIdSchema,
    subjects: z.array(ssfAuthorizationProjectionSubjectSchema).max(100_000),
  })
  .strict();

export type SsfAuthorizationProjection = z.infer<typeof ssfAuthorizationProjectionSchema>;

export type SsfEffectiveAuthorizationSubject = Readonly<{
  subject: string;
  roleNames: readonly string[];
  permissionIds: readonly string[];
}>;

export const normalizeSsfAuthorizationProjection = (
  input: SsfAuthorizationProjection
): SsfAuthorizationProjection => {
  const parsed = ssfAuthorizationProjectionSchema.parse(input);
  const subjects = parsed.subjects
    .map((entry) => ({
      subject: entry.subject,
      roles: sortedUnique(entry.roles),
      permissions: sortedUnique(entry.permissions),
    }))
    .sort((left, right) => left.subject.localeCompare(right.subject));

  for (let index = 1; index < subjects.length; index += 1) {
    if (subjects[index - 1]?.subject === subjects[index]?.subject) {
      throw new Error(`ssf_authorization_projection_duplicate_subject:${subjects[index]?.subject}`);
    }
  }

  return {
    contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
    instanceId: parsed.instanceId,
    subjects,
  };
};

export const createSsfAuthorizationRevision = (
  projection: SsfAuthorizationProjection
): `sha256:${string}` => {
  const normalized = normalizeSsfAuthorizationProjection(projection);
  return `sha256:${createHash('sha256').update(canonicalize(normalized), 'utf8').digest('hex')}`;
};

export const areSsfAuthorizationProjectionsEqual = (
  left: SsfAuthorizationProjection,
  right: SsfAuthorizationProjection
): boolean => createSsfAuthorizationRevision(left) === createSsfAuthorizationRevision(right);

const SSF_PERMISSION_PREFIX = 'ssf.';
const SSF_PERMISSION_SET = new Set<string>(SSF_TENANT_PERMISSION_IDS);

export const createSsfAuthorizationProjection = (input: {
  readonly instanceId: string;
  readonly subjects: readonly SsfEffectiveAuthorizationSubject[];
}): SsfAuthorizationProjection => {
  const subjects = input.subjects.flatMap((entry) => {
    const ssfPermissions = sortedUnique(
      entry.permissionIds.filter((permissionId) => permissionId.startsWith(SSF_PERMISSION_PREFIX))
    );
    const unknownPermission = ssfPermissions.find(
      (permissionId) => !SSF_PERMISSION_SET.has(permissionId)
    );
    if (unknownPermission) {
      throw new Error(`ssf_authorization_projection_unknown_permission:${unknownPermission}`);
    }
    if (ssfPermissions.length === 0) return [];

    return [
      {
        subject: entry.subject,
        roles: [
          entry.roleNames.includes('system_admin') ? 'tenant_admin' : 'user',
        ],
        permissions: ssfPermissions,
      },
    ];
  });

  return normalizeSsfAuthorizationProjection(
    ssfAuthorizationProjectionSchema.parse({
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId: input.instanceId,
      subjects,
    })
  );
};
