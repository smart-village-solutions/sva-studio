import {
  adoptMailTemplate,
  compileMailTemplate,
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  mailTemplateKeys,
  sameMailTemplateTexts,
  resolveEffectiveAccountInvitationTemplate,
  type ServerEmailVerificationTemplateView,
  type EmailVerificationTemplate,
  type MailTemplateKind,
  type MailTemplateSource,
  type MailTemplateView,
} from '@sva/core';
import type { InstanceRegistryRepository } from '@sva/data-repositories';
import { createSdkLogger, getWorkspaceContext } from '@sva/server-runtime';
import { resolveIdentityProviderForInstance } from '../iam-account-management/shared-runtime.js';
import { withRegistryRepository, withScopedRegistryRepository } from './repository.js';

const logger = createSdkLogger({ component: 'mail-template-sync' });
export class MailTemplateConflict extends Error {}
const inspect = async (
  instanceId: string,
  kind: MailTemplateKind,
  repository: InstanceRegistryRepository
) => {
  const instance = await repository.getInstanceById(instanceId);
  if (!instance) throw new Error('not_found');
  const stored = await repository.getInstanceMailTemplate(instanceId, kind);
  let template: MailTemplateSource;
  let source: MailTemplateView['source'];
  if (stored.template) {
    template = stored.template;
    source = 'instance';
  } else if (kind === 'verification') {
    const server = await withRegistryRepository((repo) =>
      repo.getServerEmailVerificationTemplate()
    );
    template = server.template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE;
    source = server.template ? 'server' : 'sva_default';
  } else {
    const server = await withRegistryRepository((repo) =>
      repo.getServerAccountInvitationTemplate()
    );
    ({ template, source } = resolveEffectiveAccountInvitationTemplate({
      serverTemplate: server.template,
    }));
  }
  const context = {
    tenantName: instance.displayName,
    tenantHomepageUrl: `https://${instance.primaryHostname}/`,
  };
  const studioTexts = compileMailTemplate(kind, template, context);
  let keycloakTexts: Readonly<Record<string, string>> | null = null;
  let provider:
    | NonNullable<Awaited<ReturnType<typeof resolveIdentityProviderForInstance>>>['provider']
    | undefined;
  try {
    const resolved = await resolveIdentityProviderForInstance(instanceId);
    if (resolved?.source === 'instance' && resolved.realm === instance.authRealm) {
      provider = resolved.provider;
      const messages = await provider.getEffectiveRealmEmailMessages?.('de');
      if (messages && mailTemplateKeys(kind).every((key) => typeof messages[key] === 'string'))
        keycloakTexts = Object.fromEntries(
          mailTemplateKeys(kind).map((key) => [key, messages[key] as string])
        );
    }
  } catch {
    /* Studio source remains available when Keycloak is unavailable. */
  }
  const equal = sameMailTemplateTexts(kind, studioTexts, keycloakTexts);
  const confirmed =
    stored.confirmedRealm === instance.authRealm &&
    sameMailTemplateTexts(kind, stored.confirmedTexts, keycloakTexts);
  const status = !keycloakTexts
    ? 'failed'
    : equal && ((stored.syncStatus === 'synced' && confirmed) || stored.syncStatus === 'unreviewed')
      ? 'synced'
      : stored.syncStatus === 'failed'
        ? 'failed'
        : !stored.confirmedTexts
          ? 'unreviewed'
          : !confirmed
            ? 'drift'
            : 'pending';
  const view: MailTemplateView = {
    stored,
    source,
    template,
    studioTexts,
    keycloakTexts,
    status,
    realm: instance.authRealm,
    ...context,
    canAdopt: !!keycloakTexts && !!adoptMailTemplate(kind, keycloakTexts, template, context),
  };
  return { view, provider };
};
export const readMailTemplate = (instanceId: string, kind: MailTemplateKind) =>
  withScopedRegistryRepository(
    instanceId,
    async (repository) => (await inspect(instanceId, kind, repository)).view
  );

