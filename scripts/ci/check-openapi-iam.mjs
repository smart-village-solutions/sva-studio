#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve(process.cwd(), 'docs/api/iam-v1.yaml');

const requiredPaths = [
  '/health/live:',
  '/health/ready:',
  '/api/v1/iam/users:',
  '/api/v1/iam/users/{userId}:',
  '/api/v1/iam/users/bulk-deactivate:',
  '/api/v1/iam/users/me/profile:',
  '/api/v1/iam/roles:',
  '/api/v1/iam/roles/{roleId}:',
  '/api/v1/iam/admin/reconcile:',
];

const requiredSchemas = [
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
];

const content = readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const fail = (message) => {
  console.error(`[check-openapi-iam] ${message}`);
  process.exit(1);
};

if (!lines.some((line) => line.trim() === 'openapi: 3.1.0')) {
  fail('OpenAPI-Version 3.1.0 fehlt.');
}

for (const expectedPath of requiredPaths) {
  if (!content.includes(expectedPath)) {
    fail(`Pfad fehlt: ${expectedPath}`);
  }
}

for (const schemaName of requiredSchemas) {
  if (!content.includes(`    ${schemaName}`)) {
    fail(`Schema fehlt: ${schemaName}`);
  }
}

console.log('[check-openapi-iam] ok');
