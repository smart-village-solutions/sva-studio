import { fetchPortainerDockerJson, type RemotePortainerDeps } from './remote-portainer.ts';

type PortainerService = {
  ID?: string;
  ServiceStatus?: {
    DesiredTasks?: number;
  };
  Spec?: {
    Labels?: Record<string, string>;
    Mode?: {
      Replicated?: {
        Replicas?: number;
      };
    };
    Name?: string;
    TaskTemplate?: {
      ContainerSpec?: {
        Image?: string;
      };
    };
  };
};

type PortainerTask = {
  ID?: string;
  DesiredState?: string;
  NodeID?: string;
  ServiceID?: string;
  Slot?: number;
  Status?: {
    ContainerStatus?: {
      ExitCode?: number;
    };
    Err?: string;
    Message?: string;
    State?: string;
    Timestamp?: string;
  };
  UpdatedAt?: string;
};

export type RemoteStackTaskSnapshot = {
  desiredState?: string;
  exitCode?: number;
  id?: string;
  message?: string;
  nodeId?: string;
  slot?: number;
  state?: string;
  updatedAt?: string;
};

export type RemoteStackServiceSnapshot = {
  desiredReplicas: number;
  image?: string;
  name: string;
  runningReplicas: number;
  shortName: string;
  tasks: readonly RemoteStackTaskSnapshot[];
};

export type RemoteStackSnapshot = {
  channel: 'portainer-api';
  services: readonly RemoteStackServiceSnapshot[];
  stackName: string;
};

const toShortServiceName = (stackName: string, serviceName: string) =>
  serviceName.startsWith(`${stackName}_`) ? serviceName.slice(stackName.length + 1) : serviceName;

const isRunningTask = (task: RemoteStackTaskSnapshot) =>
  (task.state?.trim().toLowerCase() ?? '') === 'running' &&
  ((task.desiredState?.trim().toLowerCase() ?? 'running') === 'running');

const resolveDesiredReplicas = (service: PortainerService, runningReplicas: number) => {
  const desiredTasks = service.ServiceStatus?.DesiredTasks;
  if (typeof desiredTasks === 'number') {
    return desiredTasks;
  }

  const replicated = service.Spec?.Mode?.Replicated?.Replicas;
  if (typeof replicated === 'number') {
    return replicated;
  }

  return runningReplicas;
};

const padColumn = (value: string, length: number) => value.padEnd(length, ' ');

const formatTaskLine = (task: RemoteStackTaskSnapshot, image: string) =>
  [
    padColumn(task.state ?? 'unknown', 8),
    padColumn(task.id?.slice(0, 8) ?? '', 8),
    padColumn(task.slot === undefined ? '' : String(task.slot), 4),
    padColumn(task.updatedAt ?? '', 20),
    image,
  ]
    .join(' ')
    .trimEnd();

export const inspectRemoteStack = async (
  deps: RemotePortainerDeps,
  env: NodeJS.ProcessEnv,
  input: {
    quantumEndpoint: string;
    stackName: string;
  },
): Promise<RemoteStackSnapshot> => {
  const [services, tasks] = await Promise.all([
    fetchPortainerDockerJson<PortainerService[]>(deps, env, {
      quantumEndpoint: input.quantumEndpoint,
      resourcePath: 'services',
    }),
    fetchPortainerDockerJson<PortainerTask[]>(deps, env, {
      quantumEndpoint: input.quantumEndpoint,
      resourcePath: 'tasks',
    }),
  ]);

  const stackServices = services.filter(
    (service) => service.Spec?.Labels?.['com.docker.stack.namespace'] === input.stackName,
  );

  return {
    channel: 'portainer-api',
    stackName: input.stackName,
    services: stackServices
      .map((service) => {
        const serviceTasks = tasks
          .filter((task) => task.ServiceID === service.ID)
          .map<RemoteStackTaskSnapshot>((task) => ({
            desiredState: task.DesiredState,
            exitCode: task.Status?.ContainerStatus?.ExitCode,
            id: task.ID,
            message: task.Status?.Err || task.Status?.Message,
            nodeId: task.NodeID,
            slot: task.Slot,
            state: task.Status?.State,
            updatedAt: task.Status?.Timestamp ?? task.UpdatedAt,
          }))
          .sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''));
        const runningReplicas = serviceTasks.filter(isRunningTask).length;
        const serviceName = service.Spec?.Name ?? service.ID ?? 'unknown-service';

        return {
          desiredReplicas: resolveDesiredReplicas(service, runningReplicas),
          image: service.Spec?.TaskTemplate?.ContainerSpec?.Image,
          name: serviceName,
          runningReplicas,
          shortName: toShortServiceName(input.stackName, serviceName),
          tasks: serviceTasks,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
};

export const formatRemoteStackSnapshot = (snapshot: RemoteStackSnapshot) => {
  const lines = [`■ stack ${snapshot.stackName}`];

  for (const service of snapshot.services) {
    lines.push(
      `  ■ service ${service.shortName} ──────────────────────────────────────────────── replicated ${service.runningReplicas}/${service.desiredReplicas}`,
    );
    lines.push('    STATUS   ID       SLOT UPDATED              IMAGE');
    if (service.tasks.length === 0) {
      lines.push('    <keine tasks>');
      continue;
    }

    for (const task of service.tasks) {
      lines.push(`    ${formatTaskLine(task, service.image ?? '')}`);
    }
  }

  return lines.join('\n');
};
