import type {
  InstanceInterfaceDraft,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
  InstanceInterfaceType,
} from './instance-interfaces';

type StoredS3 = Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;
type StoredSupabase = Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;

type StoredEntry = StoredS3 | StoredSupabase;

type SecretMap = Record<string, string>;

type GlobalStore = {
  entries: Map<string, StoredEntry>;
  secrets: Map<string, SecretMap>;
};

const STORE_GLOBAL_KEY = '__SVA_INSTANCE_INTERFACES_STORE__';

const getStore = (): GlobalStore => {
  const root = globalThis as unknown as Record<string, unknown>;
  const existing = root[STORE_GLOBAL_KEY] as GlobalStore | undefined;
  if (existing) {
    return existing;
  }
  const created: GlobalStore = { entries: new Map(), secrets: new Map() };
  root[STORE_GLOBAL_KEY] = created;
  return created;
};

const generateId = (type: InstanceInterfaceType): string =>
  `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const buildEntry = (
  instanceId: string,
  draft: InstanceInterfaceDraft,
  existing?: StoredEntry
): { entry: StoredEntry; secrets: SecretMap } => {
  const id = existing?.id ?? generateId(draft.type);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt ?? now;

  if (draft.type === 's3') {
    const entry: StoredS3 = {
      id,
      instanceId,
      type: 's3',
      name: draft.name,
      enabled: draft.enabled,
      config: {
        endpoint: draft.config.endpoint,
        region: draft.config.region,
        bucket: draft.config.bucket,
        accessKeyId: draft.config.accessKeyId,
        forcePathStyle: draft.config.forcePathStyle,
      },
      createdAt,
      updatedAt: now,
    };
    return { entry, secrets: { secretAccessKey: draft.config.secretAccessKey } };
  }

  if (draft.type === 'supabase') {
    const entry: StoredSupabase = {
      id,
      instanceId,
      type: 'supabase',
      name: draft.name,
      enabled: draft.enabled,
      config: {
        projectUrl: draft.config.projectUrl,
        schemaName: draft.config.schemaName,
        databaseUrl: draft.config.databaseUrl,
      },
      createdAt,
      updatedAt: now,
    };
    return { entry, secrets: { serviceRoleKey: draft.config.serviceRoleKey } };
  }

  throw new Error(`unsupported_interface_type:${draft.type}`);
};

export const listStoredInterfaces = (instanceId: string): readonly StoredEntry[] => {
  const store = getStore();
  return Array.from(store.entries.values()).filter((entry) => entry.instanceId === instanceId);
};

export const upsertStoredInterface = (
  instanceId: string,
  draft: InstanceInterfaceDraft,
  existingId?: string
): StoredEntry => {
  if (draft.type === 'mainserver') {
    throw new Error('mainserver_interfaces_are_managed_through_existing_endpoint');
  }
  const store = getStore();
  const existing = existingId ? store.entries.get(existingId) : undefined;
  if (existingId && !existing) {
    throw new Error('interface_not_found');
  }
  if (existing && existing.instanceId !== instanceId) {
    throw new Error('interface_instance_mismatch');
  }
  if (existing && existing.type !== draft.type) {
    throw new Error('interface_type_change_not_supported');
  }
  const { entry, secrets } = buildEntry(instanceId, draft, existing);
  store.entries.set(entry.id, entry);
  store.secrets.set(entry.id, secrets);
  return entry;
};

export const deleteStoredInterface = (instanceId: string, id: string): boolean => {
  const store = getStore();
  const existing = store.entries.get(id);
  if (!existing || existing.instanceId !== instanceId) {
    return false;
  }
  store.entries.delete(id);
  store.secrets.delete(id);
  return true;
};

export const getStoredInterface = (instanceId: string, id: string): StoredEntry | null => {
  const store = getStore();
  const entry = store.entries.get(id);
  return entry && entry.instanceId === instanceId ? entry : null;
};

export type InterfaceHealthResult = Readonly<{
  status: 'connected' | 'error' | 'disabled' | 'unknown';
  statusMessage?: string;
  checkedAt: string;
}>;

export const checkStoredInterfaceHealth = (
  entry: StoredEntry
): InterfaceHealthResult => {
  const checkedAt = new Date().toISOString();
  if (!entry.enabled) {
    return { status: 'disabled', checkedAt };
  }
  if (entry.type === 's3') {
    if (!entry.config.endpoint || !entry.config.bucket || !entry.config.accessKeyId) {
      return {
        status: 'error',
        statusMessage: 'S3-Konfiguration unvollständig (Endpoint, Bucket, Access Key erforderlich).',
        checkedAt,
      };
    }
    return { status: 'unknown', checkedAt };
  }
  if (entry.type === 'supabase') {
    if (!entry.config.projectUrl) {
      return {
        status: 'error',
        statusMessage: 'Supabase-Konfiguration unvollständig (Project URL erforderlich).',
        checkedAt,
      };
    }
    return { status: 'unknown', checkedAt };
  }
  return { status: 'unknown', checkedAt };
};
