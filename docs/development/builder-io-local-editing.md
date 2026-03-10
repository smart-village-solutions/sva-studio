# Builder.io Local Editing im Monorepo

## Ziel

Diese Anleitung beschreibt den lokalen Start von Builder.io für `apps/sva-studio-react` im Nx- und pnpm-Monorepo.

## Problem

`builder.io launch` scheitert im App-Unterordner ohne zusätzliche Workspace-Konfiguration mit einem Fehler der Form:

```text
RangeError: path should be a `path.relative()`d string
```

Ursache ist, dass Builder beim Dateiscan auf Quellpfade außerhalb des App-Ordners trifft, zum Beispiel `../../packages/routing/...`. Diese Pfade entstehen durch die lokale Monorepo-Auflösung in `vite.config.ts` und sind für die intern verwendete Ignore-Logik des Builder-CLI problematisch.

## Lösung

Für die React-App liegt unter `apps/sva-studio-react/builder.workspace.json` eine explizite Builder-Workspace-Datei. Sie bindet die App sowie die benötigten Workspace-Packages als gemeinsame Ordner ein.

Dadurch startet Builder ohne den `path.relative()`-Fehler.

## Empfohlener Start

Im App-Ordner:

```bash
cd apps/sva-studio-react
pnpm run builder:launch
```

Der Script ruft intern auf:

```bash
npx builder.io@latest launch -p 3000 -c "pnpm nx run sva-studio-react:serve" --no-open --workspace ./builder.workspace.json
```

## Hinweise

- Die `lsof`-Warnungen zu `/Volumes/.timemachine/...` stammen vom Port-Check auf macOS und sind in diesem Zusammenhang nicht die Fehlerursache.
- Der eigentliche relevante Fehler ist der `RangeError` mit den Parent-Pfaden `../../packages/...`.
- Wenn zusätzliche Workspace-Packages direkt aus der App aufgelöst werden, müssen sie gegebenenfalls auch in `builder.workspace.json` ergänzt werden.
