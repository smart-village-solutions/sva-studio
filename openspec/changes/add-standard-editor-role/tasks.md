## 1. Entwurf

- [x] Vereinbartes Rechteprofil, Löschbarkeit und einmalige Bestandsmigration dokumentieren.
- [x] Gegen vorhandenen MCP-Change `add-editor-role-baseline` abgrenzen.
- [x] Technischen Entwurf prüfen und vor Implementierung freigeben (Nutzerauftrag vom 15.11.2026).

## 2. Umsetzung nach Freigabe

- [x] Alle verfügbaren Inhaltsmodule und ihre redaktionellen Actions einschließlich Push inventarisieren; bestehende Scope-/Permission-Verträge nutzen.
- [x] Standardrollendefinition im bestehenden Pfad ergänzen und Neuanlage ohne Benutzerzuweisung integrieren; kleinste Unit-/Type-Gates unmittelbar ausführen.
- [x] Datenmigration für alle bestehenden Mandanten mit Transaktion, Kollisionsbehandlung, Wiederholbarkeit und unabhängigem Readback implementieren; vorher Schema-Snapshot und Schemaübersicht prüfen.
- [x] Modulabgleich auf vorhandene Standardrollen begrenzen: redaktionelle Modulrechte ergänzen, Modulverfügbarkeit respektieren und gelöschte Rolle nicht wiederherstellen.
- [x] Ownership-Grenzen für alle betroffenen Listen-, Detail-, Mutations-, Veröffentlichungs-, History- und Push-Pfade serverseitig nachweisen; Mainserver-Kompatibilität darf keine Ausweitung erlauben.
- [x] Mandantenweite Medien-/Kategorienrechte und bestehenden Referenzschutz prüfen.

## 3. Nachweise und Dokumentation

- [x] Die Invariantenmatrix aus `design.md` mit gezielten Unit-/Integrations-/Vertragsnachweisen einschließlich mindestens zweier Testmandanten und Migrationsteilfehlern abdecken.
- [x] Früh `pnpm check:server-runtime`, passende Type-Gates und Pflicht-Gates für Autorisierung/Datenintegrität/Migration gemäß DEVELOPMENT_RULES.md 5.2 ausführen und lokale Evidenz dokumentieren. Vor einem späteren Merge sind die Gates für dessen exakten finalen HEAD erneut maßgeblich.
- [x] Relevante aktuelle IAM-/Betriebsdokumentation und arc42 04, 05, 06, 08 prüfen und betroffene Abschnitte aktualisieren; Schemaänderungen in beiden kanonischen Schema-Dokumenten nachführen.
- [x] OpenSpec strikt validieren und `pnpm check:file-placement` ausführen; hinzugefügte und entfernte Konzepte/Pfade auf unnötige Oberfläche prüfen.

## 4. Späterer autorisierter Rollout

- [ ] Regulären Rollout gemäß `docs/guides/studio-rollout-process.md` durchführen und Bestandsmigration je Umgebung nachweisen.
- [ ] Unabhängigen Readback aller Zielmandanten sowie fachliche Abnahme separat dokumentieren; Konflikte oder fehlende Mandantenergebnisse offen ausweisen.
