# @sva/auth

Authentifizierungs- und Autorisierungspaket für SVA Studio. Implementiert OIDC-Login (PKCE), Redis-basiertes Session-Management, IAM-Autorisierung (RBAC/ABAC), Governance-Workflows und DSGVO-Betroffenenrechte.

## Architektur-Rolle

`@sva/auth` ist das zentrale BFF-Auth-Paket (Backend for Frontend). Tokens verbleiben serverseitig – der Browser erhält ausschließlich `httpOnly`-Session-Cookies. Das Paket stellt eine strikte **Client/Server-Trennung** sicher:

- **Client-safe** (`@sva/auth`): Nur Route-Pfade und Typen – kein Server-Code im Browser-Bundle
- **Server-only** (`@sva/auth/server`): Alle Handler, Session-Logik, Crypto, IAM-Entscheidungen
- Server-Fassaden bleiben als stabile Importpfade erhalten; fachliche Zerlegung lebt in Unterordnern wie `auth-server/`, `routes/` und `iam-*/`
- Die Session fuehrt bewusst nur einen minimalen Auth-Kern; Profil-PII wie Name und E-Mail wird getrennt ueber Profil-/Sync-Flows verarbeitet

```
@sva/core ← IAM-Typen, Claims, JWT
  ↑
@sva/server-runtime  ← Logger, Request-Context
  ↑
@sva/auth
```

**Abhängigkeiten:**
- `@sva/core` (workspace) – IAM-Typen, Claims, JWT-Parsing
- `@sva/server-runtime` (workspace) – Logger, Request-Context
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
- **Silent SSO:** Kontrollierter Reauth über denselben Login-Pfad mit `prompt=none`
- **Callback:** Token-Austausch, Session-Erstellung, HMAC-signiertes State-Cookie
- **Logout:** Session-Löschung, RP-Initiated Logout
- **Token-Refresh:** Automatische Erneuerung abgelaufener Access-Tokens

### Session-Management

Redis-basierte Sessions mit optionaler Token-Verschlüsselung.

- **Cookie-Sicherheit:** `httpOnly`, `secure` (Produktion), `sameSite: lax`
- **Führende Session-Wahrheit:** `Session.expiresAt` steuert fachliche Gültigkeit, Cookie-Laufzeit und Redis-TTL
- **Token-Verschlüsselung:** AES-256-GCM mit scrypt-Key-Derivation (optional via `ENCRYPTION_KEY`)
- **Login-State:** HMAC-SHA256-signiert, 10-Minuten-TTL, Timing-safe Vergleich
- **Minimaler SessionUser:** `id`, optionales `instanceId`, `roles`
- **Versionierte Session:** `issuedAt`, `expiresAt`, `sessionVersion`
- **Forced Reauth:** Benutzerbezogene Invalidierung via `forceReauthUser({ userId, mode })`
- **Logout-Schutz:** Expliziter Logout unterdrückt automatische Silent-Recovery zeitlich begrenzt

### IAM-Autorisierung

Serverseitige Autorisierungsentscheidungen auf Basis des RBAC/ABAC-Modells aus `@sva/core`.

- `authorize` – Prüft eine Aktion gegen Rollen und Berechtigungen
- `mePermissions` – Gibt die effektiven Berechtigungen des aktuellen Nutzers zurück
- **Cache:** Lokaler L1-In-Memory-Cache plus Redis-Snapshots als führender Shared-Read-Path
- **Snapshot-Scope:** Cache-Schlüssel sind an `instanceId`, Nutzer, Organisationskontext und optionalen Geo-Kontext gebunden
- **Fail-Closed:** Redis- oder Recompute-Fehler liefern im geschützten Autorisierungspfad stabil `503 database_unavailable`

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
| `/auth/login` | GET | OIDC-Login initiieren; `?silent=1` nur für internen Silent-Reauth |
| `/auth/callback` | GET | OIDC-Callback verarbeiten |
| `/auth/me` | GET | Aktuelle Session als minimaler Auth-Kontext |
| `/auth/logout` | POST | Session beenden, RP-Logout vorbereiten und Silent-SSO-Sperre setzen |

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
| `SVA_AUTH_ISSUER` | Globaler OIDC-Issuer nur für lokale Fallback-/Übergangspfade | Nur lokal/Übergang |
| `SVA_AUTH_CLIENT_ID` | Globaler OIDC-Client nur für lokale Fallback-/Übergangspfade | Nur lokal/Übergang |
| `SVA_AUTH_CLIENT_SECRET` | OIDC Client-Secret | Ja |
| `SVA_AUTH_REDIRECT_URI` | Globaler Redirect nur für lokale Fallback-/Übergangspfade | Nur lokal/Übergang |
| `SVA_AUTH_POST_LOGOUT_REDIRECT_URI` | Globaler Logout-Redirect nur für lokale Fallback-/Übergangspfade | Nur lokal/Übergang |
| `SVA_AUTH_STATE_SECRET` | HMAC-Secret für Login-State-Cookie | Ja |
| `ENCRYPTION_KEY` | AES-256-GCM Key für Token-Verschlüsselung | Empfohlen |
| `SVA_AUTH_SCOPES` | OIDC-Scopes (Default: `openid`) | Nein |
| `SVA_AUTH_SESSION_COOKIE` | Cookie-Name (Default: `sva_auth_session`) | Nein |
| `SVA_AUTH_SESSION_TTL_MS` | Session-TTL in ms | Nein |
| `SVA_AUTH_SILENT_SSO_SUPPRESS_COOKIE` | Cookie-Name für Logout-basierte Silent-SSO-Sperre | Nein |
| `SVA_AUTH_SESSION_REDIS_TTL_BUFFER_MS` | Technischer Redis-Puffer oberhalb der Session-Restdauer | Nein |
| `SVA_AUTH_SILENT_SSO_SUPPRESS_AFTER_LOGOUT_MS` | Dauer der Silent-SSO-Sperre nach Logout | Nein |
| `KEYCLOAK_ADMIN_BASE_URL` | Keycloak-Basis-URL für Admin API | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_REALM` | Realm des Service-Accounts für den technischen Token-Bezug, nicht der Ziel-Realm der Instanz | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_CLIENT_ID` | Service-Client-ID (z. B. `sva-studio-iam-service`) | Für IAM-Admin-Client |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | Service-Client-Secret | Für IAM-Admin-Client |
| `KEYCLOAK_PROVISIONER_BASE_URL` | Keycloak-Basis-URL für den Provisioning-Worker | Für globalen Provisioner |
| `KEYCLOAK_PROVISIONER_REALM` | Realm des globalen Provisioner-Service-Accounts (typisch `master`) | Für globalen Provisioner |
| `KEYCLOAK_PROVISIONER_CLIENT_ID` | Client-ID des globalen Provisioners | Für globalen Provisioner |
| `KEYCLOAK_PROVISIONER_CLIENT_SECRET` | Secret des globalen Provisioners | Für globalen Provisioner |

