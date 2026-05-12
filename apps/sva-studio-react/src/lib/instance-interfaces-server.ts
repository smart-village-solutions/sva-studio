import type {
  InstanceInterfaceDraft,
  InstanceInterfaceS3,
  InstanceInterfaceSupabase,
} from './instance-interfaces';

type StoredS3 = Omit<InstanceInterfaceS3, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;
type StoredSupabase = Omit<InstanceInterfaceSupabase, 'status' | 'statusMessage' | 'errorCode' | 'lastCheckedAt'>;

type StoredEntry = StoredS3 | StoredSupabase;

const CUSTOM_INTERFACES_NOT_SUPPORTED_ERROR = 'custom_interfaces_not_supported';
const CUSTOM_INTERFACES_UNCHECKED_MESSAGE =
  'Statusprüfung für benutzerdefinierte Schnittstellen ist noch nicht verfügbar.';

export const isCustomInterfaceStorageAvailable = (): boolean => false;

export const listStoredInterfaces = (instanceId: string): readonly StoredEntry[] => {
  void instanceId;
  return [];
};

export const upsertStoredInterface = (
  instanceId: string,
  draft: InstanceInterfaceDraft,
  existingId?: string
): StoredEntry => {
  void instanceId;
  void draft;
  void existingId;
  throw new Error(CUSTOM_INTERFACES_NOT_SUPPORTED_ERROR);
};

export const deleteStoredInterface = (instanceId: string, id: string): boolean => {
  void instanceId;
  void id;
  return false;
};

export const getStoredInterface = (instanceId: string, id: string): StoredEntry | null => {
  void instanceId;
  void id;
  return null;
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
    return {
      status: 'unknown',
      statusMessage: CUSTOM_INTERFACES_UNCHECKED_MESSAGE,
      checkedAt,
    };
  }
  if (entry.type === 'supabase') {
    if (!entry.config.projectUrl) {
      return {
        status: 'error',
        statusMessage: 'Supabase-Konfiguration unvollständig (Project URL erforderlich).',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: CUSTOM_INTERFACES_UNCHECKED_MESSAGE,
      checkedAt,
    };
  }
  return {
    status: 'unknown',
    statusMessage: CUSTOM_INTERFACES_UNCHECKED_MESSAGE,
    checkedAt,
  };
};
