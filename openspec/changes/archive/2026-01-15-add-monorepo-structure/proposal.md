# Change: Monorepo-Struktur und Package-Architektur für SVA Studio

## Why
SVA Studio soll als erweiterbare Plattform mit Core und Plugins wachsen. Eine klar definierte Monorepo- und Package-Struktur ermöglicht unabhängige Pakete, saubere Grenzen, und spätere npm-Publikation.

## What Changes
- Festlegung einer Nx Integrated Monorepo-Struktur mit definierten Ordnern für Apps und Packages
- Einführung von Konventionen für Package-Namen, Build-Outputs und Public-API
- Definition eines Plugin-Ansatzes als publishable Packages (z. B. @sva/plugin-*)
- Aufnahme eines Start-Stacks: React mit TanStack Start (Vinxi/Vite)
- Kein neues Backend/BaaS: bestehende GraphQL-API und Auth bleiben Quelle der Wahrheit

## Impact
- Affected specs: monorepo-structure
- Affected code: neue Workspace-Struktur, Build-/Release-Tooling, Package-Konventionen

## Decision Notes
- Nx wird gesetzt, weil Project Graph, Generatoren und Architektur-Konventionen bei wachsender Package-/Plugin-Landschaft Mehrwert liefern.
- Turborepo + pnpm wurde als Alternative betrachtet, bietet aber weniger eingebaute Struktur und Regeln für ein grösseres Ökosystem.
