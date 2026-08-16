# Plan 001: Kontextuelle tourbezogene Ausweichtermine vollständig und date-only-sicher umsetzen

> **Executor-Anweisung**: Arbeite ausschließlich im aktuellen Branch
> `feature/waste-tour-assignment-table`. Erzeuge weder Branch noch Worktree.
> Lies zuerst den gesamten Plan und den OpenSpec-Change. Führe jede Phase in der
> angegebenen Reihenfolge aus und beginne die nächste Phase erst, wenn ihr Gate
> grün ist. Bei einer STOP-Bedingung nicht improvisieren.
>
> **Drift-Check (zuerst ausführen)**:
> `git diff --stat b7a30101180447beb3b07ea70927232983ca4f49..HEAD -- openspec/changes/add-contextual-waste-tour-shift-creation packages/core packages/plugin-sdk packages/data-repositories packages/auth-runtime packages/plugin-waste-management apps/sva-studio-react apps/public-waste-calendar-web deploy/portainer docs`
>
> Zusätzlich zweimal im Abstand einiger Minuten
> `git status --short` ausführen. Ändert sich der Source-Status ohne eigene
> Aktion, ist noch ein paralleler Schreiber aktiv: STOP. Vorhandene fremde
> Änderungen niemals verwerfen, überschreiben, stashen oder neu formatieren.

## Status

- **Umsetzungsstatus**: DONE; der Produktions-Preflight bleibt als separates Rollout-Gate offen
- **Priorität**: P1
- **Aufwand**: L
- **Risiko**: hoch für Datenvertrag, mittel für UI
- **Abhängigkeit**: keine externe Fachabhängigkeit; intern strikt nach den Phasen unten
- **Kategorie**: Feature / Migration / Datenintegrität / UI und Accessibility
- **Geplant auf**: Commit `b7a30101180447beb3b07ea70927232983ca4f49`, 16. August 2026
- **Branch**: `feature/waste-tour-assignment-table` (muss unverändert bleiben)
- **OpenSpec**: `openspec/changes/add-contextual-waste-tour-shift-creation/`

## Warum das wichtig ist

Der Change verkürzt den Weg vom erkannten Tourtermin zur bestehenden
Scheduling-Erstellung, ohne eine zweite Pflegeoberfläche einzuführen. Gleichzeitig
muss er eine bereits mehrdeutige Regelauflösung schließen: Für dasselbe konkrete
Vorkommen gewinnt die jahresbezogene Ausnahme, während die jährliche Grundregel
in anderen Jahren weiter gilt. PostgreSQL `DATE`, explizite ISO-Ausgabe und eine
gemeinsame Core-Auswahl verhindern, dass Datenbankreihenfolge, Prozesszeitzone
oder Sommer-/Winterzeit unterschiedliche Ergebnisse in Studio, Mainserver,
Webkalender, PDF oder iCal erzeugen.

## Verbindliche Fachentscheidungen

Diese Punkte sind nicht mehr offen und dürfen während der Umsetzung nicht neu
interpretiert werden:

1. Jahresbezogene Regeln sind je `(tour_id, original_date)` eindeutig.
2. Jahresunabhängige Regeln sind je Tour und Monat/Tag eindeutig.
3. Beide Spezifitäten dürfen nebeneinander existieren. Für ein konkretes Jahr
   verdrängt die jahresbezogene Regel die jährliche Grundregel; sie werden nicht
   addiert.
4. Gleiche Spezifität führt konkurrenzsicher zu `409 Conflict`, nicht zu einem
   stillen Überschreiben.
5. Es gibt keinen produktiv zu erhaltenden Bestand in
   `waste_tour_date_shifts`; deshalb ist ein harter Schnitt auf PostgreSQL
   `DATE` erlaubt. Der Migrations-Preflight muss bei auch nur einer Zeile stoppen.
6. Außerhalb PostgreSQL bleiben Kalenderdaten normalisierte ISO-Strings
   `YYYY-MM-DD`. Keine Fachgrenze verwendet JavaScript-`Date` oder lokale
   Mitternacht.
7. Kontextuelle Einstiege öffnen die bestehende Scheduling-Erstellung als
   nativen, sicheren Link in einem neuen Tab. Ein neues Formular oder Dialog-
   Speichermodell ist out of scope.
8. Ungespeicherte Änderungen an Turnus, Abstandspreset, Start- oder Enddatum
   deaktivieren die Aktion im Tourformular. Name, Beschreibung und Sichtbarkeit
   blockieren sie nicht.
9. Lange Tournamen und Hinweise müssen umbrechen beziehungsweise kontrolliert
   kürzen, ohne Felder oder Aktionen horizontal oder vertikal aus dem sichtbaren
   Bereich zu verdrängen. Der vollständige Inhalt bleibt zugänglich.

Normative Details stehen in:

- `openspec/changes/add-contextual-waste-tour-shift-creation/design.md`
- `openspec/changes/add-contextual-waste-tour-shift-creation/specs/waste-management/spec.md`
- `openspec/changes/add-contextual-waste-tour-shift-creation/specs/public-waste-calendar/spec.md`
- `openspec/changes/add-contextual-waste-tour-shift-creation/tasks.md`

## Aktueller Zustand bei Planung

