import { fetchPortainerDockerJson, type RemotePortainerDeps } from './remote-portainer.ts';

type RunCapture = (commandName: string, args: readonly string[], env?: NodeJS.ProcessEnv) => string;
type CommandExists = (commandName: string) => boolean;

type RemoteServiceSpecDeps = RemotePortainerDeps & {
  commandExists: CommandExists;
  runCapture: RunCapture;
};

type PortainerService = {
  Spec?: {
    Name?: string;
    Labels?: Record<string, string>;
    TaskTemplate?: {
      ContainerSpec?: {
        Env?: string[];
        Image?: string;
      };
      Networks?: Array<{
        Aliases?: string[];
        Target?: string;
      }>;
    };
  };
};

type PortainerNetwork = { Id?: string; Name?: string };

export type RemoteServiceContract = {
  env: Readonly<Record<string, string>>;
  image?: string;
  labels: Readonly<Record<string, string>>;
  networkNames: readonly string[];
  serviceName: string;
};

const toEnvRecord = (entries: readonly string[] | undefined) =>
  Object.fromEntries(
    (entries ?? []).flatMap((entry) => {
      if (!entry.includes('=')) {
        return [];
      }

      const separatorIndex = entry.indexOf('=');
      return [[entry.slice(0, separatorIndex), entry.slice(separatorIndex + 1)]];
    }),
  );

export const inspectRemoteServiceContract = async (
  deps: RemoteServiceSpecDeps,
  env: NodeJS.ProcessEnv,
  input: {
    quantumEndpoint: string;
    serviceName: string;
    stackName: string;
  },
): Promise<RemoteServiceContract | null> => {
  const [services, networks] = await Promise.all([
    fetchPortainerDockerJson<PortainerService[]>(deps, env, {
      quantumEndpoint: input.quantumEndpoint,
      resourcePath: 'services',
    }),
    fetchPortainerDockerJson<PortainerNetwork[]>(deps, env, {
      quantumEndpoint: input.quantumEndpoint,
      resourcePath: 'networks',
    }),
  ]);
  const liveService = services.find((service) => service.Spec?.Name === `${input.stackName}_${input.serviceName}`);
  if (!liveService?.Spec?.TaskTemplate?.ContainerSpec) {
    return null;
  }

  const networkNameById = new Map(
    networks.flatMap((network) => (network.Id && network.Name ? [[network.Id, network.Name]] : [])),
  );
  const networkNames = (liveService.Spec.TaskTemplate.Networks ?? [])
    .map((network) => network.Target)
    .flatMap((target) => (target ? [networkNameById.get(target) ?? target] : []));

  return {
    env: toEnvRecord(liveService.Spec.TaskTemplate.ContainerSpec.Env),
    image: liveService.Spec.TaskTemplate.ContainerSpec.Image,
    labels: liveService.Spec.Labels ?? {},
    networkNames,
    serviceName: liveService.Spec.Name ?? `${input.stackName}_${input.serviceName}`,
  };
};
