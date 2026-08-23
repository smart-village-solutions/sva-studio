## Kontext

Waste-Fachdaten liegen in einer eigenen PostgreSQL-Datenbank pro Studio-Instanz. Aktuell enthält genau ein Tenant produktive Waste-Daten; weitere registrierte Datenbanken sind noch ungenutzt. Neue Tenant-Datenbanken werden bereits aus dem aktuellen kanonischen Schema provisioniert. Für bestehende Datenbanken fehlt jedoch ein geschützter, versionierter Roll-forward-Pfad.

Der ursprüngliche Ansatz von PR #984 erzeugte aus dem Provisionierungs-Builder ein Schema-Manifest und spielte dessen gesamte Statement-Liste bei jedem mutierenden Promote erneut ab. Dadurch wären auch bereits vorhandene destruktive oder semantisch einmalige Statements Teil jedes Rollouts geworden.

## Ziele und Nicht-Ziele

- Ziele:
  - ausstehende Waste-Schemaänderungen pro Tenant nachvollziehbar und genau einmal anwenden;
  - jeden Tenant bei einem Fehler auf seinen Ausgangszustand zurückrollen;
  - die konkrete `postal_code`-Drift additiv beheben;
  - Registry-, Principal-, Backup- und Promote-Grenzen beibehalten.
- Nicht-Ziele:
  - den vollständigen Zustand beliebig gedrifteter Datenbanken automatisch zu reparieren;
  - historische Spalten oder Daten im selben Change zu löschen;
  - einen zweiten Rolloutpfad neben GitHub Actions `Promote` einzuführen;
  - Datenbanken tenantübergreifend atomar zu verändern.

## Entscheidungen

### Unveränderliche Migrationsliste statt Schema-Replay

Das Release-Image enthält eine geordnete Liste aus stabiler Migrations-ID und expliziten SQL-Statements. Der One-shot liest nicht den Schema-Builder für Neuprovisionierungen ein. Die erste Migration `20260816_01_add_waste_city_postal_code` führt ausschließlich `ALTER TABLE public.waste_cities ADD COLUMN IF NOT EXISTS postal_code TEXT` aus.

### Tenant-lokaler Migrationsstand

Jede Waste-Datenbank führt die technische Tabelle `public.sva_waste_schema_migrations` mit eindeutiger Migrations-ID und Anwendungszeitpunkt. Technische Waste-Migrationsdaten bleiben damit an derselben Datenbankgrenze wie das zugehörige Fachdaten-Schema. Neue Datenbanken dürfen die additive Migration als No-op ausführen und protokollieren.

### Transaktion pro Tenant

Der Migrator beginnt vor der Ledger-Prüfung eine Transaktion, setzt Lock-, Statement- und Owner-Rolle transaktionslokal, legt das Ledger idempotent an, wendet nur ausstehende Migrationen an und protokolliert sie. Erst nach erfolgreicher Verifikation wird committed. Jeder Fehler führt zu `ROLLBACK`; danach endet der One-shot rot und blockiert den App-Deploy.

Eine Transaktion über mehrere Datenbanken ist mit PostgreSQL nicht verfügbar. Deshalb können bereits erfolgreich migrierte Tenants committed sein, wenn ein späterer Tenant fehlschlägt. Die Migrationen sind wiederanlauffähig und pro Tenant genau einmal protokolliert.

### Bewahrte Schutzgrenzen

Der zentrale Migrationsprincipal liest weiterhin nur das Registry-Inventar der Zustände `ready` und `disabled`. Der erwartete Datenbankname wird aus der kanonischen Instanz-ID abgeleitet und muss exakt dem Registry-Eintrag entsprechen. In der Tenant-Datenbank arbeitet der One-shot nach `SET LOCAL ROLE` als abgeleiteter Owner. Fehlende Tabellen, ungültige Namen, fehlende Secrets oder SQL-Fehler bleiben fail-closed.

## Risiken und Gegenmaßnahmen

- DDL kann konkurrierende Zugriffe blockieren: ein kurzes `lock_timeout` beendet den Lauf kontrolliert.
- Ein späterer Tenant kann nach bereits erfolgreichen Tenants fehlschlagen: Migrationen sind idempotent und im Ledger eindeutig protokolliert; der geschützte Rollout bleibt vor dem App-Deploy stehen.
- Eine falsche künftige Migration könnte weiterhin Daten verändern: destruktive Schritte benötigen einen eigenen Change, Preflight und explizite Abnahme; der generische Runner leitet keine SQL-Statements aus dem Sollschema ab.

## Migrationsplan

1. Ziel-Digest bauen und den mutierenden Staging-Pfad mit Waste-Backup ausführen.
2. In Staging Ledger-Eintrag, vorhandene `postal_code`-Spalte und unveränderte Fachdaten verifizieren.
3. Denselben Digest nach erfolgreicher Staging-Evidenz und verifiziertem Production-Backup promoten.
4. Einen Restore nur über den geschützten Backup-Agent-Vertrag ausführen; kein direkter Datenbankeingriff ist Teil des Standardpfads.
