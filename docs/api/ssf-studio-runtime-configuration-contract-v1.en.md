# Studio–SSF Runtime Configuration Contract V1

## Status and purpose

This document is the English translation of the functionally approved contract
for the initial exchange of data between SVA Studio and Smart Speech Flow
(SSF). It provides a shared integration baseline for both applications. The
[German version](./ssf-studio-runtime-konfigurationsvertrag-v1.md) remains the
authoritative repository document if the translations diverge.

The normative implementation plan is maintained in the OpenSpec change
`add-ssf-runtime-configuration-api`.

The IAM and runtime boundary is established by
[ADR-057](../adr/ADR-057-ssf-service-token-und-runtime-konfigurationsgrenze.md).

The corresponding target boundaries are anchored in arc42 sections 3 through 8. The two-stage authentication contract from an older parallel SSF
control-plane draft has been superseded by the simple service-token contract
defined here.

V1 covers:

- mapping a Studio instance to an SSF tenant,
- the Keycloak claims relevant to SSF for administrative users,
- internal retrieval of the effective runtime configuration,
- branding, languages, and tenant-specific explanatory content,
- control over the storage and processing of conversation content.

The first implementation slice lives in `packages/plugin-ssf/`. It contains
the fixed Zod and OpenAPI schemas, product defaults, resolver, HTML policy,
JCS revisions, domain read handler, migrations, and repositories for the
separate SSF plugin database. The generic service-token verifier lives in
`packages/auth-runtime/src/service-token.ts`; SSF-specific claim validation is
implemented in `packages/auth-runtime/src/ssf-runtime-service-token.ts`.
Production routing remains disabled by default until the pending plugin
platform change supplies a service access type and the verified
`authorizationRevision`.

Analytics, conversation data, ClickHouse, support access, and an SSF-owned
tenant administration capability are outside the scope of V1.

## System and data ownership

One Studio installation runs alongside exactly one SSF installation. One
Studio instance corresponds to exactly one SSF tenant. SSF intentionally
depends on that Studio installation and does not maintain its own tenant
registry.

| Responsible component | Authoritative data and responsibilities                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Studio Core           | canonical `instanceId`, tenant name, time zone, Keycloak provisioning, users, IAM, media management, plugin activation, readiness, and audit |
| SSF plugin in Studio  | server-wide and tenant-specific SSF configuration, policies, texts, languages, and resolution of the effective runtime configuration         |
| SSF                   | authentication and sessions, guests, conversation flow, and later runtime, session, and conversation data                                    |
| SSF Keycloak          | authenticated user identities and signed tenant, role, and permission claims                                                                 |

Studio and SSF do not share an application database and do not access each
other's persistence directly. SSF does not maintain a persistent cache of the
Studio configuration.

## Roles and identities

The SSF domain model uses the following names:

| Technical value | English label        | Scope                             |
| --------------- | -------------------- | --------------------------------- |
| `system_admin`  | System administrator | entire SSF installation           |
| `tenant_admin`  | Tenant administrator | exactly one tenant                |
| `user`          | User                 | operational use within one tenant |
| `guest`         | Guest                | one specific SSF session          |

These values are SSF personas, not renamed canonical Studio IAM roles. The
initial integration uses this fixed mapping:

| Studio IAM source                        | SSF persona or token value | Meaning                                                             |
| ---------------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| root role `instance_registry_admin`      | `system_admin`             | system-wide SSF administration; never materialized in tenant tokens |
| tenant-local default role `system_admin` | `tenant_admin`             | administration of exactly the active tenant                         |
| tenant-local operational SSF role        | `user`                     | conversation use according to effective `ssf.*` permissions         |
| validated SSF guest session              | `guest`                    | session-bound use without a Studio or regular Keycloak account      |

ADR-046 remains authoritative for Studio: `instance_registry_admin` is the
root role and Studio `system_admin` remains tenant-local. The SSF
`system_admin` persona is created only at this integration boundary. A custom
tenant role requires no special persona value to exercise SSF actions; only
its effective permissions are authoritative.

During a transition period, the existing values `admin` and `customer` are
accepted as aliases for `user` and `guest`. Newly issued or materialized roles
use only the new values.

