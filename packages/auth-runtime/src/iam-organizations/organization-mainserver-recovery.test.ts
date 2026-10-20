import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMainserverCredentialFingerprint } from '../mainserver-credential-readiness.js';

const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  identity: vi.fn(),
  attributes: vi.fn(),
  audit: vi.fn(),
  lock: vi.fn(),
  protect: vi.fn(),
  reveal: vi.fn(),
  reauthorize: vi.fn(),
  revision: vi.fn(),
}));
vi.mock('../iam-authorization/permission-revision-store.js', () => ({
  readPermissionRevisionVectorWithClient: mocks.revision,
}));
vi.mock('../iam-account-management/shared-runtime.js', () => ({
  withInstanceScopedDb: mocks.db,
  resolveIdentityProviderForInstance: mocks.identity,
}));
vi.mock('../iam-account-management/shared-activity.js', () => ({ emitActivityLog: mocks.audit }));
vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: mocks.protect,
  revealField: mocks.reveal,
}));
vi.mock('../iam-contents/mainserver-data-provider-binding-lock.js', () => ({
  lockMainserverDataProviderBindingScope: mocks.lock,
}));
import { restoreOrganizationMainserverCredentials } from './organization-mainserver-recovery.js';

const input = {
  instanceId: 'tenant',
  organizationId: 'org',
  actorAccountId: 'actor',
  actorSubject: 'actor-subject',
  requestId: 'request',
  reauthorize: mocks.reauthorize,
};
const row = {
  application_id: 'application',
  secret_ciphertext: null as string | null,
  technical_account_id: 'technical',
  keycloak_subject: 'technical-subject',
  last_verified_at: '2026-10-19T12:00:00Z',
  updated_at: '2026-10-19T13:00:00Z',
};
let query: ReturnType<typeof vi.fn>;
let current: typeof row | undefined;
let binding: { data_provider_id: string }[];
let attrs: Record<string, readonly string[]>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.reauthorize.mockResolvedValue({ instanceRevision: 1, userRevision: 1 });
  mocks.revision.mockResolvedValue({ instanceRevision: 1, userRevision: 1 });
  current = { ...row };
  binding = [{ data_provider_id: 'provider' }];
  attrs = {
    instanceId: ['tenant'],
    organizationId: ['org'],
    accountPurpose: ['organization_mainserver'],
    mainserverUserApplicationId: ['application'],
    mainserverUserApplicationSecret: ['test-secret'],
  };
  mocks.identity.mockResolvedValue({ provider: { getUserAttributes: mocks.attributes } });
  mocks.attributes.mockImplementation(async () => attrs);
  mocks.protect.mockReturnValue('enc:v1:encrypted');
  mocks.reveal.mockReturnValue('test-secret');
  query = vi.fn(async (sql: string) => {
    if (sql.includes('SELECT binding.data_provider_id'))
      return { rows: binding, rowCount: binding.length };
    if (sql.startsWith('UPDATE')) return { rows: [], rowCount: 1 };
    return { rows: current ? [current] : [], rowCount: current ? 1 : 0 };
  });
  mocks.db.mockImplementation(async (_instance, work) => work({ query }));
});

const writes = () => query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE'));

