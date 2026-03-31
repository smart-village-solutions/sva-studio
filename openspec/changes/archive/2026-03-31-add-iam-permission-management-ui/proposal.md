# Change: Inkrementelle Rechteverwaltung in der bestehenden IAM-Admin-UI

## Why

Die bestehende IAM-Admin-Oberfläche bietet bereits eine Rollenliste mit Metadaten, Create/Edit/Delete-Flows und eine separate IAM-Transparenzseite mit Rechteübersicht, Governance-Fällen, DSR-Fällen sowie einer Szenario-Prüfung. Für die eigentliche Rechtepflege ist die Rollenansicht derzeit aber noch zu technisch und zu fragmentiert: Berechtigungen werden primär als flache `permissionKey`-Listen dargestellt, während Diagnose- und Prüffunktionen an anderer Stelle liegen.

Für SVA Studio wird deshalb kein neues Ownership- oder Policy-Modell benötigt, sondern eine auf den vorhandenen UI- und Contract-Bausteinen aufsetzende Weiterentwicklung der Rollenverwaltung. Ziel ist eine fachlich besser lesbare, aber weiterhin kompatible Rechteverwaltung, die bestehende Rollen-, Permissions- und Authorize-Daten wiederverwendet und den aktuellen Implementierungsstand nicht künstlich überdehnt.

## What Changes

- Weiterentwicklung von `/admin/roles` aus der bestehenden Tabellen- und Expand-Ansicht zu einem klareren Berechtigungsarbeitsbereich innerhalb der vorhandenen Seite
- Fachlich lesbarere Darstellung vorhandener Rollen-Permissions auf Basis bestehender Datenstrukturen statt ausschließlicher Anzeige roher `permissionKey`-Listen
- Verknüpfung der Rollenverwaltung mit bereits vorhandenen IAM-Transparenz- und Prüffunktionen statt Einführung eines parallelen Admin-Moduls
- Spezifikation einer inkrementellen Detailansicht für Rollen mit Metadaten, Berechtigungen, Zuweisungskontext und Prüfeinstieg
- Festlegung, welche vorhandenen Autorisierungs- und Explainability-Felder für UI, Vorschau und Szenario-Prüfung verbindlich wiederverwendet werden
- Festlegung, wie System- und extern verwaltete Rollen in der UI als read-only kenntlich bleiben
- Verankerung, dass neue oder überarbeitete Komponenten für diese Rechteverwaltung auf `shadcn/ui`-Primitives und bestehende Admin-Patterns aufbauen
- Verankerung, dass sichtbare UI-Bezeichnungen lokalisiert und fachlich formuliert werden, während technische IDs und `permissionKey`-Werte nur ergänzend erscheinen
- Definition konsistenter Zustände für erlaubte, deaktivierte, read-only und serverseitig verweigerte Interaktionen in Rollen- und relevanten Fach-UI-Flächen
- Festlegung einer umsetzungsnahen Verifikationsstrategie für Unit-, Integrations-, E2E-, Accessibility- und i18n-Tests

## Impact

- Affected specs:
  - `account-ui`
  - `iam-access-control`
- Affected code:
  - `apps/sva-studio-react/src/routes/admin/roles/*`
  - `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
  - `apps/sva-studio-react/src/routes/content/*`
  - `apps/sva-studio-react/src/hooks/use-roles.ts`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `packages/core/src/iam/*`
  - `packages/auth/src/iam-authorization/*`
  - `packages/auth/src/iam-account-management/*`
- Affected arc42 sections:
  - `04 Solution Strategy`
  - `05 Building Block View`
  - `06 Runtime View`
  - `08 Crosscutting Concepts`
  - `10 Quality Requirements`
