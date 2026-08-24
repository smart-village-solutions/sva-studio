# Plan 002: IAM-ABAC-Auswertung in reine Entscheidungsbausteine zerlegen

> **Archivstatus:** DONE

> Executor: Arbeite ausschließlich im eigenen Worktree. Führe jeden Gate aus.
> Bei einer STOP-Bedingung nicht improvisieren, sondern berichten. Den Index
> `plans/README.md` aktualisiert der koordinierende Reviewer.

## Status

- Status: DONE
- Ausgeliefert mit: PR #987, Merge-Commit
  `66d2cf9fca784a0b1a5319d107ef9927622f871d`

- Priorität: P1
- Aufwand: M
- Risiko: HIGH
- Abhängigkeit: keine
- Kategorie: Security und Tech Debt
- Geplant bei: `8249bc50b`, 2026-08-14

## Ziel und Ist-Zustand

`packages/iam-core/src/authorization-engine.ts` enthält in
`evaluateAbacRules` Geo-Scope, Hierarchierestriktionen, Zeitfenster,
Acting-as, Force-Deny und Provenance in einer Funktion. Fallow misst
cyclomatisch 55 und kognitiv 41. Das beobachtbare Allow-/Deny-Verhalten,
Reason-Codes und Provenance sind Sicherheitsvertrag und dürfen sich nicht
ändern.

## Scope

In Scope:

- `packages/iam-core/src/authorization-engine.ts`
- neue interne Module unter `packages/iam-core/src/`, falls sie echte
  fachliche Entscheidungsgrenzen abbilden
- `packages/iam-core/src/authorization-engine.test.ts`
- Package-Exports nur soweit für unveränderte öffentliche APIs erforderlich
- neuer OpenSpec-Change `refactor-iam-abac-evaluation`
- relevante arc42-Abschnitte 05, 08, 10 und 11
- Complexity-Policy/Baseline nur über den kanonischen Updateprozess

Out of Scope:

- neue ABAC-Regeln oder Action-IDs
- geänderte Scope-, Owner-, Organization- oder DataProvider-Semantik
- Änderungen an Datenbank, HTTP-Verträgen oder Runtime-Caches
- Suppressionen oder bloßes Umbenennen zur Metriksenkung

## Vorgehen

1. Einen OpenSpec-Change mit Design anlegen. Er spezifiziert ausdrücklich
   Verhaltensparität und fail-closed Semantik; streng validieren.
2. Vor der Extraktion Characterization-Tests für Regelpriorität und
   Kombinationen ergänzen: fehlender Kontext, restricted vor allowed,
   Geo-Hierarchie, ungültige/über-Mitternacht-Zeitfenster, Acting-as,
   Force-Deny und Provenance.
3. Kleine reine Evaluatoren pro Regelgruppe extrahieren. Der bestehende
   öffentliche Einstieg bleibt Fassade und Reihenfolge der Entscheidungen.
4. Reason- und Provenance-Erzeugung typsicher halten; keine `any`, keine neuen
   optionalen Fallbacks.
5. Metriken und Tests ausführen; Baseline nur nach realer Senkung aktualisieren.

## Verifikation

```bash
pnpm nx run iam-core:test:unit
pnpm nx run iam-core:test:types
pnpm nx run iam-core:lint
pnpm nx run iam-core:check:runtime
pnpm complexity-gate
pnpm exec openspec validate refactor-iam-abac-evaluation --strict
pnpm exec fallow health --format json --quiet --explain 2>/dev/null || true
```

Vor Push nach Möglichkeit `pnpm test:pr`.

## Fertig, wenn

- `evaluateAbacRules` nicht mehr als kritischer Fallow-Befund erscheint,
- alle bisherigen und neuen Allow-/Deny-/Reason-/Provenance-Fälle identisch sind,
- keine öffentliche API verändert wurde,
- alle Gates grün sind,
- ein eigener PR ohne offene Review-Threads und mit grüner SHA-genauer CI
  gemerged wurde.

## STOP-Bedingungen

- Ein bestehender Test belegt widersprüchliche Regelprioritäten.
- Die Arbeit erfordert eine fachliche Änderung des IAM-Zielmodells.
- Ein aktiver OpenSpec-Change verändert dieselbe Authorization-Engine.
