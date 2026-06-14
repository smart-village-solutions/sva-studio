export const helpInstancesAdminENResources = {
  sections: {
    what: 'What is this?',
    value: 'What should I enter?',
    source: 'Where does it come from?',
    impact: 'What happens if it is wrong?',
  },
  realmMode: {
    title: 'Realm mode',
    what: 'Defines whether Studio should create a new realm or inspect and reconcile an existing realm.',
    value: 'For production-like tenants, choose "Existing realm" in most cases.',
    source: 'Comes from the tenant operating model and the current state in Keycloak.',
    impact: 'The wrong mode causes provisioning to block or report unexpected drift.',
    defaultHint: 'For existing tenants, "Existing realm" is the default.',
  },
  instanceId: {
    title: 'Instance id',
    what: 'Technical identifier of the instance inside Studio and the registry.',
    value: 'Use a stable lowercase identifier such as "hb-meinquartier".',
    source:
      'Comes from the tenant naming scheme and is often reused in hostnames, mappers, and roles.',
    impact: 'Typos or later changes leak into hostnames, mappers, and automation.',
  },
  displayName: {
    title: 'Display name',
    what: 'Readable name of the instance for administration and UI.',
    value: 'Enter the business-facing tenant name, for example "MeinQuartier".',
    source: 'Comes from the product or tenant name.',
    impact:
      'Usually not a hard technical blocker, but wrong values confuse operations and support.',
  },
  parentDomain: {
    title: 'Parent domain',
    what: 'The shared base domain used to derive the primary hostname of the instance.',
    value: 'Enter the platform domain, for example "studio.smart-village.app".',
    source: 'Comes from the target environment or platform setup.',
    impact:
      'A wrong domain creates wrong hostnames and inconsistent redirect/runtime configuration.',
    defaultHint: 'If possible, the current host domain is suggested automatically.',
  },
  authRealm: {
    title: 'Auth realm',
    what: 'Name of the tenant realm in Keycloak used for issuer derivation and checks.',
    value: 'Enter the exact realm name, for example "saas-hb-meinquartier".',
    source: 'Comes directly from Keycloak.',
    impact:
      'A wrong realm breaks status checks, drift detection, and provisioning against the intended tenant.',
  },
  authClientId: {
    title: 'Auth client id',
    what: 'OIDC client inside the tenant realm that Studio expects for sign-in and reconciliation.',
    value: 'Usually "sva-studio-login", unless the tenant uses a different client id.',
    source: 'Comes from the Keycloak client configuration in the tenant realm.',
    impact: 'A wrong client id causes failed status checks and mismatched client updates.',
    defaultHint: 'Default value is "sva-studio-login".',
  },
  authIssuerUrl: {
    title: 'Auth issuer URL',
    what: 'Explicit issuer URL of the tenant realm. If empty, it is derived from the realm name.',
    value: 'Usually leave it empty or enter the full realm URL.',
    source:
      'Comes from the Keycloak installation or is derived automatically from base URL and realm.',
    impact: 'A wrong issuer breaks token validation and runtime configuration.',
    defaultHint: 'Empty means: derive the issuer automatically from base URL and realm.',
  },
  authClientSecret: {
    title: 'Tenant client secret',
    what: 'Secret of the tenant client that Studio stores encrypted and uses for technical reconciliation.',
    value:
      'For existing realms, enter the current secret of the configured tenant client. For new realms, leave it empty.',
    source:
      'For existing realms, it comes from the client credentials in Keycloak. For new realms, it is generated during provisioning.',
    impact:
      'For existing realms, missing the secret blocks secret checks and parts of provisioning/drift reconciliation. For new realms, it is stored automatically after provisioning.',
  },
  tenantAdminClientId: {
    title: 'Tenant admin client id',
    what: 'OIDC client for tenant-specific administrative and bootstrap operations.',
    value: 'Enter the expected client name, for example "sva-studio-realm-admin".',
    source: 'Comes from the tenant realm in Keycloak or from the intended provisioning contract.',
    impact:
      'Without the correct client id, tenant-specific administration and parts of user management stay blocked.',
    defaultHint: 'If the client does not exist yet, Studio can provision it.',
  },
  tenantAdminClientSecret: {
    title: 'Tenant admin client secret',
    what: 'Secret of the tenant admin client that Studio stores encrypted and uses for administrative operations.',
    value: 'For existing realms, enter the current secret of the tenant admin client.',
    source: 'Comes from the client credentials of the tenant admin client in Keycloak.',
    impact:
      'A missing or wrong secret blocks administrative operations, role management, and reconciliation of the tenant admin client.',
  },
  tenantAdminUsername: {
    title: 'Admin username',
    what: 'Technical username of the tenant admin for bootstrap or reset.',
    value: 'Enter the planned or existing login name of the tenant admin.',
    source: 'Comes from tenant operations or the existing Keycloak setup.',
    impact: 'Without it, provisioning cannot reset or fully verify the admin account.',
  },
  tenantAdminEmail: {
    title: 'Admin email',
    what: 'Contact and login email of the initial tenant admin.',
    value: 'Enter the business-approved email address of the tenant admin.',
    source: 'Comes from the tenant onboarding or operating request.',
    impact: 'A wrong email complicates notifications, login, and recovery.',
  },
  tenantAdminFirstName: {
    title: 'Admin first name',
    what: 'First name of the initial tenant admin.',
    value: 'Enter the desired or existing first name.',
    source: 'Comes from the tenant admin user profile.',
    impact: 'Mostly a data quality detail, but it should stay consistent.',
  },
  tenantAdminLastName: {
    title: 'Admin last name',
    what: 'Last name of the initial tenant admin.',
    value: 'Enter the desired or existing last name.',
    source: 'Comes from the tenant admin user profile.',
    impact: 'Mostly a data quality detail, but it should stay consistent.',
  },
} as const;
