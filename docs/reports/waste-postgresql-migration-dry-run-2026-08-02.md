# Waste-PostgreSQL-Migration: lokaler Trockenlauf vom 2. August 2026

## Ergebnis

Der datenorientierte Transfer von der Supabase-Quelle PostgreSQL 17.6 in eine isolierte PostgreSQL-16.14-Datenbank wurde erfolgreich durchgeführt. Der Trockenlauf hat weder die Supabase-Quelle noch eine Swarm-Datenbank verändert.

## Geprüfter Ablauf

1. Read-only-Inventar der 13 `public.waste_*`-Quelltabellen erstellt.
2. Vollständiges PostgreSQL-17-Custom-Archiv ausschließlich dieser Tabellen erzeugt und mit `pg_restore --list` geprüft.
3. Separates Data-only-Artefakt mit expliziten Tabellen- und Spaltennamen erzeugt.
4. Die PostgreSQL-17-spezifische Session-Anweisung `transaction_timeout` ausschließlich aus der PostgreSQL-16-Migrationskopie entfernt; die Quellartefakte blieben unverändert.
5. Aktuelles Waste-Zielschema aus den versionierten Anwendungsstatements in einem isolierten `postgres:16-alpine`-Container aufgebaut.
6. 7.494 Datensätze importiert und die idempotenten Waste-Migrationen erneut angewandt.
7. Alle 13 Quelltabellen anhand ihrer exakten Zeilenzahlen verglichen.
8. Die Migration der 160 Legacy-Abholtermine in 160 aktuelle Tour-Assignments nachgewiesen.

## Verifikation

- Ergebnis des Tabellenvergleichs: `ok`
- Verglichene Quelltabellen: 13
- Importierte Datensätze: 7.494
- Legacy-Abholtermine: 160
- Erzeugte Tour-Assignments: 160
- Zusätzliche migrationsgeführte Zieltabellen: 6
- Container nach dem Test entfernt: ja

## Abgrenzung

Der Trockenlauf beweist die technische PG17→PG16-Kompatibilität des vereinbarten Datenpfads. Noch offen bleiben der kontrollierte Stopp und Session-Drain der produktiven Runtimes, die Bereitstellung der Zielzugänge im Swarm sowie der eigentliche Sonntags-Cutover.
