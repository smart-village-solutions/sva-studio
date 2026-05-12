import type {
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeSafeDetails,
} from '@sva/core';

const AUTH_DIAGNOSTICS_STORAGE_KEY = 'sva_auth_diagnostics_trail';
const AUTH_DIAGNOSTICS_MAX_EVENTS = 20;

export type AuthDiagnosticEvent = Readonly<{
  authFlowId: string;
  attempt: number;
  diagnosticStatus?: IamRuntimeDiagnosticStatus;
  event: string;
  pathname?: string;
  reasonCode?: string;
  recoveryStep?: string;
  requestId?: string;
  result?: string;
  safeDetails?: IamRuntimeSafeDetails;
  status?: number;
  timestamp: string;
  classification?: IamRuntimeDiagnosticClassification;
}>;

export type AuthDiagnosticSnapshot = Readonly<{
  authFlowId?: string;
  requestId?: string;
}>;

type AuthDiagnosticsDebugHandle = {
  clear: () => void;
  latest: () => AuthDiagnosticSnapshot;
  read: () => readonly AuthDiagnosticEvent[];
};

declare global {
  interface Window {
    __SVA_AUTH_DIAGNOSTICS__?: AuthDiagnosticsDebugHandle;
  }
}

const isEnabled = (): boolean =>
  import.meta.env.DEV ||
  import.meta.env.VITEST === true ||
  import.meta.env.VITEST === 'true' ||
  import.meta.env.VITE_ENABLE_AUTH_DIAGNOSTICS === 'true';

const readStorage = (): Storage | null => {
  try {
    return globalThis.window?.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readTrailInternal = (): AuthDiagnosticEvent[] => {
  const storage = readStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(AUTH_DIAGNOSTICS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AuthDiagnosticEvent[]) : [];
  } catch {
    return [];
  }
};

const writeTrailInternal = (trail: readonly AuthDiagnosticEvent[]): void => {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      AUTH_DIAGNOSTICS_STORAGE_KEY,
      JSON.stringify(trail.slice(-AUTH_DIAGNOSTICS_MAX_EVENTS))
    );
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

export const createAuthFlowId = (): string => {
  const randomPart = globalThis.crypto.randomUUID().replaceAll('-', '').slice(0, 12);
  return `auth-${Date.now().toString(36)}-${randomPart}`;
};

export const recordAuthDiagnosticEvent = (event: Omit<AuthDiagnosticEvent, 'timestamp'>): void => {
  if (!isEnabled()) {
    return;
  }

  const trail = readTrailInternal();
  trail.push({
    ...event,
    timestamp: new Date().toISOString(),
  });
  writeTrailInternal(trail);
};

export const readAuthDiagnosticTrail = (): readonly AuthDiagnosticEvent[] => readTrailInternal();

export const clearAuthDiagnosticTrail = (): void => {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(AUTH_DIAGNOSTICS_STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted browser contexts.
  }
};

export const readLatestAuthDiagnosticSnapshot = (): AuthDiagnosticSnapshot => {
  const trail = readTrailInternal();
  for (let index = trail.length - 1; index >= 0; index -= 1) {
    const entry = trail[index];
    if (!entry) {
      continue;
    }
    return {
      authFlowId: entry.authFlowId,
      requestId: entry.requestId,
    };
  }

  return {};
};

export const publishAuthDiagnosticsDebugHandle = (): void => {
  if (!isEnabled() || typeof globalThis.window === 'undefined') {
    return;
  }

  globalThis.window.__SVA_AUTH_DIAGNOSTICS__ = {
    clear: clearAuthDiagnosticTrail,
    latest: readLatestAuthDiagnosticSnapshot,
    read: readAuthDiagnosticTrail,
  };
};
