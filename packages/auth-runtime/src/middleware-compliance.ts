const LEGAL_TEXT_PROTECTED_PATHS = new Set(['/iam/authorize', '/iam/me/permissions']);
const LEGAL_TEXT_PROTECTED_PREFIXES = ['/api/v1/iam/'];
const LEGAL_TEXT_EXEMPT_AUTH_PATHS = new Set(['/auth/login', '/auth/callback', '/auth/logout', '/auth/me']);
const LEGAL_TEXT_EXEMPT_IAM_PREFIXES = ['/api/v1/iam/legal-texts'];
const LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES = ['/iam/me/legal-texts'];
const LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS = new Set(['accept_legal_text', 'revoke_legal_acceptance']);

const readWorkflowOperation = async (request: Request): Promise<string | undefined> => {
  try {
    const payload = await request.clone().json();
    if (!payload || typeof payload !== 'object') {
      return undefined;
    }

    const operation = (payload as { operation?: unknown }).operation;
    return typeof operation === 'string' ? operation : undefined;
  } catch {
    return undefined;
  }
};

export const shouldEnforceLegalTextCompliance = async (request: Request): Promise<boolean> => {
  const pathname = new URL(request.url).pathname;
  if (LEGAL_TEXT_EXEMPT_AUTH_PATHS.has(pathname)) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_SELF_SERVICE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (LEGAL_TEXT_EXEMPT_IAM_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname === '/api/v1/iam/governance/workflows') {
    const operation = await readWorkflowOperation(request);
    return !LEGAL_TEXT_EXEMPT_GOVERNANCE_OPERATIONS.has(operation ?? '');
  }

  if (LEGAL_TEXT_PROTECTED_PATHS.has(pathname)) {
    return true;
  }

  return LEGAL_TEXT_PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};
