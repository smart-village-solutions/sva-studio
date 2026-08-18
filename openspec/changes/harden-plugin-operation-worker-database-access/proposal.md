# Change: Datenbankzugriff des Plugin-Operations-Workers härten

## Why

Der produktive Plugin-Operations-Worker führt beim ersten Jobstart Graphile-Worker-Migrationen mit dem laufenden App-Principal aus. Dadurch scheitert das Einreihen neuer Jobs bei fehlenden DDL-Rechten und der App-Principal benötigt unnötig weitreichende Datenbankrechte.

## What Changes

- Graphile-Worker-Migrationen werden ausschließlich im kontrollierten Studio-Migrations-One-shot ausgeführt.
- Die laufende App führt keine Datenbankmigrationen mehr aus.
- Der App-Principal erhält nur die für App-Persistenz und das Einreihen erforderlichen Rechte.
- Ein dedizierter Worker-Principal verarbeitet Queue-Einträge über einen eigenen Datenbank-Pool.
- Bootstrap und Postconditions stellen Rollen, minimale Grants und ein aktuelles Graphile-Worker-Schema fail-closed sicher.
- Production-Konfiguration und Betriebsdokumentation werden um das Worker-Secret und die neue Principal-Grenze ergänzt.

## Impact

- Affected specs: `plugin-operations-platform`, `deployment-topology`
- Affected code: Plugin-Operations-Runner, Runtime-Secrets, Studio-Migration/Bootstrap, Swarm-Compose und Promote-Vertrag
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `07-deployment-view`, `08-cross-cutting-concepts`
