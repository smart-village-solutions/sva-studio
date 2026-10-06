# Change: Plugin-Metadaten ohne Browser-Entry-Point materialisieren (#1511)

## Why

`createStudioPluginCatalogReport` lädt derzeit die `PluginDefinition` aus dem
Browser-Entry-Point. Der Server-Dispatch importiert den so erzeugten Snapshot
aus `plugins.ts`; der Aktivierungsbootstrap tut dasselbe, und die Job-Runtime
lädt Browser-Pluginmodule erneut. Ein Browser-Importfehler kann deshalb
Server-Start und Worker-Registrierung verhindern, obwohl Server- und
Job-Entry-Points ausführbar sind.

## What Changes

- Der bestehende Manifest-/Katalogvertrag erhält einen serverfähigen,
  deklarativen Descriptor-Entry-Point. Die vorhandene Katalogauflösung prüft
  dessen Identität, Kompatibilität und Beiträge vor der Snapshot-Veröffentlichung.
- Plugin-Descriptoren halten Metadaten, Routenbeschreibung, IAM-, Lifecycle-,
  Server- und Job-Verträge ohne React-Seiten, Browser-Logger oder
  Übersetzungsinitialisierung. Der Browser bindet seine Views an genau diese
  validierten Descriptoren; Metadaten werden nicht in einer zweiten Liste
  gepflegt.
- Server-Dispatch, Aktivierungsbootstrap und Job-Runtime konsumieren die
  serverfähig materialisierte Katalogentscheidung. Der bisherige Import von
  `plugins.ts` und das Browser-Modulregister im Job-Pfad entfallen.
- Die bestehenden `studio`-/`ssf`-Buildprofile bleiben die Auswahlgrenze.
  Ein nicht ausgewähltes, deaktiviertes oder inkompatibles Plugin liefert in
  keinem Kontext Beiträge.

## Nicht-Ziele

- Keine freie Installation oder manifesttreue Auflösung beliebiger
  Paketnamen und Entry-Point-Dateien (#1512).
- Keine Überführung fester App-Fachseiten nach Plugin-Views (#1509), keine
  neue SSR-Technologie und kein Hot-Loading.
- Keine Änderung an Tenant-Aktivierung, IAM-Entscheidungen, Jobausführung,
  HTTP-Verträgen oder Datenbankschema.

## Impact

- Betroffene Spezifikation: `plugin-platform`.
- Maximale Codebereiche: vorhandene SDK-Descriptor-/Snapshot-Verträge,
  Katalog-/Build-Inputs, Plugin-Descriptoren der ausgewählten Profile,
  Browser-Bindung sowie die drei Server-/Job-Consumer und ihre Tests.
- Betroffene arc42-Abschnitte: `04-solution-strategy.md`,
  `05-building-block-view.md`, `06-runtime-view.md`.
- Kein neuer Package-, Service-, Orchestrator- oder Rollout-Pfad.

## Erfolg

Ein Testplugin mit absichtlich nicht serverfähig auswertbarem Browser-Modul
liefert beim echten Modulimport seine Server- und Job-Beiträge; Bootstrap und
Dispatch starten. Browser und Server veröffentlichen denselben validierten
Metadatenbestand. Deaktivierte und inkompatible Plugins bleiben in allen
Registern abwesend. Der Server-/Worker-Importgraph enthält keine
Plugin-Fachseiten oder Browser-Logger.