SSF system administrators are represented by `instance_registry_admin` in the
Studio root context and do not appear in tenant tokens. `system_admin` and
`tenant_admin` are SSF personas and default roles, not direct authorization
inputs. Server-side decisions use only fully qualified `ssf.*` actions. Custom
roles can therefore receive the same rights without special-casing a role
name. A tenant administrator does not
automatically receive operational conversation permissions. If the same person
also uses SSF operationally, that person additionally receives the `user` role
and the corresponding operational `ssf.*` permissions.

Guests remain entirely within the existing SSF session model. They receive
neither a Studio account nor a regular Keycloak account. Guest tokens, session
IDs, and conversation data are not transferred to Studio.

## Keycloak contract for tenant users

The canonical Studio `instanceId` is the shared technical tenant identifier.
It is materialized as a signed claim when the realm and clients are
provisioned.

In addition to the standard OIDC claims, an SSF tenant token contains at least:

```json
{
  "sub": "keycloak-user-id",
  "studio_instance_id": "01J...",
  "ssf_roles": ["tenant_admin"],
  "ssf_permissions": ["ssf.configuration.tenant.read", "ssf.configuration.tenant.manage"],
  "ssf_authorization_revision": "sha256:...",
  "preferred_username": "erika",
  "name": "Erika Muster",
  "locale": "de-DE"
}
```

`ssf_permissions` is the authoritative basis for server-side authorization in
SSF. `ssf_roles` supports domain classification, navigation, and auditing. An
email address is not part of the SSF token contract.

Studio IAM remains the authoritative source of effective `ssf.*` permissions.
A dedicated SSF projection run materializes only these effective permissions,
the SSF personas, and a tenant-wide `ssf_authorization_revision` into the
client scope of the separate SSF Keycloak. The projection evaluates default
and custom roles equally; raw Studio role names are not used for SSF
authorization.

Before a relevant role, assignment, or permission change, Studio marks the
tenant's SSF IAM projection as not ready and disables token issuance for the
affected tenant client. It then reconciles and verifies the projection and
revision and revokes affected sessions. Only after successful verification is
the client enabled with the new revision. A failure keeps both client and
runtime configuration fail-closed in `ssf_tenant_not_ready`; SSF rejects a
missing or stale revision claim. A failed projection can therefore neither
preserve stale rights nor silently omit valid custom-role grants.

SSF access tokens have a default lifetime of five minutes and must not be
valid for more than ten minutes. When a user is disabled or a critical role
change occurs, Studio additionally revokes that user's Keycloak sessions.
Long-lived WebSocket connections must reauthenticate or terminate no later than
the token's expiration.

## Runtime flow

```text
Studio provisions the instance, realm, users, and SSF plugin data
  -> a user signs in through Keycloak or a guest uses an SSF session
  -> SSF derives the canonical studio_instance_id from the validated context
  -> SSF calls the Studio API using its technical service identity
  -> Studio validates service token, tenant, activation, and readiness
  -> the SSF plugin resolves the effective configuration
  -> SSF renders the configuration for the current operation
```

SSF does not persist the response. If Studio or the SSF plugin is unavailable,
the affected SSF operation may fail with a technical error. No additional
synchronization or persistent cache is planned.

## Internal runtime endpoint

### Request

```http
GET /internal/plugins/ssf/v1/runtime-configuration
Authorization: Bearer <keycloak-service-token>
X-Studio-Instance-Id: <instance-id-from-validated-SSF-context>
X-Correlation-Id: <correlation-id>
```

The endpoint is reachable only from the internal network. The installation-
wide SSF service token must contain the required audience and the
`ssf.runtime-configuration.read` permission. Studio trusts the tenant header
only as a statement made by the authenticated SSF backend; direct browser
requests are not permitted.

This read-only, idempotent contract does not require an additional tenant
assertion, a second signing key, or replay storage.

### Successful response

