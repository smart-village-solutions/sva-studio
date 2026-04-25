## 1. Specification

- [x] 1.1 OpenSpec-Change mit Proposal, Design, Tasks und Spec-Deltas erstellen
- [x] 1.2 Betroffene arc42-Abschnitte und Zielarchitektur-Dokument verlinken
- [x] 1.3 `openspec validate refactor-package-target-architecture-hard-cut --strict` ausführen

## 2. Inventory und Freeze

- [x] 2.1 Aktuelle Importkanten zwischen `auth`, `core`, `data`, `sdk`, `routing`, App und Plugins inventarisieren
- [x] 2.2 Boundary-Disables und erlaubte Ausnahmen mit Ticketbezug erfassen
- [x] 2.3 PII-Datenflüsse und Credential-Flüsse pro betroffenem Package klassifizieren
- [x] 2.4 Freeze-Regel dokumentieren: keine neue Fachlogik in Sammelpackages ohne Zielpackage-Zuordnung

## 3. Package Scaffold

- [x] 3.1 `@sva/iam-core` anlegen und Autorisierungs-/PII-Basisverträge vorbereiten
- [x] 3.2 `@sva/auth-runtime` anlegen und Login-/Session-/OIDC-Verträge vorbereiten
- [x] 3.3 `@sva/iam-admin` anlegen und Benutzer-/Rollen-/Organisation-Verträge vorbereiten
- [x] 3.4 `@sva/iam-governance` anlegen und DSR-/Legal-/Audit-Verträge vorbereiten
- [x] 3.5 `@sva/instance-registry` anlegen und Instanz-/Registry-/Provisioning-Verträge vorbereiten
- [x] 3.6 `@sva/plugin-sdk` und `@sva/server-runtime` als getrennte öffentliche Rollen herstellen
- [x] 3.7 `@sva/data-client` und `@sva/data-repositories` als getrennte Datenrollen herstellen

## 4. Contract Migration

- [x] 4.1 Zentrale Autorisierungsentscheidung nach `@sva/iam-core` verschieben
- [x] 4.2 Server-Runtime-Fassade über `@sva/server-runtime` bereitstellen und erste Auth-Consumer umstellen
- [x] 4.2a Server-Runtime-Implementierung physisch aus `@sva/sdk/server` nach `@sva/server-runtime` verschieben
- [x] 4.3 Plugin-SDK-Fassade über `@sva/plugin-sdk` bereitstellen und `@sva/plugin-news` umstellen
- [x] 4.3a Plugin-SDK-Implementierung physisch aus `@sva/sdk` nach `@sva/plugin-sdk` verschieben
- [x] 4.4 Client-sicheren HTTP-Data-Client nach `@sva/data-client` verschieben und `@sva/data` als Kompatibilitäts-Barrel belassen
- [x] 4.5 Repository-Fassade über `@sva/data-repositories` bereitstellen und Auth-Instance-Registry-Consumer umstellen
- [x] 4.5a DB-Repository-Implementierung physisch aus `@sva/data` nach `@sva/data-repositories` verschieben
- [x] 4.6 Auth-Routing über `@sva/auth-runtime` entkoppeln, sodass `@sva/routing` nicht mehr direkt aus `@sva/auth` importiert

## 5. Fachpackage Migration

- [x] 5.1 Login, Logout, OIDC, Cookies, Session und Middleware in `@sva/auth-runtime` bündeln
  - Abgeschlossen: Auth-/Session-Typen, Scope-Helfer, Runtime-Session-Fehler, Token-Fehler-Guards, Mock-Auth, Token-Verschlüsselung, Redis-Client, Request-Host-Auflösung, Tenant-Host-Middleware-Prüfung, Runtime-Secrets, Auth-Config inklusive Tenant-Auth-Resolution, Return-To-Sanitizing, Audit-Events inklusive DB-Sink, Legal-Text-Compliance, JIT-Provisioning, Mainserver-Credentials und Runtime-Health liegen in `@sva/auth-runtime`; OIDC-, Login-, Callback-, Logout-, Session-, Cookie-, Health- und Middleware-Code nutzt diese Runtime-Verträge lokal.
- [x] 5.2 Benutzer, Rollen, Gruppen, Organisationen und Reconcile in `@sva/iam-admin` verschieben
  - Abgeschlossen: Role-Catalog-Reconciliation-Core, injizierbare Reconcile-HTTP-Orchestrierung, Rollen-Read-Orchestrierung, Rollen-Create-/Update-/Delete-Orchestrierung, Rollen-Mutationspersistenz, Rollen-/Gruppen-Resolution, Rollen-Sync-Helfer, Actor-Autorisierung mit Role-Level-Queries, Actor-Account- und Actor-Diagnose-Queries, Actor-Resolution-Service mit JIT-Übergang, User-Read-Orchestrierung für Liste, Detail und Timeline, User-Create-/Update-Orchestrierung, User-Create-/Update-/Import-Persistenz, Profilprojektion/-Persistenz, Sync-User-Import-Orchestrierung, Bulk-/Einzel-Deactivate-Orchestrierung, Legacy-Gruppen-Read-/Mutations-Orchestrierung, Organisations-Read-/Kontext-Read-/Mutations-Orchestrierung, Organisations-Persistenz/-Projektion sowie Gruppen-Read- und `iam-groups`-Mutations-Orchestrierung liegen in `@sva/iam-admin`; `auth` verdrahtet dafür nur noch Auth-Kontext, Feature-Flag, CSRF, Rate-Limit, Plattform-Flows, Response-Adapter und konkrete Runtime-Dependencies.
