import * as authRuntimeRoutes from '@sva/auth-runtime/runtime-routes';

import type { AuthHandlers, AuthRoutePath } from './auth.route-handlers.types.js';
import { createMethodNotAllowedHandler } from './auth.route-runtime.server.js';

const routeHandler =
  (handler: (request: Request) => Promise<Response> | Response) =>
  async ({ request }: { request: Request }): Promise<Response> =>
    handler(request);

export const governanceAuthHandlerMap = {
  '/iam/governance/workflows': {
    GET: routeHandler(authRuntimeRoutes.listGovernanceCasesHandler),
    POST: routeHandler(authRuntimeRoutes.governanceWorkflowHandler),
  },
  '/iam/governance/workflows/$caseId': {
    GET: routeHandler(authRuntimeRoutes.getGovernanceCaseHandler),
  },
  '/iam/governance/compliance/export': {
    GET: routeHandler(authRuntimeRoutes.governanceComplianceExportHandler),
  },
  '/iam/governance/legal-consents/export': {
    GET: routeHandler(authRuntimeRoutes.legalConsentExportHandler),
  },
  '/iam/admin/deletion-rules': {
    GET: routeHandler(authRuntimeRoutes.deletionRulesAdminHandler),
    POST: routeHandler(authRuntimeRoutes.deletionRulesAdminHandler),
  },
  '/iam/me/deletion-rules': {
    GET: routeHandler(authRuntimeRoutes.myDeletionRulesOverviewHandler),
  },
  '/iam/me/deletion-rules/content-preference': {
    POST: routeHandler(authRuntimeRoutes.myDeletionRulesPreferenceHandler),
  },
  '/iam/me/permission-change-requests': {
    POST: routeHandler(authRuntimeRoutes.permissionChangeSelfServiceRequestHandler),
  },
  '/iam/me/data-export': {
    GET: createMethodNotAllowedHandler('/iam/me/data-export', 'POST'),
    POST: routeHandler(authRuntimeRoutes.dataExportHandler),
  },
  '/iam/me/data-export/status': {
    GET: routeHandler(authRuntimeRoutes.dataExportStatusHandler),
  },
  '/iam/me/data-subject-rights/requests': {
    GET: routeHandler(authRuntimeRoutes.getMyDataSubjectRightsHandler),
    POST: routeHandler(authRuntimeRoutes.dataSubjectRequestHandler),
  },
  '/iam/me/data-subject-rights/cases/$caseId': {
    GET: routeHandler(authRuntimeRoutes.getMyDataSubjectRightsCaseHandler),
  },
  '/iam/me/legal-texts/pending': {
    GET: routeHandler(authRuntimeRoutes.listPendingLegalTextsHandler),
  },
  '/iam/me/profile': {
    POST: routeHandler(authRuntimeRoutes.profileCorrectionHandler),
  },
  '/iam/me/optional-processing/execute': {
    POST: routeHandler(authRuntimeRoutes.optionalProcessingExecuteHandler),
  },
  '/iam/admin/data-subject-rights/export': {
    GET: createMethodNotAllowedHandler('/iam/admin/data-subject-rights/export', 'POST'),
    POST: routeHandler(authRuntimeRoutes.adminDataExportHandler),
  },
  '/iam/admin/data-subject-rights/export/status': {
    GET: routeHandler(authRuntimeRoutes.adminDataExportStatusHandler),
  },
  '/iam/admin/data-subject-rights/cases': {
    GET: routeHandler(authRuntimeRoutes.listAdminDataSubjectRightsCasesHandler),
  },
  '/iam/admin/data-subject-rights/cases/$caseId': {
    GET: routeHandler(authRuntimeRoutes.getAdminDataSubjectRightsCaseHandler),
  },
  '/iam/admin/data-subject-rights/legal-holds/apply': {
    POST: routeHandler(authRuntimeRoutes.legalHoldApplyHandler),
  },
  '/iam/admin/data-subject-rights/legal-holds/release': {
    POST: routeHandler(authRuntimeRoutes.legalHoldReleaseHandler),
  },
  '/iam/admin/data-subject-rights/maintenance': {
    POST: routeHandler(authRuntimeRoutes.dataSubjectMaintenanceHandler),
  },
  '/api/v1/waste-management/history': {
    GET: routeHandler(authRuntimeRoutes.wasteManagementHandlers.getHistory),
  },
  '/api/v1/waste-management/master-data': {
    GET: routeHandler(authRuntimeRoutes.wasteManagementHandlers.getMasterDataOverview),
  },
  '/api/v1/waste-management/fractions': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createFraction),
  },
  '/api/v1/waste-management/fractions/$fractionId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteFraction),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateFraction),
  },
  '/api/v1/waste-management/regions': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createRegion),
  },
  '/api/v1/waste-management/regions/$regionId': {
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateRegion),
  },
  '/api/v1/waste-management/cities': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createCity),
  },
  '/api/v1/waste-management/cities/$cityId': {
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateCity),
  },
  '/api/v1/waste-management/streets': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createStreet),
  },
  '/api/v1/waste-management/streets/$streetId': {
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateStreet),
  },
  '/api/v1/waste-management/house-numbers': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createHouseNumber),
  },
  '/api/v1/waste-management/house-numbers/$houseNumberId': {
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateHouseNumber),
  },
  '/api/v1/waste-management/collection-locations': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createCollectionLocation),
  },
  '/api/v1/waste-management/collection-locations/$locationId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteCollectionLocation),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateCollectionLocation),
  },
  '/api/v1/waste-management/location-tour-links': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createLocationTourLink),
  },
  '/api/v1/waste-management/location-tour-links/bulk': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createLocationTourLinksBulk),
  },
  '/api/v1/waste-management/location-tour-links/$linkId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteLocationTourLink),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateLocationTourLink),
  },
  '/api/v1/waste-management/scheduling': {
    GET: routeHandler(authRuntimeRoutes.wasteManagementHandlers.getSchedulingOverview),
  },
  '/api/v1/waste-management/global-date-shifts': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createGlobalDateShift),
  },
  '/api/v1/waste-management/global-date-shifts/$shiftId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteGlobalDateShift),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateGlobalDateShift),
  },
  '/api/v1/waste-management/holiday-rules/$holidayRuleId': {
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateHolidayRule),
  },
  '/api/v1/waste-management/tour-date-shifts': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createTourDateShift),
  },
  '/api/v1/waste-management/tour-date-shifts/$shiftId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteTourDateShift),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateTourDateShift),
  },
  '/api/v1/waste-management/tours': {
    GET: routeHandler(authRuntimeRoutes.wasteManagementHandlers.getToursOverview),
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.createTour),
  },
  '/api/v1/waste-management/tours/$tourId': {
    DELETE: routeHandler(authRuntimeRoutes.wasteManagementHandlers.deleteTour),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateTour),
  },
  '/api/v1/waste-management/settings': {
    GET: routeHandler(authRuntimeRoutes.wasteManagementHandlers.getSettings),
    PUT: routeHandler(authRuntimeRoutes.wasteManagementHandlers.updateSettings),
  },
  '/api/v1/waste-management/settings/holiday-sync': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.runHolidaySync),
  },
  '/api/v1/waste-management/tools/initialize': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startInitialize),
  },
  '/api/v1/waste-management/tools/imports': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startImport),
  },
  '/api/v1/waste-management/tools/imports/preview': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.previewLocationTourPickupDateImport),
  },
  '/api/v1/waste-management/tools/migrations': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startMigrations),
  },
  '/api/v1/waste-management/tools/seed': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startSeed),
  },
  '/api/v1/waste-management/tools/mainserver-sync': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startMainserverSync),
  },
  '/api/v1/waste-management/tools/sync-waste-types': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startSyncWasteTypes),
  },
  '/api/v1/waste-management/tools/reset': {
    POST: routeHandler(authRuntimeRoutes.wasteManagementHandlers.startReset),
  },
  '/api/v1/plugin-operations/jobs': {
    GET: routeHandler(authRuntimeRoutes.listPluginOperationJobsHandler),
    POST: routeHandler(authRuntimeRoutes.startPluginOperationJobHandler),
  },
  '/api/v1/plugin-operations/jobs/$jobId': {
    DELETE: routeHandler(authRuntimeRoutes.deletePluginOperationJobHandler),
    GET: routeHandler(authRuntimeRoutes.getPluginOperationJobHandler),
  },
  '/api/v1/plugin-operations/jobs/$jobId/cancel': {
    POST: routeHandler(authRuntimeRoutes.cancelPluginOperationJobHandler),
  },
  '/api/v1/iam/authorize-performance': {
    GET: routeHandler(authRuntimeRoutes.getLatestAuthorizePerformanceRunHandler),
    POST: routeHandler(authRuntimeRoutes.startAuthorizePerformanceRunHandler),
  },
} satisfies Partial<Record<AuthRoutePath, AuthHandlers>>;