```json
{
  "contractVersion": "1.0",
  "configurationRevision": "sha256:...",
  "authorizationRevision": "sha256:...",
  "tenant": {
    "id": "01J...",
    "displayName": "Example Municipality",
    "timeZone": "Europe/Berlin"
  },
  "branding": {
    "logo": {
      "url": "https://example.org/logo.png",
      "alternativeText": "Logo of Example Municipality"
    },
    "icon": {
      "url": "https://example.org/icon.png",
      "alternativeText": "Icon of Example Municipality"
    }
  },
  "localization": {
    "defaultLocale": "de-DE",
    "locales": [
      {
        "locale": "de-DE",
        "authenticatedHomeExplanationHtml": "<p>...</p>",
        "guestExplanationHtml": "<p>...</p>",
        "conversationContentStorageQuestionHtml": "<p>...</p>"
      }
    ]
  },
  "conversationContentStorage": {
    "mode": "ask"
  }
}
```

`branding.logo` and `branding.icon` may each be `null`. When
`conversationContentStorage.mode = "disabled"`,
`conversationContentStorageQuestionHtml` is `null` for every locale.

`configurationRevision` is an opaque content fingerprint of the canonically
serialized effective V1 configuration, excluding both revision fields. A
change to an effective tenant override, an effective server-wide value, or a
product default effective in the resolved result automatically changes the
revision. Changing a stored value that is ineffective because of a policy or a
higher-precedence value does not change the runtime response or its revision.

`authorizationRevision` is the currently verified tenant-wide revision of the
SSF IAM projection. For authenticated operations it must exactly match the
`ssf_authorization_revision` claim. Guests do not carry this claim and do not
perform this comparison.

## Resolving the effective configuration

The following precedence applies independently to every field and locale:

```text
tenant customization
  ?? server-wide customization
  ?? SSF product default shipped with the software version
```

Product defaults are shipped exclusively as a versioned part of the SSF
plugin. They are agreed with the SSF product but their canonical runtime copy
resides in the plugin, and they are not copied into the database for every
tenant. The runtime API returns only the fully resolved result. SSF does not
know the origin of a value, receive administrative policy fields, or resolve a
second default layer.

`tenant.displayName` and `tenant.timeZone` come from the generic Studio
instance profile. Generic tenant branding from Studio media management is
reused when permitted by the SSF policy.

## Languages and texts

New tenants initially enable all languages available for the installation. A
tenant administrator may disable and re-enable languages. At least one
language must remain enabled, and `defaultLocale` must be present in
`localization.locales`. Existing overrides remain stored when a language is
disabled.

For each enabled locale, V1 returns exactly these fields:

- `authenticatedHomeExplanationHtml`: explanatory content shown after sign-in,
- `guestExplanationHtml`: explanatory content for guests,
- `conversationContentStorageQuestionHtml`: the question about storing and
  processing conversation content, or `null` when storage is disabled.

Tenants override each text independently for each locale. Fields without a
tenant override continue to inherit the respective server-wide value or
product default.

The HTML fields may contain external images and additional semantic HTML
elements. The editor may initially restrict its authoring features, but the API
contract does not define a small, rigid tag list. Studio removes directly
active or executable content such as scripts, event handlers, and dangerous
URL schemes. External images require neither a domain allowlist nor a mandatory
proxy; their use is the responsibility of the administrator editing the
content. Before publication, the responsible tenant must ensure that the
external inclusion is lawful and that affected users and guests receive any
required information.

## Branding and storage policies

System administrators manage the following policies for each tenant:

- `customBrandingAllowed`,
- `conversationContentStorageAllowed`.

Tenant administrators may change the logo and icon only when
`customBrandingAllowed` is enabled. If a system administrator withdraws this
permission, the tenant selection remains stored but is no longer effective.

Tenant administrators select the desired conversation-content mode:

- `ask`: SSF displays the localized question; storage and processing are
  permitted only after consent.
- `disabled`: SSF does not ask the question and must neither store nor
  subsequently process conversation content.

When `conversationContentStorageAllowed` is disabled, the effective mode is
always `disabled`. A different tenant selection remains stored but has no
effect.

## Write permissions in Studio

| Action                                        | Scope                   | Default grant        | Permitted changes                                                                                                 |
| --------------------------------------------- | ----------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `ssf.configuration.server.manage`             | entire SSF installation | System administrator | server-wide SSF values                                                                                            |
| `ssf.configuration.tenant-policy.manage`      | selected tenant         | System administrator | tenant-specific branding and storage policies                                                                     |
| `ssf.configuration.tenant.inspect`            | selected tenant         | System administrator | effective configuration from the root context                                                                     |
| `ssf.configuration.tenant.provenance.inspect` | selected tenant         | System administrator | origins of resolved values from the root context                                                                  |
| `ssf.configuration.tenant.read`               | active tenant           | Tenant administrator | effective configuration in the tenant context                                                                     |
| `ssf.configuration.tenant.manage`             | active tenant           | Tenant administrator | enabled languages, default locale, individual text overrides, desired storage mode, and permitted tenant branding |

