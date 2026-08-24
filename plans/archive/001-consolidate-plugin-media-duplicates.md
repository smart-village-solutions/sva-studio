# Plan 001: Plugin-Medien-Duplikate auf die bestehende gemeinsame Ownership zurückführen

> **Archivstatus:** DONE

> Executor: Arbeite ausschließlich im eigenen Worktree. Führe jeden Gate aus.
> Bei einer STOP-Bedingung nicht improvisieren, sondern berichten. Den Index
> `plans/README.md` aktualisiert der koordinierende Reviewer.

## Status

- Status: DONE
- Ausgeliefert mit: PR #986, Merge-Commit
  `3741be1b889a380a0602b7d7bf3b5cf31103261a`

- Priorität: P1
- Aufwand: M
- Risiko: MED
- Abhängigkeit: keine
- Kategorie: Tech Debt und Architektur
- Geplant bei: `8249bc50b`, 2026-08-14

## Ziel und Ist-Zustand

Fallow meldet den Clone `dup:73673e0b` mit 441 Tokens in den Media-Helpern von
Events, Generic Items und POI sowie weitere drei- bis vierfache Upload- und
Dialog-Clones. Gleichzeitig ist im aktiven OpenSpec-Change
`update-content-media-overlay-flow` bereits ein gemeinsamer Bildblock als
führende Lösung festgelegt und Task 4.8 behauptet die Entfernung lokaler
Duplikate. Der Code und der Change müssen wieder übereinstimmen.

## Scope

In Scope:

- `packages/plugin-{events,generic-items,news,poi}/src/*detail-media*`
- bestehende gemeinsame Media-Primitives in `packages/studio-ui-react/src/`
- vorhandene Media-Verträge in `packages/plugin-sdk/src/`, nur wenn ein bereits
  belegter gemeinsamer Helper dort hingehört
- zugehörige Tests der betroffenen Packages
- `openspec/changes/update-content-media-overlay-flow/tasks.md`
- bereits durch den Change betroffene deutsche Dokumentation

Out of Scope:

- neue Media-Funktionen oder geänderte UX
- Änderungen am Mainserver-Payload oder an `MediaReference`
- Datenbankmigrationen
- automatische Metadatenaktualisierung
- Änderungen an Permission- oder URL-Persistenzverträgen

## Vorgehen

1. Mit Fallow-Trace und `rg` jede gemeldete tote Media-Datei und jeden Clone
   prüfen. Nichts allein aufgrund von `unused-file` löschen.
2. Bestehende gemeinsame Implementierungen identifizieren. Nur bei mindestens
   zwei realen Konsumenten kleine typsichere Helper zentralisieren.
3. Plugin-spezifische Typadapter beibehalten; nur identische plattformweite
   Logik wie Upload-MIME-Prüfung, Asset-Titel, persistente URL und Phasenlabel
   gemeinsam besitzen lassen.
4. Konsumenten umstellen, tote Dateien entfernen und Roundtrip-/Permission-
   Tests anpassen. Task 4.8 nur dann als erledigt belassen, wenn der Code das
   nachweislich erfüllt.
5. Fallow erneut ausführen und Clone-/Dead-Code-Differenz dokumentieren.

## Verifikation

```bash
pnpm nx run studio-ui-react:test:unit
pnpm nx run studio-ui-react:test:types
pnpm nx run plugin-events:test:unit
pnpm nx run plugin-generic-items:test:unit
pnpm nx run plugin-news:test:unit
pnpm nx run plugin-poi:test:unit
pnpm nx run plugin-poi:test:types
pnpm complexity-gate
pnpm exec openspec validate update-content-media-overlay-flow --strict
pnpm exec fallow dupes --format json --quiet --explain 2>/dev/null || true
pnpm exec fallow dead-code --format json --quiet --explain 2>/dev/null || true
```

Vor Push mindestens den kleinsten vollständigen relevanten Gate-Pfad, nach
Möglichkeit `pnpm test:pr`.

## Fertig, wenn

- `dup:73673e0b` und die fachlich gleichen Media-Upload-Clones verschwunden sind,
- keine gemeldete tote Datei ohne Trace-Nachweis entfernt wurde,
- Mainserver- und MediaReference-Roundtrips unverändert sind,
- alle Verifikationen grün sind,
- ein eigener PR ohne offene Review-Threads und mit grüner SHA-genauer CI
  gemerged wurde.

## STOP-Bedingungen

- Die Konsolidierung erfordert einen neuen fachlichen Media-Vertrag.
- Ein Plugin benötigt nachweislich abweichende Persistenzsemantik.
- Der aktive OpenSpec-Change widerspricht dem aktuellen Code in einer Weise,
  die eine Produktentscheidung verlangt.
