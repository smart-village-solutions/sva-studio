# Waste-Plugin Runtime-Extraktion: Discovery-Checkpoint

## Befund

- Der Host lädt Plugin-Job-Module generisch aus `packages/plugin-*/src/server.ts` in `apps/sva-studio-react/src/lib/plugin-operation-runtime.server.ts`.
- Dort wird für Plugins mit `manifest.entryPoints.jobs` das Export-Symbol `createPluginJobExecutionHandlers` geladen, mit einer Host-Runtime-Fabrik versorgt und über `registerPluginOperationExecutionHandlers` registriert.
- Für Waste Management zeigt `packages/plugin-waste-management/plugin.manifest.json` mit `entryPoints.jobs = ./dist/server.js` und `runtimeRequirements.jobs = waste-management.operations` genau auf diesen Pfad.
- `packages/plugin-waste-management/src/server.ts` ist deshalb ein echter Runtime-Adapter und kein Metadatenmodul.

## Abgrenzung im Plugin

- `packages/plugin-waste-management/src/plugin.tsx` nutzt nur deklarative `jobTypes` und `importProfiles`.
- Diese Definitionen liegen bereits getrennt und passend benannt in `packages/plugin-waste-management/src/waste-management.job-definitions.ts`.
- Die zweite Go/No-Go-Bedingung ist damit erfüllt: das frühere `plugin-operations.ts` ist als reine Plugin-Metadaten im Plugin verblieben.

## Host-Kontexte im Vergleich

### Bereits vorhanden

- `apps/sva-studio-react/src/lib/waste-management-operations.server.ts` enthält die fachliche Waste-Job-Runtime hinter der Runtime-Fabrik `waste-management.operations`.
- `packages/auth-runtime/src/waste-management/server.ts` und `packages/auth-runtime/src/runtime-routes.ts` enthalten bereits waste-spezifische Host-/Runtime-Oberfläche, allerdings für HTTP-Handler und Route-Exports, nicht für den Plugin-Job-Adapter.
- `packages/auth-runtime/src/plugin-operations/runner.ts` und `packages/auth-runtime/src/server.ts` stellen die generische Registrierungs- und Runner-Infrastruktur für Plugin-Jobs bereit.

### Einordnung

- Aussage 1 ist erfüllt: `packages/plugin-waste-management/src/server.ts` enthält echte host-relevante Runtime-Logik, konkret Input-Prüfung, Progress-Steuerung, Cancellation-Grenzen und die Zuordnung von Job-Typen zu Runtime-Operationen.
- Der beobachtete Waste-Kontext in `auth-runtime` macht `auth-runtime` zu einer realen Alternative für Task 5; er darf deshalb nicht als fachfremd ausgeschlossen werden.
- Gleichzeitig bündelt `auth-runtime` heute zwei eher generische Rollen: HTTP-Hostfläche und Job-Runner-Infrastruktur. Der Waste-Job-Adapter wäre dort der erste plugin-spezifische Job-Adapter in dieser Schicht.

## Bewertung für Task 5

Bevorzugte Option: `@sva/waste-management-runtime`.

Begründung:

- Die Waste-Job-Runtime lebt fachlich bereits außerhalb des Plugins und näher an eigener Domainlogik als an generischer Runner-Infrastruktur.
- Ein dediziertes Paket hält die Trennung klar: Plugin-Metadaten und UI im Plugin, generische Registrierung in `auth-runtime`, Waste-spezifische Job-Runtime in einer eigenen Host-Domain.
- Die Alternative `auth-runtime` bleibt vertretbar, falls bewusst ein gemeinsamer Ort für alle waste-spezifischen Serverflächen gewünscht ist. Dann sollte aber explizit entschieden werden, dass `auth-runtime` neben HTTP auch plugin-spezifische Job-Adapter beherbergt.

## Empfehlung für Task 5

- `packages/plugin-waste-management/src/server.ts` aus dem Plugin herausziehen.
- Standardpfad: nach `@sva/waste-management-runtime`.
- Nur wenn das Zielbild ausdrücklich einen zentralen Waste-Server-Ort in `auth-runtime` bevorzugt, den Adapter stattdessen dort ansiedeln.
