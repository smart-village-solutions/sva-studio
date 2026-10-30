import type { InstanceRegistryRepository } from '@sva/data-repositories';
import type { InstanceMailTemplate } from '@sva/core';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  compileEmailVerificationTemplate,
  DEFAULT_EMAIL_VERIFICATION_TEMPLATE,
  DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
  compileMailTemplate,
} from '@sva/core';
const s = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  record: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  audit: vi.fn(),
  resolve: vi.fn(),
  commits: 0,
  scoped: 0,
  rejectNestedCheckout: false,
  server: vi.fn(),
  saveServer: vi.fn(),
  list: vi.fn(),
}));
vi.mock('./repository.js', () => ({
  withRegistryRepository: async (
    work: (
      repo: Pick<
        InstanceRegistryRepository,
        | 'getServerAccountInvitationTemplate'
        | 'getServerEmailVerificationTemplate'
        | 'saveServerEmailVerificationTemplate'
        | 'listInstances'
      >
    ) => Promise<unknown>
  ) => {
    if (s.rejectNestedCheckout && s.scoped > 0) throw new Error('nested_registry_checkout');
    return work({
      getServerAccountInvitationTemplate: async () => ({}),
      getServerEmailVerificationTemplate: s.server,
      saveServerEmailVerificationTemplate: s.saveServer,
      listInstances: s.list,
    });
  },
  withScopedRegistryRepository: async (_id: string, work: (repo: object) => Promise<unknown>) => {
    s.scoped++;
    try {
      const v = await work({
        getInstanceById: async () => instance,
        getServerAccountInvitationTemplate: async () => ({}),
        getServerEmailVerificationTemplate: s.server,
        getInstanceMailTemplate: s.get,
        saveInstanceMailTemplate: s.save,
        recordMailTemplateSync: s.record,
        appendAuditEvent: s.audit,
      });
      s.commits++;
      return v;
    } finally {
      s.scoped--;
    }
  },
}));
vi.mock('../iam-account-management/shared-runtime.js', () => ({
  resolveIdentityProviderForInstance: s.resolve,
}));
import {
  readMailTemplate,
  mutateMailTemplate,
  synchronizeMailTemplate,
  MailTemplateConflict,
  saveServerEmailVerificationTemplate,
  synchronizeInheritedMailTemplates,
} from './mail-template-sync';
const texts = compileEmailVerificationTemplate(DEFAULT_EMAIL_VERIFICATION_TEMPLATE);
let stored: InstanceMailTemplate;
let instance = { authRealm: 'hvl', displayName: 'Havelland', primaryHostname: 'hvl.example' };
beforeEach(() => {
  vi.resetAllMocks();
  s.commits = 0;
  s.scoped = 0;
  s.rejectNestedCheckout = false;
  s.server.mockResolvedValue({ revision: 0, template: null });
  s.list.mockResolvedValue([{ instanceId: 'hvl' }]);
  instance = { authRealm: 'hvl', displayName: 'Havelland', primaryHostname: 'hvl.example' };
  stored = {
    instanceId: 'hvl',
    kind: 'verification',
    revision: 0,
    template: null,
    syncStatus: 'unreviewed',
    confirmedRealm: null,
    confirmedTexts: null,
  };
  s.get.mockImplementation(async () => stored);
  s.save.mockImplementation(
    async (input: Parameters<InstanceRegistryRepository['saveInstanceMailTemplate']>[0]) => {
      if (input.expectedRevision !== stored.revision)
        throw new Error('mail_template_revision_conflict');
      stored = {
        ...stored,
        template: input.template,
        revision: stored.revision + 1,
        syncStatus: 'pending',
      };
      return stored;
    }
  );
  s.record.mockImplementation(
    async (input: Parameters<InstanceRegistryRepository['recordMailTemplateSync']>[0]) => {
      stored = {
        ...stored,
        syncStatus: input.status,
        ...(input.texts
          ? { confirmedTexts: input.texts, confirmedRealm: input.realm ?? null }
          : {}),
      };
      return true;
    }
  );
  s.read.mockResolvedValue(texts);
  s.write.mockImplementation(async (_locale: string, value: Readonly<Record<string, string>>) => {
    expect(s.commits).toBeGreaterThan(0);
    s.read.mockResolvedValue(value);
  });
  s.resolve.mockResolvedValue({
    source: 'instance',
    realm: 'hvl',
    provider: { getEffectiveRealmEmailMessages: s.read, updateRealmLocalizationTexts: s.write },
  });
});
it('keeps Studio source readable on provider failure', async () => {
  s.resolve.mockRejectedValue(new Error());
  const view = await readMailTemplate('hvl', 'verification');
  expect(view.template).toEqual(DEFAULT_EMAIL_VERIFICATION_TEMPLATE);
  expect(view.status).toBe('failed');
});
it('commits edits before a failed synchronization and retains the edit', async () => {
  stored = { ...stored, syncStatus: 'synced', confirmedRealm: 'hvl', confirmedTexts: texts };
  s.write.mockRejectedValue(new Error());
  const template = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Neue Bestätigung' };
  const view = await mutateMailTemplate(
    'hvl',
    'verification',
    { operation: 'save', expectedRevision: 0, template },
    'admin'
  );
  expect(stored.template).toEqual(template);
  expect(view.status).toBe('failed');
  expect(s.commits).toBe(2);
});
it('does not overwrite an existing foreign template at first reconciliation', async () => {
  s.read.mockResolvedValue({ ...texts, emailVerificationSubject: 'Extern' });
  const v = await synchronizeMailTemplate('hvl', 'verification');
  expect(v.status).toBe('unreviewed');
  expect(s.write).not.toHaveBeenCalled();
});
it('detects external changes without discarding saved source', async () => {
  stored = { ...stored, syncStatus: 'synced', confirmedRealm: 'hvl', confirmedTexts: texts };
  s.read.mockResolvedValue({ ...texts, emailVerificationSubject: 'Extern' });
  expect((await readMailTemplate('hvl', 'verification')).status).toBe('drift');
  expect(s.save).not.toHaveBeenCalled();
});
it.each(['source', 'remote', 'context'])(
  'rejects stale %s snapshots on explicit transfer',
  async (field) => {
    const v = await readMailTemplate('hvl', 'verification');
    const mutation = {
      operation: 'transfer' as const,
      expectedRevision: field === 'source' ? 9 : v.stored.revision,
      expectedStudioTexts: field === 'context' ? {} : v.studioTexts,
      expectedKeycloakTexts: field === 'remote' ? {} : (v.keycloakTexts ?? {}),
    };
    await expect(
      mutateMailTemplate('hvl', 'verification', mutation, 'admin')
    ).rejects.toBeInstanceOf(MailTemplateConflict);
    expect(s.write).not.toHaveBeenCalled();
  }
);
it('adopts representable remote changes without writing Keycloak', async () => {
  s.read.mockResolvedValue({ ...texts, emailVerificationSubject: 'Extern' });
  const v = await readMailTemplate('hvl', 'verification');
  const result = await mutateMailTemplate(
    'hvl',
    'verification',
    {
      operation: 'adopt',
      expectedRevision: 0,
      expectedStudioTexts: v.studioTexts,
      expectedKeycloakTexts: v.keycloakTexts ?? {},
    },
    'admin'
  );
  expect(result.status).toBe('synced');
  expect(stored.template).toMatchObject({ subject: 'Extern' });
  expect(s.write).not.toHaveBeenCalled();
});
it('confirms synchronization only after an identical readback', async () => {
  const v = await readMailTemplate('hvl', 'verification');
  s.read.mockResolvedValue({ ...texts, emailVerificationSubject: 'Extern' });
  const current = await readMailTemplate('hvl', 'verification');
  s.write.mockImplementation(async () => undefined);
  const result = await mutateMailTemplate(
    'hvl',
    'verification',
    {
      operation: 'transfer',
      expectedRevision: 0,
      expectedStudioTexts: v.studioTexts,
      expectedKeycloakTexts: current.keycloakTexts ?? {},
    },
    'admin'
  );
  expect(result.status).toBe('failed');
});

