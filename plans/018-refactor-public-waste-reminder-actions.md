# Plan 018: Public-Waste-Reminder-Actions entflechten

> **Executor-Anweisung:** Token-, DOI- und Unsubscribe-Verhalten ist sicherheits- und datenschutzrelevant. Vor Refactoring kombinatorisch gegen Altcode charakterisieren.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Datenschutz, Tokens, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Ausgeliefert:** DONE über PR #1003, Merge-Commit `be9e0bfc7bbeaeef435f63db518aca050935672a`
- **Fallow vorher:** Page-Handler in `public-waste-email-reminders.server.ts:444` — cyclomatic 24, cognitive 42, 100 Zeilen, CRAP 148,4 critical; weiterer Handler CRAP 56,3; vier produktive Importpfade.

## Warum

Ein Handler mischt Statusseiten, DOI-Hashing, signierte Unsubscribe-Tokens, Subscription-Lookup, Mutation und Redirects. Veränderte Prüfpriorität könnte Tokeninformationen preisgeben oder einen falschen Status mutieren. Pfadspezifische pure Entscheidungen und schmale I/O-Orchestrierung sollen das Verhalten explizit machen.

## Ist-Zustand

- `apps/public-waste-calendar-web/src/server/public-waste-email-reminders.server.ts:444-543` behandelt DOI und Abmeldung seriell.
- Production-Reachability: Endpoints und `public-waste-runtime.ts` importieren den Handler.
- OpenSpec `centralize-waste-unsubscribe-token-boundary` ist vollständig umgesetzt; dessen signierter Tokenvertrag darf nicht verändert werden.

## Scope

**In Scope:** Reminder-Servermodul/Test, wenige interne pure Helper, OpenSpec `refactor-public-waste-reminder-actions`, deutsche Doku/Changelog.

**Out of Scope:** Tokenformat/Kryptografie/Secretquelle, DB-Queries, URLs und sichtbare Texte, Mailversand, neue Endpoints.

## Schritte

1. Baseline: `pnpm nx run public-waste-calendar-web:test:unit --testFiles=src/server/public-waste-email-reminders.server.test.ts` und Types.
2. Characterization gegen Altcode: konfigurierte Statuspfade; DOI ohne/ungültig/expired/activated/already-active; Unsubscribe ohne Token, unlesbare Subscription-ID, fehlende Subscription, Signaturfehler, unsubscribed/already/invalid; fremde Subscription; Hash-/Verify-/Mutation-Aufrufanzahl und Reihenfolge; keine Mutation vor erfolgreicher Prüfung; fixed `now`; Redirect-Queryparameter und Fallback-Response.
3. OpenSpec strict validieren.
4. DOI- und Unsubscribe-Pfade als getrennte schmale Funktionen extrahieren; gemeinsame Response-Auswahl nur bei identischem Vertrag. Tokenwerte niemals loggen.
5. Unit/Types/Lint/Build, Complexity, OpenSpec strict, File Placement, Changelog, `git diff --check`.
6. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace public-waste-calendar-web --explain --format json`; PASS, alle introduced-Zähler inklusive Styling 0 soweit Styling berührt ist.

## Fertig

- Beide Ziel-Findings sind weg; vollständige Token-Negativmatrix und Reihenfolgetests grün.
- Tokenformat, Secret, Redirects, Statusseiten, Zeit- und Mutationssemantik unverändert.
- Root- und unabhängiges Security-/Privacy-Review freigegeben.

## STOP

- STOP, wenn vorhandene Tests Tokenwerte oder Secrets ausgeben; Werte nicht reproduzieren.
- STOP bei notwendiger Änderung an `@sva/waste-management-contracts` oder Datenbank.
- STOP bei echter Source-Überschneidung mit neuem Waste-PR.
