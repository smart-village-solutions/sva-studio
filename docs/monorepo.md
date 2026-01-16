# Monorepo Struktur

## Ordner
- apps/: laufende Anwendungen (z. B. studio)
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

## Warum Nx (statt Turborepo)?
Wir nutzen Nx, weil es als integrierte Monorepo-Plattform mehr liefert als „nur“ Task-Running:

- **Projektgraph & affected commands:** Nx modelliert Abhängigkeiten zwischen Apps und Packages und kann dadurch in CI/CD gezielt nur die betroffenen Projekte bauen/testen.
- **Generatoren & Konsistenz:** Neue Apps/Packages/Plugins lassen sich mit wiederholbaren Konventionen scaffolden (geringerer Setup-Aufwand, weniger Drift).
- **Architektur-Governance:** Mechanismen wie Tags/Boundaries helfen, Schichten (Core vs. Plugins) langfristig sauber zu halten.
- **Caching & Skalierung:** Lokales/Remote-Caching ist integriert; optional kann Nx Cloud für Team-Setups genutzt werden.

Details und Trade-offs: siehe openspec/specs/monorepo-structure/design.md

## Nx Targets
Standardisierte Targets:
- build: tsc -p packages/<name>/tsconfig.lib.json
- lint: Platzhalter (noch zu konfigurieren)
- test: Platzhalter (noch zu konfigurieren)

## Hinweise
- TanStack Start benötigt Node >= 22.12.0
- Routing erfolgt über eine Code-Registry; siehe docs/routing.md
- Package-Manager ist pnpm (siehe pnpm-workspace.yaml)
