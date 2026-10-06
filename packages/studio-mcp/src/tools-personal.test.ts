import { describe, expect, it } from 'vitest';
import { validatePersonalRequest } from './tools-personal.js';

const valid = {
  contextId: 'tenant-demo-provider',
  method: 'GET' as const,
  path: 'api/v1/iam/users',
};

describe('personal MCP API request boundary', () => {
  it('allows only the exact relative user collection and the two released methods', () => {
    expect(validatePersonalRequest(valid)).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, method: 'POST', body: { email: 'provider@example.org' } })).toBeUndefined();
    expect(validatePersonalRequest({ ...valid, path: '/api/v1/iam/users' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'https://evil.example/api/v1/iam/users' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, path: 'api/v1/iam/users/user-1' })).toBe('personal_route_not_allowed');
    expect(validatePersonalRequest({ ...valid, method: 'PATCH' as 'GET' })).toBe('personal_method_not_allowed');
  });

  it('keeps methods, body and collection pagination bounded', () => {
    expect(validatePersonalRequest({ ...valid, method: 'GET', body: {} })).toBe('get_body_not_allowed');
    expect(validatePersonalRequest({ ...valid, method: 'POST' })).toBe('post_contract_invalid');
    expect(validatePersonalRequest({ ...valid, method: 'POST', body: {}, query: { search: 'provider' } })).toBe('post_contract_invalid');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: '101' } })).toBe('page_size_out_of_range');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: ['25', '50'] } })).toBe('page_size_out_of_range');
    expect(validatePersonalRequest({ ...valid, query: { pageSize: '100', search: 'provider' } })).toBeUndefined();
  });
});
