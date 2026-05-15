# Change: Generische Host-Runtime-Auflösung für Plugin-Jobs einführen

## Why

Die Plugin-Plattform v2 lädt Job-Entry-Points bereits über Manifest, Katalog und Snapshot, koppelt die eigentliche Host-Runtime-Injektion aber noch über eine explizite `pluginId -> Runtime-Factory`-Matrix. Dadurch benötigen neue Plugins mit `jobs`-Entry-Point weiterhin eine bewusste Host-Sonderverdrahtung.

Für den nächsten Reifegrad der Plattform soll dieser Restbruch im Job-Pfad beseitigt werden, ohne den Scope auf pluginseitige `server`- oder `integrations`-Beiträge auszuweiten. Der Host soll Job-Runtimes deklarativ über einen stabilen Runtime-Contract aus Manifest und host-owned Registry auflösen.

## What Changes

- erweitert den serialisierbaren `PluginManifest` um optionale `runtimeRequirements.jobs`
- verlangt für Plugins mit `jobs`-Entry-Point eine deklarierte Job-Runtime-Contract-ID
- ersetzt die pluginId-basierte Host-Matrix für Job-Runtimes durch eine host-owned Registry auf Basis von Runtime-Contract-IDs
- stellt den Waste-Management-Referenzpfad auf den generischen Job-Runtime-Vertrag um
- ergänzt deterministische Fehlerfälle für fehlende Runtime-Anforderungen oder fehlende Host-Provider
- dokumentiert die reduzierte technische Schuld in der Architektur-Doku

## Impact

- Affected specs:
  - `plugin-platform`
  - `architecture-documentation`
- Affected code:
  - `packages/plugin-sdk`
  - `packages/plugin-waste-management`
  - `apps/sva-studio-react`
- Affected documentation:
  - `docs/architecture/11-risks-and-technical-debt.md`
