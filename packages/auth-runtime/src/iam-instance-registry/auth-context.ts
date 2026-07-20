import type { AuthenticatedRequestContext } from '../middleware.js';

export const REGISTRY_ACTIONS = {
  list: 'instance.list', read: 'instance.read', auditRead: 'instance.audit.read', diagnose: 'instance.diagnose',
  provisionRunRead: 'instance.provision.run.read', create: 'instance.create', update: 'instance.update',
  provisionPlan: 'instance.provision.plan', provisionExecute: 'instance.provision.execute', reconcile: 'instance.reconcile',
  moduleAssign: 'instance.module.assign', moduleRevoke: 'instance.module.revoke', iamBaselineSeed: 'instance.iam.baseline.seed',
  adminBootstrap: 'instance.admin.bootstrap', statusActivate: 'instance.status.activate', statusSuspend: 'instance.status.suspend',
  statusArchive: 'instance.status.archive', secretRotate: 'instance.secret.rotate', confirmationPrepare: 'instance.confirmation.prepare',
} as const;

export type RegistryActionId = (typeof REGISTRY_ACTIONS)[keyof typeof REGISTRY_ACTIONS];

export type RegistrySessionContext = AuthenticatedRequestContext & {
  readonly authKind: 'session';
};

export type RegistryServiceContext = {
  readonly authKind: 'keycloak_service';
  readonly actionId: RegistryActionId;
  readonly freshReauthAt?: undefined;
  readonly isLocalDevelopmentAuth?: undefined;
  readonly user: {
    readonly id: string;
    readonly roles: string[];
  };
};

export type RegistryRequestContext = RegistrySessionContext | RegistryServiceContext;

export const isRegistryServiceContext = (
  context: RegistryRequestContext
): context is RegistryServiceContext => context.authKind === 'keycloak_service';