The platform actions `ssf.configuration.server.manage` and
`ssf.configuration.tenant-policy.manage`, together with the root grants for
`ssf.configuration.tenant.inspect` and
`ssf.configuration.tenant.provenance.inspect`, are registered as a separate
platform-scoped plugin contribution and granted to `instance_registry_admin`
by default. They appear neither in the tenant catalog nor in SSF tenant tokens.

The tenant-scoped actions `ssf.configuration.tenant.read` and
`ssf.configuration.tenant.manage` use the regular tenant permission catalog and
are granted by default to the tenant-local Studio `system_admin` role, which is
represented as `tenant_admin` at the SSF boundary. Custom roles may receive the
same actions; the runtime never checks only the role name. Users and guests
have no configuration action by default.

Value origins are returned only with the platform action
`ssf.configuration.tenant.provenance.inspect`. System administrators may
inspect effective tenant configurations and their origins, but they may not
modify tenant-owned overrides during normal operation. A future support-access
capability requires a separate, time-limited, audited contract.

## Effect of changes

A successfully saved change becomes active immediately. There is no draft or
publication state.

- Normal text, language, and branding changes appear on the next page request
  or when a new session starts.
- An already active session retains the presentation it loaded initially.
- Tenant suspension, plugin deactivation, and an effective prohibition of
  conversation storage are considered by subsequent protected operations.

## Error contract

Errors use a stable machine-readable structure:

```json
{
  "contractVersion": "1.0",
  "error": {
    "code": "tenant_suspended",
    "message": "Runtime configuration is unavailable.",
    "retryable": false,
    "correlationId": "01J..."
  }
}
```

| HTTP status | Example error codes                                               |
| ----------- | ----------------------------------------------------------------- |
| `401`       | `service_authentication_invalid`                                  |
| `403`       | `service_action_forbidden`                                        |
| `404`       | `tenant_not_found`                                                |
| `409`       | `tenant_suspended`, `ssf_plugin_inactive`, `ssf_tenant_not_ready` |
| `503`       | `runtime_configuration_unavailable`                               |

Responses do not disclose tokens, secrets, internal database details, or data
belonging to other tenants.

## Audit and monitoring

Changes to server-wide values, tenant policies, and tenant overrides, as well
as rejected security-related requests, are stored as durable audit events. The
audit records the actor, timestamp, scope, action, affected field names, old
and new revisions, and outcome. Complete HTML content, tokens, and secrets are
not copied into the audit log.

Successful runtime requests produce technical metrics and structured logs but
not one durable audit event per request. `X-Correlation-Id` links diagnostic
information across SSF and Studio.

## Versioning

The major version is part of the API path, and the precise schema revision is
also returned as `contractVersion`. Optional backward-compatible fields may be
added within V1. SSF ignores unknown fields and strictly validates known
fields. New required fields, removed fields, or changed semantics require a
new major version.

Studio and SSF must support at least one common major version during a
transition. `configurationRevision` versions the content independently of
`contractVersion`.

## Data explicitly not exchanged

- no Studio user lists are sent to SSF,
- no email addresses are included in SSF tokens,
- no guest tokens or customer session tokens are sent to Studio,
- no passwords, client secrets, or Studio IAM internals are exchanged,
- no conversation content, consent records, or session histories are exchanged,
- no ClickHouse, usage, cost, or reporting data is exchanged,
- no direct database connection exists between Studio and SSF.

## Subsequent integration points

The runtime configuration contract has been technically specified. The
following items remain outside this first slice:

- the complete initial catalog of remaining `ssf.*` permissions beyond the
  configuration actions fixed by this contract,
- migration and removal criteria for `admin` and `customer`,
- revision-bound Keycloak permission projection,
- final integration of the service endpoint into the generic plugin server
  dispatcher and deployment profile.
