import { DEFAULT_POST_LOGIN_PATH, sanitizeReturnTo } from './auth-navigation';

const LEGAL_ACCEPTANCE_RETURN_TO_KEY = 'sva:legal-acceptance:return-to';

const sanitizeLegalAcceptanceReturnTo = (value: string | null | undefined): string => {
  const sanitized = sanitizeReturnTo(value);
  return sanitized.startsWith('/api/') ? DEFAULT_POST_LOGIN_PATH : sanitized;
};

const getStorage = () => {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    return globalThis.window.sessionStorage;
  } catch {
    return null;
  }
};

export const storeLegalAcceptanceReturnTo = (value: string | null | undefined): string => {
  const sanitized = sanitizeLegalAcceptanceReturnTo(value);
  try {
    getStorage()?.setItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY, sanitized);
  } catch {
    return sanitized;
  }
  return sanitized;
};

export const readLegalAcceptanceReturnTo = (): string => {
  try {
    const stored = getStorage()?.getItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY);
    return sanitizeLegalAcceptanceReturnTo(stored ?? DEFAULT_POST_LOGIN_PATH);
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }
};

export const clearLegalAcceptanceReturnTo = (): void => {
  try {
    getStorage()?.removeItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY);
  } catch {
    return;
  }
};
