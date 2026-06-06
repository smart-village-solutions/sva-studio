import { clearAuthDiagnosticTrail } from './auth-diagnostics';

const AUTH_KNOWN_SESSION_STORAGE_KEY = 'sva_auth_had_session';

const readLocalStorage = (): Storage | null => {
  try {
    return globalThis.window?.localStorage ?? null;
  } catch {
    return null;
  }
};

export const readHadKnownSession = (): boolean =>
  readLocalStorage()?.getItem(AUTH_KNOWN_SESSION_STORAGE_KEY) === '1';

export const markKnownSession = (): void => {
  try {
    readLocalStorage()?.setItem(AUTH_KNOWN_SESSION_STORAGE_KEY, '1');
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

export const clearKnownSession = (): void => {
  try {
    readLocalStorage()?.removeItem(AUTH_KNOWN_SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
};

export const clearClientLogoutState = (): void => {
  clearKnownSession();
  clearAuthDiagnosticTrail();
};
