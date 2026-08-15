# Plan 014: Account-Import-Profilreparatur entflechten

> **Executor-Anweisung:** Vor jeder produktiven Änderung vollständige Altverhaltens-Characterization ausführen. Sicherheits- und Mandantengrenzen nie aus Annahmen ableiten.

## Status

- **Priorität:** P1
- **Aufwand:** M
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Identität, Mandantengrenze, CRAP
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `repairIdentityUserProfileIfPossible` in `user-import-sync-handler.ts:93` — cyclomatic 21, 71 Zeilen, CRAP 116,3 critical; `report` CRAP 88 high; Datei 462 Zeilen, Fan-out 17, drei direkte Importpfade.

## Warum

Die Reparatur verbindet importierte IAM-Attribute, Keycloak-Identität, Instanzkontext, Fehlerklassifikation und Ergebnisbericht. Ein Refactor darf weder fremde Identitäten anfassen noch Fehler still zu Erfolg umdeuten. Entscheidungslogik und Seiteneffekte sollen getrennt werden, ohne den Importvertrag zu ändern.

## Ist-Zustand

- `packages/auth-runtime/src/iam-account-management/user-import-sync-handler.ts:93-163` entscheidet, ob und wie ein Identity-Provider-Profil repariert wird.
- Der Handler wird aus `iam-account-management/core.ts` aufgerufen; vorhandene Request-Context- und Wrapper-Tests decken nur Teile der Kombinatorik.
- Node-ESM und Server-Logger sind verbindlich; keine PII in neuen Logs oder Fehlermeldungen.

## Scope

**In Scope:** Handler, minimale pure Helper im selben Featureordner, bestehende/gezielte neue Tests, OpenSpec `refactor-account-import-profile-repair`, Doku/Changelog.

**Out of Scope:** Keycloak-API-Vertrag, Importdateiformat, Account-/Rollenpersistenz, Bulk-Reprovision-OpenSpec, neue Recovery-Fallbacks.

## Schritte

1. Baseline: gezielter Unit-Run für `core-handler-wrappers.test.ts` und `user-import-sync-handler.request-context.test.ts`, danach `auth-runtime:test:types`.
2. Characterization-Matrix gegen Altcode: kein Repair nötig; fehlende Identität; fehlende/partielle Attribute; gültige Reparatur; fremde Instanz/Subject; Identity-Provider nicht verfügbar; Updatefehler; Berichtserfolg/-fehler; Reihenfolge von Lookup, Update und Report; PII-freie Logargumente.
3. OpenSpec strict validieren, dann pure Plan-/Entscheidungsfunktion aus Seiteneffekt-Wiring extrahieren. Keine neue Provider-/Service-Abstraktion.
4. Bestehende Prioritäten, Fehlercodes, `undefined`-/No-op-Semantik und genau-einmal-Aufrufverhalten erhalten.
5. Unit/Types/Lint, `pnpm check:server-runtime`, Complexity, OpenSpec strict, File Placement, Changelog und `git diff --check` grün ausführen.
6. `pnpm exec fallow audit --base origin/main --workspace @sva/auth-runtime --explain --format json` vor Draft und nach Revision: PASS, `complexity_introduced=0`, `dead_code_introduced=0`, `duplication_introduced=0`.

## Fertig

- Beide Ziel-Funktionen sind unter Fallow-Schwelle oder entfernt; negative Identitäts-/Mandantenmatrix und Reihenfolgetests sind grün.
- Kein zusätzlicher Fallback, kein PII-Logging und keine Änderung des Keycloak-/Importvertrags.
- Root- und unabhängiges Security-Review freigegeben.

## STOP

- STOP bei nicht deterministisch unterscheidbaren Subject-/Instanzidentitäten.
- STOP, wenn bestehender Altcode im betroffenen Testscope rot ist.
- STOP, wenn der Fix Bulk-Reprovision oder Datenbankschema berührt.
