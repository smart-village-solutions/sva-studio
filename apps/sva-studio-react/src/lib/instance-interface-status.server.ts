import type {
  PersistedStoredEntry,
  StoredEntry,
} from './instance-interface-record-mapping.server.js';
import type { ExternalInterfaceVisibleStatus } from '@sva/core';
import { nowIso } from './instance-interface-record-mapping.server.js';

export type InterfaceHealthResult = Readonly<{
  status: 'connected' | 'error' | 'disabled' | 'unknown';
  statusMessage?: string;
  errorCode?: string;
  checkedAt: string;
}>;

const mapVisibleStatusToHealth = (
  visibleStatus: ExternalInterfaceVisibleStatus | undefined
): InterfaceHealthResult['status'] => {
  switch (visibleStatus) {
    case 'disabled':
      return 'disabled';
    case 'ok':
      return 'connected';
    case 'error':
    case 'not_configured':
      return 'error';
    default:
      return 'unknown';
  }
};

export const checkStoredInterfaceHealth = (entry: StoredEntry): InterfaceHealthResult => {
  const persistedEntry = entry as PersistedStoredEntry;
  const checkedAt = persistedEntry.lastCheckedAt ?? nowIso();

  if (!entry.enabled) {
    return {
      status: 'disabled',
      checkedAt,
      ...(persistedEntry.lastCheckErrorMessage
        ? { statusMessage: persistedEntry.lastCheckErrorMessage }
        : {}),
      ...(persistedEntry.lastCheckErrorCode
        ? { errorCode: persistedEntry.lastCheckErrorCode }
        : {}),
    };
  }

  if (persistedEntry.visibleStatus) {
    return {
      status: mapVisibleStatusToHealth(persistedEntry.visibleStatus),
      checkedAt,
      ...(persistedEntry.lastCheckErrorMessage
        ? { statusMessage: persistedEntry.lastCheckErrorMessage }
        : {}),
      ...(persistedEntry.lastCheckErrorCode
        ? { errorCode: persistedEntry.lastCheckErrorCode }
        : {}),
    };
  }

  if (entry.type === 's3') {
    if (!entry.config.endpoint || !entry.config.bucket || !entry.config.accessKeyId) {
      return {
        status: 'error',
        statusMessage:
          'S3-Konfiguration unvollständig (Endpoint, Bucket, Access Key erforderlich).',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'S3-Verbindungsprüfung ausstehend.',
      checkedAt,
    };
  }

  if (entry.type === 'mailTransport') {
    if (!entry.config.transportId) {
      return {
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (Transport-ID erforderlich).',
        checkedAt,
      };
    }
    if (!entry.config.host || !entry.config.port) {
      return {
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (SMTP-Host und Port erforderlich).',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'Statusprüfung für Mail-Transporte ist noch nicht verfügbar.',
      checkedAt,
    };
  }

  if (entry.type === 'mapGeocoding') {
    if (!entry.config.styleUrl) {
      return {
        status: 'error',
        statusMessage: 'Karten-/Geocoding-Konfiguration unvollständig (Style-URL erforderlich).',
        checkedAt,
      };
    }
    if (entry.config.killSwitchEnabled) {
      return {
        status: 'disabled',
        statusMessage: 'Karten-/Geocoding-Schnittstelle wurde per Kill-Switch deaktiviert.',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      statusMessage: 'Statusprüfung für Karten-/Geocoding-Schnittstellen ist noch nicht verfügbar.',
      checkedAt,
    };
  }

  if (entry.type === 'postgresql') {
    if (!entry.config.databaseUrl) {
      return {
        status: 'error',
        checkedAt,
      };
    }
    return {
      status: 'unknown',
      checkedAt,
    };
  }

  if (!entry.config.projectUrl) {
    return {
      status: 'error',
      statusMessage: 'Supabase-Konfiguration unvollständig (Project URL erforderlich).',
      checkedAt,
    };
  }

  if (!entry.config.databaseUrl && !('serviceRoleKey' in entry.config)) {
    return {
      status: 'error',
      statusMessage:
        'Supabase-Konfiguration unvollständig (Direkte DB-URL und Service-Role-Key erforderlich).',
      checkedAt,
    };
  }

  if (!entry.config.databaseUrl) {
    return {
      status: 'error',
      statusMessage: 'Supabase-Konfiguration unvollständig (Direkte DB-URL erforderlich).',
      checkedAt,
    };
  }

  return {
    status: 'unknown',
    statusMessage: 'Statusprüfung für benutzerdefinierte Schnittstellen ist noch nicht verfügbar.',
    checkedAt,
  };
};
