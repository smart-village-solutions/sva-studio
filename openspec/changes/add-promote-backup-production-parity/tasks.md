## 1. Backup-Job und Speichervertrag

- [x] 1.1 MinIO-S3-Konfiguration als umgebungsgebundene Secrets und nicht-sensitive Variablen modellieren; Zugangsdaten dürfen weder in Logs noch Artefakten erscheinen.
- [x] 1.2 Einen isolierten, temporären Postgres-Backup-One-shot-Job erstellen, der einen Custom-Dump erzeugt und nach MinIO hochlädt.
- [x] 1.3 Eindeutige Objektpfade, Größe, SHA-256-Vergleich nach erneutem Download und Archivprüfung über `pg_restore --list` implementieren; S3-ETags nicht als Prüfsumme verwenden.
- [x] 1.4 Fehlgeschlagene Backup-Erstellung, Upload oder Validierung fail-closed behandeln und sichere Recovery-Evidenz schreiben.

## 2. Promote-Parität für Staging und Production

- [x] 2.1 `Promote` so erweitern, dass bei erforderlicher Migration oder Bootstrap genau ein Backup vor den One-shot-Jobs läuft.
- [x] 2.2 Production-`migration_mode=run` und `bootstrap_mode=run` mit demselben Executor-Ablauf wie Staging freigeben.
- [x] 2.3 Einen redigierten, maschinenlesbaren Staging-Digest-Nachweis als GitHub-Actions-Artefakt erzeugen, dem Production-Workflow ausschließlich `actions: read` erteilen und den Nachweis vor jedem Production-`run` für exakt dieses Ziel-Digest prüfen.
- [x] 2.4 Für Production bei Migration oder Bootstrap ein Wartungsfenster vor jeder Mutation erzwingen.
- [x] 2.5 Reihenfolge und Fail-Closed-Vertrag sicherstellen: Backup → Migration → optional Bootstrap → Postconditions → App-Deploy → Verifikation.

## 3. Tests und Qualitätsgates

- [ ] 3.1 Unit-Tests für Bucket-Auswahl, Objektpfad, SHA-256-Vergleich nach Download, Archivvalidierung, Geheimnisredaktion und Fehlerfälle ergänzen.
- [ ] 3.2 Workflow-Vertrag für Staging und Production einschließlich Backup-Reihenfolge, exakt passender Staging-Digest-Evidenz, Wartungsfenster für beide Production-Modi und App-Deploy-Blockade testen.
- [x] 3.3 Compose-Rendering nachweisen: Backup-Job enthält keinen Live-App-, Postgres- oder Redis-Service und nutzt ausschließlich das Ziel-Overlay-Netz.
- [x] 3.4 Relevante Unit-, TypeScript-, Server-Runtime-, Workflow- und File-Placement-Gates ausführen.

## 4. Dokumentation und Betriebsabnahme

- [x] 4.1 arc42-Abschnitte 07, 08 und 11 sowie das Swarm-Runbook mit Backup-, Recovery- und Production-Paritätsvertrag aktualisieren.
- [x] 4.2 MinIO-Bucket-Lifecycle vor der Abnahme konfigurieren sowie Aufbewahrungszeit und Verantwortlichkeit im Runbook dokumentieren. (Für beide Buckets ist die Regel `expire-promote-backups-after-180-days` aktiv.)
- [ ] 4.3 Einen Staging- und anschließend einen Production-Promote mit demselben Digest, Backup-Nachweis und Smoke-Evidenz durchführen.
