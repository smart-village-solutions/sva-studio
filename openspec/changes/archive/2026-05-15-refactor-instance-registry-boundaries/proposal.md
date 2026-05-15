# Change: Instanzverwaltungs-Boundaries bereinigen und Root-API härten

## Why

Die Instanzverwaltung enthält parallel gepflegte Persistenzpfade, aufgeblähte Root-Exports und große Orchestrierungsdateien. Das ist nicht nur ein Wartbarkeitsproblem, sondern erhöht bereits das Risiko fachlicher Divergenzen.

## What Changes

- `@sva/data-repositories` wird als führende Persistenzschicht für die Instanz-Registry festgezogen.
- `@sva/data` führt keine eigene Instanz-Registry-Persistenzlogik mehr, sondern delegiert auf die führende Schicht.
- `@sva/instance-registry` reduziert seine Root-Exportfläche auf stabile Verträge und Fassaden.
- Service- und HTTP-Komposition der Instanzverwaltung werden in kleinere fachliche Module geschnitten.

## Impact

- Affected specs: `instance-provisioning`, `complexity-quality-governance`
- Affected code: `packages/data`, `packages/data-repositories`, `packages/instance-registry`
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
