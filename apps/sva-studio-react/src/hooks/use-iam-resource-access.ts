import type { UiAccessDecision, UiAccessRequirement } from '@sva/iam-core';

import { useAuth } from '../providers/auth-provider';
import { useAccessDecision } from '../providers/effective-access-provider';

export type IamUiResource = 'group' | 'legalText' | 'organization' | 'role' | 'user';

type IamUiOperation = 'create' | 'delete' | 'read' | 'update';

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

const buildRequirement = (isPlatformScope: boolean, action: string): UiAccessRequirement =>
  isPlatformScope
    ? {
        kind: 'platform',
        roles: { mode: 'anyOf', values: ['instance_registry_admin'] },
      }
    : {
        kind: 'tenant',
        actions: { mode: 'allOf', values: [action] },
      };

export type IamResourceAccess = Readonly<Record<IamUiOperation, UiAccessDecision>>;

export const useIamResourceAccess = (resource: IamUiResource): IamResourceAccess => {
  const { user } = useAuth();
  const isPlatformScope = Boolean(user && !user.instanceId);
  const actions = tenantActions[resource];

  return {
    read: useAccessDecision(buildRequirement(isPlatformScope, actions.read)),
    create: useAccessDecision(buildRequirement(isPlatformScope, actions.create)),
    update: useAccessDecision(buildRequirement(isPlatformScope, actions.update)),
    delete: useAccessDecision(buildRequirement(isPlatformScope, actions.delete)),
  };
};

export const isIamAccessAllowed = (decision: UiAccessDecision): boolean =>
  decision.status === 'allowed';
