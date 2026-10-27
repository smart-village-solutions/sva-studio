export const contentENErrors = {
  forbidden: 'You do not have sufficient permissions for this content action.',
  csrfValidationFailed: 'Security validation failed. Please reload the page and try again.',
  rateLimited: 'Too many requests in a short time. Please wait and try again.',
  notFound: 'The requested content could not be found.',
  databaseUnavailable: 'The content data could not be processed due to a database problem.',
  invalidRequest: 'The content contains invalid or incomplete data.',
  staleMainserverContext:
    'The organization or principal context has changed. Reload the current context and review your inputs before saving again.',
  requestIdLabel: 'Error reference:',
  copyRequestId: 'Copy reference',
  requestIdCopied: 'Copied',
  requestIdCopyFailed: 'Copy failed',
} as const;
