import { beforeEach, describe, expect, it, vi } from 'vitest';

const routingLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => routingLogger,
  getHeadersFromRequest: (request: Request) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return headers;
  },
  extractWorkspaceIdFromHeaders: (
    headers: Record<string, string>,
    headerNames: string[] = ['x-workspace-id', 'x-sva-workspace-id']
  ) => {
    for (const headerName of headerNames) {
      const value = headers[headerName];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return undefined;
  },
  extractRequestIdFromHeaders: (headers: Record<string, string>) => {
    const value = headers['x-request-id'];
    return typeof value === 'string' && value.length <= 128 ? value : undefined;
  },
  extractTraceIdFromHeaders: (headers: Record<string, string>) => {
    const traceparent = headers.traceparent;
    const match = /^00-([0-9a-f]{32})-[0-9a-f]{16}-[0-9a-f]{2}$/i.exec(traceparent ?? '');
    return match?.[1];
  },
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.requestId ? { 'X-Request-Id': options.requestId } : {}),
        },
      }
    ),
}));

import {
  authRoutePaths,
  authServerRouteFactories,
  dispatchAuthRouteRequest,
  resolveAuthHandlers,
  resolveAuthRoutePathForRequestPath,
  verifyAuthRouteHandlerCoverage,
  wrapHandlersWithJsonErrorBoundary,
} from './auth.routes.server';

type ServerRouteOptionsUnderTest = {
  path: string;
  getParentRoute: () => unknown;
  component: () => unknown;
  server: {
    handlers: {
      GET: (ctx: { request: Request }) => Promise<Response>;
    };
  };
};

const readServerRouteOptions = (route: unknown): ServerRouteOptionsUnderTest => {
  return (route as { options: unknown }).options as ServerRouteOptionsUnderTest;
};

