/** Fixed editorial actions and the existing IAM response shapes consumed by the baseline tool. */
import { z } from 'zod';

const accessScope = z.enum(['all', 'own', 'organization']);
export const permissionSchema = z.object({
  id: z.string().min(1),
  instanceId: z.string().min(1),
  permissionKey: z.string().min(1),
  isScopeAssignable: z.boolean().optional(),
  supportedAccessScopes: z.array(accessScope).optional(),
});
export const roleSchema = z.object({
  id: z.string().min(1),
  roleKey: z.string().min(1),
  description: z.string().optional(),
  managedBy: z.enum(['studio', 'external', 'keycloak_builtin']),
  syncState: z.enum(['synced', 'pending', 'failed']),
  permissions: z.array(
    z.object({ permissionKey: z.string().min(1), accessScope: accessScope.optional() })
  ),
});
export const marker = 'studio:editor-baseline:v1';
export const coreActions = [
  'read',
  'create',
  'updateMetadata',
  'updatePayload',
  'changeStatus',
  'publish',
  'archive',
  'restore',
  'delete',
];
export const moduleActions: Readonly<Record<string, readonly string[]>> = {
  news: ['read', 'create', 'update', 'delete'],
  events: ['read', 'create', 'update', 'delete'],
  poi: ['read', 'create', 'update', 'delete'],
  media: ['read', 'create', 'update', 'reference.manage', 'delete'],
  categories: ['read', 'create', 'update', 'delete'],
};
export const scopeFor = (key: string): 'all' | 'organization' =>
  key === 'content.create' ||
  key.endsWith('.create') ||
  key.startsWith('media.') ||
  key.startsWith('categories.')
    ? 'all'
    : 'organization';

export type Role = z.infer<typeof roleSchema>;
export type Assignment = {
  permissionId: string;
  permissionKey: string;
  accessScope: 'all' | 'organization';
};
export type Outcome = {
  contextId: string;
  status: 'created' | 'existing' | 'blocked' | 'error';
  code?: string;
  roleId?: string;
  matchesStandard?: boolean;
  differences?: string[];
  unavailableModules?: string[];
  unsupportedContentActions?: string[];
};
