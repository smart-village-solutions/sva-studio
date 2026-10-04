type MigrationTaskTerminalState = 'failed' | 'succeeded';

export type MigrationJobTaskSnapshot = {
  containerId?: string;
  createdAt?: string;
  desiredState?: string;
  exitCode?: number;
  message?: string;
  nodeId?: string;
  serviceId?: string;
  state?: string;
  taskId?: string;
  updatedAt?: string;
};

const normalizeTaskState = (value: string | undefined) => value?.trim().toLowerCase() ?? '';

const stringField = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const numberField = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const coerceTaskSnapshot = (value: unknown): MigrationJobTaskSnapshot | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const status = (candidate.Status ?? {}) as Record<string, unknown>;
  const containerStatus = (status.ContainerStatus ?? {}) as Record<string, unknown>;

  const snapshot = {
    containerId: stringField(containerStatus.ContainerID),
    createdAt: stringField(candidate.CreatedAt),
    desiredState: stringField(candidate.DesiredState),
    exitCode:
      typeof containerStatus.ExitCode === 'number'
        ? containerStatus.ExitCode
        : typeof status.Err === 'number'
          ? status.Err
          : undefined,
    message: stringField(status.Message),
    nodeId: stringField(candidate.NodeID),
    serviceId: stringField(candidate.ServiceID),
    state: stringField(status.State),
    taskId: stringField(candidate.ID),
    updatedAt: stringField(status.Timestamp),
  };

  if (
    snapshot.taskId === undefined &&
    snapshot.state === undefined &&
    snapshot.createdAt === undefined &&
    snapshot.updatedAt === undefined &&
    snapshot.exitCode === undefined &&
    snapshot.message === undefined
  ) {
    return null;
  }

  return snapshot;
};

const coerceNormalizedTaskSnapshot = (entry: unknown): MigrationJobTaskSnapshot | null => {
  const normalized = coerceTaskSnapshot(entry);
  if (normalized) {
    return normalized;
  }

  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const candidate = entry as Partial<MigrationJobTaskSnapshot>;
  if (
    typeof candidate.taskId !== 'string' &&
    typeof candidate.state !== 'string' &&
    typeof candidate.createdAt !== 'string' &&
    typeof candidate.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    containerId: stringField(candidate.containerId),
    createdAt: stringField(candidate.createdAt),
    desiredState: stringField(candidate.desiredState),
    exitCode: numberField(candidate.exitCode),
    message: stringField(candidate.message),
    nodeId: stringField(candidate.nodeId),
    serviceId: stringField(candidate.serviceId),
    state: stringField(candidate.state),
    taskId: stringField(candidate.taskId),
    updatedAt: stringField(candidate.updatedAt),
  } satisfies MigrationJobTaskSnapshot;
};

export const selectLatestMigrationTask = (value: unknown): MigrationJobTaskSnapshot | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const snapshots = value
    .map(coerceNormalizedTaskSnapshot)
    .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  if (snapshots.length === 0) {
    return null;
  }

  return (
    snapshots.sort((left, right) => {
      const leftTs = Date.parse(left.updatedAt ?? left.createdAt ?? '') || 0;
      const rightTs = Date.parse(right.updatedAt ?? right.createdAt ?? '') || 0;
      return rightTs - leftTs;
    })[0] ?? null
  );
};

export const getMigrationJobTerminalState = (
  task: MigrationJobTaskSnapshot | null
): MigrationTaskTerminalState | null => {
  if (!task) {
    return null;
  }

  const state = normalizeTaskState(task.state);
  const exitCode = task.exitCode;

  if (state === 'complete' || state === 'shutdown') {
    return exitCode === 0 ? 'succeeded' : 'failed';
  }

  if (['failed', 'rejected', 'orphaned', 'remove'].includes(state)) {
    return 'failed';
  }

  if (
    typeof exitCode === 'number' &&
    exitCode !== 0 &&
    [
      'new',
      'allocated',
      'pending',
      'assigned',
      'accepted',
      'preparing',
      'ready',
      'starting',
      'running',
    ].includes(state)
  ) {
    return 'failed';
  }

  return null;
};

export const extractQuantumJsonPayload = (lines: readonly string[]) => {
  const startIndex = lines.findIndex((entry) => entry.startsWith('[') || entry.startsWith('{'));
  if (startIndex === -1) {
    return null;
  }

  const jsonPayload = lines.slice(startIndex).join('\n').trim();
  return jsonPayload.length > 0 ? jsonPayload : null;
};

export const collectQuantumTaskSnapshots = (value: unknown): MigrationJobTaskSnapshot[] => {
  if (Array.isArray(value)) {
    return value
      .map(coerceTaskSnapshot)
      .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidate = value as Record<string, unknown>;
  if (Array.isArray(candidate.tasks)) {
    return candidate.tasks
      .map(coerceTaskSnapshot)
      .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
  }

  const stacks = candidate.stacks;
  if (!stacks || typeof stacks !== 'object') {
    return [];
  }

  return Object.values(stacks as Record<string, unknown>)
    .flatMap((stackEntries) => (Array.isArray(stackEntries) ? stackEntries : []))
    .flatMap((stackEntry) => {
      if (!stackEntry || typeof stackEntry !== 'object') {
        return [];
      }
      const tasks = (stackEntry as Record<string, unknown>).tasks;
      return Array.isArray(tasks) ? tasks : [];
    })
    .map(coerceTaskSnapshot)
    .filter((entry): entry is MigrationJobTaskSnapshot => entry !== null);
};