Auf dem geplanten Commit sind Route, Link und erste UI-Einstiege bereits
vorhanden. Im Worktree liegt außerdem ein aktiver, uncommittierter Entwurf für
Core, Schema, Migration, Verbraucher, Konfliktabbildung und UI. Dieser Entwurf
ist Vorarbeit, aber kein nachgewiesen fertiger Change.

Bestätigte Anker:

- `packages/core/src/waste-management/master-data-tour-date-shifts.ts` enthält
  einen begonnenen puren Resolver. Der Entwurf setzt bei expandierten jährlichen
  Regeln `hasYear: true`; damit geht die ursprüngliche Spezifität entgegen dem
  Design verloren. Die Tests decken bislang nur drei Grundfälle ab.
- `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts` stellt
  die beiden Spalten im Entwurf auf `DATE` und ergänzt zwei partielle
  Unique-Indizes.
- `deploy/portainer/migrate-waste-tenants.mjs` enthält im Entwurf die Migration
  `20260816_02_tour_date_shift_date_contract`. Der bestehende Test erwartet aber
  noch genau eine Migration. Der fokussierte Lauf war bei Planung mit drei
  erwartbaren Driftfehlern rot.
- `packages/data-repositories/src/waste-management/master-data.tour-date-shifts.ts`
  bindet Schreibwerte bereits als `::date`, liest aber mit `::text`. Dieser
  Cast hängt bei `DATE` vom PostgreSQL-`DateStyle` ab und erfüllt den vereinbarten
  Vertrag nicht; erforderlich ist `to_char(..., 'YYYY-MM-DD')`.
- Dasselbe gilt im Entwurf für
  `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.server.ts`.
- `packages/auth-runtime/src/waste-management/core/tour-date-shifts.ts` erkennt
  die beiden geplanten Constraint-Namen und bildet `23505` auf `409` ab. Tests
  für Create, Update des eigenen Datensatzes, echte Fremdkollision und andere
  Datenbankfehler fehlen noch.
- Studio-Kalender, Mainserver-Materialisierung und beide Public-Waste-Pfade sind
  im Entwurf an den Resolver angebunden, aber noch nicht gemeinsam gegen
  Override, bestehende globale/Feiertagspriorität sowie PDF-/iCal-Parität
  charakterisiert.
- Die committed UI öffnet native Links mit `target="_blank"` und
  `rel="noopener noreferrer"`. Der aktive Entwurf ergänzt Kontextblock,
  Invalid-Hinweis, Override-Hinweis und Dirty-State-Schutz, benötigt aber noch
  eine abschließende Vertrags- und Layoutprüfung.
- Der Entwurf führt `schedulingContextInvalid` in den Search-Param-Typ ein.
  Dieser Zustand ist abgeleitet und darf nicht als zusätzlicher öffentlicher
  URL-Parameter serialisiert werden. Er gehört in einen internen, typisierten
  Auflösungszustand `none | valid | invalid`.
- `plans/` ist für Fallow-/Sonar-Sanierungen belegt. Deshalb liegt dieser Plan
  bewusst unter `advisor-plans/`.

Bei Planung nachgewiesene Baseline:

- `pnpm nx run core:test:unit --testFiles=src/waste-management/master-data-tour-date-shifts.test.ts`
  → 3/3 grün.
- `pnpm exec vitest run deploy/portainer/migrate-waste-tenants.test.ts --config vitest.config.ts`
  → rot, weil der aktive Migrationsentwurf noch nicht in seinen Tests abgebildet
  ist (Länge 1→2, erwartete Apply-Zähler und bereits-applizierter Katalogstand).
- Der gemessene affected Unit-Scope gegen `origin/main` umfasst 29 Projekte und
  ist damit lokal ein breiter PR-Gate-Lauf. In den Phasen nur die unten genannten
  fokussierten Targets ausführen; `pnpm test:pr` erst am Schluss.

## Architektur- und Codekonventionen

- Pure, framework-agnostische Terminlogik lebt in `packages/core`; React- und
  App-Code konsumieren sie nur.
- Runtime-Imports in serverseitig gebauten Workspace-Paketen verwenden explizite
  `.js`-Endungen. Workspace-Abhängigkeiten müssen als `workspace:*` deklariert
  sein; keine `tsconfig`-Pfadabkürzung als Ersatz.
- Keine hardcodierten UI-Texte: Deutsch und Englisch in den bestehenden
  `plugin.translations.*`-Modulen ergänzen.
- UI-Reihenfolge: native Semantik, bestehende shadcn-/Studio-Komponenten,
  bestehende Workspace-Komponente, erst dann minimale neue Komponente.
- Keine Inline-Styles für statisches Layout. Bestehende dynamische
  Kalenderfarbe ist kein Präzedenzfall für neue statische Styles.
- Datenbank-Eindeutigkeit wird durch PostgreSQL-Indizes erzwungen. Kein
  `SELECT`-then-`INSERT` und keine vorgelagerte UI-Prüfung als alleiniger Schutz.
- Migrationen bleiben kurz und transaktional. Der Bestands-Preflight läuft vor
  `ALTER TABLE`; keine Netz- oder Fremdoperation innerhalb der Transaktion.

## Scope

