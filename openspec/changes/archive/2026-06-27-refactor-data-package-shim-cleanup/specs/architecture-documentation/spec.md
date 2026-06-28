## ADDED Requirements
### Requirement: Architekturdokumentation beschreibt `@sva/data` nur als kontrollierten Shim-Pfad

Die Architekturdokumentation MUST `@sva/data` als historisches Paket für Migrationen, Seeds, DB-Skripte/-Operationen und dokumentierte Kompatibilitäts-Re-Exports bzw. Delegation beschreiben. Sie MUST `@sva/data-repositories` gleichzeitig als einzige führende Repository-Schicht benennen.

#### Scenario: Zielarchitektur dokumentiert die Datenpaket-Grenze

- **WHEN** Teammitglieder `docs/architecture/package-zielarchitektur.md` oder `docs/architecture/package-gesamtuebersicht.md` lesen
- **THEN** beschreiben diese Quellen `@sva/data` nur als Migrations-, Seed-, DB-Skript/-Operations- und Kompatibilitätspfad
- **AND** benennen `@sva/data-repositories` als führende serverseitige Repository-Schicht

#### Scenario: Architekturänderung mit Datenpaket-Wirkung wird dokumentiert

- **WHEN** ein Change `@sva/data`, `@sva/data/server` oder `@sva/data-repositories` berührt
- **THEN** erklären die betroffenen Architekturquellen, ob `@sva/data` nur delegiert oder Re-Exports bereitstellt
- **AND** sie dokumentieren keine neue fachliche Repository-Ownership in `@sva/data`
