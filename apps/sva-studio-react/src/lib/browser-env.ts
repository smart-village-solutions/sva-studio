export const isDevelopmentBrowserEnv = (): boolean => {
  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV !== 'production';
  }

  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean; PROD?: boolean } };
  if (typeof meta.env?.DEV === 'boolean') {
    return meta.env.DEV;
  }
  if (typeof meta.env?.PROD === 'boolean') {
    return !meta.env.PROD;
  }

  return true;
};
