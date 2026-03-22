---
name: kcadm-cli
description: Work with Keycloak through `kcadm.sh`. Use this skill when inspecting or managing realms, clients, users, roles, groups, or required actions via the Keycloak Admin CLI.
---

# KCADM CLI

## When to Use

Use this skill when the task involves Keycloak administration through `kcadm.sh`, especially for:

- Checking admin access or token configuration
- Inspecting realms, clients, client scopes, roles, groups, users, sessions, keys, or components
- Creating or updating realms, users, roles, groups, clients, required actions, or identity providers
- Resetting passwords or adjusting realm-level configuration
- Verifying local Keycloak bootstrap state in Docker or test environments

Prefer read-only inspection first. Use mutations only when the task clearly requires a change.

Use `kcadm.sh` for admin work. Use `kcreg.sh` only when the task is specifically self-service client registration through the Client Registration REST API.

For this repository, `kcreg.sh` is usually not needed because the common workflows are admin-side IAM and realm operations, not delegated self-service client registration.

## Guardrails

- Start by verifying that `kcadm.sh` exists and which Keycloak server and realm you are targeting.
- Never print secrets, access tokens, passwords, or full credential payloads in the response.
- Never guess flags or resource paths. Run `kcadm.sh <subcommand> --help` if a command shape is uncertain.
- Prefer explicit `--server`, `--realm`, and `--config` or `KCADM_CONFIG` values over implicit defaults.
- Use `get` to inspect current state before `create`, `update`, or `delete`.
- Prefer narrow queries and exact IDs. Resolve object IDs before mutating resources that accept either IDs or names.
- Remember that `kcadm.sh` is a generic wrapper over the Admin REST API. When JSON fields are unclear, consult the Admin REST reference for the exact representation.
- Treat destructive commands such as client deletion, realm deletion, or bulk role removal as high-risk changes and verify target identity first.

## Default Workflow

### 1. Confirm binary and auth context

Check that the CLI is installed and identify the config file in use:

```bash
command -v kcadm.sh
echo "${KCADM_CONFIG:-$HOME/.keycloak/kcadm.config}"
```

If credentials are not already configured, authenticate explicitly:

```bash
kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --user "$ADMIN_USER" \
  --password "$ADMIN_PASSWORD" \
  --config /tmp/kcadm.config
```

For service-account style access:

```bash
kcadm.sh config credentials \
  --server http://127.0.0.1:8080 \
  --realm master \
  --client admin-cli \
  --client-secret "$ADMIN_CLIENT_SECRET" \
  --config /tmp/kcadm.config
```

If the server uses a non-public CA, configure a truststore before the first authenticated call:

```bash
kcadm.sh config truststore --trustpass "$TRUSTSTORE_PASSWORD" ~/.keycloak/truststore.jks
```

If tokens must not be written to disk, use `--no-config` and pass auth data on each invocation.

### 2. Discover the target object first

Inspect realms and query the relevant resource before changing anything:

```bash
kcadm.sh get realms --config /tmp/kcadm.config
kcadm.sh get users -r "$REALM" -q username="$USERNAME" --config /tmp/kcadm.config
kcadm.sh get clients -r "$REALM" -q clientId="$CLIENT_ID" --config /tmp/kcadm.config
kcadm.sh get groups -r "$REALM" --config /tmp/kcadm.config
```

When you need an ID for a later mutation, extract it with `jq` instead of hardcoding assumptions.

### 3. Mutate with explicit payloads

Use single-purpose commands and explicit field assignments:

```bash
kcadm.sh create users -r "$REALM" -s username="$USERNAME" -s enabled=true --config /tmp/kcadm.config
kcadm.sh update "users/$USER_ID" -r "$REALM" -s firstName=Max -s lastName=Mustermann --config /tmp/kcadm.config
kcadm.sh set-password -r "$REALM" --username "$USERNAME" --new-password "$NEW_PASSWORD" --temporary --config /tmp/kcadm.config
```

For more complex changes, prefer a checked JSON payload over long inline `-s` chains.

### 4. Verify after mutation

Always re-read the changed object and summarize the resulting state:

```bash
kcadm.sh get "users/$USER_ID" -r "$REALM" --config /tmp/kcadm.config
kcadm.sh get clients -r "$REALM" -q clientId="$CLIENT_ID" --config /tmp/kcadm.config
kcadm.sh get "clients/$CLIENT_UUID" -r "$REALM" --config /tmp/kcadm.config
```

## Built-in Helper Commands

Besides generic `create`, `get`, `update`, and `delete`, Keycloak documents several convenience commands that should be preferred when they fit the task:

- `set-password` for password resets
- `add-roles`, `remove-roles`, and `get-roles` for user, group, and composite-role mappings
- `config credentials` for authenticated sessions
- `config truststore` for custom TLS trust

These helpers are usually clearer and safer than manually composing the equivalent REST path.

## Capability Coverage

According to the official docs, `kcadm.sh` supports at least these areas:

- realm CRUD and realm-level settings
- users, passwords, sessions, and required actions
- groups and group role mappings
- realm roles, client roles, and composite-role mappings
- clients, client scopes, and installation payload retrieval
- keys and key providers through `components`
- LDAP and other storage-related components through `components`
- identity providers and other Admin REST resources

Because `kcadm.sh` talks directly to the Admin REST API, newer resources that exist in the REST reference but are not shown in detail in the guide can usually still be managed through their endpoint URIs. This includes, for example, protocol-mapper and organization-related resources. This is an inference from the docs, not a separate dedicated `kcadm.sh` feature list.

## Common Patterns

See [common-patterns.md](./references/common-patterns.md) for compact examples covering login, realm discovery, user lookup, client lookup, role mapping, group membership, and password resets.

## This Repository

In this repo, Keycloak-related local work usually falls into two runtime profiles. See also [runtime-profile-betrieb.md](../../../docs/development/runtime-profile-betrieb.md):

- default local profile via [`config/runtime/local-keycloak.vars`](../../../config/runtime/local-keycloak.vars)
  uses realm `svs-intern-studio-staging`
- HB local profile via optional local override [`config/runtime/local-keycloak.hb.local.vars`](../../../config/runtime/local-keycloak.hb.local.vars)
  uses realm `saas-hb-meinquartier`

Useful entry points:

```bash
pnpm env:up:local-keycloak
pnpm env:up:local-keycloak:hb
pnpm env:migrate:local-keycloak
pnpm env:migrate:local-keycloak:hb
pnpm env:status:local-keycloak:hb
pnpm env:smoke:local-keycloak:hb
```

For the local Docker production-like path, the HB app profile is started with:

```bash
pnpm env:up:local-keycloak:hb:docker
pnpm env:status:local-keycloak:hb:docker
```

When using `kcadm.sh` in this repo:

- read realm and admin-client values from the active runtime profile instead of hardcoding them
- prefer a temporary `KCADM_CONFIG` file outside the repo
- never copy secrets from `*.local.vars` files into committed documentation, tests, or terminal output
- if the task is actually about app health, login readiness, or seeded IAM state, check whether the repo scripts already cover it before dropping to raw `kcadm.sh`

## Response Expectations

When reporting results back to the user:

- Name the Keycloak server, realm, and resource you inspected or changed.
- State whether the action was read-only or mutating.
- Summarize the effective result, not the raw full JSON.
- Mention the config source you used if it matters for reproducibility.
- Call out blockers clearly, especially auth failures, missing realms, or missing admin permissions.
