import { createHash } from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import { z } from 'zod';
import { SSF_RECORDING_PERMISSION_IDS } from './constants.js';

export type PermissionDirectorySubject = Readonly<{
  keycloakSubject: string;
  displayName: string;
  permissionIds: readonly string[];
  languages: readonly string[];
}>;
export type SsfPluginServerCapabilities = Readonly<{
  readPermissionDirectorySubjects: (
    input: Readonly<{
      instanceId: string;
      permissionIds: readonly string[];
    }>
  ) => Promise<readonly PermissionDirectorySubject[]>;
}>;
const sortedUnique = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));
const userSchema = z
  .object({
    sub: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,254}$/u),
    displayName: z
      .string()
      .trim()
      .min(1)
      .refine((value) => Array.from(value).length <= 200),
    permissions: z.array(z.enum(SSF_RECORDING_PERMISSION_IDS)).min(1),
    languages: z
      .array(
        z
          .string()
          .max(35)
          .regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/u)
      )
      .max(40),
  })
  .strict();
export const createSsfRecordingDirectory = (
  tenantId: string,
  subjects: readonly PermissionDirectorySubject[]
) => {
  const users = subjects
    .flatMap((subject) => {
      const permissions = sortedUnique(
        subject.permissionIds.filter((id) =>
          (SSF_RECORDING_PERMISSION_IDS as readonly string[]).includes(id)
        )
      );
      if (!permissions.length) return [];
      return [
        userSchema.parse({
          sub: subject.keycloakSubject,
          displayName: Array.from(subject.displayName.trim()).slice(0, 200).join(''),
          permissions,
          languages: sortedUnique(
            subject.languages.map((tag) => Intl.getCanonicalLocales(tag).join())
          ),
        }),
      ];
    })
    .sort((a, b) => a.sub.localeCompare(b.sub));
  if (users.length > 10_000 || new Set(users.map((user) => user.sub)).size !== users.length)
    throw new Error('ssf_recording_directory_invalid');
  const content = {
    contractVersion: '2.0' as const,
    tenantId: z.string().min(1).max(128).parse(tenantId),
    users,
  };
  return {
    ...content,
    directoryRevision: `sha256:${createHash('sha256').update(canonicalize(content), 'utf8').digest('hex')}`,
  };
};
