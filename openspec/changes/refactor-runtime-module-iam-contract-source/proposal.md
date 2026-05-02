# Change: Gemeinsame Runtime-Quelle fuer Modul-IAM-Vertraege einfuehren

## Why

Die aktuelle Runtime-Pfadverdrahtung fuer Instanz-Modul-IAM verwendet in `packages/auth-runtime/src/iam-instance-registry/repository.ts` eine manuell gepflegte Registry. Seit `plugin.moduleIam` die kanonischen Modulvertraege beschreibt, existieren damit zwei Quellen fuer dieselbe fachliche Wahrheit.

Diese Doppelquelle ist fehleranfaellig: Runtime-Seeding, Modulverwaltung, Routing-Gating und kuenftige Plugin-Aenderungen koennen auseinanderlaufen, obwohl sie denselben Modulsatz beschreiben sollten. Der Umbau soll diese Driftquelle beseitigen, ohne `auth-runtime` direkt an React-lastige Plugin-Pakete zu koppeln.

## What Changes

- Eine gemeinsame, framework-agnostische Runtime-Quelle fuer Modul-IAM-Vertraege wird eingefuehrt
- Runtime- und Provisioning-Pfade lesen modulbezogene IAM-Vertraege ausschliesslich aus dieser gemeinsamen Quelle
- Manuelle Modul-IAM-Registry-Maps in `auth-runtime` werden entfernt
- Plugin- und Host-Integration bleiben deklarativ ueber `plugin.moduleIam`, aber die Runtime konsumiert einen stabilen, serverseitig sicheren Vertrag
- Paritaets- und Drift-Tests sichern ab, dass Routing, UI, Runtime-Seeding und Access-Control denselben Modulkatalog verwenden

## Impact

- Affected specs:
  - `instance-provisioning`
  - `iam-access-control`
- Affected code:
  - `packages/auth-runtime`
  - `packages/instance-registry`
  - `packages/plugin-sdk`
  - gegebenenfalls neues gemeinsames Workspace-Package oder neuer serverseitiger Contract-Edge
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
