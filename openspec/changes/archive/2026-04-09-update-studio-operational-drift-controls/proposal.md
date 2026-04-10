# Change: Betrieblichen Drift im Studio-Rollout systematisch reduzieren

## Why

Die aktuellen Studio-Incidents zeigen kein primaeres Logging- oder Routing-Problem, sondern wiederkehrenden betrieblichen Drift. Artefakt, Live-Service-Spec, Runtime-Flags, Operator-Kontext, DB-Schema/RLS und Tenant-Registry laufen auseinander, waehrend lokale gruene Tests und lokale Diagnostik nur einen Teil des realen Betriebsvertrags abdecken.

Zusaetzlich verlieren Teams viel Zeit durch Hidden State ausserhalb des Repos: lokale Shell-Overlays, abweichende Quantum-Kontexte, manuelle Portainer-Eingriffe und superuser-basierte Datenbankchecks koennen einen gesunden oder ungesunden Zustand falsch erscheinen lassen. Der Betriebsvertrag fuer `studio` muss deshalb expliziter, deterministischer und naeher an der echten Laufzeit werden.

## What Changes

- fuehrt ein verpflichtendes prod-nahes Parity-Gate vor mutierenden Remote-Deploys fuer `studio` ein
- macht Registry-, Auth- und RLS-Pruefungen aus Sicht von `APP_DB_USER` zu einem festen Bestandteil des Deploy-Contracts
- schreibt einen kanonischen Reconcile-Pfad nach manuellen Portainer-/Quantum-Eingriffen oder Incident-Recovery verbindlich fest
- dokumentiert die Vertragsgrenze zwischen lokaler Entwicklungsumgebung und dem produktionsnahen `studio`-Profil explizit
- baut bewusst auf `update-studio-swarm-migration-job`, `update-quantum-ops-decoupling`, `update-rollout-observability-gates` und `update-studio-rollout-network-consistency` auf, statt deren offene Anforderungen zu duplizieren
- fuehrt keine neue Transport-, Job- oder Netzwerkmechanik ein, sondern vereinheitlicht die Betriebsregeln fuer die bereits gehaerteten Pfade

## Impact

- Affected specs: `deployment-topology`
- Affected code:
  - `scripts/ops/runtime-env.ts`
  - `scripts/ops/runtime/remote-service-spec.ts`
  - `scripts/ops/runtime/process.ts`
  - `packages/data/src/instance-registry/server.ts`
  - Dokumentation unter `docs/development/`, `docs/guides/` und `docs/reports/`
- Affected arc42 sections:
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/07-deployment-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-scenarios.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
