# Change: Versionierte Waste-Tenant-Migrationen einführen

## Why

Der bisher für PR #984 vorgesehene Promote-One-shot würde den vollständigen Schema-Builder für Neuprovisionierungen auf jede registrierte Waste-Tenant-Datenbank anwenden. Dieser Builder enthält neben additiven Schemaänderungen auch Backfills, Rechteänderungen und destruktive Altbereinigungen. Bei derzeit genau einem produktiv genutzten Waste-Tenant ist dieses wiederholte, breite Reconcile unnötig riskant.

## What Changes

- Waste-Tenant-Datenbanken erhalten einen lokalen, versionierten Migrationsstand.
- Der Promote-One-shot wendet ausschließlich noch nicht protokollierte, explizit definierte Migrationen an.
- Jede Tenant-Migration läuft in einer eigenen Transaktion und wird bei Fehlern vollständig zurückgerollt.
- Die erste Migration ergänzt ausschließlich die fehlende Spalte `waste_cities.postal_code`; sie enthält keine Löschungen, Backfills oder Rechteänderungen.
- Das Registry-Inventar, die abgeleitete Namensprüfung sowie die geschützten Backup-, Staging- und Production-Gates bleiben erhalten.
- Der vollständige Schema-Builder bleibt ausschließlich für Neuprovisionierungen zuständig und wird nicht mehr als wiederholbare Migration interpretiert.

## Impact

- Betroffene Specs: `deployment-topology`, bestehender Vertrag zur Administrierbarkeit von Waste-Migrationsständen
- Betroffener Code: `deploy/portainer/migrate-waste-tenants.mjs`, Migrations-Entrypoints, Docker-/Compose-Paketierung und zugehörige Tests
- Betroffene arc42-Abschnitte: `docs/architecture/08-cross-cutting-concepts.md`
- Betroffene Betriebsdokumentation: `docs/guides/studio-rollout-process.md`
