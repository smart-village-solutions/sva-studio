import fs from 'node:fs';
import * as shared from '/app/node_modules/@sva/auth/dist/iam-account-management/shared.js';

const raw = fs.readFileSync('/proc/1/environ', 'utf8');
const vars = Object.fromEntries(
  raw
    .split('\0')
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf('=');
      return [entry.slice(0, idx), entry.slice(idx + 1)];
    })
);

if (vars.IAM_DATABASE_URL) {
  process.env.IAM_DATABASE_URL = vars.IAM_DATABASE_URL;
}

const tests = [
  [
    'env',
    async () => ({
      hasIamDb: Boolean(process.env.IAM_DATABASE_URL),
      appDbUser: vars.APP_DB_USER ?? null,
    }),
  ],
  [
    'org_context',
    async () =>
      shared.withInstanceScopedDb('hb-meinquartier', (client) =>
        client.query(
          `select organization.id
           from iam.account_organizations membership
           join iam.organizations organization
             on organization.instance_id = membership.instance_id
            and organization.id = membership.organization_id
           order by membership.is_default_context desc, organization.depth asc, organization.display_name asc
           limit 1`
        )
      ),
  ],
  [
    'roles',
    async () =>
      shared.withInstanceScopedDb('hb-meinquartier', (client) =>
        client.query(
          `select r.id
           from iam.roles r
           left join iam.role_permissions rp
             on rp.instance_id = r.instance_id
            and rp.role_id = r.id
           left join iam.permissions p
             on p.instance_id = rp.instance_id
            and p.id = rp.permission_id
           order by r.role_level desc, coalesce(r.display_name, r.role_name) asc
           limit 1`
        )
      ),
  ],
];

for (const [name, fn] of tests) {
  try {
    const result = await fn();
    console.log(`RESULT_OK:${name}:${JSON.stringify(result.rows?.[0] ?? result)}`);
  } catch (error) {
    console.log(`RESULT_ERR:${name}:${error instanceof Error ? error.message : String(error)}`);
  }
}
