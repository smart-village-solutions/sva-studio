# Change: Plugin-Zugriffs- und Action-Registry modularisieren

## Why

Die zentrale Plugin-Registry bündelt heute die Validierung von Access-Anforderungen und Action-Beiträgen in einer großen Datei. Die sicherheitskritischen Verträge bleiben zwar fail-closed, sind dadurch aber unnötig schwer isoliert zu prüfen und zu ändern.

## What Changes

- Extrahiert den strukturellen Vergleich von Plugin-Access-Anforderungen in einen frameworkfreien internen Baustein.
- Extrahiert die phasenweise Action-Registry-Validierung und -Materialisierung in einen internen Baustein.
- Erhält öffentliche Typen, Exports, Fehlercodes, Fehlerpriorität, Mengen-Semantik und Alias-Verhalten vollständig.
- Härtet die vorhandenen Verträge durch kombinatorische Characterization-Tests.

## Impact

- Affected specs: `plugin-actions`
- Affected code: `packages/plugin-sdk/src/plugins.ts`, neue interne Module unter `packages/plugin-sdk/src/plugin-platform/`, Registry-Tests
- Affected arc42 sections: `05-building-block-view`, `08-cross-cutting-concepts`
- Breaking changes: keine
