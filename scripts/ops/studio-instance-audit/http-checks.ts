import type { AuditCheckResult, AuditRegistryTarget } from './model.ts';

const okStatus = (status: number) => status >= 200 && status < 400;

export const runHttpChecks = async (
  target: Pick<AuditRegistryTarget, 'instanceId' | 'primaryHostname'>,
  deps: { fetchImpl?: typeof fetch } = {},
): Promise<{ checks: readonly AuditCheckResult[] }> => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const origin = `https://${target.primaryHostname}`;

  const [rootResponse, loginResponse] = await Promise.allSettled([
    fetchImpl(`${origin}/`, { redirect: 'manual' }),
    fetchImpl(`${origin}/auth/login`, { redirect: 'manual' }),
  ]);

  const checks: AuditCheckResult[] = [];

  if (rootResponse.status === 'fulfilled') {
    checks.push({
      checkId: 'reachability.root',
      status: okStatus(rootResponse.value.status) ? 'pass' : 'fail',
      summary: `GET / -> ${rootResponse.value.status}`,
      title: 'Tenant root URL antwortet',
    });
  } else {
    checks.push({
      checkId: 'reachability.root',
      status: 'fail',
      summary: rootResponse.reason instanceof Error ? rootResponse.reason.message : String(rootResponse.reason),
      title: 'Tenant root URL antwortet',
    });
  }

  if (loginResponse.status === 'fulfilled') {
    checks.push({
      checkId: 'reachability.login',
      status: okStatus(loginResponse.value.status) ? 'pass' : 'warn',
      summary: `GET /auth/login -> ${loginResponse.value.status}`,
      title: 'Login-Einstieg antwortet',
    });
  } else {
    checks.push({
      checkId: 'reachability.login',
      status: 'warn',
      summary: loginResponse.reason instanceof Error ? loginResponse.reason.message : String(loginResponse.reason),
      title: 'Login-Einstieg antwortet',
    });
  }

  return { checks };
};
