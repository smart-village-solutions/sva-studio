# Abnahme des zentralen Backup-Agenten in Staging

> **Historischer Staging-Nachweis:** Die vollständige Abnahme einschließlich Production wurde am 31. Juli 2026 abgeschlossen. Aktueller Betriebsvertrag ist der [kanonische Studio-Rollout](../../guides/studio-rollout-process.md); der [finale Abnahmenachweis](../../reports/backup-agent-rollout-abnahme-2026-07-31.md) dokumentiert den Abschluss.

## Ergebnis

Der zentrale Backup-Agent wurde am 29. Juli 2026 auf dem Quantum-Endpoint `sva`
im Stack `studio-backup-agent` abgenommen. Die Replica lief auf `node-005.sva`
mit dem unveränderlichen Agent-Image:

`ghcr.io/smart-village-solutions/sva-studio-backup-agent@sha256:5ade0d53dd27b621bab5b6f3bbcf1d280811b0d560bcedbbcd49c8407cd4768f`

Der Staging-Endpunkt
`https://backup-studio-staging.smart-village.app/_ops/backup/v1/requests`
war über gültiges TLS erreichbar. Ein absichtlich ungültiger Auftrag wurde
kontrolliert mit HTTP `400` abgewiesen.

## Erfolgreicher Drill

- GitHub-Actions-Lauf: `30492836842`
- Request-ID: `gha-30492836842-1`
- Studio-Commit: `66cd7fbc05a2bae02d8032566fc87cd3c0ad839f`
- Studio-Image-Digest: `sha256:b7d5fd29aa2f27afb759528bbca9ed94e133024d67f736138d1e03b604886ca9`
- Bucket: `studio-db-backup-staging`
- Dump-Größe: `255280` Byte

Der Agent meldete alle vorgeschriebenen Schritte als erfolgreich:

1. PostgreSQL-Custom-Dump
2. Upload nach MinIO
3. erneuter Download
4. Größen- und SHA-256-Vergleich
5. Archivprüfung mit `pg_restore --list`

Der GitHub-Workflow prüfte anschließend das Backup-Objekt unabhängig und lud
die redigierte Laufzeitevidenz als Artifact hoch.

## Unabhängig geprüfte MinIO-Nachweise

Folgende Objekte wurden nach dem Workflow per `head-object` im
Staging-Bucket bestätigt:

- `control/requests/gha-30492836842-1.json`
- `control/results/gha-30492836842-1.json`
- `staging/2026-07-29T21-34-29-201Z/b7d5fd29aa2f27afb759528bbca9ed94e133024d67f736138d1e03b604886ca9/gha-30492836842-1.dump`
- `staging/2026-07-29T21-34-29-201Z/b7d5fd29aa2f27afb759528bbca9ed94e133024d67f736138d1e03b604886ca9/gha-30492836842-1.dump.sha256`

Das terminale Ergebnis war `succeeded`, der Prüfsummenwert hatte das erwartete
SHA-256-Format, und die im Ergebnis gemeldete Größe stimmte mit dem
Dump-Objekt überein. Zugangsdaten und Datenbankinhalte wurden weder in diese
Dokumentation noch in die GitHub-Evidenz übernommen.

## Operative Korrekturen

Für die reale Umgebung waren drei Abweichungen zu korrigieren:

- aktuelle AWS-CLI-Versionen benötigen am bestehenden MinIO-Endpunkt
  `when_required` für optionale Request- und Response-Prüfsummen;
- vollständige logische Dumps verwenden den PostgreSQL-Principal `sva`, weil
  der App-Principal `sva_app` der Row-Level-Security unterliegt;
- das lokale `POSTGRES_PASSWORD` war gegenüber dem laufenden
  Staging-Postgres veraltet. Deshalb wurde das live gesetzte Passwort ohne
  Ausgabe als versioniertes Swarm-Secret
  `backup_staging_postgres_password_v3` gebunden.

Die Production-Abnahme wurde nach der expliziten Freigabe separat durchgeführt
und ist unter
[Production-Abnahme des zentralen Backup-Agenten](../../reports/central-backup-agent-production-acceptance.md)
dokumentiert.
