# @sva/studio-module-iam

`@sva/studio-module-iam` bündelt die kanonischen Studio-Modul-IAM-Verträge für Host, Runtime und Provisioning. Das Paket enthält nur framework-agnostische Vertragsdaten und kleine Registry-Helper, damit serverseitige Pfade keine React- oder Host-Bindings importieren müssen.

## Architektur-Rolle

Das Paket bildet die gemeinsame Vertragskante für modulbezogene IAM-Entscheidungen im Studio. Es ist die serverseitig sichere Quelle für:

- Standard-Content-Module `news`, `events` und `poi`
- das hosteigene Modul `media`
- die gemeinsame Modul-Registry für Instanzzuweisung, IAM-Seeding und Diagnose

## Öffentliche API

Exportierte Typen:

- `StudioModuleIamContract`

Exportierte Werte und Funktionen:

- `studioPluginModuleIamContracts`
- `studioHostModuleIamContracts`
- `studioModuleIamContracts`
- `studioModuleIamRegistry`
- `getStudioModuleIamContract(moduleId)`

## Projektstruktur

```text
packages/studio-module-iam/
├── src/
│   ├── index.ts
│   └── index.test.ts
├── package.json
├── project.json
├── tsconfig.json
├── tsconfig.lib.json
└── vitest.config.ts
```
