/**
 * Instance-Konfiguration für Multi-Host-Betrieb.
 *
 * Validiert beim ersten Zugriff die Allowlist und Parent-Domain
 * und stellt Hilfsfunktionen für Host-Parsing bereit.
 *
 * Fail-fast: Ungültige Allowlist-Einträge oder fehlende Parent-Domain
 * führen zu einem sofortigen Fehler beim App-Start.
 */

import { createSdkLogger } from '../logger/index.server';

const INSTANCE_ID_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PUNYCODE_PREFIX = 'xn--';
const logger = createSdkLogger({
  component: 'instance-config',
  level: 'info',
  enableConsole: true,
  enableOtel: false,
});

export interface InstanceConfig {
  readonly parentDomain: string;
  readonly allowedInstanceIds: ReadonlySet<string>;
  readonly canonicalAuthHost: string;
}

let cachedConfig: InstanceConfig | null | undefined;

/**
 * Lädt und validiert die Instance-Konfiguration.
 *
 * Gibt `null` zurück, wenn `SVA_PARENT_DOMAIN` nicht gesetzt ist
 * (z. B. in lokaler Entwicklung ohne Multi-Host-Betrieb).
 *
 * Wirft einen Fehler, wenn die Allowlist ungültige Einträge enthält.
 */
export function getInstanceConfig(): InstanceConfig | null {
  if (cachedConfig !== undefined) return cachedConfig;
  cachedConfig = loadAndValidateInstanceConfig();
  return cachedConfig;
}

/**
 * Setzt den Cache zurück (nur für Tests).
 */
export function resetInstanceConfigCache(): void {
  cachedConfig = undefined;
}

function loadAndValidateInstanceConfig(): InstanceConfig | null {
  const parentDomain = process.env['SVA_PARENT_DOMAIN'];
  if (!parentDomain) {
    return null;
  }

  const allowlistRaw = process.env['SVA_ALLOWED_INSTANCE_IDS'] ?? '';
  const ids = allowlistRaw
    ? allowlistRaw.split(',').filter(Boolean)
    : [];

  for (const id of ids) {
    if (id.startsWith(PUNYCODE_PREFIX)) {
      throwInvalidInstanceId(
        id,
        'IDN/Punycode-Labels (xn--) sind nicht erlaubt.'
      );
    }
    if (!INSTANCE_ID_REGEX.test(id)) {
      throwInvalidInstanceId(id, `Erlaubtes Muster: ${INSTANCE_ID_REGEX.source}`);
    }
  }

  return {
    parentDomain: parentDomain.toLowerCase(),
    allowedInstanceIds: new Set(ids),
    canonicalAuthHost: parentDomain.toLowerCase(),
  };
}

/**
 * Extrahiert die instanceId aus einem eingehenden Host-Header.
 *
 * Gibt die instanceId zurück, wenn der Host ein gültiger Instanz-Host ist.
 * Gibt `null` zurück bei: Root-Domain, fremder Domain, ungültigem Format,
 * nicht in Allowlist, mehrstufigen Subdomains, IDN/Punycode.
 */
export function parseInstanceIdFromHost(host: string): string | null {
  const config = getInstanceConfig();
  if (!config) return null;

  const normalized = normalizeHost(host);

  if (normalized === config.parentDomain) {
    return null;
  }

  const suffix = `.${config.parentDomain}`;
  if (!normalized.endsWith(suffix)) {
    return null;
  }

  const subdomain = normalized.slice(0, -suffix.length);

  if (subdomain.includes('.')) {
    return null;
  }

  if (subdomain.startsWith(PUNYCODE_PREFIX)) {
    return null;
  }

  if (!INSTANCE_ID_REGEX.test(subdomain)) {
    return null;
  }

  if (!config.allowedInstanceIds.has(subdomain)) {
    return null;
  }

  return subdomain;
}

/**
 * Prüft, ob der gegebene Host der kanonische Auth-Host ist.
 */
export function isCanonicalAuthHost(host: string): boolean {
  const config = getInstanceConfig();
  if (!config) return true;
  const normalized = normalizeHost(host);
  return normalized === config.canonicalAuthHost;
}

function throwInvalidInstanceId(id: string, reason: string): never {
  logger.error('Ungueltige instanceId in Allowlist', {
    invalid_instance_id: id,
    reason,
  });
  throw new Error(`[InstanceConfig] Ungültige instanceId "${id}": ${reason}`);
}

function normalizeHost(host: string): string {
  const hostWithoutPort = host.toLowerCase().split(':')[0] ?? '';
  return hostWithoutPort.replace(/\.+$/, '');
}
