# Change: Keycloak-Rollenabgleich auf technische Sonderrollen begrenzen

## Why
Die bestehende Spezifikation beschreibt Keycloak weiterhin als System of Record für Realm-Rollen und fordert für studioverwaltete Rollen einen bidirektionalen Abgleich. Das widerspricht dem bereits normierten Zwei-Ebenen-Modell aus Plattformrolle `instance_registry_admin`, tenantlokaler Sonderrolle `system_admin` und sonstiger fachlicher Autorisierung aus der IAM-Datenbank. Solange fachliche Rollen parallel in Keycloak und in der IAM-Datenbank gepflegt werden, bleiben doppelte Wahrheiten, widersprüchliche UI-Projektionen und riskante Drift-Pfade bestehen.

## What Changes
- Begrenze den normativen Keycloak-Rollenabgleich auf technische Sonderrollen und Realm-Zugangskontrakte.
- Definiere Keycloak für Rollen nicht mehr als generelle Quelle tenantlokaler Fachautorisierung.
- Verlagere tenantlokale Custom-Rollen, Gruppen und deren Permissions vollständig in die IAM-Datenbank.
- Stelle Session-, Guard- und Profilprojektionen auf kanonische IAM-Rollen und Permissions um, statt rohe Keycloak-Rollenlisten fachlich auszuwerten.
- Liefere in `/auth/me` beide Sichten explizit getrennt aus: kanonische IAM-Rollen (inklusive impliziter Rollenwirkung aus Gruppenzuordnungen) und rohe Keycloak-Rollen als technische Sicht.
- Erhalte Legacy-Keycloak-Rollen nur noch als Diagnose-, Drift- und Migrationsinput.
- Halte den Umbaupfad additiv: erst Lesepfade und Projektionen umstellen, dann Sync einschränken, zuletzt Legacy-Cleanup aktivieren.

## Impact
- Affected specs:
  - `iam-core`
  - `iam-access-control`
  - `instance-provisioning`
  - `account-ui`
- Affected code:
  - `packages/auth-runtime/src/*`
  - `packages/iam-admin/src/*`
  - `packages/data/src/iam/*`
  - `packages/instance-registry/src/*`
  - `apps/sva-studio-react/src/lib/*`
  - `apps/sva-studio-react/src/routes/account/*`
  - `apps/sva-studio-react/src/routes/admin/*`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
