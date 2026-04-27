## MODIFIED Requirements

### Requirement: Hard-Cut-Migration ohne dauerhafte Sammelimporte

Das System MUST alte Sammelimporte aus `@sva/auth`, `@sva/data` und `@sva/sdk` für migrierte Verantwortlichkeiten entfernen. Temporäre Re-Exports MAY nur innerhalb der aktiven Migrationsphase existieren und MUST mit Ablaufbedingung dokumentiert werden.

#### Scenario: Consumer nutzt migrierte Funktionalität

- **WHEN** eine Funktionalität in ein Zielpackage verschoben wurde
- **THEN** importieren alle produktiven Consumer den Zielpackage-Pfad
- **AND** der alte Sammelimport ist entfernt oder durch ein blockierendes Migrationsticket mit Ablaufdatum markiert

#### Scenario: Neue API wird veröffentlicht

- **WHEN** eine neue öffentliche API für Plugin-, Server-Runtime-, IAM-, Instanz- oder Datenlogik entsteht
- **THEN** wird sie direkt im passenden Zielpackage exportiert
- **AND** sie wird nicht zusätzlich als dauerhafte Kompatibilitäts-API über ein altes Sammelpackage veröffentlicht

#### Scenario: Legacy-Auth-Package wird aus dem Workspace entfernt

- **WHEN** `@sva/auth` keine aktiven produktiven Consumer mehr besitzt
- **THEN** wird `packages/auth` als Workspace-Projekt entfernt
- **AND** Root-Scripts, Nx-Gates, Runtime-Checks und aktive Dokumentation referenzieren nicht länger das Projekt `auth` als aktuellen Zielbaustein
- **AND** historische Archivdokumente dürfen `@sva/auth` nur als Vergangenheitskontext behalten
