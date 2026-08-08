import type { UiAccessDecision, UiAccessRequirement } from '@sva/iam-core';

import { useAuth } from '../providers/auth-provider';
import { useAccessDecision } from '../providers/effective-access-provider';

export type IamUiResource = 'group' | 'legalText' | 'organization' | 'role' | 'user';

type IamUiOperation = 'create' | 'delete' | 'read' | 'update';

const platformOperations: Readonly<Record<IamUiResource, readonly IamUiOperation[]>> = {
  group: [],
  legalText: [],
  organization: [],
  role: ['read', 'update'],
  user: ['read', 'update'],
};

const tenantActions: Readonly<Record<IamUiResource, Readonly<Record<IamUiOperation, string>>>> = {
  group: {
    read: 'iam.role.read',
    create: 'iam.role.write',
    update: 'iam.role.write',
    delete: 'iam.role.write',
  },
  legalText: {
    read: 'iam.legalText.read',
    create: 'iam.legalText.write',
    update: 'iam.legalText.write',
    delete: 'iam.legalText.write',
  },
  organization: {
    read: 'iam.org.read',
    create: 'iam.org.write',
    update: 'iam.org.write',
    delete: 'iam.org.write',
  },
  role: {
    read: 'iam.role.read',
    create: 'iam.role.write',
    update: 'iam.role.write',
    delete: 'iam.role.write',
  },
  user: {
    read: 'iam.user.read',
    create: 'iam.user.write',
    update: 'iam.user.write',
    delete: 'iam.accounts.delete',
  },
};

export const buildIamResourceRequirement = (
  resource: IamUiResource,
  operation: IamUiOperation,
  isPlatformScope: boolean
): UiAccessRequirement => {
  const action = tenantActions[resource][operation];

  return isPlatformScope && platformOperations[resource].includes(operation)
    ? {
        kind: 'platform',
        roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
      }
    : {
        kind: 'tenant',
        actions: { mode: 'allOf', values: [action] },
      };
};

export type IamResourceAccess = Readonly<Record<IamUiOperation, UiAccessDecision>>;

export const useIamResourceAccess = (resource: IamUiResource): IamResourceAccess => {
  const { user } = useAuth();
  const isPlatformScope = Boolean(user && !user.instanceId);

  return {
    read: useAccessDecision(buildIamResourceRequirement(resource, 'read', isPlatformScope)),
    create: useAccessDecision(buildIamResourceRequirement(resource, 'create', isPlatformScope)),
    update: useAccessDecision(buildIamResourceRequirement(resource, 'update', isPlatformScope)),
    delete: useAccessDecision(buildIamResourceRequirement(resource, 'delete', isPlatformScope)),
  };
};

export const isIamAccessAllowed = (decision: UiAccessDecision): boolean =>
  decision.status === 'allowed';
