# Change: SDK-Boundary finalisieren und Altpfade bereinigen

## Why

Der Package-Hard-Cut hat die Zielrollen bereits in `@sva/plugin-sdk` und `@sva/server-runtime` aufgeteilt, aber `@sva/sdk` bleibt aktuell als teilweiser Re-Export- und Helper-Einstieg bestehen. Dadurch existieren weiterhin mehrere oeffentliche Einstiege fuer dieselben Verantwortungen, waehrend Architektur-, ADR- und Entwicklerdokumentation den kanonischen Vertrag uneinheitlich beschreiben.

Der aktuelle Code ist bereits weitgehend auf die Zielpackages umgestellt; die offene Drift liegt vor allem in `@sva/sdk` als oeffentlicher Compat-Fassade und in mehreren normativen Dokumenten, die den Altpfad noch als regulaeren Vertrag beschreiben. Diese Inkonsistenz verwischt Ownership, erschwert Reviews und verlaengert die Migrationsphase unnoetig.

Der Architekturvertrag soll deshalb explizit finalisiert werden: `@sva/plugin-sdk` und `@sva/server-runtime` sind die kanonischen Zielpackages, `@sva/sdk` ist nur noch ein bewusst begrenzter Kompatibilitaetspfad mit dokumentiertem Restbestand und Abbaupfad.

## What Changes

- finalisiert die kanonische Boundary fuer Plugin- und Runtime-Vertraege
- deklariert `@sva/sdk` als deprecated Compatibility-Layer statt als Zielpackage
- verbietet neue fachliche Plugin-, Routing-, IAM-, Daten- und Runtime-Vertraege in `@sva/sdk`
- konsolidiert bereits vorhandenes Boundary-Enforcement und dokumentiert verbleibende Luecken statt pauschal neue Regeln zu versprechen
- bereinigt widerspruechliche Architektur-, ADR- und Entwicklerdokumentation an allen noch aktiven Normquellen
- inventarisiert die verbleibenden Compat-Exports und dokumentiert einen expliziten Abbaupfad fuer Restabweichungen

## Out of Scope

- keine breite Code-Migration produktiver Packages oder Apps, solange dort keine neuen aktiven `@sva/sdk`-Imports mehr vorliegen
- kein sofortiges Entfernen aller Re-Exports aus `packages/sdk`
- keine Neuaufteilung von Verantwortungen zwischen `plugin-sdk` und `server-runtime`

## Impact

- Affected specs:
  - `monorepo-structure`
  - `architecture-documentation`
- Affected code:
  - `packages/sdk/*`
  - `packages/plugin-sdk/*` nur falls Export-Mapping oder Deprecation-Hinweise angepasst werden
  - `packages/server-runtime/*` nur falls Export-Mapping oder Deprecation-Hinweise angepasst werden
  - `eslint.config.mjs` nur falls eine nachweisbare Boundary-Luecke dokumentiert und geschlossen wird
  - `docs/architecture/*`
  - `docs/guides/plugin-development.md`
  - `docs/monorepo.md`
  - `docs/development/observability-best-practices.md`
  - `docs/development/server-package-runtime-guards.md`
  - `docs/adr/ADR-034-plugin-sdk-vertrag-v1.md`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
  - `docs/architecture/11-risks-and-technical-debt.md`
  - `docs/architecture/package-zielarchitektur.md`

## Success Criteria

- alle normativen Architektur-, ADR- und Entwicklerquellen beschreiben `@sva/plugin-sdk` und `@sva/server-runtime` konsistent als Zielpackages
- `@sva/sdk` wird in diesen Quellen nur noch als deprecated Compatibility-Layer mit benannten Restpfaden beschrieben
- die verbleibenden Compat-Exports von `@sva/sdk` sind inventarisiert und einem Zielpackage zugeordnet
- falls bestehende Lint- und Review-Regeln bereits ausreichen, dokumentiert der Change dies explizit statt redundante Enforcement-Arbeit zu behaupten
