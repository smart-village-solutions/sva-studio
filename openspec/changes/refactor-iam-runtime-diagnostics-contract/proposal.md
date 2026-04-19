# Change: Einheitlichen Runtime-Diagnostikvertrag für IAM einführen

## Why

Die Analyse in `docs/reports/iam-diagnostics-analysis-2026-04-19.md` zeigt, dass Auth-, IAM-, Registry- und Provisioning-nahe Fehler bereits viele gute Einzelsignale besitzen, diese aber nicht als einheitlicher öffentlicher Diagnosevertrag bis in Browser und UI weitergereicht werden.

Besonders kritisch ist die Lücke zwischen serverseitig vorhandenen `reason_code`-/`requestId`-/Drift-Signalen und der heutigen Browser- bzw. UI-Wahrnehmung, die oft nur zwischen `401` und generischem Fehler unterscheidet.

## What Changes

- führt einen einheitlichen, additiven Runtime-Diagnostikvertrag für Auth-, IAM- und Provisioning-nahe Fehler ein
- vereinheitlicht die öffentliche Fehlerklassifikation für Session-, Actor-, Keycloak-, Schema- und Registry-/Provisioning-Drift
- erweitert Browser-Fehlerobjekte und UI-Datenpfade so, dass `classification`, `status`, `requestId`, `safeDetails` und `recommendedAction` nutzbar bleiben
- richtet Runtime-IAM-Fehler und Instanz-/Keycloak-Preflight auf kompatible Driftbegriffe aus
- macht den Keycloak-User- und Rollenabgleich als eigenen Diagnosepfad in Runtime, Admin-UI und Folgekorrelation sichtbar
- behandelt die verbleibende Doppelrolle von `SVA_ALLOWED_INSTANCE_IDS`, damit registrygeführte Runtime-Freigabe und Ops-/Fallback-Sicht nicht weiter auseinanderlaufen
- ergänzt gezielte Tests für Serververtrag, Browser-Parsing und UI-Statusbilder

## Impact

- Affected specs:
  - `iam-core`
  - `account-ui`
  - `instance-provisioning`
- Affected code:
  - `packages/auth/src/`
  - `packages/core/src/iam/`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `apps/sva-studio-react/src/providers/auth-provider.tsx`
  - `apps/sva-studio-react/src/routes/account/`
  - `apps/sva-studio-react/src/routes/admin/instances/`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
