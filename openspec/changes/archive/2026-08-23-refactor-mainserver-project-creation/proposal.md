# Change: Mainserver-Projekterstellung modularisieren

## Why

Der Create-Pfad für Featured Projects bündelte Autorisierung, Request-Validierung, Idempotenz-Recovery, Provider-Schreibzugriff, Sichtbarkeit, lokale Referenzpflege und Fehlerfinalisierung in einer einzelnen kritischen Funktion. Die hohe Verzweigung erschwerte es, Reihenfolge- und Teilfehlersicherheit gezielt zu prüfen, obwohl der bestehende DataProvider-Vertrag unverändert bleiben muss.

## What Changes

- Trennung der Project-Create-Orchestrierung von Autorisierungs-, Idempotenz-, Mapping- und Transportbausteinen
- Beibehaltung der bestehenden fail-closed Autorisierung, Validierung, Fehlercodes und Idempotenzantworten
- Beibehaltung der Provider-first-Semantik: bestätigte Mainserver-Erstellungen werden bei späteren lokalen Folgefehlern nicht zurückgerollt
- Explizite Characterization-Tests für Vorbedingungen, Upstream-Reihenfolge, Replay, Konflikte und Teilfehler
- Keine neue öffentliche API und keine Änderung am Mainserver-, Payload-, Reference- oder Permission-Vertrag

## Impact

- Affected specs:
  - `sva-mainserver-integration`
- Affected code:
  - `packages/sva-mainserver/src/server/projects-route.ts`
  - `packages/sva-mainserver/src/server/projects-create*.ts`
  - `packages/sva-mainserver/src/server/projects-route-*.ts`
  - zugehörige Unit-Tests
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
