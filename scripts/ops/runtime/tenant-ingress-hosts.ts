export type StudioIngressEnvironment = 'dev' | 'prod' | 'staging';

const rootHosts: Readonly<Record<StudioIngressEnvironment, string>> = {
  dev: 'studio-dev.smart-village.app',
  prod: 'studio.smart-village.app',
  staging: 'studio-staging.smart-village.app',
};

type StudioIngressContract = Readonly<{
  environment: StudioIngressEnvironment;
  rootHost: string;
  unknownHost: string;
}>;

const createStudioIngressContract = (
  environment: StudioIngressEnvironment
): StudioIngressContract => {
  const rootHost = rootHosts[environment];
  return {
    environment,
    rootHost,
    unknownHost: `unknown-ingress-smoke.${rootHost}`,
  };
};

export const studioIngressContracts: Readonly<
  Record<StudioIngressEnvironment, StudioIngressContract>
> = {
  dev: createStudioIngressContract('dev'),
  prod: createStudioIngressContract('prod'),
  staging: createStudioIngressContract('staging'),
};

export const resolveStudioIngressContract = (baseUrl: string) => {
  let hostname: string;
  try {
    hostname = new URL(baseUrl).hostname;
  } catch {
    return null;
  }
  return (
    Object.values(studioIngressContracts).find((contract) => contract.rootHost === hostname) ?? null
  );
};