Hinweis: Der Keycloak Admin Client unterstützt Keycloak **>= 22.0**.

Im produktiven Multi-Instance-Betrieb ist die Instanz-Registry führend. Jede aktive Instanz in `iam.instances` muss mindestens `authRealm` und `authClientId` besitzen; optional kann `authIssuerUrl` gesetzt werden. Login, Callback, Logout und Keycloak-Admin-Aufrufe werden dann zur Laufzeit pro Host bzw. `instanceId` aufgelöst.

## Datenminimierung und Profil-Sync

- `/auth/me` liefert absichtlich keinen vollstaendigen Profil-Datensatz, sondern nur den Auth-Kern fuer Session und Autorisierung.
- Name und E-Mail bleiben fuer Profilpflege und Synchronisation mit Keycloak zulaessig, werden aber ueber dedizierte Profil-/Sync-Operationen verarbeitet.
- Verschluesselte Persistenz in `iam.accounts` (`email_ciphertext`, `display_name_ciphertext`) bleibt bestehen.
- Operatives Logging darf keine Tokens und keine tokenhaltigen Redirect- oder Logout-URLs enthalten; Logout-Logging nutzt nur sichere Summary-Felder.

## Session-Lifecycle und Reauth

- Das BFF erneuert Tokens serverseitig; der Browser sieht weiterhin nur den Session-Cookie.
- `expiresAt` ist die einzige fachliche Gültigkeitsquelle einer Session.
- Redis-TTL ist nur technische Retention und liegt knapp oberhalb der verbleibenden Sessiondauer.
- Nach `401` darf das Frontend genau einen stillen Reauth-Versuch per iframe starten.
- Erfolgreicher Silent-Reauth rotiert die Session-ID.
- `forceReauthUser()` unterstützt `app_only` und `app_and_idp`.

## Projektstruktur

```
src/
├── index.ts                              # Client-safe Exports
├── index.server.ts                       # Server Exports
├── types.ts                              # SessionUser, Session, AuthConfig
├── config.ts                             # Env-basierte Konfiguration
├── routes.shared.ts                      # 18 Auth/IAM Route-Pfade (type-safe)
│
├── auth.server.ts                        # stabile Fassade für OIDC Login/Callback/Logout/Refresh
├── auth-server/                         # modulare OIDC- und Session-Bausteine
├── oidc.server.ts                        # OIDC-Client Setup
├── middleware.server.ts                  # withAuthenticatedUser
├── routes.server.ts                      # stabile Fassade für Auth-/IAM-Routen
├── routes/                              # Cookie-, Handler- und Registry-Bausteine
│
├── session.ts                            # In-Memory Session Store
├── redis-session.ts                      # Redis Session Store
├── redis-session.server.ts               # Redis Server Session Ops
├── redis.server.ts                       # Redis-Client
├── crypto.server.ts                      # Token-Verschlüsselung (AES-256-GCM)
│
├── iam-authorization.server.ts           # stabile Fassade für authorize + mePermissions
├── iam-authorization/                   # Evaluation, Cache-Zugriff, Handler, Shared-Bausteine
├── iam-authorization.cache.ts            # Authorization Cache
├── keycloak-admin-client.ts              # stabile Fassade für den Keycloak-Adapter
├── keycloak-admin-client/               # Konfiguration, Modelle, Fehler, Adapter-Core
├── iam-account-management.server.ts      # stabile Fassade für User/Rollen/Profile
├── iam-account-management/              # modulare Fachbausteine + Core
├── iam-governance.server.ts              # stabile Fassade für Governance-Workflows
├── iam-governance/                      # Workflow-, Compliance- und Impersonation-Bausteine
├── iam-data-subject-rights.server.ts     # stabile Fassade für DSGVO-Betroffenenrechte
├── iam-data-subject-rights/             # Export-, Request- und Compliance-Bausteine
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
- [ADR-017: Modulare IAM-Server-Bausteine](../../docs/adr/ADR-017-modulare-iam-server-bausteine.md)
- [IAM Authorization API Contract](../../docs/guides/iam-authorization-api-contract.md)
- [IAM Governance-Runbook](../../docs/guides/iam-governance-runbook.md)
- [IAM DSR-Runbook](../../docs/guides/iam-data-subject-rights-runbook.md)
- [Querschnittliche Konzepte (arc42 §8)](../../docs/architecture/08-cross-cutting-concepts.md)
