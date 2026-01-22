# Monorepo Struktur

## Ordner
- apps/: laufende Anwendungen (z. B. sva-studio-react)
- packages/: publishable Libraries und Plugins
- tooling/: gemeinsame Tools und Konfigurationen
- scripts/: Automations-Skripte

## Package-Konventionen
- Scope: @sva/*
- Core: @sva/core
- Data: @sva/data
- SDK: @sva/sdk
- Plugins: @sva/plugin-*

## Neues Package anlegen
1. Lege einen Ordner unter packages/ an
2. Erstelle package.json, project.json, tsconfig.json, tsconfig.lib.json
3. Exportiere die Public API über src/index.ts
4. Füge einen Pfad in tsconfig.base.json hinzu

## Nx Targets
Standardisierte Targets:
- build: tsc -p packages/<name>/tsconfig.lib.json
- lint: Platzhalter (noch zu konfigurieren)
- test: Platzhalter (noch zu konfigurieren)

## Hinweise
- TanStack Start benötigt Node >= 22.12.0
- Routing erfolgt über eine Code-Registry; siehe docs/routing.md
- Package-Manager ist pnpm (siehe pnpm-workspace.yaml)
