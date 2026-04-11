type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ComposeDocument = {
  name?: string;
  networks?: Record<string, JsonValue>;
  secrets?: Record<string, JsonValue>;
  services?: Record<string, JsonValue>;
  version?: string;
  volumes?: Record<string, JsonValue>;
};

export type ServiceContract = {
  env: Readonly<Record<string, string>>;
  image?: string;
  labels: Readonly<Record<string, string>>;
  networks: readonly string[];
};

const REQUIRED_INGRESS_LABELS = ['traefik.enable', 'traefik.docker.network'] as const;

const toStringRecord = (value: JsonValue | undefined): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => (typeof entry === 'string' ? [[key, entry]] : [])),
  );
};

const toEnvRecord = (value: JsonValue | undefined): Record<string, string> => {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value.flatMap((entry) => {
        if (typeof entry !== 'string' || !entry.includes('=')) {
          return [];
        }

        const separatorIndex = entry.indexOf('=');
        return [[entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)]];
      }),
    );
  }

  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => (typeof entry === 'string' ? [[key, entry]] : [])),
  );
};

const toServiceNetworks = (value: JsonValue | undefined): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => (typeof entry === 'string' ? [entry] : []));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.keys(value);
};

export const normalizeQuantumComposeValue = (value: JsonValue, parentKey?: string): JsonValue => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeQuantumComposeValue(entry, parentKey))
      .filter((entry): entry is Exclude<JsonValue, null> => entry !== null);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, JsonValue>;
  const preserveNullEntries = parentKey === 'networks';
  const normalizedEntries = Object.entries(record)
    .filter(([, entry]) => preserveNullEntries || entry !== null)
    .map(([key, entry]) => {
      if (key === 'cpus' && typeof entry === 'number') {
        return [key, String(entry)] as const;
      }

      return [key, normalizeQuantumComposeValue(entry, key)] as const;
    })
    .filter(([, entry]) => preserveNullEntries || entry !== null);

  return Object.fromEntries(normalizedEntries) as JsonValue;
};

export const buildQuantumDeployComposeDocument = (renderedCompose: ComposeDocument): ComposeDocument => {
  const { name: _stackName, ...composeWithoutName } = renderedCompose;
  return normalizeQuantumComposeValue(composeWithoutName as JsonValue) as ComposeDocument;
};

export const extractComposeServiceContract = (
  renderedCompose: ComposeDocument,
  serviceName: string,
): ServiceContract | null => {
  const service = renderedCompose.services?.[serviceName];
  if (!service || typeof service !== 'object' || Array.isArray(service)) {
    return null;
  }

  const serviceRecord = service as Record<string, JsonValue>;
  const deploy = serviceRecord.deploy;
  const deployRecord =
    deploy && typeof deploy === 'object' && !Array.isArray(deploy) ? (deploy as Record<string, JsonValue>) : undefined;

  const labels = {
    ...toStringRecord(serviceRecord.labels),
    ...toStringRecord(deployRecord?.labels),
  };

  return {
    env: toEnvRecord(serviceRecord.environment),
    image: typeof serviceRecord.image === 'string' ? serviceRecord.image : undefined,
    labels,
    networks: toServiceNetworks(serviceRecord.networks),
  };
};

export const assertComposeServiceNetworks = (
  renderedCompose: ComposeDocument,
  serviceName: string,
  requiredNetworks: readonly string[],
) => {
  const contract = extractComposeServiceContract(renderedCompose, serviceName);
  if (!contract) {
    throw new Error(`Render-Compose enthaelt keinen Service ${serviceName}.`);
  }

  const missingNetworks = requiredNetworks.filter((networkName) => !contract.networks.includes(networkName));
  if (missingNetworks.length > 0) {
    throw new Error(
      `Render-Compose fuer ${serviceName} enthaelt nicht alle erwarteten Netzwerke: ${missingNetworks.join(', ')}.`,
    );
  }

  return contract;
};

export const assertComposeServiceIngressLabels = (renderedCompose: ComposeDocument, serviceName: string) => {
  const contract = extractComposeServiceContract(renderedCompose, serviceName);
  if (!contract) {
    throw new Error(`Render-Compose enthaelt keinen Service ${serviceName}.`);
  }

  const missingRequiredLabels = REQUIRED_INGRESS_LABELS.filter((labelKey) => !(contract.labels[labelKey]?.trim() ?? ''));
  if (missingRequiredLabels.length > 0) {
    throw new Error(
      `Render-Compose fuer ${serviceName} enthaelt nicht alle erwarteten Ingress-Labels: ${missingRequiredLabels.join(', ')}.`,
    );
  }

  const ingressRoutingLabels = Object.keys(contract.labels).filter(
    (labelKey) =>
      labelKey.startsWith('traefik.') &&
      (labelKey.endsWith('.rule') ||
        labelKey.endsWith('.port') ||
        labelKey.includes('.frontend.rule') ||
        labelKey.includes('.loadbalancer.server.port')),
  );

  if (ingressRoutingLabels.length === 0) {
    throw new Error(
      `Render-Compose fuer ${serviceName} enthaelt keine ingressrelevanten Traefik-Routing-Labels.`,
    );
  }

  return contract;
};
