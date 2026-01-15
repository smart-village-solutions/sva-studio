## Context
SVA Studio soll als erweiterbares System mit Core und Plugins wachsen. Der Stack ist React mit TanStack Start, Monorepo-Tooling ist Nx gesetzt.

## Goals / Non-Goals
- Goals: Klar definierte Workspace-Struktur, publishable Packages, spätere npm-Verwendung
- Non-Goals: Detaillierte Feature-Implementierung der Fachdomänen, Backend-Neuarchitektur

## Decisions
- Decision: Nx Integrated Monorepo mit pnpm Workspaces
- Decision: Apps liegen unter apps/, publishable Packages unter packages/
- Decision: Plugins sind Packages mit Namensschema @sva/plugin-*
- Decision: Start-App basiert auf TanStack Start (Vinxi/Vite)
- Decision: Nx bleibt gesetzt; Turborepo wird nicht gewählt

## Alternatives considered
- Turborepo: guter Runner, aber Nx bietet Graph + Generators für Packages/Apps

## Risks / Trade-offs
- Nx initialer Overhead durch Konfiguration -> Mit Generatoren und klaren Konventionen kompensieren
- TanStack Start ist noch dynamisch im Ökosystem -> Regelmässige Updates einplanen

## Migration Plan
- Neue Struktur als Basis schaffen, danach inkrementell Pakete/App-Features aufbauen

## Open Questions
- Versioning-Strategie: Changesets vs. Nx Release
- Publikation: EUPL Lizenzhinweise je Package
