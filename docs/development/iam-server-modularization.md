# IAM-Server-Modularisierung

Die serverseitigen IAM-Hotspots wurden auf eine Fassade-plus-Kernmodul-Struktur umgestellt.

## Zielbild

- Öffentliche Dateien wie `iam-account-management.server.ts` oder `routes.server.ts` bleiben dünne Entry-Points.
- Fachliche Unterordner bündeln die zuständigen Bausteine:
  - `auth-server/`
  - `routes/`
  - `iam-authorization/`
  - `iam-account-management/`
  - `iam-data-subject-rights/`
  - `iam-governance/`
  - `keycloak-admin-client/`
- Größere Restkomplexität liegt explizit in Fassaden-nahen Hotspots wie `users-handlers.ts`, `roles-handlers.ts`, `reconcile-handler.ts` und `shared.ts` und wird über `QUAL-*`-Tickets nachverfolgt.

## Arbeitsregel

- Neue Endpunkte, Hilfslogik und Refactorings werden in den Fachordnern ergänzt.
- Die Fassaden dienen nur noch als stabile Importpfade für `@sva/auth-runtime/server` und interne Konsumenten.
- `iam-account-management/core.ts` bleibt bewusst dünn und delegiert nur noch in fachliche Handler-Module.
- Weitere Zerlegungsschritte für `iam-account-management/` laufen unter `QUAL-112` und betreffen insbesondere Query-/Mutation-Splitting, Shared-Runtime-Helfer und den Reconcile-Scheduler.
- Änderungen mit Architekturwirkung müssen `docs/architecture/04`, `05`, `06`, `08`, `09`, `10` und `11` prüfen.