it('updates an inherited invitation after municipality name and homepage changes', async () => {
  const original = compileMailTemplate(
    'invitation',
    { ...DEFAULT_ACCOUNT_INVITATION_TEMPLATE, revision: 0 },
    { tenantName: 'Havelland', tenantHomepageUrl: 'https://hvl.example/' }
  );
  stored = {
    ...stored,
    kind: 'invitation',
    syncStatus: 'synced',
    confirmedRealm: 'hvl',
    confirmedTexts: original,
  };
  s.read.mockResolvedValue(original);
  instance = { ...instance, displayName: 'Neuer Name', primaryHostname: 'new.example' };
  const before = await readMailTemplate('hvl', 'invitation');
  expect(before.status).toBe('pending');
  const result = await synchronizeMailTemplate('hvl', 'invitation');
  expect(result.status).toBe('synced');
  expect(s.write.mock.calls[0][1].executeActionsBody).toContain('Neuer Name');
  expect(s.write.mock.calls[0][1].executeActionsBody).toContain('https://new.example/');
});

it('does not claim synchronization when the source changed before recording confirmation', async () => {
  s.record.mockResolvedValue(false);
  await expect(synchronizeMailTemplate('hvl', 'verification')).rejects.toBeInstanceOf(
    MailTemplateConflict
  );
});

