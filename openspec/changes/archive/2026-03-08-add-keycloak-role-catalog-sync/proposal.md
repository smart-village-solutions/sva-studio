# Change: Studio-verwaltete Rollen nach Keycloak synchronisieren

## Why

Die Rollenverwaltung im Studio ist funktional vorhanden, aber neue bzw. geänderte Rollen werden aktuell nicht als Realm-Rollen in Keycloak verwaltet. Dadurch bleibt Keycloak als zweite manuelle Admin-Oberfläche notwendig und es entsteht Drift zwischen IAM-Datenbank und IdP.

## What Changes

- Studio wird zur führenden Oberfläche für den gesamten Rollen-Lebenszyklus (Create, Update, Delete, Assign).
- Rollen-CRUD unter `/api/v1/iam/roles` synchronisiert Rollen zusätzlich nach Keycloak (nicht nur User-Zuweisungen).
- Einführung eines stabilen Role-Mappings zwischen `iam.roles` und Keycloak-Rollen (inkl. Sync-Status).
- Implementierung eines Reconciliation-Laufs (manuell + geplant), um Drift zwischen DB und Keycloak zu erkennen und zu beheben.
- Erweiterung von Auditing und Monitoring um Role-Sync-Ereignisse und Drift-Metriken.
- Erweiterung der Keycloak-Service-Account-Berechtigungen auf das für Rollenverwaltung notwendige Minimum.

## Impact

- Affected specs: `iam-core`, `iam-access-control`
- Affected code:
  - `packages/auth/` (Keycloak Admin Role API, Sync-Orchestrierung, Reconcile-Job)
  - `packages/data/` (Schema-Erweiterung für Role-Mapping/Sync-Status, Migration)
  - `apps/sva-studio-react/` (Rollen-UI mit Sync-Status und Fehlerhinweisen)
  - `docs/guides/` (Betriebs- und Setup-Dokumentation Keycloak-Rollen-Sync)
- Affected arc42 sections:
  - `05-building-block-view`
  - `06-runtime-view`
  - `07-deployment-view`
  - `08-cross-cutting-concepts`
  - `09-architecture-decisions`
  - `11-risks-and-technical-debt`

## Dependencies

- `add-account-user-management-ui` muss umgesetzt und als Basis verfügbar sein.
- Keycloak-Service-Account benötigt zusätzliche Rechte für Realm-Rollenverwaltung (Least Privilege).

## Risks

- Höhere Kopplung an Keycloak Admin API.
- Zusätzliche Betriebs-Komplexität durch Reconciliation und Drift-Handling.
- Fehlkonfiguration der Keycloak-Berechtigungen kann Rolle-CRUD blockieren.
