## Context

`@sva/iam-core` ist bereits als Package vorhanden, re-exportiert Authorize-Logik aber noch aus `@sva/core`. Dieser Change macht `iam-core` zum echten Authorize-Zentrum und entfernt die alte Ownership aus `core`.

## Goals / Non-Goals

- Goals: Authorize-Contracts und Engine liegen in `iam-core`; Runtime-Infrastruktur bleibt in `auth-runtime`; Fachlogik bleibt in `iam-admin` und `iam-governance`; alle Consumer werden hart migriert.
- Non-Goals: keine neuen Dependencies, keine dauerhaften Bridge-Exports, keine fachliche Änderung an Permission-Snapshot-Persistenz.

## Decisions

- Decision: `evaluateAuthorizeDecision` bleibt eine reine synchrone Funktion in `@sva/iam-core`.
- Decision: Redis/L1/L2/DB-Recompute bleiben in `@sva/auth-runtime`, weil sie Runtime- und Infrastruktur-Abhängigkeiten besitzen.
- Decision: `@sva/core` re-exportiert die migrierten Authorize-Typen nicht weiter.
- Alternatives considered: Kompatibilitätsbrücken wurden verworfen, weil der Change bewusst ein Hard Cut sein soll.

## Risks / Trade-offs

- Breiter Compile-Radius durch entfernte Core-Exports → in Phasen migrieren und nach jeder Phase relevante Nx-Gates ausführen.
- Performance-Regression im Authorize-Pfad → Engine ohne Runtime-Abhängigkeiten halten und Permission-Store-Verhalten nicht gleichzeitig fachlich umbauen.
- Re-export-Zyklen durch neue Barrels → Fallow nach API-Cut auf Circular Dependencies und Re-export-Cycles ausführen.

## Migration Plan

1. OpenSpec-Deltas validieren.
2. Authorize-Contracts und Engine nach `iam-core` verschieben.
3. Runtime-Authorize-Consumer auf `iam-core` migrieren.
4. Domain- und App-Consumer auf Zielimporte migrieren.
5. Alte Core-Exports entfernen.
6. Unit-, Type-, Runtime- und Performance-Gates ausführen.