### In Scope

OpenSpec und Dokumentation:

- `openspec/changes/add-contextual-waste-tour-shift-creation/tasks.md`
- `docs/development/studio-db-schema-final.sql`
- `docs/development/studio-db-schema.md`
- `docs/architecture/05-building-block-view.md`
- `docs/architecture/06-runtime-view.md`
- `docs/architecture/08-cross-cutting-concepts.md`
- die bestehende deutsche Waste-Bedienungsdokumentation unter `docs/guides/`
  nach vorheriger `rg`-Suche; genau eine passende Datei ändern, keine neue
  parallele Anleitung anlegen

Core und Exporte:

- `packages/core/src/waste-management/master-data-tour-date-shifts.ts`
- `packages/core/src/waste-management/master-data-tour-date-shifts.test.ts`
- `packages/core/src/waste-management-master-data.ts`
- `packages/core/src/index.ts`
- `packages/plugin-sdk/src/index.ts`
- `packages/plugin-sdk/src/public-api.ts`

Schema, Migration, Repository und API:

- `apps/sva-studio-react/src/lib/waste-management-operations.schema.ts`
- `apps/sva-studio-react/src/lib/waste-management-operations.server.test.ts`
- `deploy/portainer/migrate-waste-tenants.mjs`
- `deploy/portainer/migrate-waste-tenants.test.ts`
- `packages/data-repositories/src/waste-management/master-data.tour-date-shifts.ts`
- `packages/data-repositories/src/waste-management/master-data.test.ts`
- `packages/auth-runtime/src/waste-management/core/tour-date-shifts.ts`
- `packages/auth-runtime/src/waste-management/core/mutation-helpers.ts`
- `packages/auth-runtime/src/waste-management/core/mutation-helpers.test.ts`
- `packages/auth-runtime/src/waste-management/core/master-data-branches.test.ts`

Verbraucher:

- `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.ts`
- `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.materialization.test.ts`
- `packages/plugin-waste-management/src/waste-management.tours.presentation.ts`
- `packages/plugin-waste-management/tests/waste-management.tours.presentation.test.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.assignments.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.assignments.test.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.projection.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.server.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-loader.types.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-calendar-occurrences.test.ts`
- `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.test.ts`
- vorhandene PDF-Projektionstests, falls die Characterization nachweist, dass
  deren Eingang nicht bereits vollständig durch die Loader-Tests abgedeckt ist

Route und UI:

- `packages/plugin-waste-management/src/search-params.ts`
- `packages/plugin-waste-management/src/waste-management.tour-shift-navigation.ts`
- `packages/plugin-waste-management/src/waste-management.tour-shift-create-link.tsx`
- `packages/plugin-waste-management/src/waste-management.scheduling-panel.effects.ts`
- `packages/plugin-waste-management/src/waste-management.scheduling-create-form-view.tsx`
- `packages/plugin-waste-management/src/waste-management.scheduling-form-content.tsx`
- `packages/plugin-waste-management/src/waste-management.scheduling-tour-form-view.tsx`
- `packages/plugin-waste-management/src/waste-management.scheduling-global-form-view.tsx`
- `packages/plugin-waste-management/src/waste-management.scheduling-tour-mutations.ts`
- `packages/plugin-waste-management/src/waste-management.tours-form-content.tsx`
- `packages/plugin-waste-management/src/waste-management.tours-form-view.tsx`
- `packages/plugin-waste-management/src/waste-management.tours-year-calendar.tsx`
- `packages/plugin-waste-management/src/waste-management.tours.table-row.parts.tsx`
- `packages/plugin-waste-management/src/plugin.translations.de.scheduling.ts`
- `packages/plugin-waste-management/src/plugin.translations.en.scheduling.ts`
- `packages/plugin-waste-management/src/plugin.translations.de.tours.ts`
- `packages/plugin-waste-management/src/plugin.translations.en.tours.ts`
- die bereits vorhandenen korrespondierenden Tests unter
  `packages/plugin-waste-management/tests/`
- `apps/sva-studio-react/e2e/waste-management-plugin.spec.ts`

Echte PostgreSQL-Abnahme, falls noch kein passendes Ziel im aktiven Entwurf
entstanden ist:

- `apps/sva-studio-react/project.json`
- `apps/sva-studio-react/scripts/test-waste-tour-date-shifts.sh` (neu)
- `apps/sva-studio-react/src/lib/waste-tour-date-shifts.postgres.integration.test.ts` (neu)
- `scripts/ci/run-integration-gate.ts`
- `scripts/ci/run-integration-gate.test.ts`

### Out of Scope

- globale Ausweichtermine, Feiertagsregeln oder deren bestehende Priorität
  verändern
- individuelle Tourtermine, bedarfsabhängige Touren oder explizite
  Tour-Einsätze in Verschiebungsregeln umdeuten
- eine zweite Scheduling-Oberfläche oder imperative `window.open`-Logik
- ortsspezifische Verschiebungen
- automatische Legacy-Transformation, Backfill oder Dublettenbereinigung
- zentrale IAM-Tabellen für externe Waste-Fachdaten anlegen
- PDF-Branding, Medienauswahl oder andere gleichzeitig veränderte Waste-Features
- bestehende fremde Worktree-Änderungen verwerfen oder global formatieren
- neue Datumsbibliothek; der begrenzte date-only-Vertrag ist mit vorhandenen
  UTC-Helfern und PostgreSQL korrekt abbildbar

