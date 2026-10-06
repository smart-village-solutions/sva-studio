# Change: Installierte Plugin-Entrypoints manifesttreu auflösen

## Why

Der Studio-Build erkennt installierte Manifeste, bildet aber keine installierten Servermodule ab. Browser-, Descriptor- und Job-Register suchen nur nach `plugin-*` und festen Dateinamen. Eine installierte Distribution mit anderem Paketnamen oder gültigen abweichenden Manifestpfaden kann deshalb den bestehenden Plugin-Snapshot nicht vollständig erreichen (#1512).

## What Changes

- Der Build liest installierte Katalogeinträge samt Profilzuordnung aus `apps/sva-studio-react/plugin-catalog.json` und materialisiert ausschließlich deren deklarierte Manifest-Entrypoints in den bestehenden Browser-, Descriptor-, Server- und Job-Registern.
- Die bestehenden Profilgrenzen `studio` und `ssf` bleiben erhalten. Workspace-Plugins nutzen weiterhin ihren bestehenden Quellpfad; installierte Plugins werden nur für das gewählte Profil aufgenommen.
- Fehlende, außerhalb des Pakets liegende oder nicht auflösbare deklarierte Entrypoints stoppen den Build vor Veröffentlichung. Nicht ausgewählte installierte Pakete erzeugen keine Runtime-Imports.
- Ein gepacktes Testpaket mit einem beliebigen Namen und getrennten Dateien weist die tatsächliche Paketauflösung sowie positive und negative Artefaktfälle nach. Es wird nicht als Produktplugin veröffentlicht.

## Impact

- Issue: #1512; Teilauftrag von #1503; baut auf dem mit #1511 gelieferten Descriptor-Vertrag auf.
- Betroffene Spezifikation: `plugin-platform`.
- Betroffene Codegrenzen: Studio-Katalog- und Build-Inputs, bestehende Build-Registry und Loader-Consumer, Vite-Build-Einbindung, Image-/Chunk-Verifikation und gezielte Paket-/Artefakttests.
- Betroffene arc42-Abschnitte: `docs/architecture/05-building-block-view.md` und `docs/architecture/08-cross-cutting-concepts.md`; die Entwicklerdokumentation für Plugins wird fortgeschrieben.

## Nicht-Ziele

- Keine Installationsoberfläche, kein Paketmarktplatz, kein Hot-Loading und kein zusätzlicher Rollout-Pfad.
- Keine Änderung der tenantbezogenen Aktivierung oder der Host-Execution-Contexts. Die bestehenden `studio`-/`ssf`-Image-Prüfungen bleiben erhalten und berücksichtigen zusätzlich die gewählten installierten Pakete.
- Keine Aufnahme eines Produktplugins ohne konkret benannten Verbraucher und Host-Runtime-Vertrag.

## Kritische Nachweise vor Merge

1. Ein aus einem Tarball installiertes Testpaket außerhalb des Namensschemas `plugin-*` mit getrennten Browser-, Descriptor-, Server- und Job-Dateien erreicht den validierten Snapshot und die vorhandenen Server-/Job-Loader.
2. Entfernte, falsch deklarierte, inkompatible und nicht ausgewählte Pakete sind im Build- beziehungsweise Startnachweis fail-closed; nicht ausgewählte Pakete erscheinen in keinem Client-/Server-/Worker-Chunk.
3. Der gleiche deklarative Beitragsumfang entsteht für das Testpaket im Workspace- und Installationspfad. Der Nachweis prüft die tatsächliche Modulauflösung, nicht nur injizierte Registry-Maps.
4. Die beiden bestehenden Profil-Builds und die Image-/Chunk-Verifikation sind für den exakten PR-HEAD grün; bei der Testdistribution stimmt der ausgewählte Paket- und Chunk-Satz mit dem tatsächlichen Artefakt überein.