- [x] 5.3 DSR, Legal Texts und Audit-nahe Governance-Flows in `@sva/iam-governance` verschieben
  - Abgeschlossen: Read-Models, DSR-Export-Payload/Serialisierung, DSR-Export-POST-Flows, DSR-Export-Status-/Download-Flows, DSR-Maintenance-Runner, Governance-Workflow-Policy, Governance-Workflow-Executor, Governance-Compliance-Export, Legal-Text-HTML/Schemas, Legal-Text-Repository, Legal-Text-Mutation-Handler, Legal-Text-Listen-/Pending-Handler und Legal-Text-Request-Context liegen in `@sva/iam-governance`; `auth` enthält nur noch Boundary-Adapter für Auth-Kontext, Request-Scope und HTTP-Antworten.
- [x] 5.4 Instanzmodell, Host-Klassifikation, Registry und Provisioning in `@sva/instance-registry` verschieben
  - Abgeschlossen: Service-Orchestrierung, Keycloak-Ausführung, Provisioning-Reader, Keycloak-State-Adapter, Keycloak-Client-Factory-Helfer, Worker-Loop, allgemeine Instanz-HTTP-Handler, Keycloak-HTTP-Handler, Statusmutations-HTTP-Adapter, Auth-/Reauth-Guard-Regeln, Runtime-Wiring, Mutation-Fehlerklassifikation und Mutation-Input-Builder liegen in `@sva/instance-registry`; `auth` enthält nur noch Boundary-Adapter für Auth-Kontext, CSRF, konkrete Secrets, Keycloak-Admin-Client und Kompatibilitäts-Exports.
- [x] 5.5 Integrationspackages auf Zielverträge umstellen und direkte Auth-/Data-Interna entfernen

## 6. Enforcement

- [x] 6.1 Nx-Tags für alle Zielpackages und PII-relevanten Packages setzen
- [x] 6.2 `depConstraints` für Zielgrenzen, PII-Grenzen, Plugin-Grenzen und Browser-/Server-Grenzen aktivieren
- [x] 6.3 Alte Sammelimporte in ESLint verbieten
- [x] 6.4 Runtime-Import-Regeln und `check:server-runtime` für neue serverseitige Packages sicherstellen
- [x] 6.5 Boundary-Disables entfernen oder mit blockierendem Folgeticket dokumentieren
  - Stand: produktiver Code nutzt keine Boundary-Disables; der verbleibende `/* eslint-disable */`-Treffer liegt in der generierten TanStack-RouteTree-Datei.

## 7. Consumer Migration

- [x] 7.1 App-Imports auf Server-Funktionen, client-sichere Contracts oder Zielpackages umstellen
- [x] 7.2 Plugin-Imports ausschließlich auf Plugin-SDK-Verträge umstellen
- [x] 7.3 Routing-Imports auf neutrale Contracts umstellen
- [x] 7.4 Tests, Mocks und Fixtures auf neue Package-Grenzen umstellen
  - Stand: App-, Routing-, Mainserver-, Vitest- und Root-TS-Aliasse zeigen auf Zielpackages; `@sva/auth-runtime` enthält keine `@sva/auth`-/`@sva/auth/server`-Kante mehr.
- [x] 7.5 Alte Re-Exports und Sammel-Barrels löschen
  - Abgeschlossen: `@sva/auth-runtime/runtime-routes` exportiert Auth-, IAM-, Governance-, Legal-Text-, DSR-, Content- und Instance-Registry-Handler lokal aus `@sva/auth-runtime`; die temporäre `@sva/auth`-Dependency, TS-Pfade, Vitest-Aliasse und die Boundary-Ausnahme für `scope:auth-runtime -> scope:auth` wurden entfernt.

## 8. Documentation

- [ ] 8.1 `docs/architecture/package-zielarchitektur.md` finalisieren
- [ ] 8.2 `docs/architecture/04-solution-strategy.md` aktualisieren
- [ ] 8.3 `docs/architecture/05-building-block-view.md` aktualisieren
- [ ] 8.4 `docs/architecture/06-runtime-view.md` aktualisieren
- [ ] 8.5 `docs/architecture/08-cross-cutting-concepts.md` aktualisieren
- [ ] 8.6 `docs/architecture/09-architecture-decisions.md` und relevante ADRs aktualisieren
- [ ] 8.7 `docs/architecture/10-quality-requirements.md` und `11-risks-and-technical-debt.md` aktualisieren

## 9. Verification

- [ ] 9.1 `pnpm nx graph` oder gleichwertige Importanalyse gegen Zielgrenzen prüfen
- [ ] 9.2 `pnpm lint`
- [ ] 9.3 `pnpm test:unit`
- [ ] 9.4 `pnpm test:types`
- [ ] 9.5 `pnpm test:eslint`
- [ ] 9.6 `pnpm check:server-runtime`
- [ ] 9.7 `pnpm test:e2e`
- [ ] 9.8 `pnpm test:pr`
