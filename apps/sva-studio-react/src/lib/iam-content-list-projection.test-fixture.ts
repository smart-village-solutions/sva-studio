import { beforeEach, vi } from 'vitest';

import {
  createProjectionDatabaseQuery,
  fixture,
} from './iam-content-list-projection.test-database.js';

export { fixture, mapInsertedProjectionRow } from './iam-content-list-projection.test-database.js';

const state = vi.hoisted(() => ({
  authorizeContentPrimitiveForUser: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  resolveActorAccountId: vi.fn(),
  resolveEffectivePermissions: vi.fn(),
  readEffectiveSvaMainserverCredentialsWithStatus: vi.fn(),
  readMainserverScopeResolverMode: vi.fn(
    () => process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE ?? 'shadow'
  ),
  loadCurrentMainserverDataProviderBinding: vi.fn(),
  recordSuccessfulExternalContentDeletion: vi.fn(),
  recordSuccessfulExternalContentMutation: vi.fn(),
  withInstanceScopedDb: vi.fn(),
  getSvaMainserverNews: vi.fn(),
  getSvaMainserverEvent: vi.fn(),
  getSvaMainserverGenericItem: vi.fn(),
  getSvaMainserverPoi: vi.fn(),
  getSvaMainserverSurvey: vi.fn(),
  listSvaMainserverNews: vi.fn(),
  listSvaMainserverEvents: vi.fn(),
  listSvaMainserverGenericItems: vi.fn(),
  listSvaMainserverPoi: vi.fn(),
  listSvaMainserverSurveys: vi.fn(),
  listSvaMainserverProjection: vi.fn(),
  getWorkspaceContext: vi.fn(),
}));

export const getProjectionTestState = () => state;

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorizeContentPrimitiveForUser,
  loadCurrentMainserverDataProviderBinding: state.loadCurrentMainserverDataProviderBinding,
  readEffectiveSvaMainserverCredentialsWithStatus:
    state.readEffectiveSvaMainserverCredentialsWithStatus,
  readMainserverScopeResolverMode: state.readMainserverScopeResolverMode,
  resolveActorAccountId: state.resolveActorAccountId,
  resolveEffectivePermissions: state.resolveEffectivePermissions,
  recordSuccessfulExternalContentDeletion: state.recordSuccessfulExternalContentDeletion,
  recordSuccessfulExternalContentMutation: state.recordSuccessfulExternalContentMutation,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  getSvaMainserverNews: state.getSvaMainserverNews,
  getSvaMainserverEvent: state.getSvaMainserverEvent,
  getSvaMainserverGenericItem: state.getSvaMainserverGenericItem,
  getSvaMainserverPoi: state.getSvaMainserverPoi,
  getSvaMainserverSurvey: state.getSvaMainserverSurvey,
  listSvaMainserverNews: state.listSvaMainserverNews,
  listSvaMainserverEvents: state.listSvaMainserverEvents,
  listSvaMainserverGenericItems: state.listSvaMainserverGenericItems,
  listSvaMainserverPoi: state.listSvaMainserverPoi,
  listSvaMainserverSurveys: state.listSvaMainserverSurveys,
  listSvaMainserverProjection: state.listSvaMainserverProjection,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: state.loggerError,
    info: state.loggerInfo,
    warn: state.loggerWarn,
  }),
  getWorkspaceContext: state.getWorkspaceContext,
}));

import {
  listProjectedContents as listProjectedContentsBase,
  refreshProjectedContents as refreshProjectedContentsBase,
  refreshProjectedContentsForMainserverMutation as refreshProjectedContentsForMainserverMutationBase,
  resetContentProjectionRuntimeStateForTests,
} from './iam-content-list-projection.server';

export const listProjectedContentsForTest = (
  ...args: Parameters<typeof listProjectedContentsBase>
): ReturnType<typeof listProjectedContentsBase> => listProjectedContentsBase(...args);

export const refreshProjectedContentsForTest = (
  ...args: Parameters<typeof refreshProjectedContentsBase>
): ReturnType<typeof refreshProjectedContentsBase> => refreshProjectedContentsBase(...args);

type MutationProjectionRefreshInput = Parameters<
  typeof refreshProjectedContentsForMainserverMutationBase
>[0];

export const refreshProjectedContentsForMainserverMutationForTest = (
  input: Omit<
    MutationProjectionRefreshInput,
    'actingPrincipalType' | 'authorizationMode' | 'credentialFingerprint'
  > &
    Partial<
      Pick<
        MutationProjectionRefreshInput,
        'actingPrincipalType' | 'authorizationMode' | 'credentialFingerprint'
      >
    >
) =>
  refreshProjectedContentsForMainserverMutationBase({
    actingPrincipalType: 'organization',
    authorizationMode: 'credential_visible_compatibility',
    credentialFingerprint: 'a'.repeat(64),
    ...input,
  });