export type MailTemplateMutation = {
  operation: 'save' | 'transfer' | 'adopt';
  expectedRevision: number;
  template?: MailTemplateSource | null;
  expectedStudioTexts?: Readonly<Record<string, string>>;
  expectedKeycloakTexts?: Readonly<Record<string, string>>;
};
const syncLocked = async (
  instanceId: string,
  kind: MailTemplateKind,
  repository: InstanceRegistryRepository,
  actorId?: string,
  expected?: MailTemplateMutation
): Promise<MailTemplateView> => {
  const { view, provider } = await inspect(instanceId, kind, repository);
  if (
    expected &&
    (view.stored.revision !== expected.expectedRevision ||
      !sameMailTemplateTexts(kind, view.studioTexts, expected.expectedStudioTexts ?? null) ||
      !sameMailTemplateTexts(kind, view.keycloakTexts, expected.expectedKeycloakTexts ?? null))
  )
    throw new MailTemplateConflict();
  if (expected?.operation === 'adopt') {
    if (!view.keycloakTexts) throw new Error('mail_template_adoption_unsupported');
    const candidate =
      view.keycloakTexts && adoptMailTemplate(kind, view.keycloakTexts, view.template, view);
    if (!candidate) throw new Error('mail_template_adoption_unsupported');
    const stored = await repository.saveInstanceMailTemplate({
      instanceId,
      kind,
      expectedRevision: view.stored.revision,
      template: candidate,
      actorId,
    });
    const recorded = await repository.recordMailTemplateSync({
      instanceId,
      kind,
      expectedRevision: stored.revision,
      status: 'synced',
      realm: view.realm,
      texts: view.keycloakTexts,
    });
    if (!recorded) throw new MailTemplateConflict();
    await repository.appendAuditEvent({
      instanceId,
      actorId,
      eventType: 'instance_reconfigured',
      requestId: getWorkspaceContext().requestId,
      details: { area: 'mail_template', kind, result: 'adopted' },
    });
    return {
      ...view,
      stored: {
        ...stored,
        syncStatus: 'synced',
        confirmedRealm: view.realm,
        confirmedTexts: view.keycloakTexts,
      },
      source: 'instance',
      template: candidate,
      studioTexts: view.keycloakTexts,
      status: 'synced',
    };
  }
  const record = async (
    status: MailTemplateView['status'],
    texts?: Readonly<Record<string, string>>
  ) => {
    const recorded = await repository.recordMailTemplateSync({
      instanceId,
      kind,
      expectedRevision: view.stored.revision,
      status,
      ...(texts ? { realm: view.realm, texts } : {}),
    });
    if (!recorded) throw new MailTemplateConflict();
    return {
      ...view,
      status,
      stored: {
        ...view.stored,
        syncStatus: status,
        ...(texts ? { confirmedRealm: view.realm, confirmedTexts: texts } : {}),
      },
    };
  };
  if (
    !view.keycloakTexts ||
    !provider?.updateRealmLocalizationTexts ||
    !provider.getEffectiveRealmEmailMessages
  )
    return record('failed');
  if (sameMailTemplateTexts(kind, view.studioTexts, view.keycloakTexts))
    return record('synced', view.keycloakTexts);
  const safe =
    expected?.operation === 'transfer' ||
    (view.stored.confirmedRealm === view.realm &&
      sameMailTemplateTexts(kind, view.stored.confirmedTexts, view.keycloakTexts));
  if (!safe) return record(view.stored.confirmedTexts ? 'drift' : 'unreviewed');
  await repository.appendAuditEvent({
    instanceId,
    actorId,
    eventType: 'instance_reconfigured',
    requestId: getWorkspaceContext().requestId,
    details: { area: 'mail_template', kind, result: 'requested' },
  });
  try {
    await provider.updateRealmLocalizationTexts('de', view.studioTexts);
    const confirmed = await provider.getEffectiveRealmEmailMessages('de');
    if (!sameMailTemplateTexts(kind, view.studioTexts, confirmed)) return record('failed');
    await repository.appendAuditEvent({
      instanceId,
      actorId,
      eventType: 'instance_reconfigured',
      requestId: getWorkspaceContext().requestId,
      details: { area: 'mail_template', kind, result: 'confirmed' },
    });
    return { ...(await record('synced', view.studioTexts)), keycloakTexts: view.studioTexts };
  } catch {
    logger.warn('Mail template synchronization failed', {
      instance_id: instanceId,
      kind,
      reason_code: 'readback_unconfirmed',
    });
    return record('failed');
  }
};
export const synchronizeMailTemplate = (
  instanceId: string,
  kind: MailTemplateKind,
  actorId?: string
) =>
  withScopedRegistryRepository(instanceId, (repo) => syncLocked(instanceId, kind, repo, actorId));
