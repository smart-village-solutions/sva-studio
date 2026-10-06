# Change: Plugin-Tenant-Modulvoraussetzungen deklarativ auswerten

## Why

`@sva/instance-registry` kennt derzeit feste Plugin-IDs, um `categories` als
Begleitmodul zuzuweisen und Waste-Provisionierung auszulösen. Dadurch können
neue Plugins ihre Tenant-Modulvoraussetzungen nicht selbst deklarieren; ein
fehlendes Begleitmodul kann erst nach Beginn der Mutation auffallen.

## What Changes

- Plugin-Beiträge deklarieren direkte Tenant-Modulvoraussetzungen im
  vorhandenen `PluginDefinition`-Vertrag. Zuweisung und Bootstrap prüfen die
  Voraussetzung gegen die verfügbaren Modulbeiträge und den Tenant-Zustand,
  bevor sie schreiben.
- Ein Entzug wird abgewiesen, solange ein anderes zugewiesenes Modul die
  Voraussetzung benötigt.
- Aktivierung, Reconcile und Suspendierung laufen über den bestehenden
  Plugin-Tenant-Lifecycle. Die generische Instance Registry enthält keine
  Waste-ID oder Waste-Provisionierungsaktion mehr.
- Waste-Provisionierungsmethoden verlassen den allgemeinen
  Instance-Registry-Repositoryvertrag. Verbleibende Waste-Status- und
  Retry-Consumer bleiben über die vorhandene plugin-spezifische Serverfassade
  angebunden.
- Die derzeitigen `news`, `events` und `poi`-Voraussetzungen für `categories`
  werden im jeweiligen Plugin-Beitrag deklariert.

## PR-Ziel und Grenzen

**PR-Ziel:** Tenant-Modulvoraussetzungen aus validierten Plugin-Beiträgen
auflösen und alle Instance-Registry-Mutationen sowie Waste-Lifecycle-Trigger
auf den bereits bestehenden generischen Lifecycle-Pfad umstellen.

**Nicht-Ziele:** Keine neue Dependency-Manager-Schicht, kein neuer Jobrunner,
keine Änderung an IAM-Aktionen oder UI, keine allgemeine Retry-Reform und keine
Löschung bestehender Tenant- oder Waste-Fachdaten.

**Maximal betroffene Bereiche:** `packages/plugin-sdk`, die betroffenen
Plugin-Definitionen, `packages/instance-registry`, die
Instance-Registry-Repositoryverträge und deren bestehende Waste-Fassade,
gezielte Unit-/Integrations-Tests sowie die betroffenen Plugin-Plattform- und
arc42-Dokumente.

## Impact

- Affected specs: `plugin-platform`
- Affected code: Plugin-Definition/Snapshot-Validierung, Modulzuweisung und
  -Bootstrap, Tenant-Lifecycle-Reconcile, Instance-Registry-Repositoryvertrag
  und die bestehende Waste-Provisionierungsfassade
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`,
  `08-cross-cutting-concepts` (nur soweit die Zuständigkeit dort beschrieben
  ist)
- Related: [Issue #1508](https://github.com/smart-village-solutions/sva-studio/issues/1508),
  [Epic #1503](https://github.com/smart-village-solutions/sva-studio/issues/1503),
  completed predecessor [#1506](https://github.com/smart-village-solutions/sva-studio/issues/1506)
