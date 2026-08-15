# Plan 003: Backup-Agent-Requestvalidierung aus dem Runtime-Orchestrator lösen

> Executor: Arbeite ausschließlich im eigenen Worktree. Führe jeden Gate aus.
> Bei einer STOP-Bedingung nicht improvisieren, sondern berichten. Den Index
> `plans/README.md` aktualisiert der koordinierende Reviewer.

## Status

- Priorität: P1
- Aufwand: M
- Risiko: HIGH
- Abhängigkeit: keine
- Kategorie: Security, Operations und Tech Debt
- Geplant bei: `8249bc50b`, 2026-08-14

## Ziel und Ist-Zustand

`deploy/backup-agent/agent.mjs` umfasst etwa 2.000 Zeilen und 27
CRAP-Überschreitungen. `validRestoreRequest` mischt Contract-Version,
Environment-/Database-Regeln, Tenant-Sonderfälle, S3-Key, SHA und Ablaufzeit.
Der produktiv ausgerollte v2-Vertrag, OIDC, Replay-Schutz und der geschützte
Restorepfad müssen unverändert bleiben.

## Scope

In Scope:

- `deploy/backup-agent/agent.mjs`
- neue `.mjs`-Module unter `deploy/backup-agent/`
- `deploy/backup-agent/agent.test.ts`
- `deploy/backup-agent/Dockerfile`, falls Runtime-Module explizit kopiert werden
- `scripts/ci/run-backup-agent-integration.ts` nur bei notwendiger Anpassung des
  unveränderten Test-Wirings
- neuer OpenSpec-Change `refactor-backup-agent-contract-boundaries`
- relevante deutsche Backup-/Restore- und arc42-Dokumentation

Out of Scope:

- neue Request-Version oder neue Restore-Aktion
- Änderungen an Buckets, Prefixes, Secrets, OIDC, Replay-Schutz oder Signaturen
- Änderung des kanonischen Promote-/Rolloutpfads
- Production-Deployment oder manueller Restore

## Vorgehen

1. OpenSpec-Proposal und Design für reine Contract-/Validierungsgrenzen
   erstellen und streng validieren.
2. Bestehende Tests um vollständige Negativmatrix ergänzen: unbekannte Keys,
   Version/Aktion, Environment/DB/Tenant, abgelaufene und zu lange Requests,
   SHA, Prefix, Traversal und Import-Sondervertrag.
3. Pure Validatoren und getypte Ergebnisgrenzen extrahieren. Die exportierten
   Boolean-Fassaden und Fehlerbehandlung bleiben kompatibel.
4. Docker-/Runtime-Auflösung für jedes neue Modul ausdrücklich prüfen; relative
   Runtime-Imports verwenden `.mjs`.
5. Unit-, Integrations-, Runtime- und Fallow-Gates ausführen.

## Verifikation

```bash
pnpm exec vitest run deploy/backup-agent/agent.test.ts
pnpm test:integration:backup-agent
pnpm exec tsc -p tsconfig.scripts.json --noEmit
pnpm check:server-runtime
pnpm complexity-gate
pnpm exec openspec validate refactor-backup-agent-contract-boundaries --strict
pnpm exec fallow health --format json --quiet --explain 2>/dev/null || true
```

Vor Push nach Möglichkeit `pnpm test:pr`.

## Fertig, wenn

- `validRestoreRequest` nicht mehr als kritischer Fallow-Befund erscheint,
- v1/v2- und Import-Verhalten bitgleich durch Tests fixiert sind,
- das gebaute Backup-Agent-Image alle neuen Runtime-Module enthält,
- kein Rollout oder externer Zustand verändert wurde,
- ein eigener PR ohne offene Review-Threads und mit grüner SHA-genauer CI
  gemerged wurde.

## STOP-Bedingungen

- Die Refaktorierung verlangt eine Contract-Version oder fachliche Regeländerung.
- Ein bestehender Test widerspricht der produktiv dokumentierten v2-Semantik.
- Neue Module werden im realen Containerpfad nicht deterministisch aufgelöst.
