# Change: Plugin-SDK-Boundary bereinigen – Plugins dürfen nur über @sva/sdk importieren

## Why

`@sva/plugin-example` importiert direkt aus `@sva/core` und verletzt damit die in der Konzeption (Paketarchitektur.md) definierte SDK-Boundary: *„Das SDK-Paket ist die einzige offizielle Schnittstelle zwischen Plugins und dem Host-System."* Als Beispiel-Plugin hat dieses Paket Vorbildfunktion – ein falsches Abhängigkeits-Pattern hier setzt ein gefährliches Precedent für alle zukünftigen Plugins.

## What Changes

- `@sva/plugin-example`: Dependency von `@sva/core` auf `@sva/sdk` umstellen
- `@sva/plugin-example/src/index.ts`: Import von `coreVersion` → `sdkVersion` aus `@sva/sdk`
- ESLint-Boundary-Regel einführen: Plugins (`scope:plugin`) dürfen nicht direkt aus `@sva/core` importieren
- `@sva/sdk`: Re-Exports um Plugin-relevante Typen erweitern (Route-Factory-Typen als Einstieg)
- Monorepo-Spec: Neue Requirement für die SDK-Boundary-Regel ergänzen
- arc42-Bausteinsicht: Schichtdiagramm mit erlaubten Abhängigkeitsrichtungen ergänzen

## Impact

- Betroffene Specs: `monorepo-structure`
- Betroffene Packages: `@sva/plugin-example`, `@sva/sdk`, ESLint-Konfiguration
- Betroffene arc42-Abschnitte: `05-building-block-view` (Schichtdiagramm), `04-solution-strategy` (Leitprinzip SDK-Boundary)
- Breaking für externe Plugin-Entwickler: Nein (Beispiel-Plugin ist intern, noch keine externen Plugins)