export const ctx = {
  sessionId: 'session-1',
  activeOrganizationId: 'org-1',
  user: {
    id: 'kc-user-1',
    instanceId: 'de-musterhausen',
    roles: [],
  },
};

export const registerProjectionFixture = (): void => {
  beforeEach(() => {
    process.env.SVA_MAINSERVER_SCOPE_RESOLVER_MODE = 'automatic';
    process.env.SVA_CONTENT_PROJECTION_ADAPTER_MODE = 'legacy';
    process.env.SVA_CONTENT_PROJECTION_HOT_COMPLETION_ENABLED = 'false';
    process.env.SVA_CONTENT_PROJECTION_PARTIAL_READS_ENABLED = 'false';
    resetContentProjectionRuntimeStateForTests();
    fixture.projectionRows = [];
    fixture.syncStates = new Map();
    fixture.projectionInsertArgs = null;
    fixture.projectionInsertSql = null;
    fixture.projectionInsertPayloadSizes = [];
    fixture.simulateConcurrentProjectionConflict = false;
    fixture.simulateLegacyProjectionSchemaMismatchOnce = false;
    fixture.simulateLegacySyncStateSchemaMismatchOnce = false;
    fixture.syncScopeKeyColumnAvailable = true;
    fixture.projectionScopeKeyColumnAvailable = true;
    state.authorizeContentPrimitiveForUser.mockReset();
    state.resolveActorAccountId.mockReset();
    state.resolveEffectivePermissions.mockReset();
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockReset();
    state.loadCurrentMainserverDataProviderBinding.mockReset();
    state.recordSuccessfulExternalContentDeletion.mockReset();
    state.recordSuccessfulExternalContentMutation.mockReset();
    state.withInstanceScopedDb.mockReset();
    state.getSvaMainserverNews.mockReset();
    state.getSvaMainserverEvent.mockReset();
    state.getSvaMainserverGenericItem.mockReset();
    state.getSvaMainserverPoi.mockReset();
    state.listSvaMainserverNews.mockReset();
    state.listSvaMainserverEvents.mockReset();
    state.listSvaMainserverGenericItems.mockReset();
    state.listSvaMainserverPoi.mockReset();
    state.listSvaMainserverSurveys.mockReset();
    state.listSvaMainserverProjection.mockReset();
    state.getWorkspaceContext.mockReset();
    state.loggerError.mockReset();
    state.loggerInfo.mockReset();
    state.loggerWarn.mockReset();
    state.getWorkspaceContext.mockReturnValue({ requestId: 'req-1' });

    state.authorizeContentPrimitiveForUser.mockImplementation(
      async ({ action }: { action: string }) =>
        action.endsWith('.read')
          ? {
              ok: true,
              actor: {
                instanceId: 'de-musterhausen',
                keycloakSubject: 'kc-user-1',
              },
              permissions: [{ action, resourceType: action.split('.')[0] ?? 'content' }],
            }
          : {
              ok: false,
              status: 403,
              error: 'forbidden',
              message: 'forbidden',
            }
    );
    state.resolveEffectivePermissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.read', resourceType: 'content' },
        { action: 'news.read', resourceType: 'news' },
        { action: 'events.read', resourceType: 'events' },
        { action: 'generic-items.read', resourceType: 'generic-items' },
        { action: 'poi.read', resourceType: 'poi' },
        { action: 'surveys.read', resourceType: 'surveys' },
      ],
    });
    state.resolveActorAccountId.mockResolvedValue('account-1');
    state.readEffectiveSvaMainserverCredentialsWithStatus.mockImplementation(
      async (input: { actingPrincipalType: 'organization' | 'user' }) => ({
        status: 'ok',
        source: input.actingPrincipalType,
        credentials: { apiKey: 'key', apiSecret: 'secret' },
        credentialFingerprint:
          input.actingPrincipalType === 'organization' ? 'b'.repeat(64) : 'a'.repeat(64),
      })
    );
    state.loadCurrentMainserverDataProviderBinding.mockResolvedValue(undefined);

    state.withInstanceScopedDb.mockImplementation(
      async (
        _instanceId: string,
        work: (client: {
          query: <TRow>(
            text: string,
            values?: readonly unknown[]
          ) => Promise<{ rows: TRow[]; rowCount: number }>;
        }) => Promise<unknown>
      ) =>
        work({
          query: createProjectionDatabaseQuery(),
        })
    );
  });
};
