import { DEFAULT_POST_LOGIN_PATH, sanitizeReturnTo } from './auth-navigation';

const LEGAL_ACCEPTANCE_RETURN_TO_KEY = 'sva:legal-acceptance:return-to';

const getStorage = () => {
  if (typeof globalThis.window === 'undefined') {
    return null;
  }

  try {
    return globalThis.window.sessionStorage;
  } catch {
    return null;
  }
};

export const storeLegalAcceptanceReturnTo = (value: string | null | undefined): string => {
  const sanitized = sanitizeReturnTo(value);
  getStorage()?.setItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY, sanitized);
  return sanitized;
};

export const readLegalAcceptanceReturnTo = (): string => {
  const stored = getStorage()?.getItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY);
  return sanitizeReturnTo(stored ?? DEFAULT_POST_LOGIN_PATH);
};

export const clearLegalAcceptanceReturnTo = (): void => {
  getStorage()?.removeItem(LEGAL_ACCEPTANCE_RETURN_TO_KEY);
};