describe('restoreOrganizationMainserverCredentials', () => {
  it('restores only the organization-versioned verified pair and audits in the same transaction', async () => {
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('restored');
    expect(mocks.attributes).toHaveBeenCalledWith(
      'technical-subject',
      expect.arrayContaining(['accountPurpose', 'mainserverUserApplicationSecret'])
    );
    const fingerprint = createMainserverCredentialFingerprint({
      instanceId: 'tenant',
      source: 'organization',
      principalId: 'org',
      credentials: { apiKey: 'application', apiSecret: 'test-secret' },
    });
    expect(mocks.lock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ credentialFingerprint: fingerprint, dataProviderId: 'provider' })
    );
    expect(mocks.protect).toHaveBeenCalledWith(
      'test-secret',
      'iam.organization_mainserver_credentials.mainserver_application_secret:org'
    );
    expect(writes()).toHaveLength(1);
    expect(writes()[0]?.[0]).not.toContain('last_verified_at =');
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({ query }),
      expect.objectContaining({
        eventType: 'organization.mainserver_credentials_restored',
        requestId: 'request',
      })
    );
  });

  it('does not read Keycloak when eligibility or the existing association is missing', async () => {
    current = undefined;
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    expect(mocks.identity).not.toHaveBeenCalled();
    expect(writes()).toHaveLength(0);
  });

  it.each(['instanceId', 'organizationId', 'accountPurpose'])(
    'rejects mismatched or ambiguous %s markers',
    async (marker) => {
      attrs[marker] = [attrs[marker]?.[0] ?? 'missing', 'other'];
      expect(await restoreOrganizationMainserverCredentials(input)).toBe(
        'technical_account_mismatch'
      );
      expect(writes()).toHaveLength(0);
    }
  );

  it('rejects partial canonical attributes instead of using legacy values', async () => {
    delete attrs.mainserverUserApplicationSecret;
    attrs.sva_mainserver_api_key = ['legacy'];
    attrs.sva_mainserver_api_secret = ['legacy-secret'];
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'keycloak_credentials_incomplete'
    );
    expect(writes()).toHaveLength(0);
  });

  it('rejects a different remaining application ID', async () => {
    if (!current) throw new Error('Missing fixture row');
    current.application_id = 'different';
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'credential_version_mismatch'
    );
    expect(writes()).toHaveLength(0);
  });

  it('does not replace unreadable ciphertext', async () => {
    if (!current) throw new Error('Missing fixture row');
    current.application_id = '';
    current.secret_ciphertext = 'enc:v1:unreadable';
    mocks.reveal.mockReturnValue(undefined);
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'credential_decryption_failed'
    );
    expect(writes()).toHaveLength(0);
  });

  it('rejects a conflicting remaining secret', async () => {
    if (!current) throw new Error('Missing fixture row');
    current.application_id = '';
    current.secret_ciphertext = 'encrypted';
    mocks.reveal.mockReturnValue('different');
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'credential_version_mismatch'
    );
    expect(writes()).toHaveLength(0);
  });

  it.each([
    { bindings: [] },
    { bindings: [{ data_provider_id: 'one' }, { data_provider_id: 'two' }] },
  ])('requires exactly one current binding', async ({ bindings }) => {
    binding = bindings;
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('binding_not_verified');
    expect(writes()).toHaveLength(0);
  });

  it('rechecks the complete snapshot after the external read', async () => {
    mocks.attributes.mockImplementation(async () => {
      current = { ...row, updated_at: '2026-10-19T14:00:00Z' };
      return attrs;
    });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('concurrent_change');
    expect(writes()).toHaveLength(0);
  });

  it('does not claim success when the guarded write loses its row', async () => {
    const original = query.getMockImplementation();
    if (!original) throw new Error('Missing fixture query');
    query.mockImplementation(async (sql: string) =>
      sql.startsWith('UPDATE') ? { rows: [], rowCount: 0 } : original(sql)
    );
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('concurrent_change');
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('never restores plaintext when encryption is unavailable', async () => {
    mocks.protect.mockReturnValue('plaintext-fallback');
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'credential_encryption_unavailable'
    );
    expect(writes()).toHaveLength(0);
  });

  it('returns only safe codes when Keycloak fails', async () => {
    mocks.attributes.mockRejectedValue(new Error('sensitive provider detail'));
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('keycloak_unavailable');
    expect(writes()).toHaveLength(0);
  });

  it('propagates an audit failure through the transaction rollback boundary without false success', async () => {
    mocks.audit.mockRejectedValue(new Error('audit failed'));
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('database_unavailable');
  });
  it('refuses a permission revoked during the Keycloak read without writing or auditing', async () => {
    mocks.attributes.mockImplementation(async () => {
      mocks.reauthorize.mockResolvedValue(null);
      return attrs;
    });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('principal_not_allowed');
    expect(writes()).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('refuses a revision changed between reauthorization and the locked commit', async () => {
    mocks.revision.mockResolvedValue({ instanceRevision: 1, userRevision: 2 });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('principal_not_allowed');
    expect(writes()).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('does not write if the transaction cannot read the current permission revision', async () => {
    mocks.revision.mockRejectedValue(new Error('revision store unavailable'));
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('database_unavailable');
    expect(writes()).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
