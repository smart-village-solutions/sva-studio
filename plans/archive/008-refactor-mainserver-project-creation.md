# Plan 008: Mainserver-Projekterstellung entflechten

> **Archivstatus:** DONE

## Status

- Status: DONE
- Priorität: P1
- Aufwand: L
- Risiko: HIGH
- Abhängigkeit: vorhandenen Projects-Worktree konfliktfrei auflösen
- Kategorie: Server-Orchestrierung und Datenintegrität

## Ziel und Ist-Zustand

`packages/sva-mainserver/src/server/projects-route.ts` bündelt in `createProject`
Validierung, Autorisierung, Upstream-Aufrufe, Mapping und Fehlerübersetzung. Der
Fallow-Befund liegt bei 55 zyklomatischer, 73 kognitiver Komplexität und 265
Zeilen.

## Scope und Vorgehen

- Erfolgs-, Validierungs-, Autorisierungs-, Upstream- und Rollbackpfade zuerst
  charakterisieren,
- reine Payload-/Antwortabbildung von I/O-Orchestrierung trennen,
- Autorisierungs- und Fehlersemantik unverändert und fail-closed halten,
- keine neue Service-/Factory-Abstraktion ohne zweiten belegten Konsumenten,
- Node-ESM- und Server-Runtime-Regeln strikt einhalten.

## Verifikation

- fokussierte Projects-Route-Tests mit vollständiger Negativmatrix,
- Mainserver Unit, Types, Runtime, Complexity-Gate, Fallow, OpenSpec strict,
- relevante Integrationstests für tatsächliche Upstream-Sequenz.

## Fertig, wenn

- `createProject` nicht mehr kritisch ist,
- Seiteneffektreihenfolge und Fehlercodes unverändert nachgewiesen sind,
- neue Module klare Ownership und keine Zyklen besitzen.

## STOP-Bedingungen

- der bestehende Projects-Worktree oder ein PR ändert denselben Create-Pfad,
- Datenintegrität oder Rückabwicklung ist aus den Tests nicht eindeutig ableitbar.

## Abschluss

- PR: #992
- Merge-Commit: `fd05ef73b2c87a601b7f2667854722162e1c107d`
- Ergebnis: `createProject` von 55/73/265 auf 11/14/35
  (zyklomatisch/kognitiv/Funktionszeilen) reduziert; die vollständige
  Seiteneffektreihenfolge und bestehende Reference-/Idempotency-Pfade sind
  explizit charakterisiert.
