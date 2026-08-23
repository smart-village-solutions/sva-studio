# Plan 022: POI-Formularserialisierung entflechten

> **Archivstatus:** DONE

> **Executor-Anweisung:** Arbeite nur im zugewiesenen Worktree. Führe vor jeder produktiven Änderung die Baseline und neue Characterization-Tests gegen den unveränderten Altcode aus. Bei einer STOP-Bedingung nicht improvisieren.

## Status

- **Priorität:** P1
- **Aufwand:** M–L
- **Risiko:** MITTEL
- **Abhängigkeit:** gemeinsam mit Plan 023 in Bundle A
- **Kategorie:** POI-Datenintegrität, Complexity, CRAP
- **Geplant auf:** `98e6ca3d7`, 15. August 2026
- **Fallow vorher:** `poi.detail-form.serialization.ts` hat 259 Zeilen, 27 Funktionen, Cyclomatic gesamt 197, Cognitive gesamt 85, MI 69,4, Complexity-Dichte 0,76 und sechs CRAP-Findings. Kritisch sind die Mapper ab Zeile 140 mit CC 33/CRAP 268,2 und ab Zeile 112 mit CC 26/CRAP 172; `compactAddress`, `compactContact`, `compactLocation` und der Medienmapper liegen jeweils bei CC 19/CRAP 97.
- **Ergebnis:** DONE – PR #1009, Merge-Commit `e17772eb3d0c7e2de47750d2c75e0dc67a74b94a`
- **Fallow nachher:** 259 Zeilen, 31 Funktionen, Cyclomatic gesamt 118, Cognitive gesamt 41, MI 78,4, Complexity-Dichte 0,46 und keine CRAP-Findings. Der Hauptserializer sank von CC 33 auf 9; der coveragegebundene Audit gegen das beim Merge aktuelle `origin/main` meldete PASS und für Complexity, Dead Code, Duplikation und Styling jeweils 0 eingeführte Befunde.

## Warum und Produktionsreichweite

Das Modul übersetzt das bearbeitete POI-Formular in den Mainserver-Mutationsvertrag. Fehler verlieren explizite Leerungen, verändern Koordinaten, Öffnungszeiten, Preise, Medien oder die Reihenfolge von Kategorien. Der Export läuft über `poi.detail-form.ts`, wird in `poi.detail-page.tsx` vor Create/Update aufgerufen und ist damit produktiv erreichbar. Der Hotspot-Score beträgt 15,9 bei 15 Commits, +365/−107 Zeilen und Fan-in 1.

## Scope

**In Scope:** `packages/plugin-poi/src/poi.detail-form.serialization.ts`, bei belegtem Bedarf ein minimales pluginlokales Helper-Modul, `packages/plugin-poi/tests/poi.detail-form.test.ts`, gemeinsamer OpenSpec-Change und Changelog für Bundle A.

**Out of Scope:** Events-/News-Module, Mainserver-Vertrag, öffentliche POI-Typen, Validierung, neue Shared-Package-Grenze, Clone `dup:9b9f8261`, funktionale Korrekturen.

**Aktive-Abgrenzung:** `refactor-shared-editor-primitives` besitzt POI-UI-
Sections und Repeater, erklärt Mapping/Validierung/Speichern aber ausdrücklich
als pluginlokal. `add-studio-data-form-and-test-foundations` setzt seine
Referenzimplementierung außerhalb des POI-Mappings um. Dieser Plan ändert weder
UI-Primitives noch Shared-Testinfrastruktur. Vor Start beide aktiven Changes und
Branch-Deltas erneut prüfen; bei Datei-, Testinfrastruktur- oder
Vertragsüberschneidung STOP.

## Characterization vor Refactoring

1. Baseline: `pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-form.test.ts` und `pnpm nx run plugin-poi:test:types`; beide müssen grün sein.
2. Gegen Altcode ergänzen und grün ausführen: `null`/`undefined`/Whitespace; leere und teilweise Adresse, Kontakt, Location; Latitude/Longitude einzeln, `NaN`, Infinity und numerischer String; Kategorien-Deduplikation und Reihenfolge; Öffnungszeiten mit Boolean-only-/Platzhalterzeilen; Preise einschließlich `0` und `false`; Medien ohne URL bzw. mit MIME-Normalisierung; Operator leer/teilweise; explizite Clears für Mobile Description, External ID, Keywords und Tags; Payload `undefined`, Objekt und falscher Runtime-Typ.
3. Für jedes neue Testset den unveränderten Produktionsdiff mit `git diff -- packages/plugin-poi/src` prüfen: vor dem Refactor darf dort keine Änderung stehen.

## Umsetzung

1. Wiederholte Normalisierung genau einmal pro Feld auswerten und fachlich benannte kleine Mapper verwenden. Keine Reflection, keine generische Pfad-Engine und kein `any`.
2. Öffnungszeiten, Preise und Medien in jeweils klaren, reinen Transformationen halten; Fallback-, Filter- und Reihenfolgesemantik unverändert lassen.
3. Erst nach grüner Characterization produktiven Code ändern. Nach jedem Block den gezielten Unit-Run wiederholen.
4. Gemeinsam mit Plan 023 OpenSpec `refactor-poi-form-contract` strikt validieren.

## Gates und Fertig-Kriterien

- `pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-form.test.ts`
- `pnpm nx run plugin-poi:test:coverage --testFiles=tests/poi.detail-form.test.ts`
- `pnpm nx run plugin-poi:test:types`, `pnpm nx run plugin-poi:lint`, `pnpm nx run plugin-poi:build`
- `pnpm complexity-gate`, `pnpm exec openspec validate refactor-poi-form-contract --strict`, `pnpm check:file-placement`, `pnpm check:studio-changelog`, `git diff --check`
- Final einmal `pnpm test:pr`, sofern der gemessene affected Scope praktikabel ist; Abweichung dokumentieren.
- Vor Draft und nach Source-Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/plugin-poi --explain --format json`; PASS mit Complexity/Dead Code/Duplication/Styling introduced 0 und ohne moderate CRAP-Neufunde, bei Bedarf mit echter Coverage wiederholen.
- Zielanker und alle berührten Serialization-Findings sind verschwunden; öffentliche Shapes, Werte, Reihenfolge und Clears bleiben byte-/deep-equal zur Characterization.

## STOP

- STOP, wenn Mainserver-Feldvertrag, Validierung oder öffentliche POI-Typen geändert werden müssten.
- STOP, wenn Altcode-Tests widersprüchliche Clear-, Fallback- oder Reihenfolgesemantik zeigen.
- STOP bei aktiver Source-/Testüberschneidung oder wenn eine Cross-Plugin-Abstraktion nötig erscheint.