## Git-Workflow

- Im aktuellen Branch `feature/waste-tour-assignment-table` bleiben.
- Kein neuer Branch und kein Worktree.
- Vor jedem Änderungsblock `git status --short` prüfen und nur eigene Hunks
  bearbeiten. Bei fremden Änderungen im selben Symbol STOP.
- Keine Commits, kein Push und keine PR-Erstellung ohne gesonderten Auftrag.
- Falls später committiert wird, bestehende Conventional-Commit-Form verwenden,
  zum Beispiel `feat(waste): complete contextual tour shift creation`.

## Abhängigkeitssortierte Umsetzung

### Phase 0: Aktiven Entwurf einfrieren und gegen OpenSpec reconciliieren

1. Branch, HEAD und Status erfassen:
   `git branch --show-current && git rev-parse HEAD && git status --short`.
2. Sicherstellen, dass keine parallelen Schreibzugriffe mehr stattfinden. Bei
   wechselndem Status STOP.
3. Den gesamten aktiven Diff nach OpenSpec-Task 1.1–5.6 klassifizieren: bereits
   erfüllt, begonnen, offen oder widersprüchlich. Vorhandene korrekte Hunk-Arbeit
   behalten; keine pauschale Neuschreibung.
4. Den bekannten roten Migrationstest als Baseline dokumentieren. Andere rote
   fokussierte Tests müssen entweder eindeutig zum aktiven Entwurf gehören oder
   führen zum STOP.

**Gate**:

```bash
test "$(git branch --show-current)" = "feature/waste-tour-assignment-table"
pnpm exec openspec validate add-contextual-waste-tour-shift-creation --strict
```

Erwartung: Branch-Prüfung und OpenSpec-Validierung enden mit Exit 0.

### Phase 1: Pure Core-Auswahl und Date-only-Vertrag abschließen

1. `resolveEffectiveWasteTourDateShiftsForYear` als einzige fachliche Auswahl
   für eine Tour und ein Jahr fertigstellen.
2. Die ursprüngliche Spezifität nach Expansion explizit bewahren, etwa durch
   ein readonly Feld `specificity: 'annual' | 'year-specific'`; nicht den
   persistierten Wert `hasYear` semantisch umdeuten.
3. Auswahl unabhängig von Eingabereihenfolge machen. Gleiche Spezifität bleibt
   deterministisch, wird aber fachlich als persistenzseitig ungültiger Zustand
   charakterisiert; nicht still mit „last write wins“ kaschieren.
4. Nur ISO-Date-only und UTC-Operationen verwenden. Keine lokale Mitternacht,
   kein `getFullYear`, `setFullYear` oder lokales Datumsformat in der Kernlogik.
5. Fälle testen: nur jährliche Regel, nur Jahresregel, Override in einem Jahr,
   jährliche Wirkung im Folgejahr, mehrere Touren, Cross-Year-Offset, Schaltjahr
   inklusive 29. Februar, ungültiges ISO-Datum, gleiche Spezifität und
   Eingabereihenfolge.
6. Core- und SDK-Exporte mit `.js`-Runtimepfaden erhalten.

**Gate**:

```bash
TZ=UTC pnpm nx run core:test:unit --testFiles=src/waste-management/master-data-tour-date-shifts.test.ts
TZ=Europe/Berlin pnpm nx run core:test:unit --testFiles=src/waste-management/master-data-tour-date-shifts.test.ts
pnpm nx run core:test:types
pnpm nx run plugin-sdk:test:types
pnpm check:server-runtime
```

Erwartung: beide Zeitzonenläufe liefern dieselben fachlichen ISO-Werte; alle
Befehle Exit 0.

### Phase 2: PostgreSQL-Schema und versionierte Hard-Cut-Migration finalisieren

1. Vor Vergabe der ID den aktuellen Katalog in
   `deploy/portainer/migrate-waste-tenants.mjs` lesen. Wenn
   `20260816_02_tour_date_shift_date_contract` inzwischen belegt oder committed
   ist, die nächste freie monotone ID verwenden; keine bestehende ID umdeuten.
2. Im Neuprovisionierungs-Schema `original_date DATE NOT NULL` und
   `actual_date DATE NOT NULL` sowie genau diese Eindeutigkeiten abbilden:
   - `(tour_id, original_date) WHERE has_year`
   - `(tour_id, EXTRACT(MONTH FROM original_date), EXTRACT(DAY FROM original_date)) WHERE NOT has_year`
3. Migrationstransaktion: zuerst `SELECT`-/`DO`-Preflight auf null Zeilen,
   danach beide `ALTER COLUMN ... TYPE DATE USING ...::date`, danach Indizes,
   danach Postcondition für beide Spaltentypen und beide Indexdefinitionen.
4. Nicht nur die Existenz der Indexnamen prüfen. Die Verifikation muss über
   `pg_get_indexdef` beziehungsweise Katalogprädikate bestätigen, dass Spalten,
   Ausdruck und `WHERE`-Prädikat stimmen.
