# PR 302: Post-Merge- und Post-Deploy-Testliste

Diese grobe Testliste bündelt die wichtigsten Prüfungen nach Merge und Deploy von PR 302.

## 1. CI und Release

- Neuer Push auf `main`: GitHub Actions laufen ohne Nx-Cloud-Warnungen oder `nx fix-ci`.
- Studio-Image-Build läuft durch.
- Deploy zieht das neue Image/Artifact.
- Runtime startet ohne Server-ESM- oder Importfehler.

## 2. Login, Session und Logout

- Plattform-Login auf Root-/Canonical-Host.
- Tenant-Login über Tenant-Host/Realm ohne `instanceId`-Claim.
- Tenant-Login mit passendem `instanceId`-Claim.
- Tenant-Login mit widersprüchlichem `instanceId`-Claim: muss fail-closed sein.
- Session-Cookie löschen ohne Logout: User sieht Hinweis und Login-Link führt zurück zur ursprünglichen Seite.
- Header-Logout: muss Browser-Navigation/IdP-End-Session auslösen.
- Logout aus Rechtstext-Dialog.
- Nach Logout darf Silent-SSO nicht sofort wieder einloggen.

## 3. Tenant, Keycloak und Provisioning

- Root-Host `studio.smart-village.app`: `/admin/users` und `/admin/roles` laufen im Platform-Scope und dürfen kein `invalid_instance_id` liefern.
- Root-Host Keycloak-User-Sync: Button auf `/admin/users` nutzt den Plattform-Realm und meldet `executionMode=platform_admin`.
- Bestehender Tenant-Realm: Login funktioniert weiter.
- Neuer Tenant-Realm: Bootstrap/Provisioning prüfen.
- Tenant-lokaler User ohne `instanceId`-Attribut wird akzeptiert/importiert.
- Tenant-lokaler User mit fremdem `instanceId`-Attribut wird übersprungen/diagnostiziert.
- Keycloak-Checkliste: fehlender `instanceId`-Mapper ist Warnung, kein Login-Blocker.
- Tenant-User-Sync: HTTP 200 mit `partial_failure` ist kein Browser-Crash, aber ein fachlich offener Befund; Zähler für `manualReviewCount`, `updatedCount`, `skippedCount` und `totalKeycloakUsers` dokumentieren.
- Tenant-Rollen-Reconcile: `IDP_FORBIDDEN` gegen Tenant-Admin-Client-Rechte, Realm-Zuordnung und Secret-Ausrichtung prüfen; kein Fallback auf globale Plattform-Credentials.

## 4. Admin-Routing

- `/admin/content` funktioniert als kanonische Content-Route.
- Legacy `/content`, `/content/new`, `/content/:id` redirecten korrekt.
- Core-Admin-Routen funktionieren:
  - `/admin/users`
  - `/admin/organizations`
  - `/admin/roles`
  - `/admin/instances`
- Detailseiten mit korrekten Param-Namen laden:
  - User
  - Organization
  - Role
  - Instance
- Keine Plugin/Admin-Resource darf Core-Pfade wie `users`, `roles`, `organizations` shadowen.

## 5. Navigation und UI

- Sidebar zeigt Content/Admin-Einstiege korrekt.
- Breadcrumbs für `/admin/content` und Detailseiten.
- Header zeigt Login, Logout und Konto korrekt.
- Home-Seite zeigt Session-Expired-Hinweis korrekt.
- Keine kaputten Links zu alten `/content*`-Zielen außer Redirect-Kompatibilität.

## 6. Plugin-Verträge und Namespacing

- Plugin-News lädt und registriert sich korrekt.
- Plugin-Identifier/Namespaces werden validiert.
- Ungültige Plugin-IDs, Content-Types, Admin-Resource-IDs oder Audit-Events fail-fast.
- Kollisionen zwischen Host- und Plugin-Registrierungen werden deterministisch abgelehnt.

## 7. News-Plugin und Content

- Bestehende alte News mit `contentType: "news"` bleiben sichtbar.
- Alte News können bearbeitet werden und werden serverseitig validiert/sanitized.
- Neue News werden als `news.article` erstellt.
- News-Liste, Erstellen, Bearbeiten und Löschen im UI prüfen.
- E2E: News-Plugin Smoke-Test gegen deployte Umgebung.

## 8. Content-Management allgemein

- Content-Liste unter `/admin/content`.
- Content-Editor für neue und bestehende Einträge.
- Berechtigungen für Content-Zugriff.
- Fehlerfälle:
  - ungültiger Payload
  - fehlender CSRF/Idempotency-Key
  - nicht berechtigt

## 9. Rechte, Rollen und Guards

- Nicht eingeloggter Zugriff auf geschützte Routen leitet zu Login mit `returnTo`.
- User ohne Rolle bekommt klaren Fehler.
- Editor/Admin/System-Admin sehen erwartete Bereiche.
- Tenant-User sieht nur tenant-relevante Daten.

## 10. Observability und Diagnose

- Auth-Logs enthalten Scope/Instance-Kontext ohne PII.
- Tenant-Scope-Konflikt hat `reason_code=tenant_scope_conflict`.
- Logout-Logs enthalten keine sensiblen Redirect-Querys.
- Routing-/Plugin-Konflikte werden strukturiert geloggt.

## 11. OpenSpec und Docs-Sanity

- Relevante Guides stimmen mit deploytem Verhalten überein.
- Keycloak-Doku: Mapper als Warnung/Interop, nicht als Pflicht.
- Plugin-Development-Guide passt zu Namespacing-Regeln.

## Empfohlene Reihenfolge

1. Deploy/Health
2. Root-Login und Platform-IAM (`/admin/instances`, `/admin/users`, `/admin/roles`, Platform-User-Sync)
3. Login/Logout
4. Tenant-Login
5. Tenant-Admin-Routing
6. Content/News
7. Provisioning/Keycloak inkl. Tenant-User-Sync und Rollen-Reconcile
8. Observability
