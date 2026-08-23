# Plan 023: POI-Inbound-Mapping charakterisieren und vereinfachen

> **Archivstatus:** REJECTED

> **Executor-Anweisung:** Dieser Plan ist das zweite eigenständige Zielproblem in Bundle A. Seine Characterization-Evidenz muss separat erkennbar bleiben, auch wenn dieselbe Testdatei wie Plan 022 verwendet wird.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** MITTEL
- **Ergebnis:** REJECTED – wirtschaftlicher STOP nach Characterization und unabhängigem Review
- **Abhängigkeit:** gemeinsam mit Plan 022
- **Kategorie:** POI-Legacy-Daten, Complexity, CRAP
- **Geplant auf:** `98e6ca3d7`, 15. August 2026
- **Fallow vorher:** `poi.detail-form.mapping.ts` hat 130 Zeilen, 11 Funktionen, CC gesamt 96, Cognitive gesamt 42, MI 70,6 und Dichte 0,74. Zielanker ist `mapPoiContentToFormValues` mit CC 27/Cognitive 14/CRAP 184,5. `mapPriceToFormValue` liegt bei CC 16/CRAP 71,3; die bereits kleinen Kontakt-, Adress- und Location-Mapper liegen zwischen CRAP 43,1 und 49,5 und sind Characterization-, nicht zwingend Refactoring-Ziele.

## Warum und Produktionsreichweite

Das Modul wandelt bestehende Mainserver-POIs in Formularwerte um. Es entscheidet über Legacy-Kategorien, Defaultzeilen, `active !== false`, Numerik und Payload-Text. Der Export läuft über `poi.detail-form.ts` und wird nach `getPoiDetail` vor `react-hook-form reset` in `poi.detail-page.tsx` aufgerufen. Der Hotspot hat sechs Commits, +154/−25 Zeilen und Fan-in 1.

## Ergebnis und wirtschaftlicher STOP

Die separate Characterization für Kategorienpriorität, Defaults, Legacywerte,
Numerik, Payload, Listenreihenfolge und Referenzverhalten ist grün und bleibt als
zusätzliche Vertragsabsicherung bestehen. Der anschließend erprobte produktive
Refactor wurde jedoch vollständig verworfen: Die Datei stieg von 130 auf 146
Zeilen und von 11 auf 16 Funktionen; Cyclomatic gesamt stieg von 96 auf 101,
während Cognitive gesamt nur von 42 auf 41 sank. Die fünf neuen Single-use-
Mapper verteilten bestehende Entscheidungen überwiegend über weitere
Funktionsgrenzen und erhöhten damit Ownership, statt sie belastbar zu senken.

`packages/plugin-poi/src/poi.detail-form.mapping.ts` wurde deshalb exakt auf die
Bundle-Basis `884248ef7a33c23e63f01cfaca52d83425f4be4e` zurückgesetzt. Der Zielanker
`mapPoiContentToFormValues` mit CC 27/Cognitive 14/CRAP 184,5 bleibt transparent
als Bestandsfinding bestehen. Eine spätere Bearbeitung braucht einen anderen,
fachlich begründeten Ansatz; bloße Funktionszerlegung erfüllt den Nutzen-
Aufwand-Schnitt nicht.

## Scope

**In Scope:** `mapPoiContentToFormValues` in `packages/plugin-poi/src/poi.detail-form.mapping.ts`, nur bei fachlichem Bedarf unmittelbar verwendete pluginlokale Mapper, `packages/plugin-poi/tests/poi.detail-form.test.ts`, gemeinsamer OpenSpec-/Changelog-Scope.

**Out of Scope:** rein metrisches Zerlegen der bereits 8–13 Zeilen kleinen Kontakt-, Adress- und Location-Mapper, Events-Mapper, der kleine Clone `dup:9b9f8261`, Mainserver-Snapshots, neue Defaultwerte, Änderung öffentlicher Formtypen oder UI-Komponenten.

## Characterization vor Refactoring

1. Baseline: `pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-form.test.ts` und `pnpm nx run plugin-poi:test:types`; beide müssen grün sein.
2. Eigene Tests für: Kategorienliste gewinnt vor `categoryName`; Fallback auf `categoryName`; leere Kategorien; `active` true/false/fehlend; fehlende vs. leere Adressen, Web-URLs, Öffnungszeiten, Preise und Zertifikate; Kontakt/Location/Operator teilweise; `0`, negative und nichtendliche Zahlen; Payload `undefined`, `null`, Array und Objekt; Wochentagsnormalisierung; Eingabelistenreihenfolge und Referenz-/Clone-Verhalten.
3. Roundtrip-Fälle Mapping → Serialisierung getrennt von den reinen Inbound-Erwartungen halten.
4. Neue Fälle auf unverändertem Produktionscode grün ausführen und mit `git diff -- packages/plugin-poi/src` nachweisen, dass vor dem Refactor kein Source-Diff besteht.

## Umsetzung

1. Die verzweigte Orchestrierung in `mapPoiContentToFormValues` durch einmalig berechnete, fachlich benannte Zwischenergebnisse vereinfachen; vorhandene kleine Mapper nur ändern, wenn dies echte doppelte Ownership entfernt.
2. Keine gemeinsame Events-/News-Abstraktion und keine generische Feld-Engine einführen.
3. Nach jedem Block gezielte Unit-Tests; Plan-022- und Plan-023-Fälle müssen gemeinsam grün bleiben.

## Gates und Fertig-Kriterien

- `pnpm nx run plugin-poi:test:unit --testFiles=tests/poi.detail-form.test.ts`
- `pnpm nx run plugin-poi:test:coverage --testFiles=tests/poi.detail-form.test.ts`
- `pnpm nx run plugin-poi:test:types`
- `pnpm nx run plugin-poi:lint`
- `pnpm nx run plugin-poi:build`
- `pnpm complexity-gate`
- `pnpm exec openspec validate refactor-poi-form-contract --strict`
- `pnpm check:file-placement`
- `pnpm check:studio-changelog`
- `git diff --check`
- Final einmal `pnpm test:pr`, sofern der zuvor gemessene affected Scope praktikabel ist; eine Auslassung mit gemessenem Scope und Ersatzgates dokumentieren.
- Vor Draft und nach jeder relevanten Source-Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/plugin-poi --explain --format json`. Erwartet: `PASS`, `complexity_introduced: 0`, `dead_code_introduced: 0`, `duplication_introduced: 0`, `styling_introduced: 0` und keine neuen moderaten CRAP-Findings. Coverageabhängiges CRAP mit der vom Coverage-Target erzeugten `coverage-final.json` erneut prüfen.
- Die Characterization ist abgeschlossen. Der produktive Fertig-Pfad wurde durch
  die dokumentierte STOP-Bedingung beendet; Zielanker und kleine Mapper bleiben
  als Bestandsfindings erhalten. Der Events-/POI-Clone bleibt unverändert.

STOP bei notwendiger Mainserver-/Formvertragsänderung, bei Konflikt zwischen Roundtrip und bestehender UI-Semantik, bei `any`/Reflection oder bei einer neuen Cross-Plugin-Ownership-Grenze. Vor Start außerdem STOP, wenn `refactor-shared-editor-primitives` oder `add-studio-data-form-and-test-foundations` inzwischen dieselbe Mapping-Source, reine Formvertragstestfälle oder Testinfrastruktur beansprucht.
