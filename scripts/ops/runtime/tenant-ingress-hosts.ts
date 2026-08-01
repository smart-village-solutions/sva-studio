export type StudioIngressEnvironment = 'dev' | 'prod' | 'staging';

const productionTenantIds = [
  'bb-ahrensfelde',
  'bb-amt-schlieben',
  'bb-angermuende',
  'bb-bad-belzig',
  'bb-bernau',
  'bb-birkenwerder',
  'bb-briesen',
  'bb-dahme-spreewald',
  'bb-eberswalde',
  'bb-eisenhuettenstadt',
  'bb-falkenberg-elster',
  'bb-frankfurt-oder',
  'bb-gransee',
  'bb-gruenheide',
  'bb-guben',
  'bb-havelland',
  'bb-herzberg-elster',
  'bb-hohen-neuendorf',
  'bb-kloster-lehnin',
  'bb-koenigs-wusterhausen',
  'bb-kyritz',
  'bb-michendorf',
  'bb-neuzelle',
  'bb-nuthetal',
  'bb-oberspreewald-lausitz',
  'bb-panketal',
  'bb-petershagen-eggersdorf',
  'bb-prenzlau',
  'bb-prignitz',
  'bb-ruedersdorf',
  'bb-schoenefeld',
  'bb-seelow',
  'bb-spremberg',
  'bb-storkow',
  'bb-uckermark',
  'bb-wandlitz',
  'bw-kommone',
  'by-amorbach',
  'by-augsburg',
  'de-musterhausen',
  'de-studio-sandbox',
  'demo',
  'eichenzell',
  'hb-meinquartier',
  'he-kassel',
  'mv-crivitz',
  'mv-hagenow',
  'ni-goslar',
  'ni-harsum',
  'ni-lehrte',
  'ni-osnabrueck',
  'ni-papenburg',
  'ni-wittingen',
  'nrw-detmold',
  'nrw-legden',
  'rp-linz-am-rhein',
  'sh-kiel',
  'sh-nordapp',
  'sl-sankt-wendel',
  'st-arneburg-goldbeck',
  'st-magdeburg',
  'st-wittenberg',
  'st-zeitz',
] as const;

const rootHosts: Readonly<Record<StudioIngressEnvironment, string>> = {
  dev: 'studio-dev.smart-village.app',
  prod: 'studio.smart-village.app',
  staging: 'studio-staging.smart-village.app',
};

const tenantIds: Readonly<Record<StudioIngressEnvironment, readonly string[]>> = {
  dev: ['de-teststadt-dev'],
  prod: productionTenantIds,
  staging: ['de-studio-sandbox'],
};

type StudioIngressContract = Readonly<{
  environment: StudioIngressEnvironment;
  hosts: readonly string[];
  rootHost: string;
  tenantIds: readonly string[];
  unknownHost: string;
}>;

const createStudioIngressContract = (environment: StudioIngressEnvironment): StudioIngressContract => {
  const rootHost = rootHosts[environment];
  return {
    environment,
    hosts: [rootHost, ...tenantIds[environment].map((instanceId) => `${instanceId}.${rootHost}`)],
    rootHost,
    tenantIds: tenantIds[environment],
    unknownHost: `unknown-ingress-smoke.${rootHost}`,
  };
};

export const studioIngressContracts: Readonly<Record<StudioIngressEnvironment, StudioIngressContract>> = {
  dev: createStudioIngressContract('dev'),
  prod: createStudioIngressContract('prod'),
  staging: createStudioIngressContract('staging'),
};

export const resolveStudioIngressContract = (baseUrl: string) => {
  const hostname = new URL(baseUrl).hostname;
  return Object.values(studioIngressContracts).find((contract) => contract.rootHost === hostname) ?? null;
};
