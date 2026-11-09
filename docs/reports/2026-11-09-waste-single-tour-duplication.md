# Einzeltouren duplizieren: Prüfung vom 9. November 2026

## Auftrag und Grenze

Datum, Fraktion und Rhythmus beim Duplizieren einer einzelnen Tour ohne erneute Eingabe übernehmen und eine eigenständige Kopie als Entwurf speichern. Ausgangspunkt ist Zeile 43 im [Prüfblatt](https://docs.google.com/spreadsheets/d/1TAYWlYVIga6SVjd11H5aL2dnhV7lfAcSNNF2HN48uqo/edit#gid=939932647).

Betroffen sind ausschließlich die vorhandenen Duplizierungstests, die zugehörige Spezifikation und dieser Nachweis. Jahresübernahme, zusätzliche Bearbeitungsfunktionen, Feiertagsberechnung und Mainserver-Synchronisation sind ausgeschlossen. PR #2124 und seine vier Dateien bleiben unverändert. Es erfolgen keine produktiven Datenänderungen, kein Merge und kein Rollout.

## Befund und historische Reproduktion

Untersuchungsbasis: `origin/main` bei `67a5be6b9`. Der gemeldete Verlust der Formularvorbelegung ist in diesem Stand nicht reproduzierbar. Commit `79c7fd770890e3e2aa003591a79c6808aa45a46b` vom 25. Oktober 2026 enthält bereits die Wiederherstellung der Duplizierungsvorbelegung aus der Route.

Als kontrollierte historische Gegenprobe wurde ausschließlich `waste-management.tours-panel.tsx` vorübergehend aus dem Elternstand dieses Commits eingesetzt. Die vier isolierten Fälle für festen Turnus, individuelle Termine, Abstandspreset und Abruf scheiterten mit leerem Formular; danach wurde das aktuelle Panel bytegleich wiederhergestellt. Diese Gegenprobe rekonstruiert den damaligen Panel-Einstieg im heutigen Testaufbau, keinen vollständigen historischen Build. Im aktuellen Stand bestehen dieselben Fälle. Deshalb enthält dieser PR keine weitere Änderung am Produktivcode.

## Vollständiger bestehender Datenpfad

1. `packages/plugin-waste-management/src/waste-management.tours-list-view.navigation.ts`: Die Tabellenaktion verwendet `mapTourToDuplicateForm`, setzt den Create-Modus und übergibt `duplicateFromTourId` an die bestehende Route.
2. `waste-management.tours-panel.effects.ts`: `useWasteToursDuplicateRouteHydration` lädt die Quelltour aus der Übersicht erneut in das Formular, auch nach einem neuen Mount. Die Vorbelegung erfolgt einmal pro Quelle und Routenbesuch, damit laufende Eingaben erhalten bleiben.
3. `waste-management.tours.shared.ts`: Der Mapper übernimmt Fraktions-IDs, festen Turnus beziehungsweise `customRecurrenceId`, Gültigkeitsdaten und individuelle Termine. Nur ID, Namenssuffix und Status werden für die Kopie geändert. `dateLocationAssignments` bleiben zunächst leer, weil der Server die Beziehungen kopiert.
4. `waste-management.tours-form-view.tsx` und `waste-management.tours.tour-mutations.ts`: Das Formular übergibt die Quell-ID beim Erstellen. `toCreateTourInput` erzeugt den Request mit `status: draft`; feste Turnusse und Presets verwenden ihre Datumsgrenzen, individuelle Termine verwenden `customDates`, Abruf erzeugt keine erfundenen Datumsgrenzen.
5. `waste-management.api.operations.tours.ts`: POST nach `/api/v1/waste-management/tours` über den vorhandenen Mutationstransport.
6. `packages/waste-management-runtime/src/handlers/tours.ts` und `http-schemas.tours.ts`: Tourverwaltung, zusätzliche Planungsberechtigung bei Duplizierung, CSRF und Eingaben werden geprüft. Der Create-Vertrag erlaubt ausschließlich den Status Entwurf.
7. `handlers/tours-write-support.ts`: `createWasteTourWriteInput` normalisiert die übergebenen Werte. Der bestehende Saver schreibt die neue Tour; anschließend werden die Beziehungen kopiert und die gespeicherte Tour über `loadWasteTourById` zurückgelesen.
8. `server-loaders.entitiesrules.ts` und `repositories/master-data.tours.ts`: Der Saver ruft `upsertWasteTour` auf. `upsert_waste_tour` erhält Fraktionen, Turnus/Preset, Datum, individuelle Termine und Status als Parameter; die Definition unter `operations/waste-tour-fractions.schema.ts` speichert Fraktionszuordnungen mit der neuen Tour-ID und setzt `active` nur bei veröffentlichten Touren.

## Geltende Kopierregeln

Die maßgeblichen Anforderungen stehen in [der Waste-Spezifikation](../../openspec/specs/waste-management/spec.md), Abschnitt „Waste-Management erlaubt das Duplizieren von Touren“ und unmittelbar folgend.

- Die Kopie bekommt eine neue ID und den Status Entwurf. Die Quelldaten bleiben unverändert.
- Abholort-Zuordnungen, ortsbezogene Einzeltermine, Tour-Einsätze und tourbezogene Verschiebungen werden erst beim Speichern serverseitig mit neuen IDs übernommen.
- Zuordnungen erhalten keinen separaten Gültigkeitszeitraum; es gilt der Zeitraum ihrer Tour.
- Konkrete Termine, Terminhinweise und die Jahressemantik tourbezogener Verschiebungen werden unverändert kopiert. Eine einzelne Duplizierung rechnet keine Daten auf ein Folgejahr um.
- Globale Verschiebungen und Feiertagsregeln sind kein eigener Kopierbestand dieses Pfads. Deren Berechnung und Anwendung bleiben unverändert.
- Der vorhandene Fehlerpfad löscht die neue Tour, falls das Kopieren abhängiger Daten fehlschlägt. Bestehende Tests prüfen diesen Rollback sowie die zusätzliche Planungsberechtigung.

## Testnachweise und Grenzen

Die Tests verwenden ausschließlich synthetische Daten; die UI-API ist gemockt. Der serverseitige Handler-Test verwendet einen getrennten In-Memory-Bestand für Quelle und Kopie und liest die Kopie über die bestehende Readback-Dependency zurück. Das ist kein PostgreSQL-Integrationstest und keine Live-Abnahme.

- `waste-management.page.test.tsx`: vier Duplizierungsfälle ab Tabellenaktion einschließlich erneutem Mount, sichtbarer Vorbelegung, unverändertem Requestinhalt, neuer ID, Entwurfsstatus und unveränderter Quelle. Ein einzelner individueller Termin mit Beschreibung ist enthalten.
- `handlers.test.ts`: Speicherung genau einer neuen Tour, Rücklesen des gespeicherten Entwurfs, Übernahme der vier Beziehungstypen, unveränderter Quellbestand; vorhandene Fälle für fehlende Planungsberechtigung und Rollback.
- Vorhandene gezielte Tests für Navigation, Mapping, Formular-Submit und Kopieren abhängiger Daten ergänzen diese Nachweise.

Ergebnis: 59 gezielt ausgeführte Tests grün (25 UI, 4 Navigation, 8 Mapping, 13 Submit, 3 Handler, 6 Write-Support); File-Placement, Diff- und Formatprüfung bestanden. Die drei ausgewählten Handlerfälle lassen 47 fachfremde Fälle dieser Datei bewusst aus. Test-Quality- und Documentation-Review meldeten keine blockierenden Befunde.

Ausführbare lokale Befehle (jeweils im isolierten Worktree):

```sh
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.page.test.tsx
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours-list-view.navigation.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours.shared.test.ts
pnpm nx run plugin-waste-management:test:unit --testFiles=tests/waste-management.tours.tour-mutations.test.ts
pnpm nx run waste-management-runtime:test:unit --testFiles=src/handlers.test.ts --testNamePattern=duplicat
pnpm nx run waste-management-runtime:test:unit --testFiles=src/handlers/tours-write-support.test.ts
pnpm check:file-placement
```

Die Prüfung belegt das Repository-Verhalten. Welcher Build in der gemeldeten Oberfläche tatsächlich lief und ob die fachliche Abnahme inzwischen erfolgt ist, wurde nicht live geprüft. Die Tabelle wurde ausschließlich gelesen.