5. Bei jeder vorhandenen Zeile mit dem stabilen Fehler
   `waste_migration_tour_date_shift_data_present` abbrechen. Kein `DELETE`,
   `UPDATE`, `TRUNCATE` oder automatischer Backfill.
6. Migrationstests auf zwei Katalogeinträge, Apply-Zähler, Skip bereits
   angewendeter Migration, Preflight-Rollback, Postcondition-Rollback und
   unveränderte Privilegien erweitern.
7. Schema-Builder-Test auf `DATE` und beide vollständigen Indexdefinitionen
   erweitern.

**Gate**:

```bash
pnpm exec vitest run deploy/portainer/migrate-waste-tenants.test.ts --config vitest.config.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-operations.server.test.ts
pnpm exec tsc -p tsconfig.scripts.json --noEmit
```

Erwartung: Migrationstest vollständig grün; keine alte „genau eine Migration“-Assertion;
TypeScript Exit 0.

### Phase 3: Repository-Grenze und stabilen 409-Vertrag abschließen

1. In allen SELECTs für `original_date` und `actual_date` exakt
   `to_char(column, 'YYYY-MM-DD') AS column` verwenden. `column::text` ist nicht
   ausreichend, weil es vom Session-`DateStyle` abhängt.
2. Writes weiterhin als normalisierte Strings mit `$n::date` binden. Keine
   JavaScript-`Date`-Werte erzeugen und keinen globalen `pg`-Typeparser ändern.
3. `ON CONFLICT (id) DO UPDATE` für das Aktualisieren des eigenen Datensatzes
   behalten. Die beiden fachlichen Unique-Indizes dürfen dadurch nicht zu einem
   pauschalen Upsert nach Ursprung werden.
4. Ausschließlich `23505` für die beiden exakten Constraint-Namen auf den
   fachlichen `409 conflict` mit stabilem Reason-Code abbilden. Andere
   Unique-Verletzungen und Datenbankfehler bleiben im bisherigen 503-/Auditpfad.
5. Tests ergänzen für Create-Konflikt, Update gegen fremden Datensatz,
   unverändertes Update des eigenen Datensatzes, unbekannte `23505`, generischen
   Datenbankfehler, Audit-Reason und unveränderten Visible-Status-Vertrag.

**Gate**:

```bash
pnpm nx run data-repositories:test:unit --testFiles=src/waste-management/master-data.test.ts
pnpm nx run auth-runtime:test:unit --testFiles=src/waste-management/core/mutation-helpers.test.ts --testFiles=src/waste-management/core/master-data-branches.test.ts
pnpm nx run data-repositories:test:types
pnpm nx run auth-runtime:test:types
pnpm check:server-runtime
```

Erwartung: alle fokussierten Tests und Typgates Exit 0; Assertions enthalten
`to_char`, `::date`, 409 nur für die zwei erlaubten Constraints und 503 für den
Rest.

### Phase 4: Alle fachlichen Verbraucher auf denselben Resolver umstellen

1. Studio-Jahreskalender, Mainserver-Materialisierung, berechnete Public-Waste-
   Vorkommen und assignment-basierte Public-Waste-Projektion verwenden denselben
   Core-Resolver vor dem Aufbau ihrer Shift-Map.
2. Jede Projektion leitet die relevanten Jahre aus ihrem echten fachlichen
   Fenster ab. Keine Ableitung aus `new Date()` oder Prozesszeitzone.
3. Die bestehende Priorität `tourbezogen → global → Feiertag` unverändert
   charakterisieren. Der Change ändert nur die Auswahl innerhalb der
   tourbezogenen Regeln.
4. Public-Waste-DB-Reads ebenfalls mit `to_char` ausführen und `has_year`
   verpflichtend typisieren; kein stilles `?? true` an einer DB-Grenze, an der
   das Schema `NOT NULL` garantiert.
5. Tests in allen drei Konsumenten mit derselben Fixture-Matrix ergänzen:
   jährliche Grundregel plus Jahresausnahme, anderes Jahr, globale Regel,
   Feiertagsregel, Cross-Year-Shift und unveränderte Ausgabe unter UTC sowie
   `Europe/Berlin`.
6. PDF und iCal über die bestehende Public-Waste-Projektion charakterisieren,
   damit kein separater Auswahlpfad verbleibt.

