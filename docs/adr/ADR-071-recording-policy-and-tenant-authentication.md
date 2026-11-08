# ADR-071: Studio ownership of recording policy and tenant authentication

- Status: Accepted for implementation
- Date: 2026-11-02
- Related change: `add-ssf-recording-administration`

## Context

SSF consumes recording policy, consent wording, administrative permission claims
and a live directory. Studio already owns installation templates, tenant content
overrides, account management, module IAM and Keycloak provisioning. The agreed
retention default is 720 hours, with installation configuration and explicit
tenant overrides; ordinary-login MFA is optional unless the tenant requires it.

## Decision

The SSF plugin owns recording configuration and editorial legal content. It
resolves tenant retention before installation retention and then the 720-hour
fallback, validating explicit values from 1 to 8760 hours. Recording enablement
is tenant-specific and explicit. The `recording` subtree is resolved separately
from content suppression, whose generic merge also uses `enabled` as metadata.
Effective policy is included in the runtime configuration revision.

Core/IAM owns managed `competenceLanguages`, effective account permissions and
authentication policy. Interface language does not imply reviewer competence.
The SSF plugin receives a narrow host-supplied directory reader; it does not
query IAM tables or own a duplicate account database. Directory labels are
bounded for the consumer without excluding an otherwise eligible identity.

Recording grants are explicit. Plugin metadata preserves
`systemAdminPermissionExclusions` through SDK normalization, host composition
and tenant bootstrap so adding a recording permission does not automatically
grant it to every tenant administrator. Existing configuration-management
permissions retain their normal baseline.

Competence changes schedule the existing durable tenant lifecycle reconciliation
task in the account transaction. A change during a running reconciliation must
produce a later reconciliation, not disappear behind the active-job guard.
Keycloak attribute projection preserves omitted profile fields. Issued access
tokens carry `ssf_permissions` and `ssf_languages`; a live directory read does
not itself revoke an already issued access token.

Ordinary-login MFA policy belongs to the realm-owning Core/IAM instance, not SSF
content JSON. Studio uses tenant-local authorization, existing provisioning jobs
and independent Keycloak read-back. Desired policy and last verified applied
policy are distinct; pending or failed application must be visible. Optional
ordinary MFA does not bypass SSF's existing fresh sensitive-action step-up.
Unmanaged authentication bindings must be preserved or reported as a conflict.

## Consequences

- Existing administration and runtime integration paths are extended; no second
  configuration service, IAM authority, plugin loader or job system is created.
- Installation and tenant boundaries remain distinct. Studio's host `instanceId`
  represents the tenant in service context and maps to SSF's `tenantId`.
- Existing archive expiry dates, cryptographic keys and decryption grants remain
  outside Studio policy editing. A default change does not rewrite archives.
- Legacy storage controls are removed from mounted editors. Required v2
  compatibility output uses disabled storage and null questions; historical v1
  resolver compatibility remains explicit.
- Production promotion and tenant enablement require the normal release process
  and operational prerequisites. Local test evidence is not deployment evidence.

## References

- [Producer change](../../openspec/changes/add-ssf-recording-administration/proposal.md)
- [Building blocks](../architecture/05-building-block-view.md)
- [Runtime flows](../architecture/06-runtime-view.md)
- [Cross-cutting concepts](../architecture/08-cross-cutting-concepts.md)
