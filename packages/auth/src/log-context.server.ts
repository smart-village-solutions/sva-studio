export { buildLogContext } from './shared/log-context.js';

export const isTokenErrorLike = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const typed = error as { name?: unknown; code?: unknown; error?: unknown };
  const name = typeof typed.name === 'string' ? typed.name.toLowerCase() : '';
  const code = typeof typed.code === 'string' ? typed.code.toLowerCase() : '';
  const oauthError = typeof typed.error === 'string' ? typed.error.toLowerCase() : '';
  return (
    name.includes('token') ||
    name.includes('oauth') ||
    code.includes('token') ||
    oauthError.length > 0
  );
};