**Gate**:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours.presentation.test.ts
pnpm nx run sva-studio-react:test:unit:server --testFiles=src/lib/waste-management-mainserver-sync.materialization.test.ts
pnpm --dir apps/public-waste-calendar-web exec vitest run src/lib/public-waste-calendar-loader.assignments.test.ts src/lib/public-waste-calendar-occurrences.test.ts src/lib/public-waste-ical.server.test.ts
pnpm nx run plugin-waste-management:test:types
pnpm nx run public-waste-calendar-web:test:types
pnpm nx run sva-studio-react:test:types
```

Erwartung: dieselbe Jahresausnahme gewinnt in allen Projektionen; globale und
Feiertagsfälle bleiben unverändert; alle Befehle Exit 0.

### Phase 5: Search-Kontext und einmalige Hydrierung robust machen

1. Öffentlicher URL-Vertrag bleibt auf `schedulingTourId` und
   `schedulingOriginalDate` begrenzt. Ein Validierungsstatus wie
   `schedulingContextInvalid` darf nicht serialisiert werden.
2. Einen puren Auflöser als discriminated union modellieren:
   - `{ kind: 'none' }`
   - `{ kind: 'valid', tourId, originalDate? }`
   - `{ kind: 'invalid', reason: 'invalid-date' | 'missing-tour' | 'contradictory-context' }`
3. Normalisierung: Datum nur mit Tour, reales ISO-Kalenderdatum, Tourkontext nur
   bei `tab=scheduling`, `schedulingView=create` und
   `schedulingEntryType=tour-shift`; globaler Kontext verwirft beide Parameter.
4. Hydrierung genau einmal und nur in ein unberührtes Standardformular. Wenn der
   Nutzer vor Abschluss des Tour-Loads editiert hat, darf der Effekt nichts
   überschreiben. Dazu einen expliziten pristine-/hydrated-Zustand verwenden,
   nicht nur einen Key aus der URL.
5. Reload darf neu hydrieren; normale Re-Renders, spätere Loads oder Navigation
   im selben Mount nicht.
6. Abbruch und erfolgreicher Save entfernen beide Kontextparameter. Ungültiger
   Kontext erzeugt einen lokalisierten, nicht blockierenden Hinweis und keine
   versteckte Vorbelegung.

**Gate**:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/search-params.test.ts --testFiles=tests/waste-management.tour-shift-navigation.test.ts --testFiles=tests/waste-management.scheduling-panel.test.tsx
```

Erwartung: Tests für valid, invalid, widersprüchlich, Reload, User-edit-before-load,
kein zweites Hydrieren sowie Cleanup sind grün; kein serialisierter dritter
Kontextparameter.

### Phase 6: Kontextuelle UI, Dirty-State und räumlich robuste Texte abschließen

1. `WasteTourShiftCreateLink` bleibt im aktiven Zustand ein echter Link mit
   `target="_blank"` und `rel="noopener noreferrer"`. Der deaktivierte Zustand
   im Tourformular darf nicht navigieren und muss seinen Grund sichtbar sowie
   programmatisch zugeordnet ausgeben.
2. Sichtbaren und zugänglichen Text trennen:
   - leere Tabellenzelle sichtbar kurz `Anlegen`;
   - zugänglicher Name vollständig mit Handlung, Tourname und neuem Tab;
   - Detaildialog sichtbar exakt `Tourbezogenen Ausweichtermin anlegen`;
   - Kalender sichtbar nur kompakte Tages-/Aktionsfläche, zugänglicher Name mit
     lokalisiertem Datum, Tourname und neuem Tab.
3. Kontextuelle Erstellung ersetzt die Typauswahl durch einen kompakten
   Kontextblock. Tour und Originaldatum bleiben in den regulären Feldern
   editierbar. Allgemeine Erstellung zeigt weiter die Typauswahl.
4. Layout für lange Texte explizit absichern: Container `min-w-0`, Text
   `break-words` beziehungsweise kontrolliertes `line-clamp` nur mit vollständig
   zugänglichem Namen/Tooltip, Actions `shrink-0`, responsive Stapelung auf
   schmalen Viewports. Keine fixe Höhe, die zwei- oder mehrzeiligen Text clippt.
5. Tourformular ausschließlich gegen `persistedTour` prüfen. Sichtbar und
   deaktiviert bei Änderungen an Recurrence, Custom-Preset, First-Date oder
   End-Date; nicht blockiert durch Name, Beschreibung oder Active-Status.
   Persistierte individuelle/bedarfsgesteuerte Tour zeigt keine Aktion, auch
   wenn das ungespeicherte Formular auf Turnus umgestellt wurde.
6. Jahresbezogene Regel mit passender jährlicher Grundregel zeigt vor Save den
   nicht blockierenden Override-Hinweis für das Jahr.
7. 409 bleibt als persistente Inline-Fehlermeldung am Formular stehen und wird
   nicht durch einen Redirect gelöscht.
8. Alle neuen Texte in Deutsch und Englisch ergänzen. Keine Stringverkettung,
   wenn Grammatik oder Reihenfolge sprachabhängig ist.
9. Alle Einstiege nur bei aufgelöstem
   `waste-management.scheduling.manage` rendern.

**Gate**:

```bash
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tour-shift-create-link.test.tsx --testFiles=tests/waste-management.tours-content.test.tsx --testFiles=tests/waste-management.tours-form-content.test.tsx --testFiles=tests/waste-management.tours-year-calendar.test.tsx --testFiles=tests/waste-management.scheduling-create-form-view.test.tsx
pnpm nx run plugin-waste-management:lint
pnpm nx run plugin-waste-management:test:types
```

Falls `waste-management.scheduling-create-form-view.test.tsx` noch nicht
existiert, in dieser Phase anlegen und als fokussierte Characterization nutzen.
Erwartung: alle Tests Exit 0; lange deutsche und englische Tournamen werden in
schmalen Testcontainern ohne horizontales Overflow gerendert; vollständige
Accessible Names bleiben erhalten.

### Phase 7: Echte PostgreSQL- und Browser-Integration nachweisen