const authServerMocks = vi.hoisted(() => {
  const response = (name: string) => new Response(JSON.stringify({ name }), { status: 200 });
  return {
    loginHandler: vi.fn(async () => response('loginHandler')),
    devLoginHandler: vi.fn(async () => response('devLoginHandler')),
    callbackHandler: vi.fn(async () => response('callbackHandler')),
    meHandler: vi.fn(async () => response('meHandler')),
    devLogoutHandler: vi.fn(async () => response('devLogoutHandler')),
    logoutHandler: vi.fn(async () => response('logoutHandler')),
    healthReadyHandler: vi.fn(async () => response('healthReadyHandler')),
    healthLiveHandler: vi.fn(async () => response('healthLiveHandler')),
    mePermissionsHandler: vi.fn(async () => response('mePermissionsHandler')),
    authorizeHandler: vi.fn(async () => response('authorizeHandler')),
    listUsersHandler: vi.fn(async () => response('listUsersHandler')),
    createUserHandler: vi.fn(async () => response('createUserHandler')),
    getUserHandler: vi.fn(async () => response('getUserHandler')),
    sendPasswordSetupEmailHandler: vi.fn(async () => response('sendPasswordSetupEmailHandler')),
    getUserTimelineHandler: vi.fn(async () => response('getUserTimelineHandler')),
    updateUserHandler: vi.fn(async () => response('updateUserHandler')),
    deactivateUserHandler: vi.fn(async () => response('deactivateUserHandler')),
    sendPasswordSetupEmailHandler: vi.fn(async () => response('sendPasswordSetupEmailHandler')),
    bulkDeactivateUsersHandler: vi.fn(async () => response('bulkDeactivateUsersHandler')),
    syncUsersFromKeycloakHandler: vi.fn(async () => response('syncUsersFromKeycloakHandler')),
    getMyProfileHandler: vi.fn(async () => response('getMyProfileHandler')),
    updateMyProfileHandler: vi.fn(async () => response('updateMyProfileHandler')),
    listGroupsHandler: vi.fn(async () => response('listGroupsHandler')),
    createGroupHandler: vi.fn(async () => response('createGroupHandler')),
    getGroupHandler: vi.fn(async () => response('getGroupHandler')),
    updateGroupHandler: vi.fn(async () => response('updateGroupHandler')),
    deleteGroupHandler: vi.fn(async () => response('deleteGroupHandler')),
    assignGroupRoleHandler: vi.fn(async () => response('assignGroupRoleHandler')),
    removeGroupRoleHandler: vi.fn(async () => response('removeGroupRoleHandler')),
    assignGroupMembershipHandler: vi.fn(async () => response('assignGroupMembershipHandler')),
    removeGroupMembershipHandler: vi.fn(async () => response('removeGroupMembershipHandler')),
    instanceRegistryHandlers: {
      listInstances: vi.fn(async () => response('listInstancesHandler')),
      getInstance: vi.fn(async () => response('getInstanceHandler')),
      createInstance: vi.fn(async () => response('createInstanceHandler')),
      updateInstance: vi.fn(async () => response('updateInstanceHandler')),
      getInstanceKeycloakStatus: vi.fn(async () => response('getInstanceKeycloakStatusHandler')),
      getInstanceKeycloakPreflight: vi.fn(async () => response('getInstanceKeycloakPreflightHandler')),
      planInstanceKeycloakProvisioning: vi.fn(async () => response('planInstanceKeycloakProvisioningHandler')),
      executeInstanceKeycloakProvisioning: vi.fn(async () => response('executeInstanceKeycloakProvisioningHandler')),
      getInstanceKeycloakProvisioningRun: vi.fn(async () => response('getInstanceKeycloakProvisioningRunHandler')),
      reconcileInstanceKeycloak: vi.fn(async () => response('reconcileInstanceKeycloakHandler')),
      probeTenantIamAccess: vi.fn(async () => response('probeTenantIamAccessHandler')),
      assignInstanceModule: vi.fn(async () => response('assignInstanceModuleHandler')),
      bootstrapInstanceAdminStructure: vi.fn(async () => response('bootstrapInstanceAdminStructureHandler')),
      revokeInstanceModule: vi.fn(async () => response('revokeInstanceModuleHandler')),
      seedInstanceIamBaseline: vi.fn(async () => response('seedInstanceIamBaselineHandler')),
      activateInstance: vi.fn(async () => response('activateInstanceHandler')),
      suspendInstance: vi.fn(async () => response('suspendInstanceHandler')),
      archiveInstance: vi.fn(async () => response('archiveInstanceHandler')),
    },
    wasteManagementHandlers: {
      getHistory: vi.fn(async () => response('getWasteManagementHistoryHandler')),
      createCity: vi.fn(async () => response('createWasteManagementCityHandler')),
      createCollectionLocation: vi.fn(async () => response('createWasteManagementCollectionLocationHandler')),
      createFraction: vi.fn(async () => response('createWasteManagementFractionHandler')),
      deleteFraction: vi.fn(async () => response('deleteWasteManagementFractionHandler')),
      createHouseNumber: vi.fn(async () => response('createWasteManagementHouseNumberHandler')),
      createGlobalDateShift: vi.fn(async () => response('createWasteManagementGlobalDateShiftHandler')),
      createLocationTourLinksBulk: vi.fn(async () => response('createWasteManagementLocationTourLinksBulkHandler')),
      createLocationTourLink: vi.fn(async () => response('createWasteManagementLocationTourLinkHandler')),
      createRegion: vi.fn(async () => response('createWasteManagementRegionHandler')),
      createStreet: vi.fn(async () => response('createWasteManagementStreetHandler')),
      createTour: vi.fn(async () => response('createWasteManagementTourHandler')),
      createTourDateShift: vi.fn(async () => response('createWasteManagementTourDateShiftHandler')),
      getMasterDataOverview: vi.fn(async () => response('getWasteManagementMasterDataOverviewHandler')),
      getSchedulingOverview: vi.fn(async () => response('getWasteManagementSchedulingOverviewHandler')),
      getToursOverview: vi.fn(async () => response('getWasteManagementToursOverviewHandler')),
      getSettings: vi.fn(async () => response('getWasteManagementSettingsHandler')),
      startInitialize: vi.fn(async () => response('startWasteManagementInitializeHandler')),
      updateSettings: vi.fn(async () => response('updateWasteManagementSettingsHandler')),
      updateCity: vi.fn(async () => response('updateWasteManagementCityHandler')),
      updateCollectionLocation: vi.fn(async () => response('updateWasteManagementCollectionLocationHandler')),
      updateFraction: vi.fn(async () => response('updateWasteManagementFractionHandler')),
      updateGlobalDateShift: vi.fn(async () => response('updateWasteManagementGlobalDateShiftHandler')),
      updateHouseNumber: vi.fn(async () => response('updateWasteManagementHouseNumberHandler')),
      updateLocationTourLink: vi.fn(async () => response('updateWasteManagementLocationTourLinkHandler')),
      updateRegion: vi.fn(async () => response('updateWasteManagementRegionHandler')),
      updateStreet: vi.fn(async () => response('updateWasteManagementStreetHandler')),
      updateTour: vi.fn(async () => response('updateWasteManagementTourHandler')),
      updateTourDateShift: vi.fn(async () => response('updateWasteManagementTourDateShiftHandler')),
      startMigrations: vi.fn(async () => response('startWasteManagementMigrationsHandler')),
      startImport: vi.fn(async () => response('startWasteManagementImportHandler')),
      startSeed: vi.fn(async () => response('startWasteManagementSeedHandler')),
      startReset: vi.fn(async () => response('startWasteManagementResetHandler')),
    },
    listContentsHandler: vi.fn(async () => response('listContentsHandler')),
    createContentHandler: vi.fn(async () => response('createContentHandler')),
    getContentHandler: vi.fn(async () => response('getContentHandler')),
    updateContentHandler: vi.fn(async () => response('updateContentHandler')),
    deleteContentHandler: vi.fn(async () => response('deleteContentHandler')),
    getContentHistoryHandler: vi.fn(async () => response('getContentHistoryHandler')),
    listMediaHandler: vi.fn(async () => response('listMediaHandler')),
    listMediaReferencesHandler: vi.fn(async () => response('listMediaReferencesHandler')),
    initializeMediaUploadHandler: vi.fn(async () => response('initializeMediaUploadHandler')),
    completeMediaUploadHandler: vi.fn(async () => response('completeMediaUploadHandler')),
    getMediaHandler: vi.fn(async () => response('getMediaHandler')),
    updateMediaHandler: vi.fn(async () => response('updateMediaHandler')),
    deleteMediaHandler: vi.fn(async () => response('deleteMediaHandler')),
    getMediaUsageHandler: vi.fn(async () => response('getMediaUsageHandler')),
    getMediaDeliveryHandler: vi.fn(async () => response('getMediaDeliveryHandler')),
    replaceMediaReferencesHandler: vi.fn(async () => response('replaceMediaReferencesHandler')),
    listOrganizationsHandler: vi.fn(async () => response('listOrganizationsHandler')),
    createOrganizationHandler: vi.fn(async () => response('createOrganizationHandler')),
    getOrganizationHandler: vi.fn(async () => response('getOrganizationHandler')),
    updateOrganizationHandler: vi.fn(async () => response('updateOrganizationHandler')),
    deactivateOrganizationHandler: vi.fn(async () => response('deactivateOrganizationHandler')),
    assignOrganizationMembershipHandler: vi.fn(async () => response('assignOrganizationMembershipHandler')),
    removeOrganizationMembershipHandler: vi.fn(async () => response('removeOrganizationMembershipHandler')),
    getMyOrganizationContextHandler: vi.fn(async () => response('getMyOrganizationContextHandler')),
    updateMyOrganizationContextHandler: vi.fn(async () => response('updateMyOrganizationContextHandler')),
    listPermissionsHandler: vi.fn(async () => response('listPermissionsHandler')),
    listRolesHandler: vi.fn(async () => response('listRolesHandler')),
    createRoleHandler: vi.fn(async () => response('createRoleHandler')),
    updateRoleHandler: vi.fn(async () => response('updateRoleHandler')),
    deleteRoleHandler: vi.fn(async () => response('deleteRoleHandler')),
    listLegalTextsHandler: vi.fn(async () => response('listLegalTextsHandler')),
    createLegalTextHandler: vi.fn(async () => response('createLegalTextHandler')),
    updateLegalTextHandler: vi.fn(async () => response('updateLegalTextHandler')),
    deleteLegalTextHandler: vi.fn(async () => response('deleteLegalTextHandler')),
    reconcileHandler: vi.fn(async () => response('reconcileHandler')),
    listGovernanceCasesHandler: vi.fn(async () => response('listGovernanceCasesHandler')),
    governanceWorkflowHandler: vi.fn(async () => response('governanceWorkflowHandler')),
    governanceComplianceExportHandler: vi.fn(async () => response('governanceComplianceExportHandler')),
    dataExportHandler: vi.fn(async () => response('dataExportHandler')),
    dataExportStatusHandler: vi.fn(async () => response('dataExportStatusHandler')),
    getMyDataSubjectRightsHandler: vi.fn(async () => response('getMyDataSubjectRightsHandler')),
    listPendingLegalTextsHandler: vi.fn(async () => response('listPendingLegalTextsHandler')),
    dataSubjectRequestHandler: vi.fn(async () => response('dataSubjectRequestHandler')),
    profileCorrectionHandler: vi.fn(async () => response('profileCorrectionHandler')),
    optionalProcessingExecuteHandler: vi.fn(async () => response('optionalProcessingExecuteHandler')),
    adminDataExportHandler: vi.fn(async () => response('adminDataExportHandler')),
    adminDataExportStatusHandler: vi.fn(async () => response('adminDataExportStatusHandler')),
    listAdminDataSubjectRightsCasesHandler: vi.fn(async () => response('listAdminDataSubjectRightsCasesHandler')),
    legalHoldApplyHandler: vi.fn(async () => response('legalHoldApplyHandler')),
    legalHoldReleaseHandler: vi.fn(async () => response('legalHoldReleaseHandler')),
    dataSubjectMaintenanceHandler: vi.fn(async () => response('dataSubjectMaintenanceHandler')),
    listPluginOperationJobsHandler: vi.fn(async () => response('listPluginOperationJobsHandler')),
    startPluginOperationJobHandler: vi.fn(async () => response('startPluginOperationJobHandler')),
    getPluginOperationJobHandler: vi.fn(async () => response('getPluginOperationJobHandler')),
    cancelPluginOperationJobHandler: vi.fn(async () => response('cancelPluginOperationJobHandler')),
  };
});

