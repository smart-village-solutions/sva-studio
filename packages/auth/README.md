# @sva/auth

Authentifizierungs- und Autorisierungspaket für SVA Studio. Implementiert OIDC-Login (PKCE), Redis-basiertes Session-Management, IAM-Autorisierung (RBAC/ABAC), Governance-Workflows und DSGVO-Betroffenenrechte.

## Architektur-Rolle

`@sva/auth` ist das zentrale BFF-Auth-Paket (Backend for Frontend). Tokens verbleiben serverseitig – der Browser erhält ausschließlich `httpOnly`-Session-Cookies. Das Paket stellt eine strikte **Client/Server-Trennung** sicher:

- **Client-safe** (`@sva/auth`): Nur Route-Pfade und Typen – kein Server-Code im Browser-Bundle
- **Server-only** (`@sva/auth/server`): Alle Handler, Session-Logik, Crypto, IAM-Entscheidungen

```
@sva/core ← IAM-Typen, Claims, JWT
  ↑
@sva/sdk  ← Logger, Request-Context
  ↑
@sva/auth
```

**Abhängigkeiten:**
- `@sva/core` (workspace) – IAM-Typen, Claims, JWT-Parsing
- `@sva/sdk` (workspace) – SDK Logger, Request-Context
- `openid-client` – OIDC-Protokoll (PKCE-Flow)
- `ioredis` – Redis Session Storage
- `pg` – PostgreSQL für IAM-Daten
- `cookie-es` – Cookie-Handling
- `@opentelemetry/api` – Tracing

## Exports

| Pfad | Beschreibung |
| --- | --- |
| `@sva/auth` | Client-safe: Route-Pfade, Typen (`AuthConfig`, `SessionUser`) |
| `@sva/auth/server` | Server-only: Login, Callback, Logout, IAM-Handler, Middleware |

## Features

### OIDC-Authentifizierung

Vollständiger OIDC Authorization Code Flow mit PKCE über Keycloak.

- **Login:** PKCE-basierter Redirect zum Identity Provider
- **Callback:** Token-Austausch, Session-Erstellung, HMAC-signiertes State-Cookie
- **Logout:** Session-Löschung, RP-Initiated Logout
- **Token-Refresh:** Automatische Erneuerung abgelaufener Access-Tokens

### Session-Management

Redis-basierte Sessions mit optionaler Token-Verschlüsselung.

- **Cookie-Sicherheit:** `httpOnly`, `secure` (Produktion), `sameSite: lax`
- **Token-Verschlüsselung:** AES-256-GCM mit scrypt-Key-Derivation (optional via `ENCRYPTION_KEY`)
- **Login-State:** HMAC-SHA256-signiert, 10-Minuten-TTL, Timing-safe Vergleich

### IAM-Autorisierung

Serverseitige Autorisierungsentscheidungen auf Basis des RBAC/ABAC-Modells aus `@sva/core`.

- `authorize` – Prüft eine Aktion gegen Rollen und Berechtigungen
- `mePermissions` – Gibt die effektiven Berechtigungen des aktuellen Nutzers zurück
- **Cache:** In-Memory-Cache für Autorisierungsentscheidungen

### Governance-Workflows

- Freigabe-Workflows (Approval, Delegation, Impersonation)
- Compliance-Export für Audit-Zwecke
- Self-Approval-Schutz, Expiry-Handling

### DSGVO-Betroffenenrechte

- **Datenexport:** JSON/CSV/XML für Nutzer und Admins
- **Löschung:** Soft-Delete mit Legal-Hold-Support
- **Profil-Korrektur:** Berichtigung personenbezogener Daten
- **Wartung:** Admin-Schnittstelle für Datenbereinigung

## Auth-Routen (18 Pfade)

### Authentifizierung
| Pfad | Methode | Beschreibung |
| --- | --- | --- |
| `/auth/login` | GET | OIDC-Login initiieren |
| `/auth/callback` | GET | OIDC-Callback verarbeiten |
| `/auth/me` | GET | Aktuelle Session/Nutzer-Info |
| `/auth/logout` | GET | Session beenden, RP-Logout |

### IAM
| Pfad | Methode | Beschreibung |
| --- | --- | --- |
| `/iam/authorize` | POST | Autorisierungsentscheidung |
| `/iam/me/permissions` | GET | Eigene Berechtigungen |

### Governance
| Pfad | Methode | Beschreibung |
| --- | --- | --- |
| `/iam/governance/workflows` | GET/POST | Governance-Workflows |
| `/iam/governance/compliance/export` | GET | Compliance-Export |

