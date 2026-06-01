import { describe, expect, it, vi } from 'vitest';

const dataRepositoryMocks = vi.hoisted(() => ({
  loadDefaultExternalInterfaceRecord: vi.fn(),
  saveExternalInterfaceConnectionCheck: vi.fn(),
  saveExternalInterfaceRecord: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: dataRepositoryMocks.loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceConnectionCheck: dataRepositoryMocks.saveExternalInterfaceConnectionCheck,
  saveExternalInterfaceRecord: dataRepositoryMocks.saveExternalInterfaceRecord,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    error: vi.fn(),
  }),
  toJsonErrorResponse: vi.fn(),
  withRequestContext: async (_input: unknown, work: () => Promise<unknown>) => work(),
}));

vi.mock('../iam-account-management/encryption.js', () => ({
  protectField: vi.fn(),
  revealField: vi.fn(),
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ request_id: 'req-1' })),
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: vi.fn(),
}));

import { sharedWasteManagementDeps } from './server-context.js';

describe('sharedWasteManagementDeps', () => {
  it('exposes the default interface loader for waste settings write operations', () => {
    expect(sharedWasteManagementDeps.loadDefaultInterfaceRecord).toBe(
      dataRepositoryMocks.loadDefaultExternalInterfaceRecord
    );
  });
});