it('inherits a configurable confirmation standard until an instance override is set', async () => {
  const general = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Allgemeine Vorlage' };
  s.server.mockResolvedValue({ revision: 4, template: general });
  let view = await readMailTemplate('hvl', 'verification');
  expect(view.template).toEqual(general);
  expect(view.source).toBe('server');
  stored = { ...stored, template: { ...general, subject: 'Eigene Vorlage' } };
  view = await readMailTemplate('hvl', 'verification');
  expect(view.template.subject).toBe('Eigene Vorlage');
  expect(view.source).toBe('instance');
  const reset = await mutateMailTemplate(
    'hvl',
    'verification',
    { operation: 'save', expectedRevision: 0, template: null },
    'admin'
  );
  expect(reset.template).toEqual(general);
  expect(reset.source).toBe('server');
  expect(stored.template).toBeNull();
});
it('commits a changed standard and synchronizes only inheriting instances', async () => {
  const general = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Neuer Standard' };
  stored = { ...stored, syncStatus: 'synced', confirmedRealm: 'hvl', confirmedTexts: texts };
  s.list.mockResolvedValue([{ instanceId: 'hvl' }, { instanceId: 'own' }]);
  s.get.mockImplementation(async (id: string) =>
    id === 'own' ? { ...stored, template: { ...general, subject: 'Eigene Vorlage' } } : stored
  );
  s.saveServer.mockImplementation(async () => {
    s.server.mockResolvedValue({ revision: 1, template: general });
    s.commits++;
    return { revision: 1, template: general };
  });
  const result = await saveServerEmailVerificationTemplate({
    expectedRevision: 0,
    template: general,
    actorId: 'admin',
  });
  expect(result.unsynchronizedInstances).toEqual([]);
  expect(s.write).toHaveBeenCalledExactlyOnceWith('de', compileEmailVerificationTemplate(general));
  expect(s.resolve).toHaveBeenCalledExactlyOnceWith('hvl');
});
it('checks a concurrent override before reading or writing Keycloak in a standard sync', async () => {
  stored = { ...stored, template: DEFAULT_EMAIL_VERIFICATION_TEMPLATE };
  expect(await synchronizeInheritedMailTemplates('verification', 'admin')).toEqual([]);
  expect(s.resolve).not.toHaveBeenCalled();
  expect(s.write).not.toHaveBeenCalled();
});
it('retains a saved general template when an inherited realm cannot be synchronized', async () => {
  const general = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Gespeicherter Standard' };
  s.saveServer.mockImplementation(async () => {
    s.server.mockResolvedValue({ revision: 1, template: general });
    return { revision: 1, template: general };
  });
  s.resolve.mockRejectedValue(new Error('offline'));
  const result = await saveServerEmailVerificationTemplate({
    expectedRevision: 0,
    template: general,
    actorId: 'admin',
  });
  expect(result.template).toEqual(general);
  expect(result.unsynchronizedInstances).toEqual(['hvl']);
  expect((await readMailTemplate('hvl', 'verification')).template).toEqual(general);
});

it('removes a synchronized instance override and transfers the current general template', async () => {
  const own = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Eigene Vorlage' };
  const general = { ...DEFAULT_EMAIL_VERIFICATION_TEMPLATE, subject: 'Aktueller Standard' };
  const ownTexts = compileEmailVerificationTemplate(own);
  stored = {
    ...stored,
    revision: 2,
    template: own,
    syncStatus: 'synced',
    confirmedRealm: 'hvl',
    confirmedTexts: ownTexts,
  };
  s.read.mockResolvedValue(ownTexts);
  s.server.mockResolvedValue({ revision: 5, template: general });
  const result = await mutateMailTemplate(
    'hvl',
    'verification',
    { operation: 'save', expectedRevision: 2, template: null },
    'admin'
  );
  expect(result.status).toBe('synced');
  expect(result.source).toBe('server');
  expect(stored.template).toBeNull();
  expect(s.write).toHaveBeenCalledExactlyOnceWith('de', compileEmailVerificationTemplate(general));
});

it.each(['invitation', 'verification'] as const)(
  'reads inherited %s templates without a nested registry pool checkout',
  async (kind) => {
    s.rejectNestedCheckout = true;
    stored.kind = kind;
    s.read.mockResolvedValue(
      compileMailTemplate(
        kind,
        kind === 'verification'
          ? DEFAULT_EMAIL_VERIFICATION_TEMPLATE
          : DEFAULT_ACCOUNT_INVITATION_TEMPLATE,
        {
          tenantName: instance.displayName,
          tenantHomepageUrl: `https://${instance.primaryHostname}/`,
        }
      )
    );
    const views = await Promise.all(Array.from({ length: 5 }, () => readMailTemplate('hvl', kind)));
    expect(views).toHaveLength(5);
    for (const view of views)
      expect(view).toMatchObject({ source: 'sva_default', status: 'synced' });
    expect(s.scoped).toBe(0);
  }
);
