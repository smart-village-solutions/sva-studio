import * as authRuntimeRoutes from '@sva/auth-runtime/runtime-routes';

import type { AuthHandlers, AuthRoutePath } from './auth.route-handlers.types.js';
import { createMethodNotAllowedHandler } from './auth.route-runtime.server.js';
import { wasteAuthHandlerMap } from './auth.route-handlers.waste.server.js';
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
  ...wasteAuthHandlerMap,
  '/api/v1/plugin-operations/jobs': {
    GET: routeHandler(authRuntimeRoutes.listPluginOperationJobsHandler),
    POST: routeHandler(authRuntimeRoutes.startPluginOperationJobHandler),
  },
  '/api/v1/plugin-operations/jobs/$jobId': {
    DELETE: routeHandler(authRuntimeRoutes.deletePluginOperationJobHandler),
    GET: routeHandler(authRuntimeRoutes.getPluginOperationJobHandler),
  },
  '/api/v1/plugin-operations/jobs/$jobId/artifacts/$artifactId': {
    GET: routeHandler(authRuntimeRoutes.downloadPluginOperationArtifactHandler),
  },
  '/api/v1/plugin-operations/jobs/$jobId/cancel': {
    POST: routeHandler(authRuntimeRoutes.cancelPluginOperationJobHandler),
  },
  '/api/v1/iam/authorize-performance': {
    GET: routeHandler(authRuntimeRoutes.getLatestAuthorizePerformanceRunHandler),
    POST: routeHandler(authRuntimeRoutes.startAuthorizePerformanceRunHandler),
  },
} satisfies Partial<Record<AuthRoutePath, AuthHandlers>>;
