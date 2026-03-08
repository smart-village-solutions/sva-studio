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
- Größere Restkomplexität liegt explizit in `core.ts`-Dateien und wird über `QUAL-*`-Tickets nachverfolgt.

## Arbeitsregel

- Neue Endpunkte, Hilfslogik und Refactorings werden in den Fachordnern ergänzt.
- Die Fassaden dienen nur noch als stabile Importpfade für `@sva/auth/server` und interne Konsumenten.
- Änderungen mit Architekturwirkung müssen `docs/architecture/04`, `05`, `06`, `08`, `09`, `10` und `11` prüfen.
