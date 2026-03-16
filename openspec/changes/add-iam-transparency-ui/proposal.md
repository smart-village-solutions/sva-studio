# Change: IAM-Transparenz-UI für Governance, DSGVO und Verwaltungsmetadaten

## Warum

Im aktuellen IAM-Stand werden wesentliche Daten zwar gespeichert und teilweise über API-Contracts bereitgestellt, tauchen in der React-UI aber gar nicht oder nur stark reduziert auf. Dadurch fehlen Administrations- und Compliance-Sichten für Governance-Workflows, Betroffenenrechte, strukturierte Berechtigungen sowie wichtige Metadaten in Benutzer-, Rollen- und Organisationsansichten.

## Was ändert sich

- Ausbau von `/admin/iam` zu einem tab-basierten IAM-Transparenz-Cockpit für Rechte, Governance und DSGVO/Retention
- Neue Self-Service-Oberfläche unter `/account/privacy` für Datenexporte, Betroffenenanfragen und optionale Verarbeitung
- Anreicherung bestehender Admin-Ansichten für Benutzer, Rollen, Organisationen und Organisationskontext um heute unsichtbare IAM-Metadaten
- Präzisierung der Access-Control-Sicht, damit strukturierte Permission-Felder und Diagnoseinformationen konsistent in der UI nutzbar sind
- Präzisierung der DSR-Capability, damit Status- und Admin-Bearbeitung nicht nur API-, sondern auch UI-seitig spezifiziert sind

## Impact

- Betroffene Specs:
  - `account-ui`
  - `iam-access-control`
  - `iam-data-subject-rights`
- Betroffener Code:
  - `apps/sva-studio-react/src/routes/account/*`
  - `apps/sva-studio-react/src/routes/admin/*`
  - `apps/sva-studio-react/src/components/OrganizationContextSwitcher.tsx`
  - `apps/sva-studio-react/src/hooks/*`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/core/src/iam/authorization-contract.ts`
  - `packages/auth/src/iam-authorization/*`
  - `packages/auth/src/iam-data-subject-rights/*`
- Betroffene arc42-Abschnitte:
  - `04 Loesungsstrategie`
  - `05 Bausteinsicht`
  - `06 Laufzeitsicht`
  - `08 Querschnittskonzepte`
  - `09 Architekturentscheidungen`
  - `11 Risiken und technische Schulden`
