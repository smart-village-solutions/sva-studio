# Draft: Auth Session Persistence

## Requirements (confirmed)
- Current auth uses in-memory session storage in `packages/auth`.
- Sessions are lost on dev server reload; cookies remain but session map is empty.
- Multi-tenant isolation required (organizations with isolated sessions).
- Horizontal scalability required (multi-instance backend).
- OIDC/Keycloak tokens must be managed (access/refresh/id).
- Automatic token refresh without re-login.
- Performance targets: session lookup < 10 ms; permission checks < 50 ms.
- Security/compliance: DSGVO, BSI; HttpOnly/Secure/SameSite cookies; session timeout and auto logout.
- Operations: open source first, self-hosted, monitoring/observability, DR/backup.
- No blocking disk I/O in request path.

## Technical Decisions
- TBD: Persistent session store selection (Redis/Postgres/etc.).
- TBD: Multi-tenant isolation strategy (key namespace vs per-tenant DB schema).
- TBD: Token storage/encryption strategy.

## Research Findings
- Current in-memory session store in `packages/auth/src/session.ts` (Map-based CRUD + TTL cleanup).
- Session creation/refresh/logout flow in `packages/auth/src/auth.server.ts` (sessionId stored in cookie, refresh token grant, TTL cleanup).
- Server routes set/read session cookie in `packages/auth/src/routes.server.ts`.
- Config includes `sessionCookieName` + `sessionTtlMs` in `packages/auth/src/config.ts`.
- Pending: existing test infrastructure and patterns.
- Pending: Keycloak integration touchpoints.

## Open Questions
- Preferred session store and available infrastructure (e.g., Redis already in stack?).
- Storage of tokens: server-side only vs split (refresh token server-side, access token in memory).
- Required retention/TTL policy per tenant and session.

## Scope Boundaries
- INCLUDE: persistent session storage, token refresh flow, multi-tenant isolation, observability hooks.
- EXCLUDE: UI changes unless required for auth flow correctness.
