## 1. Implementierung

- [x] 1.1 Gepinnten `goose`-Wrapper für macOS/Linux und lokale Tool-Cache-Installation einführen
- [x] 1.2 Kanonischen `goose`-Migrationspfad mit historisch neu nummerierten SQL-Dateien aufbauen
- [x] 1.3 Bestehende Nx-Targets und Data-Skripte auf `goose` umstellen und `db:migrate:status` ergänzen
- [x] 1.4 Runtime-Profile, Acceptance-Migration und Deploy-Evidenz auf `goose`-Status und `goose`-Version erweitern
- [x] 1.5 Tests und Diagnosepfade auf neue Dateinamen, neue Pfade und `goose`-Semantik anpassen
- [x] 1.6 Relevante Dokumentation und arc42-Abschnitte fortschreiben und ADR-029 referenzieren

## 2. Validierung

- [x] 2.1 `pnpm nx run data:test:unit` bzw. die betroffenen Data-/SDK-/Auth-Tests erfolgreich ausführen
- [x] 2.2 `pnpm nx run data:db:migrate:validate` erfolgreich gegen temporäre DB ausführen
- [x] 2.3 `pnpm nx run data:db:test:seeds` und `pnpm nx run data:db:test:rls` erfolgreich ausführen
- [x] 2.4 `pnpm check:file-placement` und relevante Type-/Lint-Checks erfolgreich ausführen