vi.mock('@sva/auth-runtime/runtime-routes', () => authServerMocks);
vi.mock('@sva/auth-runtime/runtime-health', () => ({
  healthLiveHandler: authServerMocks.healthLiveHandler,
  healthReadyHandler: authServerMocks.healthReadyHandler,
}));

describe('auth.routes.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves handlers for all declared auth paths', () => {
    for (const path of authRoutePaths) {
      expect(resolveAuthHandlers(path)).toBeDefined();
    }
  });

  it('flags invalid handler registrations in coverage verification', () => {
    expect(() =>
      verifyAuthRouteHandlerCoverage(
        ['/auth/login'],
        {
          '/auth/login': {
            GET: 'not-a-handler',
          } as unknown as ReturnType<typeof resolveAuthHandlers>,
        },
        routingLogger
      )
    ).toThrow('Invalid auth route handler registration');

    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Auth route mapping contains invalid handler registrations',
      expect.objectContaining({
        invalid_handlers: '/auth/login#GET',
      })
    );
  });

  it('maps runtime health API paths to the runtime health handlers', async () => {
    const readyHandlers = resolveAuthHandlers('/api/v1/iam/health/ready');
    const liveHandlers = resolveAuthHandlers('/api/v1/iam/health/live');

    expect(readyHandlers?.GET).toBeDefined();
    expect(liveHandlers?.GET).toBeDefined();

    const readyGet = readyHandlers?.GET;
    const liveGet = liveHandlers?.GET;

    if (!readyGet || !liveGet) {
      throw new Error('Expected GET handlers to be defined');
    }

    const readyResponse = await readyGet({
      request: new Request('http://localhost/api/v1/iam/health/ready', { method: 'GET' }),
    });
    const liveResponse = await liveGet({
      request: new Request('http://localhost/api/v1/iam/health/live', { method: 'GET' }),
    });

    expect(readyResponse.status).toBe(200);
    expect(liveResponse.status).toBe(200);
    expect(authServerMocks.healthReadyHandler).toHaveBeenCalled();
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalled();
  });

  it('dispatches media upload completion routes to the auth runtime', async () => {
    const handlers = resolveAuthHandlers('/api/v1/iam/media/upload-sessions/$uploadSessionId/complete');
    expect(handlers?.POST).toBeDefined();

    const post = handlers?.POST;
    if (!post) {
      throw new Error('Expected POST handler to be defined');
    }

    await post({
      request: new Request('http://localhost/api/v1/iam/media/upload-sessions/upload-1/complete', { method: 'POST' }),
    });

    expect(authServerMocks.completeMediaUploadHandler).toHaveBeenCalled();
  });

  it('dispatches plugin operation routes to the auth runtime', async () => {
    const createHandlers = resolveAuthHandlers('/api/v1/plugin-operations/jobs');
    const detailHandlers = resolveAuthHandlers('/api/v1/plugin-operations/jobs/$jobId');
    const cancelHandlers = resolveAuthHandlers('/api/v1/plugin-operations/jobs/$jobId/cancel');

    expect(createHandlers?.GET).toBeDefined();
    expect(createHandlers?.POST).toBeDefined();
    expect(detailHandlers?.GET).toBeDefined();
    expect(cancelHandlers?.POST).toBeDefined();

    const list = createHandlers?.GET;
    const post = createHandlers?.POST;
    const get = detailHandlers?.GET;
    const cancel = cancelHandlers?.POST;

    if (!list || !post || !get || !cancel) {
      throw new Error('Expected plugin operation handlers to be defined');
    }

    await list({
      request: new Request('http://localhost/api/v1/plugin-operations/jobs', { method: 'GET' }),
    });
    await post({
      request: new Request('http://localhost/api/v1/plugin-operations/jobs', { method: 'POST' }),
    });
    await get({
      request: new Request('http://localhost/api/v1/plugin-operations/jobs/job-1', { method: 'GET' }),
    });
    await cancel({
      request: new Request('http://localhost/api/v1/plugin-operations/jobs/job-1/cancel', { method: 'POST' }),
    });

    expect(authServerMocks.listPluginOperationJobsHandler).toHaveBeenCalled();
    expect(authServerMocks.startPluginOperationJobHandler).toHaveBeenCalled();
    expect(authServerMocks.getPluginOperationJobHandler).toHaveBeenCalled();
    expect(authServerMocks.cancelPluginOperationJobHandler).toHaveBeenCalled();
  });

  it('dispatches waste management routes to the auth runtime', async () => {
    const masterDataHandlers = resolveAuthHandlers('/api/v1/waste-management/master-data');
    const fractionHandlers = resolveAuthHandlers('/api/v1/waste-management/fractions');
    const fractionDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/fractions/$fractionId');
    const collectionLocationHandlers = resolveAuthHandlers('/api/v1/waste-management/collection-locations');
    const collectionLocationDetailHandlers = resolveAuthHandlers(
      '/api/v1/waste-management/collection-locations/$locationId'
    );
    const streetHandlers = resolveAuthHandlers('/api/v1/waste-management/streets');
    const streetDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/streets/$streetId');
    const houseNumberHandlers = resolveAuthHandlers('/api/v1/waste-management/house-numbers');
    const houseNumberDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/house-numbers/$houseNumberId');
    const locationTourLinkHandlers = resolveAuthHandlers('/api/v1/waste-management/location-tour-links');
    const locationTourLinkBulkHandlers = resolveAuthHandlers('/api/v1/waste-management/location-tour-links/bulk');
    const locationTourLinkDetailHandlers = resolveAuthHandlers(
      '/api/v1/waste-management/location-tour-links/$linkId'
    );
    const schedulingHandlers = resolveAuthHandlers('/api/v1/waste-management/scheduling');
    const globalDateShiftHandlers = resolveAuthHandlers('/api/v1/waste-management/global-date-shifts');
    const globalDateShiftDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/global-date-shifts/$shiftId');
    const tourDateShiftHandlers = resolveAuthHandlers('/api/v1/waste-management/tour-date-shifts');
    const tourDateShiftDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/tour-date-shifts/$shiftId');
    const toursHandlers = resolveAuthHandlers('/api/v1/waste-management/tours');
    const tourDetailHandlers = resolveAuthHandlers('/api/v1/waste-management/tours/$tourId');
    const settingsHandlers = resolveAuthHandlers('/api/v1/waste-management/settings');
    const initializeHandlers = resolveAuthHandlers('/api/v1/waste-management/tools/initialize');
    const migrationsHandlers = resolveAuthHandlers('/api/v1/waste-management/tools/migrations');
    const importHandlers = resolveAuthHandlers('/api/v1/waste-management/tools/imports');
    const seedHandlers = resolveAuthHandlers('/api/v1/waste-management/tools/seed');
    const resetHandlers = resolveAuthHandlers('/api/v1/waste-management/tools/reset');

    expect(masterDataHandlers?.GET).toBeDefined();
    expect(fractionHandlers?.POST).toBeDefined();
    expect(fractionDetailHandlers?.DELETE).toBeDefined();
    expect(collectionLocationHandlers?.POST).toBeDefined();
    expect(collectionLocationDetailHandlers?.PUT).toBeDefined();
    expect(streetHandlers?.POST).toBeDefined();
    expect(streetDetailHandlers?.PUT).toBeDefined();
    expect(houseNumberHandlers?.POST).toBeDefined();
    expect(houseNumberDetailHandlers?.PUT).toBeDefined();
    expect(locationTourLinkHandlers?.POST).toBeDefined();
    expect(locationTourLinkBulkHandlers?.POST).toBeDefined();
    expect(locationTourLinkDetailHandlers?.PUT).toBeDefined();
    expect(schedulingHandlers?.GET).toBeDefined();
    expect(globalDateShiftHandlers?.POST).toBeDefined();
    expect(globalDateShiftDetailHandlers?.PUT).toBeDefined();
    expect(tourDateShiftHandlers?.POST).toBeDefined();
    expect(tourDateShiftDetailHandlers?.PUT).toBeDefined();
    expect(toursHandlers?.GET).toBeDefined();
    expect(toursHandlers?.POST).toBeDefined();
    expect(tourDetailHandlers?.PUT).toBeDefined();
    expect(settingsHandlers?.GET).toBeDefined();
    expect(settingsHandlers?.PUT).toBeDefined();
    expect(migrationsHandlers?.POST).toBeDefined();
    expect(importHandlers?.POST).toBeDefined();
    expect(seedHandlers?.POST).toBeDefined();
    expect(resetHandlers?.POST).toBeDefined();

    await masterDataHandlers.GET?.({
      request: new Request('http://localhost/api/v1/waste-management/master-data', { method: 'GET' }),
    });
    await fractionHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/fractions', { method: 'POST' }),
    });
    await fractionDetailHandlers.DELETE?.({
      request: new Request('http://localhost/api/v1/waste-management/fractions/fraction-1', { method: 'DELETE' }),
    });
    await collectionLocationHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/collection-locations', { method: 'POST' }),
    });
    await collectionLocationDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/collection-locations/location-1', {
        method: 'PUT',
      }),
    });
    await streetHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/streets', { method: 'POST' }),
    });
    await streetDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/streets/street-1', { method: 'PUT' }),
    });
    await houseNumberHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/house-numbers', { method: 'POST' }),
    });
    await houseNumberDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/house-numbers/house-1', { method: 'PUT' }),
    });
    await locationTourLinkHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/location-tour-links', { method: 'POST' }),
    });
    await locationTourLinkBulkHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/location-tour-links/bulk', { method: 'POST' }),
    });
    await locationTourLinkDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/location-tour-links/link-1', {
        method: 'PUT',
      }),
    });
    await schedulingHandlers.GET?.({
      request: new Request('http://localhost/api/v1/waste-management/scheduling', { method: 'GET' }),
    });
    await globalDateShiftHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/global-date-shifts', { method: 'POST' }),
    });
    await globalDateShiftDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/global-date-shifts/shift-1', { method: 'PUT' }),
    });
    await tourDateShiftHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tour-date-shifts', { method: 'POST' }),
    });
    await tourDateShiftDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/tour-date-shifts/shift-1', { method: 'PUT' }),
    });
    await toursHandlers.GET?.({
      request: new Request('http://localhost/api/v1/waste-management/tours', { method: 'GET' }),
    });
    await toursHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tours', { method: 'POST' }),
    });
    await tourDetailHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/tours/tour-1', { method: 'PUT' }),
    });
    await settingsHandlers.GET?.({
      request: new Request('http://localhost/api/v1/waste-management/settings', { method: 'GET' }),
    });
    await settingsHandlers.PUT?.({
      request: new Request('http://localhost/api/v1/waste-management/settings', { method: 'PUT' }),
    });
    await initializeHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tools/initialize', { method: 'POST' }),
    });
    await migrationsHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tools/migrations', { method: 'POST' }),
    });
    await importHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tools/imports', { method: 'POST' }),
    });
    await seedHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tools/seed', { method: 'POST' }),
    });
    await resetHandlers.POST?.({
      request: new Request('http://localhost/api/v1/waste-management/tools/reset', { method: 'POST' }),
    });

    expect(authServerMocks.wasteManagementHandlers.getMasterDataOverview).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createFraction).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createCollectionLocation).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateCollectionLocation).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createStreet).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateStreet).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.deleteFraction).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createHouseNumber).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateHouseNumber).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createLocationTourLink).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createLocationTourLinksBulk).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateLocationTourLink).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.getSchedulingOverview).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createGlobalDateShift).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateGlobalDateShift).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createTourDateShift).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateTourDateShift).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.getToursOverview).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.createTour).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateTour).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.getSettings).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.updateSettings).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.startInitialize).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.startMigrations).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.startImport).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.startSeed).toHaveBeenCalled();
    expect(authServerMocks.wasteManagementHandlers.startReset).toHaveBeenCalled();
  });

  it('executes all mapped handlers for all routes', async () => {
    for (const path of authRoutePaths) {
      const handlers = resolveAuthHandlers(path);
      const request = new Request(`http://localhost${path}`, { method: 'GET' });

      if (handlers.GET) {
        const response = await handlers.GET({ request });
        if (path === '/iam/me/data-export' || path === '/iam/admin/data-subject-rights/export') {
          expect(response.status).toBe(405);
        } else {
          expect(response.status).toBe(200);
        }
      }

      if (handlers.POST) {
        const response = await handlers.POST({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.PATCH) {
        const response = await handlers.PATCH({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.PUT) {
        const response = await handlers.PUT({ request });
        expect(response.status).toBe(200);
      }

      if (handlers.DELETE) {
        const response = await handlers.DELETE({ request });
        expect(response.status).toBe(200);
      }
    }

    expect(authServerMocks.loginHandler).toHaveBeenCalled();
    expect(authServerMocks.devLoginHandler).toHaveBeenCalled();
    expect(authServerMocks.callbackHandler).toHaveBeenCalled();
    expect(authServerMocks.meHandler).toHaveBeenCalled();
    expect(authServerMocks.devLogoutHandler).toHaveBeenCalled();
    expect(authServerMocks.logoutHandler).toHaveBeenCalled();
    expect(authServerMocks.listUsersHandler).toHaveBeenCalled();
    expect(authServerMocks.getUserHandler).toHaveBeenCalled();
    expect(authServerMocks.updateUserHandler).toHaveBeenCalled();
    expect(authServerMocks.listGroupsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteGroupHandler).toHaveBeenCalled();
    expect(authServerMocks.listOrganizationsHandler).toHaveBeenCalled();
    expect(authServerMocks.updateMyOrganizationContextHandler).toHaveBeenCalled();
    expect(authServerMocks.listPermissionsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteRoleHandler).toHaveBeenCalled();
    expect(authServerMocks.listGroupsHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteGroupHandler).toHaveBeenCalled();
    expect(authServerMocks.listContentsHandler).toHaveBeenCalled();
    expect(authServerMocks.createContentHandler).toHaveBeenCalled();
    expect(authServerMocks.getContentHandler).toHaveBeenCalled();
    expect(authServerMocks.updateContentHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteContentHandler).toHaveBeenCalled();
    expect(authServerMocks.getContentHistoryHandler).toHaveBeenCalled();
    expect(authServerMocks.listMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.initializeMediaUploadHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.updateMediaHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaUsageHandler).toHaveBeenCalled();
    expect(authServerMocks.getMediaDeliveryHandler).toHaveBeenCalled();
    expect(authServerMocks.replaceMediaReferencesHandler).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.updateInstance).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakStatus).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakPreflight).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.planInstanceKeycloakProvisioning).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.executeInstanceKeycloakProvisioning).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.getInstanceKeycloakProvisioningRun).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.reconcileInstanceKeycloak).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.probeTenantIamAccess).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.assignInstanceModule).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.bootstrapInstanceAdminStructure).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.revokeInstanceModule).toHaveBeenCalled();
    expect(authServerMocks.instanceRegistryHandlers.seedInstanceIamBaseline).toHaveBeenCalled();
    expect(authServerMocks.listLegalTextsHandler).toHaveBeenCalled();
    expect(authServerMocks.createLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.updateLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.deleteLegalTextHandler).toHaveBeenCalled();
    expect(authServerMocks.listGovernanceCasesHandler).toHaveBeenCalled();
    expect(authServerMocks.getUserTimelineHandler).toHaveBeenCalled();
    expect(authServerMocks.getMyDataSubjectRightsHandler).toHaveBeenCalled();
    expect(authServerMocks.listPendingLegalTextsHandler).toHaveBeenCalled();
    expect(authServerMocks.listAdminDataSubjectRightsCasesHandler).toHaveBeenCalled();
    expect(authServerMocks.dataSubjectMaintenanceHandler).toHaveBeenCalled();
  });

  it('passes the incoming request to the login handler', async () => {
    const handlers = resolveAuthHandlers('/auth/login');
    const request = new Request('https://bb-guben.studio.example.org/auth/login', {
      method: 'GET',
      headers: { host: 'bb-guben.studio.example.org' },
    });

    const response = await handlers.GET?.({ request });

    expect(response?.status).toBe(200);
    expect(authServerMocks.loginHandler).toHaveBeenCalledWith(request);
  });

  it('throws for unknown auth path', () => {
    expect(() => resolveAuthHandlers('/auth/unknown')).toThrow('Unknown auth route path');
  });

  it('matches static and parameterized runtime auth paths', () => {
    expect(resolveAuthRoutePathForRequestPath('/health/live')).toBe('/health/live');
    expect(resolveAuthRoutePathForRequestPath('/api/v1/iam/users/abc-123')).toBe('/api/v1/iam/users/$userId');
    expect(resolveAuthRoutePathForRequestPath('/api/v1/iam/groups/group-1/roles/role-1')).toBe(
      '/api/v1/iam/groups/$groupId/roles/$roleId'
    );
    expect(resolveAuthRoutePathForRequestPath('/not-covered')).toBeNull();
  });

  it('dispatches runtime auth requests without going through the route tree', async () => {
    const response = await dispatchAuthRouteRequest(new Request('http://localhost/health/live'));

    expect(response?.status).toBe(200);
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalledTimes(1);
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/health/live',
        method: 'GET',
        workspace_id: 'default',
      })
    );
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler completed',
      expect.objectContaining({
        event: 'routing.handler.completed',
        route: '/health/live',
        method: 'GET',
        status_code: 200,
        workspace_id: 'default',
      })
    );
  });

  it('does not let dispatched diagnostics failures break successful auth handlers', async () => {
    routingLogger.info.mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    const response = await dispatchAuthRouteRequest(new Request('http://localhost/health/live'));

    expect(response?.status).toBe(200);
    expect(authServerMocks.healthLiveHandler).toHaveBeenCalledTimes(1);
  });

  it('does not let method-not-allowed diagnostics failures break the 405 response', async () => {
    routingLogger.warn.mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    const response = await dispatchAuthRouteRequest(new Request('http://localhost/iam/me/data-export', { method: 'GET' }));

    expect(response?.status).toBe(405);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'method_not_allowed',
    });
  });

  it('returns null for requests outside the auth runtime route set', async () => {
    const response = await dispatchAuthRouteRequest(new Request('http://localhost/not-covered'));

    expect(response).toBeNull();
  });

  it('returns method_not_allowed for unsupported runtime auth methods', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/auth/logout', {
        method: 'GET',
        headers: {
          'X-Request-Id': 'req-method',
        },
      })
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('POST');
    await expect(response?.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      requestId: 'req-method',
    });
    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Unsupported HTTP method for route handler',
      expect.objectContaining({
        event: 'routing.handler.method_not_allowed',
        reason: 'method-not-allowed',
        route: '/auth/logout',
        method: 'GET',
        allow: 'POST',
        request_id: 'req-method',
      })
    );
  });

  it('sorts allowed methods alphabetically for multi-method auth routes', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/api/v1/iam/users/test-user', {
        method: 'PUT',
      })
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get('Allow')).toBe('DELETE, GET, PATCH');
  });

  it('returns a JSON 500 response when a wrapped handler throws', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'X-Request-Id': 'req-123',
          traceparent: '00-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
        },
      }),
    });

    expect(response).toBeDefined();
    expect(response?.status).toBe(500);
    expect(response?.headers.get('Content-Type')).toContain('application/json');
    expect(response?.headers.get('X-Request-Id')).toBe('req-123');
    await expect(response?.json()).resolves.toEqual({
      error: 'internal_error',
      message: 'Ein unerwarteter Fehler ist aufgetreten.',
      requestId: 'req-123',
    });
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/auth/me',
        method: 'GET',
        request_id: 'req-123',
        trace_id: '0123456789abcdef0123456789abcdef',
      })
    );
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        method: 'GET',
        route: '/auth/me',
        workspace_id: 'default',
        request_id: 'req-123',
        trace_id: '0123456789abcdef0123456789abcdef',
        error_type: 'Error',
        error_message: 'boom',
      })
    );
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler completed',
      expect.objectContaining({
        event: 'routing.handler.completed',
        route: '/auth/me',
        method: 'GET',
        status_code: 500,
        request_id: 'req-123',
      })
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs undefined correlation ids for missing or invalid headers', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw 'boom';
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'X-Request-Id': 'x'.repeat(256),
          traceparent: '00-invalid-0123456789abcdef-01',
        },
      }),
    });

    expect(response?.status).toBe(500);
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'default',
        request_id: undefined,
        trace_id: undefined,
        error_type: 'string',
        error_message: 'boom',
      })
    );
  });

  it.each([
    '',
    '01-0123456789abcdef0123456789abcdef-0123456789abcdef-01',
    '00-0123456789abcdef0123456789abcde-0123456789abcdef-01',
    '00-zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-0123456789abcdef-01',
  ])('drops invalid traceparent edge case %j without crashing', async (traceparent) => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: traceparent ? { traceparent } : undefined,
      }),
    });

    expect(response?.status).toBe(500);
    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'default',
        trace_id: undefined,
      })
    );
  });

  it('logs workspace_id from headers when available', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-workspace-id': 'de-musterhausen',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-musterhausen',
      })
    );
  });

  it('prefers x-sva-workspace-id and x-instance-id header fallbacks for workspace logging', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-sva-workspace-id': 'de-alt-workspace',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-alt-workspace',
      })
    );

    routingLogger.error.mockClear();

    await handlers.GET?.({
      request: new Request('http://localhost/auth/me', {
        headers: {
          'x-instance-id': 'de-instance-header',
        },
      }),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-instance-header',
      })
    );
  });

  it('falls back to instanceId query parameter for workspace logging', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    await handlers.GET?.({
      request: new Request('http://localhost/iam/me/permissions?instanceId=de-musterhausen'),
    });

    expect(routingLogger.error).toHaveBeenCalledWith(
      'Unhandled exception in route handler',
      expect.objectContaining({
        event: 'routing.handler.error_caught',
        workspace_id: 'de-musterhausen',
      })
    );
  });

  it('writes a stderr fallback when structured route logging itself throws', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    routingLogger.error.mockImplementationOnce(() => {
      throw new Error('logger down');
    });
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async () => {
        throw new Error('boom');
      },
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/auth/me?instanceId=de-fallback', {
        headers: {
          'X-Request-Id': 'req-fallback',
        },
      }),
    });

    expect(response?.status).toBe(500);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"workspace_id":"de-fallback"'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('"event":"routing.logger.fallback_activated"'));
    stderrSpy.mockRestore();
  });

  it('derives the route path from the request URL when the error boundary wrapper gets no explicit route path', async () => {
    const handlers = wrapHandlersWithJsonErrorBoundary({
      GET: async ({ request }) => new Response(request.url, { status: 200 }),
    });

    const response = await handlers.GET?.({
      request: new Request('http://localhost/api/v1/iam/users/url-derived', {
        method: 'GET',
      }),
    });

    expect(response?.status).toBe(200);
    expect(routingLogger.info).toHaveBeenCalledWith(
      'Routing handler dispatched',
      expect.objectContaining({
        event: 'routing.handler.dispatched',
        route: '/api/v1/iam/users/url-derived',
      })
    );
  });

  it('builds server route factories with wrapped handlers for declared auth paths', async () => {
    const rootRoute = { id: 'root' } as never;
    const dataExportIndex = authRoutePaths.indexOf('/iam/me/data-export');
    const route = readServerRouteOptions(authServerRouteFactories[dataExportIndex]?.(rootRoute));

    expect(route.path).toBe('/iam/me/data-export');
    expect(route.getParentRoute()).toBe(rootRoute);
    expect(route.component()).toBeNull();

    const response = await route.server.handlers.GET({
      request: new Request('http://localhost/iam/me/data-export', {
        headers: {
          'X-Request-Id': 'req-route-factory',
        },
      }),
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('POST');
    await expect(response.json()).resolves.toEqual({
      error: 'method_not_allowed',
      message: 'HTTP-Methode nicht erlaubt.',
      requestId: 'req-route-factory',
    });
    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Unsupported HTTP method for route handler',
      expect.objectContaining({
        event: 'routing.handler.method_not_allowed',
        route: '/iam/me/data-export',
      })
    );
  });

  it('does not log method_not_allowed for health routes', async () => {
    const response = await dispatchAuthRouteRequest(
      new Request('http://localhost/health/live', {
        method: 'POST',
        headers: {
          'X-Request-Id': 'req-health',
        },
      })
    );

    expect(response?.status).toBe(405);
    expect(routingLogger.warn).not.toHaveBeenCalled();
  });

  it('warns when auth route mappings diverge from declared paths', () => {
    verifyAuthRouteHandlerCoverage(['/auth/login', '/auth/me'], { '/auth/login': {} }, routingLogger as never);

    expect(routingLogger.warn).toHaveBeenCalledWith(
      'Auth route mapping differs from declared auth route paths',
      expect.objectContaining({
        missing_paths: '/auth/me',
        extra_paths: '',
      })
    );
  });

  it('stays silent when auth route mappings match declared paths', () => {
    verifyAuthRouteHandlerCoverage(['/auth/login', '/auth/me'], { '/auth/login': {}, '/auth/me': {} }, routingLogger as never);

    expect(routingLogger.warn).not.toHaveBeenCalled();
  });
});
