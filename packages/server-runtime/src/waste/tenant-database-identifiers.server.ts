import { createHash } from 'node:crypto';

const identifierPattern = /^[a-z][a-z0-9_]{0,62}$/u;

export type WasteTenantDatabaseNames = Readonly<{
  database: string;
  ownerRole: string;
  migratorRole: string;
  appRole: string;
  publicAppRole: string;
}>;

export const deriveWasteTenantDatabaseNames = (instanceId: string): WasteTenantDatabaseNames => {
  const normalized = instanceId
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '') || 'tenant';
  const safeSlug = /^[a-z]/u.test(normalized) ? normalized : `t_${normalized}`;
  const hash = createHash('sha256').update(instanceId).digest('hex').slice(0, 12);
  const base = `sva_w_${safeSlug.slice(0, 25)}_${hash}`;
  const names = {
    database: `${base}_db`,
    ownerRole: `${base}_owner`,
    migratorRole: `${base}_migrator`,
    appRole: `${base}_app`,
    publicAppRole: `${base}_public`,
  } as const;
  if (Object.values(names).some((name) => !identifierPattern.test(name))) {
    throw new Error('waste_tenant_identifier_invalid');
  }
  return names;
};
