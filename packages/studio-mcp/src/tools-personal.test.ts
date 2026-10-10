import { describe, expect, it } from 'vitest';
import { validatePersonalRequest } from './tools-personal-request.js';

const valid = {
  contextId: 'tenant-demo-provider',
  method: 'GET' as const,
  path: 'api/v1/iam/users',
};

describe('personal MCP API request boundary', () => {
  it('requires a body only for group membership removal among DELETE routes', () => {
    const removal = { ...valid, method: 'DELETE' as const, path: 'api/v1/iam/groups/group-1/memberships' };
    const body = { keycloakSubject: 'subject-1' };
    expect(validatePersonalRequest(removal)).toBe('mutation_body_required');
    expect(validatePersonalRequest({ ...removal, body })).toBeUndefined();
    for (const invalidBody of [{}, { keycloakSubject: '' }, { keycloakSubject: 42 }, { keycloakSubject: null }]) {
      expect(validatePersonalRequest({ ...removal, body: invalidBody })).toBe('group_membership_subject_required');
    }
    for (const path of [
      'api/v1/iam/groups/group-1',
      'api/v1/iam/groups/group-1/roles/role-1',
      'api/v1/iam/organizations/org-1/memberships/account-1',
      'api/v1/iam/users/user-1',
      'api/v1/interfaces/interface-1',
    ]) {
      expect(validatePersonalRequest({ ...removal, path, body })).toBe('delete_body_not_allowed');
    }
  });

  it('allows bounded admin resource routes and methods', () => {
    expect(validatePersonalRequest(valid)).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'POST', body: { email: 'provider@example.org' } })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/users/user-1' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'PATCH', path: 'api/v1/iam/users/user-1', body: { enabled: false } })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'POST', path: 'api/v1/iam/users/user-1/send-password-setup-email' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'DELETE', path: 'api/v1/iam/groups/group-1/roles/role-1' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'DELETE', path: 'api/v1/iam/organizations/org-1/memberships/account-1' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, path: '/api/v1/iam/users' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'https://evil.example/api/v1/iam/users' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/users/user-1/bulk-deactivate' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/users/../users' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/organizations/org-1/provision-mainserver' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/contents' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/interfaces' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'POST', path: 'api/v1/interfaces', body: { draft: {} } })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'DELETE', path: 'api/v1/interfaces/s3-1' })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'PATCH', path: 'api/v1/interfaces/s3-1', body: {} })).toBe('personal_route_not_allowed');
  });

  it('keeps methods, body and collection pagination bounded', () => {
    expect(validatePersonalRequest({ ...valid, method: 'GET', body: {} })).toBe('get_body_not_allowed');
    expect(validatePersonalRequest({ ...valid, method: 'DELETE', path: 'api/v1/interfaces/s3-1', body: {} })).toBe('delete_body_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/interfaces', query: { pageSize: '10' } })).toBe('interface_query_not_supported');
    expect(validatePersonalRequest({ ...valid, method: 'POST', path: 'api/v1/interfaces' })).toBe('mutation_body_required');
    expect(validatePersonalRequest({ ...valid, method: 'POST' })).toBe('post_contract_invalid');
    expect(validatePersonalRequest({ ...valid, method: 'POST', body: {}, query: { search: 'provider' } })).toBe('post_contract_invalid');
    expect(validatePersonalRequest({ ...valid, method: 'PATCH', path: 'api/v1/iam/users/user-1' })).toBe('mutation_body_required');
    expect(validatePersonalRequest({ ...valid, method: 'POST', path: 'api/v1/iam/groups/group-1/memberships' })).toBe('mutation_body_required');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: '101' } })).toBe('page_size_out_of_range');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: ['25', '50'] } })).toBe('page_size_out_of_range');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: '100', search: 'provider' } })).toBeUndefined();
  });

  it('rejects excessive query keys and malformed page sizes', () => {
    const excessiveQuery = Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`field${index}`, 'value']));
    expect(validatePersonalRequest({ ...valid, query: excessiveQuery })).toBe('query_limit_exceeded');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: 'many' } })).toBe('page_size_out_of_range');
  });
  it('allows only bounded Mainserver settings reads and saves', () => {
    const request = { ...valid, path: 'api/v1/interfaces/mainserver' };
    const body = { graphqlBaseUrl: 'https://server.example/graphql', oauthTokenUrl: 'https://identity.example/token', enabled: true };
    expect(validatePersonalRequest(request)).toBeUndefined();
    expect(validatePersonalRequest({ ...request, method: 'POST', body })).toBeUndefined();
    for (const method of ['DELETE', 'PATCH'] as const) expect(validatePersonalRequest({ ...request, method, body })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...request, method: 'POST' })).toBe('mainserver_settings_invalid');
    for (const field of ['instanceId', 'clientSecret', 'secretRef']) expect(validatePersonalRequest({ ...request, method: 'POST', body: { ...body, [field]: 'other' } })).toBe('mainserver_settings_invalid');
    expect(validatePersonalRequest({ ...request, method: 'POST', body: { ...body, graphqlBaseUrl: 'invalid' } })).toBe('mainserver_settings_invalid');
    expect(validatePersonalRequest({ ...request, query: { instanceId: 'other' } })).toBe('interface_query_not_supported');
  });

});
