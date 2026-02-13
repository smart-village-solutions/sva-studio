# Develop Quality Gates: Vorher/Nachher

## Ziel

Erhöhung der Review-Sicherheit auf `develop` durch ausführbare Qualitäts-Targets statt Platzhalter.

## Vorher

- Mehrere `lint`-Targets waren reine Platzhalter (`not configured`).
- `@sva/monitoring-client:test:unit` war ein No-Op.
- `pnpm test:eslint` und `pnpm test:types` waren nicht als standardisierte Root-Workflows verfügbar.
- Unit-Test-Läufe waren in paralleler Ausführung anfällig für flakey Verhalten (`auth:test:unit`).

## Nachher

- Reale `lint`-Targets für:
  - `sva-studio-react`
  - `@sva/auth`
  - `@sva/core`
  - `@sva/data`
  - `@sva/plugin-example`
  - `@sva/monitoring-client`
  - `@sva/sdk`
- `@sva/monitoring-client:test:unit` führt echte Vitest-Tests aus.
- Root-Skripte ergänzt:
  - `pnpm test:eslint`
  - `pnpm test:types`
- `pnpm test:unit` läuft seriell (`--parallel=1`) zur Reduktion von Flakes.

## Reviewer-Nutzen

- Grün bedeutet häufiger "echter Check" statt Platzhalter.
- Monitoring-Client ist im Unit-Qualitätspfad enthalten.
- Exemption-Review ist in der Doku klarer beschrieben (`docs/development/testing-coverage.md`).

## Verifikation

- `pnpm test:eslint` ✅
- `pnpm test:types` ✅
- `pnpm test:unit` ✅
