import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearAuthDiagnosticTrail,
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
});
