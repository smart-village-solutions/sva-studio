# Change: Kanonischen Permission-Katalog und additiven Tenant-Reconcile einführen

## Why

Permission-Definitionen und Grants für `system_admin` werden derzeit in Seed-Plänen, Runtime-Baselines und einzelnen SQL-Migrationen mehrfach gepflegt. Diese Parallelquellen können auseinanderlaufen: Neu angelegte Tenants erhalten dann nicht zwingend dieselben Rechte wie bereits migrierte Tenants.

Das System benötigt eine einzige einsehbare und typsichere Quelle, aus der neue Tenant-Baselines, Modulaktivierungen und kontrollierte Nachziehläufe für bestehende Tenants deterministisch abgeleitet werden.

## What Changes

- Ein kanonischer Permission-Katalog beschreibt Key, Beschreibung, Ressourcentyp, Verfügbarkeit (`root`, `tenant` oder `module`) und Lifecycle einer Permission.
- Tenantweite Permissions und Permissions aktivierter Module erhalten standardmäßig einen Grant an `system_admin`; Ausnahmen müssen explizit im Katalog stehen.
- Neue Tenants, Modulaktivierungen und Baseline-Reconcile verwenden dieselbe Katalogauswertung statt lokaler Parallelarrays.
- Ein idempotenter, additiver Reconcile ergänzt Definitionen und verwaltete Grants für bestehende Tenants und invalidiert betroffene Permission-Snapshots.
- Fehlende Katalogeinträge oder auf `deprecated` gesetzte Permissions führen niemals automatisch zum Löschen persistierter Permission-Daten oder manueller Grants.
- Modul-Permissions müssen spätestens bei Modulaktivierung materialisiert werden; bereits vorhandene Definitionen bleiben auch ohne aktive Modulzuweisung zulässig.
- `iam.accounts.delete` wird über den Katalog und den kontrollierten Reconcile für bestehende Tenants einschließlich `de-studio-sandbox` nachgezogen.
- Drift-, Eindeutigkeits-, Root-/Tenant-Isolations- und Idempotenztests sichern den Katalog und seine Verbraucher ab.

## Impact

- Affected specs: `iam-access-control`, `instance-provisioning`
- Affected code: `packages/core`, `packages/data-repositories`, `packages/instance-registry`, `packages/studio-module-iam`, IAM-Seeds und Migrations-/Rollout-Gates
- Affected data: `iam.permissions`, `iam.role_permissions`, Permission-Snapshot-Invalidierung
- Affected arc42 sections: `docs/architecture/04-solution-strategy.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/09-architecture-decisions.md`
- ADR required: kanonischer Permission-Katalog und additiver Reconcile als neues IAM-Pattern
- Rollout: ausschließlich über `docs/guides/studio-rollout-process.md`; kein manueller SQL-Fix als Standardpfad

