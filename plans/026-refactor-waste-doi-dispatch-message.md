# Plan 026: DOI-Versandnachricht in explizite Abschnitte zerlegen

> **Executor-Anweisung:** E-Mail-Adressen und DOI-Inhalte sind produktive Datenschutzverträge. Vor Refactoring alle Adress-, Fallback- und Abschnittskombinationen gegen Altcode charakterisieren; keine echten personenbezogenen Daten in Tests oder Logs verwenden.

## Status

- **Priorität:** P1
- **Aufwand:** S–M
- **Risiko:** MITTEL
- **Abhängigkeit:** keine; Bundle C
- **Kategorie:** Waste-DOI, Datenschutz, Complexity, CRAP
- **Geplant auf:** `98e6ca3d7`, 15. August 2026
- **Fallow vorher:** `buildDoiDispatchMessage` in `waste-management-email-reminder-dispatch.server.ts:231` hat CC 19, Cognitive 18, 55 Zeilen und CRAP 97 (High). Die Datei hat 332 Zeilen, Fan-in 2, MI 87 und keine Dead-Code-Quote.

## Warum und Produktionsreichweite

Die Funktion erzeugt Betreff, Textabschnitte, Absender sowie To/CC/BCC/Reply-To für die produktive Double-Opt-in-Mail. Sie wird über `buildDispatchMessage` vom E-Mail-Outbox-Prozessor erreicht. Heute liegen optionale Templateabschnitte, Fallbacks und Adressprioritäten in einer verzweigten Funktion; Drift kann Pflichtinformationen entfernen oder Reply-To falsch wählen.

## Scope

**In Scope:** `apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.ts`, `apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.test.ts`, minimaler interner typed Helper, OpenSpec `refactor-waste-doi-dispatch-message`, Changelog.

**Out of Scope:** Tokenerzeugung, Secret-Auswahl, Datums-/Location-Matching, Reminder-Mail, Outbox/SQL/Retry/Idempotenz, Templates/Übersetzungswerte, öffentliche Mail- oder Waste-Verträge, PR #983/#984.

## Characterization vor Refactoring

1. Baseline: `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-email-reminder-dispatch.server.test.ts` und `pnpm nx run sva-studio-react:test:types`; beide müssen grün sein.
2. DOI-Matrix: Payload-/Config-ServiceLabel und DataController-Priorität; Whitespace/leer/fehlend; Preheader, Intro, Ort, Buttonlabel mit/ohne Confirm-URL, Fallback, Expiry, Datenschutz und Impressum; exakte Abschnittsreihenfolge und Leerzeilen; Subject-Platzhalter unbekannt/gesetzt.
3. Adressen: To/CC/BCC, Payload-Reply-To vor Config vor Transport, fehlende Fallbacks, DisplayName und From-Priorität. Keine Secrets im Snapshot.
4. Negativfall: falscher Template-Key bleibt im unveränderten Reminder-Pfad; DOI-Refactor darf ihn nicht berühren.
5. Neue DOI-Fälle auf unverändertem Produktionscode grün ausführen und mit `git diff -- apps/sva-studio-react/src/lib/waste-management-email-reminder-dispatch.server.ts` den fehlenden Source-Diff vor dem Refactor belegen.

## Umsetzung

1. Templatewerte, optionale Textabschnitte und Address Envelope in kleine reine interne Funktionen teilen.
2. Reihenfolge, Trimming, Fallbacks und Rückgabeform exakt bewahren; keine Template-Engine oder neue Dependency einführen.
3. Nach jedem Block gezielten Unit-Run ausführen.

## Gates und Fertig-Kriterien

- `pnpm nx run sva-studio-react:test:unit --testFiles=src/lib/waste-management-email-reminder-dispatch.server.test.ts`
- `pnpm nx run sva-studio-react:test:coverage --testFiles=src/lib/waste-management-email-reminder-dispatch.server.test.ts`
- `pnpm nx run sva-studio-react:test:types`
- `pnpm nx run sva-studio-react:lint`
- `pnpm nx run sva-studio-react:build`
- `pnpm check:server-runtime`
- `pnpm complexity-gate`
- `pnpm exec openspec validate refactor-waste-doi-dispatch-message --strict`
- `pnpm check:file-placement`
- `pnpm check:studio-changelog`
- `git diff --check`
- Accessibility-/E2E-Gates sind nicht anwendbar, weil ausschließlich serverseitige Mailmodellierung ohne UI oder Journey geändert wird.
- Final einmal `pnpm test:pr`, sofern der zuvor gemessene affected Scope praktikabel ist; Auslassung und Ersatzgates dokumentieren.
- `pnpm exec fallow audit --base origin/main --workspace sva-studio-react --explain --format json`; erwartet `PASS`, `complexity_introduced: 0`, `dead_code_introduced: 0`, `duplication_introduced: 0`, `styling_introduced: 0` und keine moderaten CRAP-Neufunde. Coverageabhängiges CRAP mit der vom Coverage-Target erzeugten `coverage-final.json` erneut prüfen.
- Root-Review und unabhängiges Datenschutz-/Runtime-Vertragsreview.
- Zielanker verschwunden; Subject, Text, Reihenfolge und Envelope sind für jede Characterization exakt gleich.

## STOP

- STOP bei notwendiger Änderung an Token, Secret, URL-, Outbox-, SQL-, Retry- oder Idempotenzvertrag.
- STOP bei aktiver Überschneidung derselben Source-/Testdatei oder widersprüchlicher Altsemantik.
- STOP, wenn eine neue generische Template-Engine oder öffentliche API erforderlich würde.
