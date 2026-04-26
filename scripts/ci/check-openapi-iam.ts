import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { authRoutePaths } from '../../packages/auth-runtime/src/routes.ts';

const normalizeRoutePath = (routePath: string): string =>
  routePath.replaceAll(/\/\$([A-Za-z0-9_]+)/g, '/{$1}');

const openApiRouteExclusions = ['/api/v1/iam/instances'] as const;

const isDocumentedOpenApiRoute = (routePath: string): boolean =>
  !routePath.startsWith('/auth/') && !openApiRouteExclusions.some((prefix) => routePath.startsWith(prefix));

export const requiredPaths = authRoutePaths
  .filter(isDocumentedOpenApiRoute)
  .map(normalizeRoutePath);

export const requiredOperations = {
  '/health/live': ['get'],
  '/api/v1/iam/health/live': ['get'],
  '/health/ready': ['get'],
  '/api/v1/iam/health/ready': ['get'],
  '/iam/me/permissions': ['get'],
  '/iam/authorize': ['post'],
  '/api/v1/iam/users': ['get', 'post'],
  '/api/v1/iam/users/sync-keycloak': ['post'],
  '/api/v1/iam/users/{userId}': ['get', 'patch', 'delete'],
  '/api/v1/iam/users/{userId}/timeline': ['get'],
  '/api/v1/iam/users/bulk-deactivate': ['post'],
  '/api/v1/iam/users/me/profile': ['get', 'patch'],
  '/api/v1/iam/organizations': ['get', 'post'],
  '/api/v1/iam/organizations/{organizationId}': ['get', 'patch', 'delete'],
  '/api/v1/iam/organizations/{organizationId}/memberships': ['post'],
  '/api/v1/iam/organizations/{organizationId}/memberships/{accountId}': ['delete'],
  '/api/v1/iam/me/context': ['get', 'put'],
  '/api/v1/iam/roles': ['get', 'post'],
  '/api/v1/iam/roles/{roleId}': ['patch', 'delete'],
  '/api/v1/iam/legal-texts': ['get', 'post'],
  '/api/v1/iam/legal-texts/{legalTextVersionId}': ['patch'],
    '/api/v1/iam/permissions': ['get'],
    '/api/v1/iam/admin/reconcile': ['post'],
  '/iam/governance/workflows': ['get', 'post'],
  '/iam/governance/compliance/export': ['get'],
  '/iam/me/data-export': ['get', 'post'],
  '/iam/me/data-export/status': ['get'],
  '/iam/me/data-subject-rights/requests': ['get', 'post'],
  '/iam/me/profile': ['post'],
  '/iam/me/optional-processing/execute': ['post'],
  '/iam/admin/data-subject-rights/export': ['get', 'post'],
  '/iam/admin/data-subject-rights/export/status': ['get'],
  '/iam/admin/data-subject-rights/cases': ['get'],
  '/iam/admin/data-subject-rights/legal-holds/apply': ['post'],
  '/iam/admin/data-subject-rights/legal-holds/release': ['post'],
  '/iam/admin/data-subject-rights/maintenance': ['post'],
} as const satisfies Record<string, readonly string[]>;

export const requiredSchemas = [
  'ApiErrorResponse',
  'Pagination',
  'User',
  'UserRole',
  'UserListResponse',
  'UserItemResponse',
  'BulkDeactivateResponse',
  'SyncUsersResponse',
  'CreateUserRequest',
  'UpdateUserRequest',
  'UpdateMyProfileRequest',
  'Organization',
  'OrganizationMembership',
  'OrganizationListResponse',
  'OrganizationItemResponse',
  'CreateOrganizationRequest',
  'UpdateOrganizationRequest',
  'OrganizationMembershipRequest',
  'OrganizationMembershipResponse',
  'OrganizationContext',
  'OrganizationContextResponse',
  'UpdateOrganizationContextRequest',
  'Role',
  'RoleListResponse',
  'RoleMutationResponse',
  'CreateRoleRequest',
  'UpdateRoleRequest',
  'LegalText',
  'LegalTextListResponse',
  'LegalTextItemResponse',
  'CreateLegalTextRequest',
  'UpdateLegalTextRequest',
  'AuthorizeRequest',
  'AuthorizeResponse',
  'EffectivePermission',
    'Permission',
    'PermissionListResponse',
  'PermissionSubject',
  'MePermissionsResponse',
  'GovernanceCase',
  'GovernanceCaseListResponse',
  'GovernanceWorkflowRequest',
  'GovernanceWorkflowMutationResponse',
  'GovernanceComplianceRow',
  'GovernanceComplianceExportResponse',
  'DsrCanonicalStatus',
  'DsrCase',
  'DsrSelfServiceOverview',
  'DsrSelfServiceResponse',
  'DsrCaseListResponse',
  'DataExportRequest',
  'AdminDataExportRequest',
  'DataExportAcceptedResponse',
  'DataExportStatusResponse',
  'DataSubjectRequest',
  'DataSubjectRequestResponse',
  'ProfileCorrectionRequest',
  'ProfileCorrectionResponse',
  'OptionalProcessingResponse',
  'LegalHoldApplyRequest',
  'LegalHoldApplyResponse',
  'LegalHoldReleaseRequest',
  'LegalHoldReleaseResponse',
  'DsrMaintenanceRequest',
  'DsrMaintenanceResponse',
  'UserTimelineEvent',
  'UserTimelineResponse',
] as const;

