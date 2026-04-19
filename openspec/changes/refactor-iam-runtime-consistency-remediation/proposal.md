# Change: Eigentliche IAM-Laufzeitprobleme fachlich beheben

## Why

Die Analyse in `docs/reports/iam-diagnostics-analysis-2026-04-19.md` und der anschließende Retest gegen `studio` zeigen, dass der zuletzt ausgerollte Stand die Diagnosequalität deutlich verbessert hat, die eigentlichen IAM-Probleme aber weiter bestehen.

Besonders sichtbar sind vier zusammenhängende Problemcluster: `registry_or_provisioning_drift`, fachlich inkonsistente User-/Membership-/Profilprojektion, fehlerhafter Keycloak-User-/Rollenabgleich und technische Teilpfade mit `IDP_UNAVAILABLE` oder instabilen Sync-Hängern. Diese Probleme müssen als eigener Folgechange behoben werden, statt nur besser erklärt zu werden.

## What Changes

- behebt den tenantübergreifenden Keycloak-User- und Rollenabgleich als eigenständigen fachlichen Arbeitsstrang
- stellt sicher, dass User-, Membership-, Profil- und Rollenprojektion zwischen `/auth/me`, `/account`, `/admin/users` und `/admin/roles` konsistent aus denselben fachlichen Quellen abgeleitet werden
- trennt technische IDP-/DB-/Provisioning-Fehler klar von fachlichen `manual_review`- oder Mapping-Inkonsistenzen und behebt die heute sichtbaren Fehlpfade
- schließt aktive `registry_or_provisioning_drift`-Lücken rund um Tenant-Admin-Client, Secret-Ausrichtung und Reconcile-Voraussetzungen
- beseitigt instabile Sync-Pfade, bei denen User-Synchronisation oder Rollen-Reconcile zwar gestartet werden, aber fachlich hängen bleiben oder ohne wirksames Ergebnis enden
- ergänzt reproduzierbare Tests für Reconcile-, Sync-, Membership- und Drift-Remediation

## Impact

- Affected specs:
  - `iam-core`
  - `account-ui`
  - `instance-provisioning`
- Affected code:
  - `packages/auth/src/`
  - `packages/core/src/iam/`
  - `packages/data/src/`
  - `apps/sva-studio-react/src/lib/iam-api.ts`
  - `apps/sva-studio-react/src/routes/account/`
  - `apps/sva-studio-react/src/routes/admin/users/`
  - `apps/sva-studio-react/src/routes/admin/roles/`
  - `apps/sva-studio-react/src/routes/admin/instances/`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
