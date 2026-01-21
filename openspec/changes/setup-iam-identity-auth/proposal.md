# Change: Keycloak-Integration und IAM-Service-Architektur etablieren

## Zusammenfassung

Dieses Proposal etabliert die Fundamente für das Identity & Access Management (IAM) des SVA Studios. In drei Phasen wird die Integration mit Keycloak realisiert, die mandantenfähige Organisationsstruktur umgesetzt und das rollenbasierte Berechtigungssystem implementiert.

## Why

Das SVA Studio erfordert ein **sicheres, skalierbares und mandantenfähiges IAM-System**:

- **Sicherheit:** Zentrale Authentifizierung über Keycloak mit SSO und 2FA für alle Zugänge
- **Governance:** Granulare rollenbasierte Zugriffskontrolle (RBAC) und attributbasierte Kontrolle (ABAC)
- **Betrieb:** Nahtlose Verwaltung von Organisationshierarchien (Landkreis → Gemeinde → Ortsteil) mit hierarchischer Rechtevererbung
- **Compliance:** Revisionssichere Audit-Logs und DSGVO-Konformität
- **Skalierbarkeit:** Mandantenfähigkeit zur Unterstützung mehrerer Kommunen

Ohne diese Fundamente können die nachfolgenden Module (News, Medienverwaltung, etc.) nicht mit den erforderlichen Sicherheits- und Organisationsanforderungen arbei­ten.

## What Changes

### Phase 1: Keycloak-Integration und IAM-Service-Architektur

- **Client-Konfiguration:** OIDC-Integration des SVA Studios mit Keycloak (Redirect-URIs, Web Origins, Client Scopes)
- **Token-Mapping:** Keycloak-Mappers für User-Informationen im JWT (Rollen, Organisationszugehörigkeiten)
- **IAM-Service:** Neuer interner Service zur Token-Validierung und User-Identity-Auflösung
- **SSO/2FA:** Aktivierung und Test der Single-Sign-On und Zwei-Faktor-Authentifizierung

### Phase 2: Organisationsstruktur und Benutzer-Mapping

- **Datenmodellierung:** Postgres-Schema für hierarchische Organisationen (`iam.organizations`, `iam.accounts`)
- **Account-Synchronisation:** Just-in-Time Provisioning beim ersten Keycloak-Login
- **Organizationsanbindung:** Automatische Zuweisung von Nutzern zu Organisationen und Hierarchiestufen

### Phase 3: Rollenmodell und Berechtigungslogik

- **7-Personas-System:** Implementierung der vordefinierten Systemrollen
- **RBAC/ABAC Engine:** Rollenbasierte und attributbasierte Zugriffskontrolle
- **Rechte-Vererbung:** Hierarchische Vererbung entlang der Organisationsstruktur
- **Basis-Audit-Logging:** Revisionssichere Protokollierung von IAM-Ereignissen

## Impact

### Betroffene Specs (neu)

- `iam-core` – IAM-Architektur, Authentifizierung, Keycloak-Integration
- `iam-organizations` – Organisationsmodell und Hierarchien
- `iam-access-control` – Rollenmodell, RBAC/ABAC, Permissions
- `iam-auditing` – Audit-Logs und Compliance

### Betroffene Packages

- `packages/core/` – IAM-Services und Permission Engine
- `packages/data/` – Postgres-Schemas für IAM-Tabellen
- `apps/studio/` – Frontend-Integration mit Keycloak OIDC

### Breaking Changes

- **Keine Breaking Changes in dieser Phase.** Das IAM-System wird parallel zu bestehenden Systemen aufgebaut und später aktiviert.

### Abhängigkeiten & Sequenzierung

Alle nachfolgenden Arbeitspakete (Milestone 1 News-Modul, Milestone 2 Medienverwaltung, etc.) sind auf Phase 1–3 angewiesen:

```
Phase 1: Keycloak + IAM-Service
         ↓
Phase 2: Organisationen + Account-Sync
         ↓
Phase 3: Rollen + Permissions
         ↓
Milestone 1: News-Modul mit vollständigem IAM
```

### Ressourcen-Impakt

- **Frontend:** Integration OIDC-Login, Session-Management
- **Backend:** 3 neue Services (IAM, Org-Sync, Permission Engine)
- **Infrastruktur:** Keycloak-Instanz (bereits vorhanden), Redis für Permission-Caching, Postgres-Migration
- **Testing:** Unit-Tests, E2E-Tests für Authentication & Authorization Flows

## Approval Gate

Vor Start der Implementierung müssen folgende Punkte geklärt sein:

1. ✅ Keycloak-Instanz und Admin-Zugriff verfügbar?
2. ✅ Postgres/Supabase-Schema-Migrations-Workflow etabliert?
3. ✅ Redis/Caching-Strategie geklärt?
4. ❓ Externe IdP-Anbindungen (AD, BundID) für Phase 1 relevant oder später?

---

**Status:** 🟡 Proposal (bereit für Review)
