# Router-Diagnostik für Demo-Deployment

Stand: 13.03.2026

Für die Eingrenzung des SSR-Routing-Fehlers schreibt der App-Container beim Start jetzt zwei Diagnoseartefakte:

- `/tmp/sva-entrypoint-diagnostics.json`
- `/tmp/sva-router-diagnostics.json`

## Inhalt

`/tmp/sva-entrypoint-diagnostics.json` enthält:

- vorhandene Runtime-Artefakte wie `.output/server/index.mjs`
- gefundene Public-Assets
- Status des generierten TanStack-Start-Manifests im Runtime-Server-Bundle unter `.output/server/chunks/build/`
- nur unkritische Env-Informationen als Bool-Werte oder Basis-URLs

`/tmp/sva-router-diagnostics.json` enthält, falls die optionale Router-Diagnose im SSR-Bundle ausgeführt wurde:

- den vom Prozess aufgebauten Route-Tree
- registrierte `routesById`, `routesByPath` und `flatRoutes`
- Marker, ob `/` und `/demo` tatsächlich registriert sind
- bei frühem Modul-Load zunächst einen Snapshot mit `phase: "router_module_loaded"`

## Nutzung

Die Dateien sind für Fälle gedacht, in denen Live-Logs auf dem Swarm-Node nicht zuverlässig verfügbar sind. Sie können nach dem Start des Containers per Exec ausgelesen werden.

## Root Cause

Die eigentliche Ursache des Demo-404 war am Ende nicht mehr das Routing selbst, sondern der Build-Pfad:

- `pnpm nx run sva-studio-react:build` mit `@nx/vite:build` erzeugte in dieser App nur `.output/public`
- der nachgeschobene manuelle `nitro build` erzeugte zwar `.output/server/index.mjs`, aber nur einen generischen Nitro-Server ohne TanStack-Start-SSR-Route-Bundle
- ein direkter `pnpm exec vite build` im App-Ordner baut dagegen korrekt:
  - `.output/public/*`
  - `.output/server/chunks/build/*`
  - `.output/server/index.mjs`

Der `build`-Target von `sva-studio-react` wurde deshalb auf `nx:run-commands` mit direktem `vite build` umgestellt. Der separate `nitro build` im Dockerfile entfällt.

Beispiel:

```bash
quantum-cli exec --environment demo --endpoint sva --stack sva-studio --service app -- cat /tmp/sva-entrypoint-diagnostics.json
quantum-cli exec --environment demo --endpoint sva --stack sva-studio --service app -- cat /tmp/sva-router-diagnostics.json
```
