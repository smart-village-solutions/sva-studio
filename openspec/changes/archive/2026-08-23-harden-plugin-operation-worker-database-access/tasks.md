## 1. Runtime-Grenze

- [x] 1.1 Eigenen Worker-Datenbank-Resolver und Pool mit fail-closed Production-Konfiguration ergänzen
- [x] 1.2 `runMigrations()` aus dem normalen Worker-Startpfad entfernen
- [x] 1.3 Tests für getrennte Pools, fehlende Konfiguration und migrationsfreien Start ergänzen

## 2. Migration und Rechte

- [x] 2.1 Graphile-Worker-Migration in den privilegierten Studio-Migrations-One-shot verschieben
- [x] 2.2 Dedizierten Worker-Principal und minimale App-/Worker-Grants idempotent reconciliieren
- [x] 2.3 Postconditions für Schema, Rollen und Grants ergänzen
- [x] 2.4 Deployment- und Bootstrap-Tests für fehlende Secrets und zu breite App-Rechte ergänzen
- [x] 2.5 Sicheren Enqueue-Wrapper und einen echten PostgreSQL-Vertragstest für App und Worker ergänzen
- [x] 2.6 Graphile-PUBLIC-Rechte bereits im Migrations-One-shot fail-closed entziehen

## 3. Deployment und Dokumentation

- [x] 3.1 Dev-, Staging- und Production-Konfiguration um das Worker-Secret ergänzen
- [x] 3.2 Betroffene arc42-Abschnitte und den kanonischen Rollout-Vertrag aktualisieren
- [x] 3.3 OpenSpec-Dokumentation vervollständigen

## 4. Verifikation

- [x] 4.1 Betroffene Unit-, Typ- und Server-Runtime-Tests ausführen
- [x] 4.4 PostgreSQL-Vertragstest im kanonischen Integrations-Gate verdrahten
- [x] 4.5 Worker-Start und Laufzeitstatus fail-closed in Readiness und Fehlerlogging aufnehmen
- [x] 4.2 Deployment-, File-Placement- und Complexity-Gates ausführen
- [x] 4.3 Abschließendes Standards- und Spec-Review durchführen
