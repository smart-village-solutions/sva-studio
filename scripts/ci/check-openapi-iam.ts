import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const requiredPaths = [
  '/health/live:',
  '/health/ready:',
  '/api/v1/iam/users:',
  '/api/v1/iam/users/{userId}:',
  '/api/v1/iam/users/bulk-deactivate:',
  '/api/v1/iam/users/me/profile:',
  '/api/v1/iam/roles:',
  '/api/v1/iam/roles/{roleId}:',
  '/api/v1/iam/admin/reconcile:',
] as const;

export const requiredSchemas = [
  'ApiErrorResponse:',
  'User:',
  'UserListResponse:',
  'UserItemResponse:',
  'Role:',
  'RoleListResponse:',
  'CreateUserRequest:',
  'UpdateUserRequest:',
  'CreateRoleRequest:',
  'UpdateRoleRequest:',
] as const;

export const validateOpenApiDocument = (content: string): string[] => {
  const lines = content.split('\n');
  const errors: string[] = [];

  if (!lines.some((line) => line.trim() === 'openapi: 3.1.0')) {
    errors.push('OpenAPI-Version 3.1.0 fehlt.');
  }

  for (const expectedPath of requiredPaths) {
    if (!content.includes(expectedPath)) {
      errors.push(`Pfad fehlt: ${expectedPath}`);
    }
  }

  for (const schemaName of requiredSchemas) {
    if (!content.includes(`    ${schemaName}`)) {
      errors.push(`Schema fehlt: ${schemaName}`);
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
