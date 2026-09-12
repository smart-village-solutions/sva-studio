import { open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import { isReservedTenantHostname, isValidInstanceId } from '@sva/core';

const KASSEL_PARENT_DOMAIN = 'dialog.kassel.de';
const KASSEL_PARENT_LABELS = KASSEL_PARENT_DOMAIN.split('.');
const DOCKER_SERVICE_REFERENCE = /^[a-zA-Z0-9_-]+@docker$/;

export type KasselTenantIngressInput = {
  readonly instanceId: string;
  readonly hostname: string;
  readonly service: string;
};

export type KasselTenantIngress = {
  readonly filename: string;
  readonly hostname: string;
  readonly routerName: string;
  readonly source: string;
};

const normalizeKasselHostname = (hostname: string): string => {
  const lowercase = hostname.toLowerCase();
  let end = lowercase.length;
  while (end > 0 && lowercase[end - 1] === '.') {
    end -= 1;
  }
  return lowercase.slice(0, end);
};

const resolveTenantLabel = (hostname: string): string => {
  const suffix = `.${KASSEL_PARENT_DOMAIN}`;
  if (!hostname.endsWith(suffix)) {
    throw new Error('tenant_ingress_hostname_outside_parent_domain');
  }

  const labels = hostname.split('.');
  if (labels.length !== KASSEL_PARENT_LABELS.length + 1) {
    throw new Error('tenant_ingress_hostname_invalid_label_count');
  }

  const tenantLabel = labels[0] ?? '';
  if (tenantLabel.startsWith('xn--')) {
    throw new Error('tenant_ingress_hostname_punycode_rejected');
  }
  if (!isValidInstanceId(tenantLabel)) {
    throw new Error('tenant_ingress_hostname_invalid_label');
  }
  if (isReservedTenantHostname(tenantLabel)) {
    throw new Error('tenant_ingress_hostname_reserved');
  }
  return tenantLabel;
};

export const buildKasselTenantIngress = (input: KasselTenantIngressInput): KasselTenantIngress => {
  const hostname = normalizeKasselHostname(input.hostname);
  const tenantLabel = resolveTenantLabel(hostname);
  if (!isValidInstanceId(input.instanceId) || input.instanceId !== tenantLabel) {
    throw new Error('tenant_ingress_instance_hostname_mismatch');
  }
  if (!DOCKER_SERVICE_REFERENCE.test(input.service)) {
    throw new Error('tenant_ingress_service_invalid');
  }

  const routerName = `studio-tenant-${tenantLabel}`;
  const source = [
    'http:',
    '  routers:',
    `    ${routerName}:`,
    `      rule: "Host(\`${hostname}\`) && !PathPrefix(\`/internal/\`)"`,
    '      entryPoints:',
    '        - websecure',
    '      priority: 200',
    `      service: "${input.service}"`,
    '      tls:',
    '        certResolver: le',
    '',
  ].join('\n');

  return {
    filename: `${routerName}.yml`,
    hostname,
    routerName,
    source,
  };
};

export const publishKasselTenantIngress = async (
  input: KasselTenantIngressInput & { readonly directory: string }
): Promise<KasselTenantIngress & { readonly path: string }> => {
  const rendered = buildKasselTenantIngress(input);
  const targetPath = join(input.directory, rendered.filename);
  const temporaryPath = join(input.directory, `.${rendered.filename}.${randomUUID()}.tmp`);

  let temporaryExists = false;
  try {
    const handle = await open(temporaryPath, 'wx', 0o600);
    temporaryExists = true;
    try {
      await handle.writeFile(rendered.source, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, targetPath);
    temporaryExists = false;
  } finally {
    if (temporaryExists) {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }

  return { ...rendered, path: targetPath };
};
