# Change: Instance-Registry-Mutationswerte typsicher strukturieren

## Why

Die Create- und Update-Pfade der Instanz-Registry koppeln fachliche Eingaben unmittelbar an lange, positionsabhängige SQL-Wertelisten. Benannte pure Wertsegmente sollen diese Datenintegritäts- und Secret-Verträge prüfbar machen, ohne das Laufzeitverhalten zu verändern.

## What Changes

- Charakterisiert die vollständigen Create- und Update-Positionsverträge einschließlich Secret-Erhalt, explizitem Löschen und Ersetzen.
- Strukturiert die Wertelisten in kleine fachlich benannte pure Segmente.
- Behält SQL-Text, Schema, öffentliche Repository-Verträge, Hostname-Reihenfolge und Fehleridentität unverändert bei.

## Impact

- Affected specs: `instance-provisioning`
- Affected code: `packages/data-repositories/src/instance-registry/repository-mutations.ts`
- Affected docs: `docs/architecture/05-building-block-view.md`, `docs/architecture/08-cross-cutting-concepts.md`
- Keine Schemaänderung und keine Migration