export const mutateMailTemplate = async (
  instanceId: string,
  kind: MailTemplateKind,
  mutation: MailTemplateMutation,
  actorId: string
) => {
  if (mutation.operation !== 'save')
    return withScopedRegistryRepository(instanceId, (repo) =>
      syncLocked(instanceId, kind, repo, actorId, mutation)
    );
  // Commit the source before network I/O; an unsuccessful transfer must never roll back an edit.
  await withScopedRegistryRepository(instanceId, async (repo) => {
    const instance = await repo.getInstanceById(instanceId);
    if (!instance) throw new Error('not_found');
    if (mutation.template)
      compileMailTemplate(kind, mutation.template, {
        tenantName: instance.displayName,
        tenantHomepageUrl: `https://${instance.primaryHostname}/`,
      });
    await repo.saveInstanceMailTemplate({
      instanceId,
      kind,
      expectedRevision: mutation.expectedRevision,
      template: mutation.template ?? null,
      actorId,
    });
  });
  try {
    return await synchronizeMailTemplate(instanceId, kind, actorId);
  } catch {
    logger.warn('Saved mail template remains pending', {
      instance_id: instanceId,
      kind,
      reason_code: 'sync_unavailable',
    });
    return readMailTemplate(instanceId, kind);
  }
};

export const readServerEmailVerificationTemplate =
  async (): Promise<ServerEmailVerificationTemplateView> => {
    const state = await withRegistryRepository((repo) => repo.getServerEmailVerificationTemplate());
    return {
      revision: state.revision,
      template: state.template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
      source: state.template ? 'server' : 'sva_default',
    };
  };
export const synchronizeInheritedMailTemplates = async (
  kind: MailTemplateKind,
  actorId: string
): Promise<readonly string[]> => {
  const instances = await withRegistryRepository((repo) => repo.listInstances({})).catch(
    () => null
  );
  if (!instances) return ['*'];
  const unsynchronized: string[] = [];
  for (const { instanceId } of instances) {
    try {
      const result = await withScopedRegistryRepository(instanceId, async (repo) => {
        // Check inheritance under the same lock as writes, including a newly created override.
        if ((await repo.getInstanceMailTemplate(instanceId, kind)).template !== null) return null;
        return syncLocked(instanceId, kind, repo, actorId);
      });
      if (result && result.status !== 'synced') unsynchronized.push(instanceId);
    } catch {
      unsynchronized.push(instanceId);
    }
  }
  return unsynchronized;
};
export const saveServerEmailVerificationTemplate = async (input: {
  expectedRevision: number;
  template: EmailVerificationTemplate | null;
  actorId: string;
}): Promise<ServerEmailVerificationTemplateView> => {
  compileMailTemplate('verification', input.template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE, {
    tenantName: '',
    tenantHomepageUrl: '',
  });
  const state = await withRegistryRepository((repo) =>
    repo.saveServerEmailVerificationTemplate(input)
  );
  const unsynchronizedInstances = await synchronizeInheritedMailTemplates(
    'verification',
    input.actorId
  );
  return {
    revision: state.revision,
    template: state.template ?? DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
    source: state.template ? 'server' : 'sva_default',
    unsynchronizedInstances,
  };
};
