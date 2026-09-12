import { publishKasselTenantIngress } from '@sva/instance-registry/kassel-tenant-ingress';

const requireKasselMode = (): void => {
  if (process.env.SVA_TENANT_INGRESS_MODE !== 'kassel-traefik-file') {
    throw new Error('kassel_tenant_ingress_mode_disabled');
  }
};

export const publishConfiguredKasselTenantIngress = async (input: {
  readonly instanceId: string;
  readonly primaryHostname: string;
}) => {
  requireKasselMode();
  const directory = process.env.SVA_KASSEL_TRAEFIK_DYNAMIC_DIR?.trim();
  if (!directory) throw new Error('kassel_traefik_dynamic_dir_missing');
  const published = await publishKasselTenantIngress({
    instanceId: input.instanceId,
    hostname: input.primaryHostname,
    service: process.env.SVA_KASSEL_TRAEFIK_SERVICE?.trim() || 'sva-studio-ssf@docker',
    directory,
  });
  return {
    routerName: published.routerName,
    configHash: published.configHash,
  };
};

type EndpointProbeInput = {
  readonly kind: 'ingress' | 'login';
  readonly primaryHostname: string;
  readonly authIssuerUrl: string;
  readonly authClientId: string;
  readonly expectedRouterName: string;
  readonly expectedConfigHash: string;
};

const requireExpectedRouter = (response: Response, input: EndpointProbeInput): void => {
  if (
    response.headers.get('x-sva-tenant-router') !== input.expectedRouterName ||
    response.headers.get('x-sva-tenant-config') !== input.expectedConfigHash
  ) {
    throw new Error('kassel_ingress_router_not_loaded');
  }
};

const requireSuccessfulIngress = (response: Response, primaryHostname: string): void => {
  if (response.status >= 200 && response.status < 300) return;
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    let redirect: URL;
    try {
      redirect = new URL(location ?? '', `https://${primaryHostname}`);
    } catch {
      throw new Error('kassel_ingress_redirect_invalid');
    }
    if (redirect.origin === `https://${primaryHostname}`) return;
    throw new Error('kassel_ingress_redirect_invalid');
  }
  throw new Error('kassel_ingress_probe_failed');
};

const requireValidLoginRedirect = (
  response: Response,
  input: EndpointProbeInput
): Readonly<Record<string, unknown>> => {
  if (response.status < 300 || response.status >= 400) {
    throw new Error('kassel_login_probe_failed');
  }
  const location = response.headers.get('location');
  if (!location) throw new Error('kassel_login_redirect_missing');
  let redirect: URL;
  let issuer: URL;
  try {
    redirect = new URL(location);
    issuer = new URL(input.authIssuerUrl);
  } catch {
    throw new Error('kassel_login_redirect_invalid');
  }
  if (
    redirect.origin !== issuer.origin ||
    redirect.pathname !== `${issuer.pathname}/protocol/openid-connect/auth` ||
    redirect.searchParams.get('client_id') !== input.authClientId ||
    redirect.searchParams.get('state') === null ||
    redirect.searchParams.get('code_challenge') === null ||
    redirect.searchParams.get('code_challenge_method') !== 'S256'
  ) {
    throw new Error('kassel_login_redirect_invalid');
  }
  const callback = redirect.searchParams.get('redirect_uri');
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(callback ?? '');
  } catch {
    throw new Error('kassel_login_callback_invalid');
  }
  if (
    callbackUrl.origin !== `https://${input.primaryHostname}` ||
    callbackUrl.pathname !== '/auth/callback' ||
    callbackUrl.search !== '' ||
    callbackUrl.hash !== ''
  ) {
    throw new Error('kassel_login_callback_invalid');
  }
  return {
    status: response.status,
    issuerOrigin: redirect.origin,
    issuerPath: redirect.pathname,
    callbackOrigin: callbackUrl.origin,
  };
};

export const probeKasselTenantEndpoint = async (
  input: EndpointProbeInput,
  fetcher: typeof fetch = fetch
): Promise<Readonly<Record<string, unknown>>> => {
  requireKasselMode();
  const path = input.kind === 'login' ? '/auth/login' : '/';
  const response = await fetcher(`https://${input.primaryHostname}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'sva-studio-kassel-provisioner/1.0' },
  });
  requireExpectedRouter(response, input);
  if (input.kind === 'login') return requireValidLoginRedirect(response, input);
  requireSuccessfulIngress(response, input.primaryHostname);
  return { status: response.status, hostname: input.primaryHostname };
};
