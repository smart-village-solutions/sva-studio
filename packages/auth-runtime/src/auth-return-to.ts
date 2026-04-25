import { classifyHost, isTrafficEnabledInstanceStatus } from '@sva/core';
import { loadInstanceByHostname } from '@sva/data-repositories/server';
import { getInstanceConfig, isCanonicalAuthHost } from '@sva/server-runtime';

import { resolveEffectiveRequestHost } from './request-hosts.js';

const normalizeDefaultReturnTo = (value: string | undefined): string => value ?? '/';
const isLocalHttpHost = (hostname: string): boolean => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const isTrustedAbsoluteReturnTo = async (target: URL): Promise<boolean> => {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return false;
  }
  if (target.protocol === 'http:' && !isLocalHttpHost(target.hostname)) {
    return false;
  }

  if (target.pathname === '/auth' || target.pathname.startsWith('/auth/')) {
    return false;
  }

  const config = getInstanceConfig();
  if (!config) {
    return false;
  }

  if (isCanonicalAuthHost(target.host)) {
    return true;
  }

  const classification = classifyHost(target.host, config.parentDomain);
  if (classification.kind !== 'tenant') {
    return false;
  }

  const registryEntry = await loadInstanceByHostname(target.host).catch(() => null);
  return registryEntry ? isTrafficEnabledInstanceStatus(registryEntry.status) : false;
};

export const sanitizeAuthReturnTo = async (
  _request: Request,
  value: string | null | undefined,
  options: { defaultPath?: string } = {}
): Promise<string> => {
  const defaultPath = normalizeDefaultReturnTo(options.defaultPath);
  if (!value) {
    return defaultPath;
  }

  if (value.startsWith('/')) {
    if (value.startsWith('//') || value === '/auth' || value.startsWith('/auth?') || value.startsWith('/auth/')) {
      return defaultPath;
    }
    return value;
  }

  try {
    const target = new URL(value);
    return (await isTrustedAbsoluteReturnTo(target)) ? target.toString() : defaultPath;
  } catch {
    return defaultPath;
  }
};

export const resolveAuthRequestHost = (request: Request): string => resolveEffectiveRequestHost(request);
