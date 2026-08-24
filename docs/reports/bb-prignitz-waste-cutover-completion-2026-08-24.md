# Abschlussnachweis des Waste-PostgreSQL-Cutovers für `bb-prignitz`

## Ergebnis

Der produktive Waste-Datenbestand von `bb-prignitz` wurde am 9. August 2026 kontrolliert aus der bisherigen Supabase-PostgreSQL-Datenbank in die tenantgebundene Studio-PostgreSQL-Datenbank übernommen. Der geschützte Workflow, sein redigiertes Importartefakt, spätere Production-Promotes und aktuelle Read-only-Smokes belegen den erfolgreichen Zielbetrieb.

Dieser Bericht ersetzt die frühere No-Go-Bewertung im Readiness-Bericht nicht rückwirkend. Er dokumentiert, dass die dort genannten technischen Blocker anschließend behoben und der Cutover danach erfolgreich ausgeführt wurden.

## Produktiver Cutover

- GitHub-Actions-Run: [`31315095719`](https://github.com/smart-village-solutions/sva-studio/actions/runs/31315095719)
- Wartungsfenster: `2026-08-09-bb-prignitz-cutover`
- Ergebnis: `success`
- Quellartefakt: prüfsummengebundenes, tenantbezogenes Data-only-Artefakt
- Redigierte Evidenz: Artefakt `waste-bb-prignitz-import-31315095719-1`, Artefakt-ID `9038525981`
- Zieldatenbank: `sva_w_bb_prignitz_4fc528d5be47_db`

Der Workflow stoppte zuerst den Public-Waste-Stack und bestätigte den Stillstand. Der Import-Agent sperrte anschließend neue Verbindungen der Studio-/Worker-Runtime zur Zieldatenbank und wartete, bis bestehende Anwendungssitzungen beendet waren. Erst nach erfolgreichem Import, Bestandsvergleich, Rechteprobe und Public-Smoke wurde der Public-Waste-Stack mit PostgreSQL wieder gestartet.

## Redigierte Import- und Datenbankevidenz

Das weiterhin verfügbare GitHub-Artefakt enthält keine Zugangsdaten und weist folgende erfolgreiche Schritte aus:

| Prüfung | Ergebnis |
| --- | --- |
| Quellobjekt und SHA-256 | erfolgreich geprüft |
| Runtime-Verbindungssperre | gesetzt |
| Anwendungssitzungen | vollständig geleert |
| Zielbestand vor Import | leer |
| Sicherheitsbackup vor Mutation | erstellt, erneut geladen und per SHA-256 geprüft |
| Datenimport | erfolgreich |
| Quellinventar | 7.494 Zeilen vollständig übernommen |
| Legacy-Zuordnungs-Backfill | 160 Tourzuordnungen und 160 Ortszuordnungen |
| Studio-Runtime-Rolle | abgeglichen und erfolgreich geprüft |
| Public-Runtime-Rolle | Schema lesbar, Tabellen lesbar und Reminder-Schreibrecht geprüft |

Das Ziel war bereits durch die tenantgebundene Provisionierung mit Schema, Constraints, Sequenzen und getrennten Runtime-Rollen aufgebaut. Der Import war ein Data-only-Import in dieses vorab migrierte, leer geprüfte Schema. Die agentseitige Inventarprüfung akzeptierte den Import nur bei vollständiger Übereinstimmung mit dem geprüften Quellinventar. Nachfolgende Production-Promotes führten die Waste-Migrations- und Backup-Gates erfolgreich aus.

## Ausweichtermin-Migration

Die kontextuelle Ausweichtermin-Funktion wurde mit PR #1039 eingeführt. Der erste erfolgreiche Production-Promote, der den zugehörigen Commit enthielt, war Run [`31974456870`](https://github.com/smart-village-solutions/sva-studio/actions/runs/31974456870) vom 16. August 2026.

Die Migration `20260816_02_tour_date_shift_date_contract` prüft vor jeder Änderung fail-closed, ob `public.waste_tour_date_shifts` Datensätze enthält. Bei einem einzigen vorhandenen Datensatz bricht sie mit `waste_migration_tour_date_shift_data_present` ab. Der Production-Migrationsjob war erfolgreich und verifizierte anschließend beide `DATE`-Spalten sowie die beiden partiellen Unique-Indizes. Damit ist der vor dem Rollout geforderte leere Bestand produktiv nachgewiesen.

## Aktueller Zielbetrieb

Am 24. August 2026 wurden ausschließlich lesende Prüfungen ausgeführt:

- Quantum-Endpoint `sva`, Stack `studio`: PostgreSQL, App, Provisionierer und Redis laufen mit der vorgesehenen Replikazahl.
- Quantum-Endpoint `sva`, Stack `web-waste-calendar`: App läuft mit einer Replik.
- `https://bb-prignitz.studio.smart-village.app/health/live`: HTTP 200, Status `alive`.
- `https://prignitz.abfallkalender.pro/health/live`: HTTP 200, Status `ok`, Instanz `bb-prignitz`.
- `https://prignitz.abfallkalender.pro/api/public-waste/selection`: HTTP 200 mit 13 auswählbaren Regionen.

## Rückfallfenster und Supabase-Stilllegung

Die Zielschreibzugriffe wurden nach dem erfolgreichen Cutover am 9. August 2026 freigegeben. Das vereinbarte 14-tägige Rückfallfenster endete am 23. August 2026 ohne Rückwechsel auf die alte Quelle. Studio und Public Waste verwenden weiterhin die tenantgebundene PostgreSQL-Datenbank.

Bei der Abschlussprüfung am 24. August 2026 war die frühere Supabase-Projektidentität nicht mehr vorhanden (`tenant/user ... not found`). Damit ist die Stilllegung nach Ablauf des Rückfallfensters bestätigt. Die lokale Servicekonfiguration enthält nur noch einen nicht mehr nutzbaren historischen Verweis. Ein späterer Rückwechsel wäre wegen der seit dem Cutover entstandenen Zieldaten ausdrücklich eine neue, separat freizugebende Datenmigration.

GitHub Actions und die aktuelle Runtime belegen den Zeitraum ohne Rückwechsel; ein separates historisches Supabase-Auditprotokoll über mögliche manuelle Zugriffe während der 14 Tage liegt im Repository nicht vor. Diese verbleibende Evidenzgrenze ändert nicht den bestätigten Zielbetrieb und wird hier ausdrücklich festgehalten.

## Zugeordnete OpenSpec-Aufgaben

- `add-contextual-waste-tour-shift-creation`: 5.4
- `add-waste-tenant-database-provisioning`: 6.3 und 6.4
- `migrate-waste-from-supabase-to-postgresql`: 3.3, 4.4 und 4.5
