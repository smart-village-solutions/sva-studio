# IAM-Baseline-Seeding für Instanz-Module

## Zweck

Dieses Dokument beschreibt den Entwicklungs- und Testpfad für das modulbezogene IAM-Baseline-Seeding.

## Führende Datenquellen

- `iam.instances` enthält die Instanz
- `iam.instance_modules` enthält den kanonischen Modulsatz
- `@sva/plugin-sdk` liefert den deklarativen Modul-IAM-Vertrag

## Lokaler Ablauf

1. Migrationen ausführen:

```bash
pnpm nx run data:db:migrate:up
```

2. Seeds ausführen:

```bash
pnpm nx run data:db:seed
```

3. Instanzdetail oder Modulbereich im Root-Host öffnen.
4. Modul zuweisen oder `IAM-Basis neu aufbauen` ausführen.

## Seed-Szenarien

- Instanz ohne zugewiesene Module:
  - erwartet leere `assignedModules`
  - Plugin-Routen und Plugin-Navigation bleiben blockiert
- Instanz mit gültigem Modulsatz:
  - `assignedModules` enthält die zugewiesenen Modul-IDs
  - passende modulbezogene Permissions sind vorhanden
- Instanz mit absichtlich driftender IAM-Basis:
  - Modul ist zugewiesen, aber Permission- oder Rollenbasis fehlt teilweise
  - `seedIamBaseline` rekonstruiert die Basis idempotent

## Prüfregeln

- Modulverträge dürfen nur über `plugin.moduleIam` eingebracht werden.
- unbekannte Module werden serverseitig abgewiesen
- Entzug entfernt modulbezogene Rechte hart
- `seedIamBaseline` verändert keine Rollenmitgliedschaften des aufrufenden Benutzers

## Relevante Checks

```bash
openspec validate add-instance-module-activation --strict
pnpm check:server-runtime
pnpm nx run-many --target=test:unit --projects=plugin-sdk,instance-registry,data-repositories,data,routing,sva-studio-react --parallel=4
```
