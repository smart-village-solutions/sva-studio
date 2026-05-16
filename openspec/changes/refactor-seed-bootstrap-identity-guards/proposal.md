# Change: Seed-, Bootstrap- und Reconcile-Verträge für Umgebungsidentität trennen

## Why
Der aktuelle lokale Tenant-Login kann ausfallen, obwohl `local-keycloak` korrekt konfiguriert ist, weil historische Seeds bestehende Registry-Identität stillschweigend auf produktionsnahe Host-, Realm- und Client-Werte zurückschreiben. Damit vermischen wir additive Baseline-Daten mit laufzeitkritischer Umgebungsidentität.

Für lokale Entwicklungsumgebungen, bestehende Staging-Umgebungen und neue Server fehlt damit ein klarer Vertrag, welche Pfade nur ergänzen dürfen und welche Pfade autoritativ Identität setzen oder korrigieren dürfen.

## What Changes
- Trennt normative Seed-, Bootstrap- und Reconcile-Semantik für Instanz-Identität und Baseline-Daten.
- Definiert geschützte Registry-/Auth-Felder, die in bestehenden Umgebungen standardmäßig nicht überschrieben werden dürfen.
- Legt fest, dass Standard-Seeds additive Daten pflegen, während autoritative Identitätsänderungen nur über explizite Bootstrap-/Reconcile-Pfade laufen.
- Ergänzt Guardrails für bestehende lokale und staging-nahe Umgebungen, damit abweichende Identitätswerte nicht still überschrieben werden.
- Verankert eine dokumentierte Unterscheidung zwischen neuer Umgebung und bestehender Umgebung im Deployment-/Betriebsvertrag.

## Impact
- Affected specs:
  - `instance-provisioning`
  - `deployment-topology`
- Affected code:
  - `packages/data/seeds/0001_iam_personas.sql`
  - `packages/data/seeds/*.sql`
  - `scripts/ops/runtime/local-instance-registry.ts`
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/bootstrap-local-instance-db/*`
  - mögliche Seed-/Bootstrap-Guards im Runtime- und Ops-Pfad
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