1. Das derzeitige `sva-studio-react:test:integration`-No-op durch einen
   begrenzten echten Waste-Date-Shift-Test ersetzen. Vorhandenes lokales
   Docker-PostgreSQL nutzen; keine neue Dependency, `pg` ist bereits vorhanden.
2. Das Setup-Skript an `packages/data/scripts/test-seeds.sh` anlehnen:
   dedizierte zufällige Testdatenbank, Schutzliste für produktive Namen,
   readiness check, Trap-Cleanup und kein Löschen der Standarddatenbank.
3. Der Vitest-Integrationstest muss real nachweisen:
   - Spaltentypen `date`;
   - beide partiellen Indexdefinitionen;
   - parallele Inserts gleicher Spezifität: genau eines erfolgreich, eines
     `23505` mit erwartetem Constraint;
   - jährliche und jahresbezogene Regel nebeneinander erlaubt;
   - Update des eigenen Datensatzes erlaubt;
   - `SET datestyle TO 'SQL, DMY'` ändert Repository-Ausgabe nicht;
   - Werte bleiben Strings, keine JavaScript-`Date`-Instanzen.
4. `sva-studio-react` in `GENERAL_INTEGRATION_PROJECTS` aufnehmen und den
   Gate-Test aktualisieren, damit `pnpm test:integration` den echten Test in CI
   ausführt.
5. Den bestehenden Waste-Playwright-Stub um den kontextuellen Flow ergänzen:
   Link besitzt neuen-Tab-Vertrag und richtige Search-Parameter; die Zielseite
   zeigt vorausgewählte Tour und Originaldatum. Wegen Browser-Sicherheitsmodellen
   den neuen Tab mit Playwrights `page.waitForEvent('popup')` beziehungsweise
   BrowserContext-Page-Event erfassen, nicht `window.open` mocken.

**Gate**:

```bash
pnpm nx run sva-studio-react:test:integration
pnpm exec vitest run scripts/ci/run-integration-gate.test.ts --config vitest.config.ts
pnpm nx run sva-studio-react:test:e2e
```

Erwartung: echter PostgreSQL-Test, Gate-Test und Waste-Browserflow Exit 0; die
temporäre Datenbank wird auch bei Fehlschlag entfernt.

### Phase 8: Dokumentation, OpenSpec-Status und Gesamtverifikation

1. In `docs/development/studio-db-schema.md` den externen Waste-Vertrag für
   `DATE`, partielle Eindeutigkeit, Migration und DateStyle-sichere Grenze
   dokumentieren.
2. `docs/development/studio-db-schema-final.sql` bleibt ein Snapshot der
   zentralen Studio-Datenbank. Dort nur den vorhandenen Kommentar zur externen
   Waste-Abgrenzung ergänzen; keine externen Waste-Tabellen in den Dump kopieren.
3. Arc42 aktualisieren:
   - 05: Core besitzt Regelpriorität;
   - 06: Route → Formular sowie Schema/Migration → Repository → Verbraucher;
   - 08: date-only-, Zeitzonen- und Eindeutigkeitsvertrag.
4. Passende Waste-Bedienungsanleitung um Einstieg, neuen Tab, Dirty-State,
   Kontextblock, Override und Konfliktbehandlung erweitern. Deutsch mit echten
   Umlauten.
5. Erst nach grünen Gates die zutreffenden Checkboxen in `tasks.md` abhaken.
   Kein Haken allein aufgrund vorhandenen Codes; jeder Haken braucht den
   zugehörigen Test- oder Doku-Nachweis.
6. Vor Migration/Rollout den leeren produktiven Bestand erneut über den
   geschützten Diagnoseweg bestätigen. Dieser Plan autorisiert weder Rollout
   noch Datenbankmutation.

**Finale Gates**:

```bash
pnpm nx show projects --affected --withTarget=test:unit --base=origin/main
pnpm test:pr
pnpm test:integration
pnpm check:server-runtime
pnpm check:file-placement
pnpm exec openspec validate add-contextual-waste-tour-shift-creation --strict
pnpm exec prettier --check advisor-plans openspec/changes/add-contextual-waste-tour-shift-creation docs/development/studio-db-schema.md docs/architecture/05-building-block-view.md docs/architecture/06-runtime-view.md docs/architecture/08-cross-cutting-concepts.md
git diff --check
```

Erwartung: alle Befehle Exit 0. Der erste Befehl dient nur der transparenten
Scope-Messung; wegen des bereits bekannten breiten Scopes ist `pnpm test:pr`
hier bewusst das einmalige abschließende PR-Gate.

## Testplan als Anforderungsmatrix

