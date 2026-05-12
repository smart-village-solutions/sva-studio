import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthDiagnosticTrail,
  createAuthFlowId,
  readAuthDiagnosticTrail,
  readLatestAuthDiagnosticSnapshot,
  recordAuthDiagnosticEvent,
} from './auth-diagnostics';

const sessionStorageState = new Map<string, string>();
const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageState.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    sessionStorageState.set(key, value);
  }),
  removeItem: vi.fn((key: string) => {
    sessionStorageState.delete(key);
  }),
};

describe('auth diagnostics trail', () => {
  beforeEach(() => {
    sessionStorageState.clear();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
  });

  afterEach(() => {
    sessionStorageState.clear();
  });

  it('stores events and exposes the latest authFlowId and requestId snapshot', () => {
    recordAuthDiagnosticEvent({
      authFlowId: 'flow-1',
      attempt: 1,
      event: 'auth_me_401_received',
      requestId: 'req-1',
      result: 'failed',
    });
    recordAuthDiagnosticEvent({
      authFlowId: 'flow-1',
      attempt: 1,
      event: 'auth_redirect_session_expired',
      result: 'failed',
    });

    expect(readAuthDiagnosticTrail()).toHaveLength(2);
    expect(readLatestAuthDiagnosticSnapshot()).toEqual({
      authFlowId: 'flow-1',
      requestId: undefined,
    });
  });

  it('clears the persisted trail', () => {
    recordAuthDiagnosticEvent({
      authFlowId: 'flow-2',
      attempt: 1,
      event: 'auth_logout_started',
      result: 'started',
    });

    clearAuthDiagnosticTrail();

    expect(readAuthDiagnosticTrail()).toEqual([]);
    expect(readLatestAuthDiagnosticSnapshot()).toEqual({});
  });

  it('uses crypto.randomUUID to create auth flow ids', () => {
    const originalCrypto = globalThis.crypto;
    const randomUUID = vi.fn(() => '11111111-2222-4333-8444-555555555555');
    vi.spyOn(Date, 'now').mockReturnValue(1_715_000_000_000);
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });

    expect(createAuthFlowId()).toBe('auth-lvuypx4w-111111112222');
    expect(randomUUID).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });
});