### DSGVO
| Pfad | Methode | Beschreibung |
| --- | --- | --- |
| `/iam/me/data-export` | GET | Eigener Datenexport |
| `/iam/me/data-subject-rights/requests` | GET/POST | Betroffenenrechte-Anträge |
| `/iam/me/profile` | GET/PUT | Profildaten |
| `/iam/admin/data-subject-rights/*` | GET/POST | Admin-Betroffenenrechte |

## Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
| --- | --- | --- |
| `SVA_AUTH_ISSUER` | OIDC-Issuer-URL (Keycloak) | Ja |
| `SVA_AUTH_CLIENT_ID` | OIDC Client-ID | Ja |
| `SVA_AUTH_CLIENT_SECRET` | OIDC Client-Secret | Ja |
| `SVA_AUTH_REDIRECT_URI` | Redirect-URI nach Login | Ja |
| `SVA_AUTH_POST_LOGOUT_REDIRECT_URI` | Redirect nach Logout | Ja |
| `SVA_AUTH_STATE_SECRET` | HMAC-Secret für Login-State-Cookie | Ja |
| `ENCRYPTION_KEY` | AES-256-GCM Key für Token-Verschlüsselung | Empfohlen |
| `SVA_AUTH_SCOPES` | OIDC-Scopes | Nein |
| `SVA_AUTH_SESSION_COOKIE` | Cookie-Name (Default: `sva_auth_session`) | Nein |
| `SVA_AUTH_SESSION_TTL_MS` | Session-TTL in ms | Nein |
| `KEYCLOAK_ADMIN_BASE_URL` | Keycloak-Basis-URL für Admin API | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_REALM` | Realm für Admin API | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Service-Client-ID (z. B. `sva-studio-iam-service`) | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Service-Client-Secret | Für IAM-Admin-Client |

Hinweis: Der Keycloak Admin Client unterstützt Keycloak **>= 22.0**.

## Projektstruktur

```
src/
├── index.ts                              # Client-safe Exports
├── index.server.ts                       # Server Exports
├── types.ts                              # SessionUser, Session, AuthConfig
├── config.ts                             # Env-basierte Konfiguration
├── routes.shared.ts                      # 18 Auth/IAM Route-Pfade (type-safe)
│
├── auth.server.ts                        # OIDC Login/Callback/Logout/Refresh
├── oidc.server.ts                        # OIDC-Client Setup
├── middleware.server.ts                  # withAuthenticatedUser
├── routes.server.ts                      # Route-Handler (467 Zeilen)
│
├── session.ts                            # In-Memory Session Store
├── redis-session.ts                      # Redis Session Store
├── redis-session.server.ts               # Redis Server Session Ops
├── redis.server.ts                       # Redis-Client
├── crypto.server.ts                      # Token-Verschlüsselung (AES-256-GCM)
│
├── iam-authorization.server.ts           # authorize + mePermissions
├── iam-authorization.cache.ts            # Authorization Cache
├── keycloak-admin-client.ts              # Keycloak Admin API Adapter (IdentityProviderPort)
├── iam-governance.server.ts              # Governance-Workflows
├── iam-data-subject-rights.server.ts     # DSGVO-Betroffenenrechte
│
├── audit-events.server.ts                # Auth Audit Event Emitter
├── audit-events.types.ts                 # Audit Event Types
├── audit-db-sink.server.ts               # Audit DB Persistence
│
└── *.test.ts                             # Unit- und E2E-Tests
```

## Nx-Konfiguration

- **Name:** `auth`
- **Tags:** `scope:auth`, `type:lib`
- **Build:** `pnpm nx run auth:build`
- **Lint:** `pnpm nx run auth:lint`
- **Tests:** `pnpm nx run auth:test:unit`

## Verwandte Dokumentation

- [Session-Management-Analyse](../../docs/architecture/session-management-analysis.md)
- [ADR-009: Keycloak als zentraler IdP](../../docs/adr/ADR-009-keycloak-als-zentraler-identity-provider.md)
- [ADR-010: Verschlüsselung IAM Core Data Layer](../../docs/adr/ADR-010-verschluesselung-iam-core-data-layer.md)
- [ADR-012: RBAC Permission-Komposition](../../docs/adr/ADR-012-permission-kompositionsmodell-rbac-v1.md)
- [ADR-013: RBAC/ABAC-Hybridmodell](../../docs/adr/ADR-013-rbac-abac-hybridmodell.md)
- [IAM Authorization API Contract](../../docs/guides/iam-authorization-api-contract.md)
- [IAM Governance-Runbook](../../docs/guides/iam-governance-runbook.md)
- [IAM DSR-Runbook](../../docs/guides/iam-data-subject-rights-runbook.md)
- [Querschnittliche Konzepte (arc42 §8)](../../docs/architecture/08-cross-cutting-concepts.md)