| Risiko               | Testort                          | Muss nachweisen                                              |
| -------------------- | -------------------------------- | ------------------------------------------------------------ |
| Jahres-Override      | Core + alle drei Verbraucher     | Jahresregel gewinnt nur im konkreten Jahr                    |
| Gleiche Spezifität   | PostgreSQL + Auth-Runtime        | Constraint verhindert Race, API liefert 409                  |
| Eigenes Update       | PostgreSQL + Repository          | derselbe Datensatz bleibt aktualisierbar                     |
| DateStyle/DST        | Repository + Core + Public Waste | ISO-String bleibt unter DMY, UTC und Europe/Berlin identisch |
| Bestehende Priorität | Studio, Mainserver, Public Waste | Tour/global/Feiertag unverändert                             |
| Route-Hydrierung     | Search/Nav/Panel-Tests           | einmalig, reload-stabil, keine Nutzerüberschreibung          |
| Ungültiger Kontext   | Search + Create View             | sichtbar verworfen, kein versteckter Save                    |
| Dirty Tour           | Tourformular                     | nur terminrelevante Änderungen blockieren                    |
| Kompakter Text       | Komponenten + Browser            | kein Overflow, vollständiger Accessible Name                 |
| Berechtigung         | Komponenten + Server             | UI verborgen und Mutation weiterhin autorisiert              |
| PDF/iCal             | Public-Waste-Tests               | identische effektive Verschiebung                            |

## Done-Kriterien

- [ ] Branch blieb durchgehend `feature/waste-tour-assignment-table`; kein
      Worktree oder Nebenbranch wurde erzeugt.
- [ ] Vorhandene fremde Änderungen wurden erhalten und der aktive Entwurf wurde
      hunkweise reconciliiert.
- [ ] Eine pure Core-Funktion besitzt die vollständige Regelpriorität und
      bewahrt Spezifität explizit.
- [ ] Studio, Mainserver und beide Public-Waste-Pfade verwenden diese Funktion.
- [ ] `original_date` und `actual_date` sind im Neu- und Migrationsschema
      PostgreSQL `DATE`.
- [ ] Zwei korrekte partielle Unique-Indizes erzwingen die fachliche
      Eindeutigkeit unter Konkurrenz.
- [ ] Migrations-Preflight stoppt bei jeder vorhandenen Zeile; kein automatischer
      Legacy-Backfill existiert.
- [ ] Alle Reads liefern per `to_char` unabhängig von `DateStyle` ISO-Strings;
      alle Writes binden `::date`; kein Fachwert ist JavaScript-`Date`.
- [ ] Gleiche Spezifität liefert stabil 409; andere DB-Fehler behalten ihren
      bisherigen Vertrag.
- [ ] Kontext-URL enthält nur die zwei vereinbarten Parameter und hydriert ein
      unberührtes Formular genau einmal.
- [ ] Tabellenzelle, Detaildialog, Kalender und Tourformular erfüllen Text-,
      New-Tab-, Berechtigungs-, Dirty-State- und Accessibility-Vertrag.
- [ ] Lange Tourtexte sind in schmalen und breiten Layouts ohne Clipping oder
      horizontales Overflow nutzbar.
- [ ] Echte PostgreSQL-Integration deckt Typen, Indizes, Konkurrenz, Eigenupdate
      und DateStyle ab.
- [ ] Browserflow weist neuen Tab, Tour und Originaldatum nach.
- [ ] Dokumentation und alle zutreffenden OpenSpec-Tasks sind aktualisiert.
- [ ] Alle finalen Gates sind grün und `git diff --check` meldet nichts.
- [ ] Status in `advisor-plans/README.md` ist auf `DONE` gesetzt.

## STOP-Bedingungen

Sofort stoppen und berichten, wenn:

- sich der Worktree ohne eigene Aktion weiter verändert oder ein anderer
  Prozess dieselben Dateien schreibt;
- der Branch nicht `feature/waste-tour-assignment-table` ist;
- produktiv oder in einem zu migrierenden Tenant auch nur eine Zeile in
  `waste_tour_date_shifts` existiert;
- die nächste freie Tenant-Migrations-ID oder ein Constraint-Name bereits mit
  anderer Bedeutung belegt ist;
- die Umsetzung eine Änderung der globalen/Feiertagspriorität erfordert;
- ein Consumer eine eigene, fachlich abweichende Regelauflösung benötigt;
- der Search-Vertrag einen dritten persistierten Kontextparameter zu benötigen
  scheint;
- ein Date-only-Wert nur durch JavaScript-`Date`, lokale Mitternacht oder einen
  globalen `pg`-Parser korrekt erscheint;
- der echte PostgreSQL-Test nur gegen eine nicht eindeutig temporäre Datenbank
  laufen könnte;
- eine Phase nach zwei gezielten Korrekturversuchen rot bleibt;
- Dateien außerhalb des In-Scope-Bereichs notwendig werden. Erst Scope und
  Ursache berichten, dann Freigabe abwarten.

## Wartungs- und Reviewhinweise

- Bei zukünftigen neuen Ausgaben oder Importpfaden darf die Auswahlregel nicht
  kopiert werden; sie konsumieren den Core-Resolver.
- Bei Erweiterung um ortsspezifische Regeln muss die Spezifitätsordnung neu als
  Fachentscheidung spezifiziert werden. Sie darf nicht implizit in Map-
  Überschreibreihenfolge wachsen.
- Reviewer sollen besonders auf `::text` an DATE-Spalten, lokale Date-
  Konstruktion, serialisierte Ableitungsflags, `last write wins`, unsichere
  Popup-Öffnung und abgeschnittene lange Texte achten.
- Ein späterer produktiver Datenbestand hebt die Hard-Cut-Annahme auf und
  benötigt einen neuen, expliziten Migrations-Change; dieser Plan darf dann
  nicht unverändert wiederverwendet werden.
