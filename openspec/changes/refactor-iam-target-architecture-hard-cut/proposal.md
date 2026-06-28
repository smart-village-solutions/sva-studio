# Change: IAM-Zielarchitektur-Hard-Cut

## Why

Die dokumentierte Zielarchitektur nennt `@sva/iam-core` als zentralen Ort für Authorize-Verträge und Permission-Entscheidungen. Im aktuellen Code liegt die eigentliche Authorize-Engine noch in `@sva/core`, während `@sva/auth-runtime` neben Authentifizierung und Session auch breite IAM-Adapter- und Exportflächen hält.

## What Changes

- **BREAKING**: Authorize-Contracts, Reason Codes, `EffectivePermission`, `AuthorizeRequest`, `AuthorizeResponse`, `IamAction` und `evaluateAuthorizeDecision` werden aus `@sva/core` entfernt und nach `@sva/iam-core` migriert.
- **BREAKING**: Interne und package-public Consumer werden direkt auf Zielimporte migriert; es gibt keine Deprecation-Bridges.
- `@sva/auth-runtime` bleibt Owner von Auth, Session, OIDC, Cookies, Auth-Middleware, Runtime-Route-Wiring, Permission-Store und Redis-/DB-Snapshot-Infrastruktur.
- `@sva/iam-admin` und `@sva/iam-governance` konsumieren `@sva/iam-core` für Authorize-nahe Verträge und halten fachliche Use-Cases in ihren eigenen Package-Grenzen.
- Der `authorize`-Hot-Path darf keine zusätzlichen DB- oder Redis-Roundtrips erhalten.

## Impact

- Affected specs: `iam-core`, `iam-server-modularization`, `iam-access-control`
- Affected code: `packages/iam-core`, `packages/core/src/iam`, `packages/auth-runtime/src/iam-authorization`, `packages/iam-admin/src`, `packages/iam-governance/src`, `apps/sva-studio-react/src/routes/admin`, `apps/sva-studio-react/src/lib/iam-api.ts`
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `package-zielarchitektur`