const requiredResponseCodes = [
  { path: '/iam/me/data-export', method: 'get', codes: ['405'] },
  { path: '/iam/admin/data-subject-rights/export', method: 'get', codes: ['405'] },
] as const;

type ParsedOpenApiDocument = {
  readonly paths: ReadonlyMap<string, ReadonlySet<string>>;
  readonly schemas: ReadonlySet<string>;
};

const parseOpenApiDocument = (content: string): ParsedOpenApiDocument => {
  const lines = content.split('\n');
  const paths = new Map<string, Set<string>>();
  const schemas = new Set<string>();
  let currentPath: string | null = null;
  let inPaths = false;
  let inSchemas = false;

  for (const line of lines) {
    if (line === 'paths:') {
      inPaths = true;
      inSchemas = false;
      currentPath = null;
      continue;
    }
    if (line === 'components:') {
      inPaths = false;
      currentPath = null;
      continue;
    }
    if (line === '  schemas:') {
      inSchemas = true;
      continue;
    }

    if (inPaths) {
      const pathMatch = /^  (\/[^:]+):\s*$/.exec(line);
      if (pathMatch) {
        currentPath = pathMatch[1];
        paths.set(currentPath, new Set<string>());
        continue;
      }

      const methodMatch = currentPath ? /^    (get|post|put|patch|delete):\s*$/.exec(line) : null;
      if (methodMatch && currentPath) {
        paths.get(currentPath)?.add(methodMatch[1]);
      }
      continue;
    }

    if (inSchemas) {
      const schemaMatch = /^    ([A-Za-z0-9]+):\s*$/.exec(line);
      if (schemaMatch) {
        schemas.add(schemaMatch[1]);
        continue;
      }

      if (/^  [A-Za-z]/.test(line)) {
        inSchemas = false;
      }
    }
  }

  return {
    paths,
    schemas,
  };
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractOperationBlock = (content: string, path: string, method: string): string | null => {
  const pathMatch = new RegExp(`^  ${escapeRegExp(path)}:\\s*$`, 'm').exec(content);
  if (!pathMatch) {
    return null;
  }

  const pathStart = pathMatch.index + pathMatch[0].length;
  const pathRest = content.slice(pathStart);
  const nextPathOrComponentsOffset = pathRest.search(/^(  \/|components:)/m);
  const pathBlock = nextPathOrComponentsOffset === -1 ? pathRest : pathRest.slice(0, nextPathOrComponentsOffset);
  const methodMatch = new RegExp(`^    ${escapeRegExp(method)}:\\s*$`, 'm').exec(pathBlock);

  if (!methodMatch) {
    return null;
  }

  const methodStart = methodMatch.index + methodMatch[0].length;
  const methodRest = pathBlock.slice(methodStart);
  const nextMethodOffset = methodRest.search(/^    (get|post|put|patch|delete):/m);

  return nextMethodOffset === -1 ? methodRest : methodRest.slice(0, nextMethodOffset);
};

export const validateOpenApiDocument = (content: string): string[] => {
  const errors: string[] = [];
  const parsed = parseOpenApiDocument(content);

  if (!content.split('\n').some((line) => line.trim() === 'openapi: 3.1.0')) {
    errors.push('OpenAPI-Version 3.1.0 fehlt.');
  }

  for (const expectedPath of requiredPaths) {
    if (!parsed.paths.has(expectedPath)) {
      errors.push(`Pfad fehlt: ${expectedPath}`);
    }
  }

  for (const [path, methods] of Object.entries(requiredOperations)) {
    const actualMethods = parsed.paths.get(path);
    if (!actualMethods) {
      continue;
    }

    for (const method of methods) {
      if (!actualMethods.has(method)) {
        errors.push(`HTTP-Methode fehlt: ${method.toUpperCase()} ${path}`);
      }
    }
  }

  for (const schemaName of requiredSchemas) {
    if (!parsed.schemas.has(schemaName)) {
      errors.push(`Schema fehlt: ${schemaName}`);
    }
  }

  for (const requirement of requiredResponseCodes) {
    const operationBlock = extractOperationBlock(content, requirement.path, requirement.method);
    if (!operationBlock) {
      continue;
    }

    for (const statusCode of requirement.codes) {
      if (!new RegExp(`^\\s+'${escapeRegExp(statusCode)}':\\s*$`, 'm').test(operationBlock)) {
        errors.push(`Antwortcode fehlt: ${requirement.method.toUpperCase()} ${requirement.path} -> ${statusCode}`);
      }
    }
  }

  return errors;
};

export const runOpenApiCheck = (rootDir = process.cwd()): number => {
  const filePath = resolve(rootDir, 'docs/api/iam-v1.yaml');
  const content = readFileSync(filePath, 'utf8');
  const errors = validateOpenApiDocument(content);

  if (errors.length > 0) {
    console.error(`[check-openapi-iam] ${errors[0]}`);
    return 1;
  }

  console.log('[check-openapi-iam] ok');
  return 0;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runOpenApiCheck());
}
