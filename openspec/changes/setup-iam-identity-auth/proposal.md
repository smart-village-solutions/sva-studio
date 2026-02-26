# Change: Child A – Keycloak-Integration und IAM-Identity-Basis

## Zusammenfassung

Dieses Proposal ist **Child A** im IAM-Masterplan und etabliert ausschließlich die Identity-Basis: Keycloak/OIDC, Session-Lifecycle, Token-Validierung und User-Context-Auflösung. Datenmodellierung, RBAC/ABAC, Hierarchie und Governance-Workflows sind in nachgelagerte Child-Changes ausgelagert.

## Why

Das SVA Studio erfordert ein **sicheres, skalierbares und mandantenfähiges IAM-System**:

- **Sicherheit:** Zentrale Authentifizierung über Keycloak mit SSO als Basis (2FA in späterer Phase)
- **Governance:** Granulare rollenbasierte Zugriffskontrolle (RBAC) und attributbasierte Kontrolle (ABAC)
- **Betrieb:** Nahtlose Verwaltung von Organisationshierarchien (Landkreis → Gemeinde → Ortsteil) mit hierarchischer Rechtevererbung
- **Compliance:** Revisionssichere Audit-Logs und DSGVO-Konformität
- **Skalierbarkeit:** Mandantenfähigkeit zur Unterstützung mehrerer Kommunen

Ohne diese Fundamente können die nachfolgenden Module (News, Medienverwaltung, etc.) nicht mit den erforderlichen Sicherheits- und Organisationsanforderungen arbei­ten.

## What Changes

### Child A Scope: Keycloak-Integration und IAM-Identity-Basis

- **Client-Konfiguration:** OIDC-Integration des SVA Studios mit Keycloak (Redirect-URIs, Web Origins, Client Scopes)
- **Token-Mapping:** Keycloak-Mappers für User-Informationen im JWT (Identity-Basis, inkl. `instanceId`-Kontext)
- **IAM-Service:** Neuer interner Service zur Token-Validierung und User-Identity-Auflösung
- **SSO:** Aktivierung und Test der Single-Sign-On-Basis für lokale Entwicklung
- **Nicht in Child A (lokal):** 2FA und externe IdP-Integrationen (AD, BundID)

### Ausgelagerter Scope (Masterplan-konform)

- `add-iam-core-data-layer`: Datenmodellierung, RLS, instanzgebundene Zuordnungen
- `add-iam-authorization-rbac-v1`: RBAC, `GET /iam/me/permissions`, `POST /iam/authorize`
- `add-iam-abac-hierarchy-cache`: ABAC, Vererbung, Cache-Invalidierung, Performance-Härtung
- `add-iam-governance-workflows`: Delegation, Impersonation, Approval-Workflows, Legal/Audit-Ausbau

## Impact

### Betroffene Specs

- `iam-core` – IAM-Architektur, Authentifizierung, Keycloak-Integration

### Betroffene Packages

- `packages/auth/` – OIDC-, Session- und Token-Logik
- `apps/studio/` – Frontend-Integration mit Keycloak OIDC

### Breaking Changes

- **Keine Breaking Changes in dieser Phase.** Das IAM-System wird parallel zu bestehenden Systemen aufgebaut und später aktiviert.

### Abhängigkeiten & Sequenzierung

Child A ist Voraussetzung für die nachgelagerten IAM-Child-Changes im Masterplan:

```
Child A: Identity-Basis (OIDC/Session/Token)
         ↓
Child B: Core Data Layer
         ↓
Child C: RBAC v1
         ↓
Child D: ABAC + Hierarchie + Cache
         ↓
Child E: Governance-Workflows
```

### Ressourcen-Impakt

- **Frontend:** Integration OIDC-Login, Session-Management
- **Backend:** Auth/Identity-Service-Bausteine
- **Infrastruktur:** Keycloak-Instanz (bereits vorhanden), Redis Session Store
- **Testing:** Unit-Tests, E2E-Tests für Authentication-Flows

### Ist-Stand Codebasis (bereits vorhanden)

- OIDC-Discovery und Client-Initialisierung: `packages/auth/src/oidc.server.ts`
- Auth-Konfiguration über Umgebungsvariablen: `packages/auth/src/config.ts`
- Session- und Login-State-Handling via Redis: `packages/auth/src/redis-session.server.ts`
- Serverseitige Auth-Flows und Route-Handler: `packages/auth/src/auth.server.ts`, `packages/auth/src/routes.server.ts`

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Keycloak-Instanz und Admin-Zugriff verfügbar?
2. ✅ Keycloak-Basisintegration im Code vorhanden und als Child-A-Basis nutzbar?
3. ✅ Externe IdP-Anbindungen (AD, BundID) und 2FA lokal explizit aus Child A ausgeklammert?
4. ℹ️ Postgres-Verfügbarkeit und Caching-Strategie werden in Child B/D umgesetzt (kein Blocker für Child A)

---

**Status:** 🟡 Proposal (Child A, Scope bereinigt; bereit für Review)
