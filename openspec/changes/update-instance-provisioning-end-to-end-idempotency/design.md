## Context

Für Instanz-Provisioning existiert bereits ein worker-basierter Ablauf. Reconcile- und Execute-Mutationen prüfen zwar den `Idempotency-Key` auf Header-Ebene, aber der Key wird derzeit nicht konsistent durch alle Schichten weitergereicht und nicht für persistente Deduplizierung verwendet.

## Goals / Non-Goals

- Goals:
- Echte End-to-End-Idempotenz für Reconcile/Execute herstellen
- Doppelte Runs bei Retry/Netzwerkfehlern verhindern
- Deterministische API-Antworten für Replay-Fälle sicherstellen
- Konfliktfall bei Key-Reuse mit anderer Payload klar behandeln

- Non-Goals:
- Keine Änderung der fachlichen Provisioning-Schrittlogik
- Keine Umstellung bestehender Create-Flow-Idempotenz außerhalb von Reconcile/Execute
- Kein Wechsel des Worker-Queue-Modells

## Decisions

- Decision: `idempotencyKey` wird verpflichtender Teil der Reconcile/Execute-Service-Inputs.
- Alternatives considered: Header nur im API-Rand prüfen. Verworfen, da keine persistente Deduplizierung.

- Decision: Deduplizierung erfolgt in der Persistenz auf fachlichem Scope (Instanz + Intent/Operation + Idempotency-Key).
- Alternatives considered: In-Memory-Cache. Verworfen, da nicht cluster- und restart-sicher.

- Decision: Optionaler Payload-Fingerprint wird persistiert, um Key-Reuse mit abweichender Payload als Konflikt zu erkennen.
- Alternatives considered: Kein Payload-Vergleich. Verworfen, da semantisch unsicher bei versehentlich wiederverwendeten Keys.

## Risks / Trade-offs

- Risk: Falsch gewählter Deduplizierungs-Scope blockiert legitime Wiederholungen.
- Mitigation: Scope in Spec explizit definieren und mit Tests absichern.

- Risk: Migration auf großer Tabelle kann Locking verursachen.
- Mitigation: additive Migration, Index/Constraint-Strategie mit minimaler Sperrzeit.

- Risk: API-Verhalten ändert sich bei Key-Reuse (Konflikt statt Neuerstellung).
- Mitigation: klarer Fehlercode, dokumentiertes Verhalten, Regressionstests.

## Migration Plan

1. Additive DB-Migration: Idempotenz-Spalte(n) + deduplizierender Index/Constraint.
2. Repository erweitern: Insert/Upsert mit Wiederverwendungslogik.
3. Service/APIs erweitern: Key durchreichen und Konflikte mappen.
4. Tests für Replay/Parallelität/Mismatch ergänzen.
5. Doku in arc42 und OpenSpec aktualisieren.

## Open Questions

- Soll der Deduplizierungs-Scope `instanceId + intent + idempotencyKey` oder `instanceId + stepKey + idempotencyKey` sein?
- Welche Retention-Regel gilt für Idempotenz-Daten (z. B. unbegrenzt vs. TTL)?
