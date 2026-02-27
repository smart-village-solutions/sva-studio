# Tasks: setup-iam-identity-auth

## Scope-Hinweis (Child A)

Dieser Change ist auf Identity-Basis begrenzt (OIDC, Session, Token, User-Context).
Folgende Themen sind ausgelagert und werden hier nicht mehr umgesetzt:

- `add-iam-core-data-layer` (Datenmodell, RLS, Instanz-/Org-Zuordnung)
- `add-iam-authorization-rbac-v1` (RBAC v1, Authorize-API)
- `add-iam-abac-hierarchy-cache` (ABAC, Vererbung, Cache)
- `add-iam-governance-workflows` (Delegation, Impersonation, Approval, Legal/Audit)

## Phase 1: Keycloak-Integration und IAM-Service-Architektur

**Status:** 🟢 **100% COMPLETE** (25/25 Tasks)

### 1.1 Keycloak-Konfiguration

- [x] 1.1.1 OIDC-Client im Keycloak für SVA Studio erstellen
- [x] 1.1.2 Redirect-URIs konfigurieren (dev, staging, prod)
- [x] 1.1.3 Web Origins für CORS festlegen ⚠️ *Keycloak-seitig zu verifizieren*
- [x] 1.1.4 Client-Scopes definieren (openid, profile, email)
- [x] 1.1.5 Keycloak-Mappers für Identity-Claims inkl. `instanceId` konfigurieren
- [x] 1.1.6 Keycloak-Version festlegen und dokumentieren (`26.2.4`)

### 1.2 IAM-Service-Grundstruktur

- [x] 1.2.1 `packages/core/src/iam/` Verzeichnis struktu­rieren (framework-agnostische IAM-Logik aus `packages/auth/src/` extrahiert)
- [x] 1.2.2 Token-Validator implementieren (JWT-Verifizierung mit Keycloak Public Key)
- [x] 1.2.3 User-Context-Resolver entwickeln (Claims auslesen, User-ID bereitstellen)
- [x] 1.2.4 Keycloak-Config-Management (URL, Realm, Client-ID)
- [x] 1.2.5 Error-Handling für invalid/expired Tokens

### 1.3 Frontend-Integration

- [x] 1.3.1 OIDC-Library wählen: keine Browser-OIDC-Library; serverseitiges BFF-Pattern mit `openid-client` in `@sva/auth` (Frontend nutzt `/auth/login`, `/auth/me`, `/auth/logout`)
- [x] 1.3.2 Login-Flow im SVA Studio implementieren (Frontend-Trigger via `/auth/login`, Session-Loading via `/auth/me`, Redirect-Flow per E2E verifiziert)
- [x] 1.3.3 Token-Speicherung via HttpOnly Cookie (Secure, SameSite) umgesetzt (`/auth/callback` setzt `httpOnly`, `sameSite=lax`, `secure` in prod; kein localStorage)
- [x] 1.3.4 Logout-Flow implementieren (UI-Logout via `POST /auth/logout`, Session-Invalidierung + Cookie-Löschung + Redirect verifiziert)
- [x] 1.3.5 Token-Refresh-Mechanik (Refresh bei expiring/expired Session via `refreshTokenGrant`; Erfolg- und Fehlerpfad durch Unit-Tests abgesichert)

### 1.4 Backend-Authentication-Middleware

- [x] 1.4.1 Express/Framework-Middleware für Token-Validierung schreiben (`withAuthenticatedUser` in `packages/auth/src/middleware.server.ts`; in `/auth/me` integriert)
- [x] 1.4.2 Protected-Routes etablieren
- [x] 1.4.3 User-Context in Request-Object injizieren
- [x] 1.4.4 Unit-Tests für Token-Validierung

### 1.5 Security & Testing

- [x] 1.5.1 HTTPS-Konfiguration für lokal und in allen Umgebungen
- [x] 1.5.2 SSO-Flow testen (Multi-Tab, Session-Konsistenz) per `sso-session-consistency.test.ts` verifiziert
- [x] 1.5.3 Token-Expiration und Refresh testen
- [x] 1.5.4 E2E-Tests für Login-Logout-Szenarios
- [x] 1.5.5 Security-Audit (Token-Claims, No Secrets in Frontend)

**Implementiert:** `packages/auth/src/` mit OIDC, Redis-Sessions, AES-256-GCM Token-Encryption

---

## Acceptance Criteria

**Phase 1:** 🟢 **COMPLETE** (100%)
- ✅ Ein Nutzer kann sich über Keycloak anmelden
- ✅ Token wird validiert, User-Context ist verfügbar
- ✅ Session-Management mit Redis und AES-256-GCM Encryption
- ✅ E2E-Tests für kritische Auth-Flows
- ✅ Frontend-Integration ist umgesetzt (Login-/Logout-Aktionen + `/auth/me` Session-Loading)

---

**Overall Progress (Child A):** 🟢 **97% COMPLETE** (34/35 Tasks)

## Phase 1.6: Architektur-Dokumentation (Review-Befund)

- [x] 1.6.1 ADR erstellen: „Keycloak als zentraler Identity Provider" (unter `docs/adr/ADR-009-keycloak-als-zentraler-identity-provider.md`)
- [x] 1.6.2 Specs unter `specs/` auf Deutsch übersetzen oder Sprachwahl als ADR dokumentieren (Child-A-Specs unter `openspec/changes/setup-iam-identity-auth/specs/` auf Deutsch harmonisiert)
- [x] 1.6.3 Spec-Scope bereinigen: `iam-access-control`, `iam-organizations`, `iam-auditing` auf Child-A-Scope reduziert (RBAC/ABAC/Hierarchie/Governance ausgelagert)

## Phase 1.7: Operative Observability (Logging-Review 26.02.2026)

- [x] 1.7.1 SDK Logger in allen Auth-Modulen einsetzen: `createSdkLogger({ component: 'iam-auth' })` statt `console.*`
- [x] 1.7.2 `workspace_id` (= `instanceId`) als Pflichtfeld in allen Auth-Log-Einträgen sicherstellen
- [x] 1.7.3 Korrelations-IDs implementieren: `X-Request-Id`-Header generieren/propagieren, OTEL Trace-Context durchreichen
- [x] 1.7.4 Token-Fehler-Logging: jeden `TokenError`-Fall als SDK Logger `warn`-Eintrag emittieren (ohne Token-Werte/PII)
- [x] 1.7.5 Audit-Events Dual-Write: Login/Logout/Account-Erstellung parallel in DB und über SDK Logger in OTEL-Pipeline emittieren (OTEL-Sink in Child A umgesetzt; DB-Sink explizit in Child B `add-iam-core-data-layer` Task 3.4 verankert)
- [x] 1.7.6 OIDC-Flow-Sequenzdiagramm um `request_id`/`trace_id`-Propagation erweitern (im design.md)
- [x] 1.7.7 Log-Level-Konvention für Child A validieren: info (Login), warn (Token-Fehler), debug (Refresh/Session), error (OIDC-Discovery)
**Last Updated:** 27. Februar 2026
