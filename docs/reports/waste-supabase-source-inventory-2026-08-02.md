# Quellinventar der Waste-Supabase vom 2. August 2026

## Zweck und Zugriff

Das Inventar dokumentiert die bestehende Supabase-Quelle vor dem PostgreSQL-Cutover. Die Erhebung erfolgte ausschließlich lesend über den projektspezifischen Supabase-MCP-Zugang und eine PostgreSQL-Verbindung. Es wurden keine fachlichen Inhalte, Schlüssel, Passwörter oder personenbezogenen Daten in diesen Bericht übernommen.

## Technischer Stand

- Supabase-Projekt: `velejbcoqfvfaptjcsup`
- Quelldatenbank: PostgreSQL 17.6
- Fachschema: `public`
- Fachtabellen: 13 Tabellen mit Präfix `waste_`
- Zeilen insgesamt: 7.494
- Indizes auf den inventarisierten Waste-Tabellen: 49
- Sequenzen im Schema: 0

## Zeilenzahlen

| Tabelle                            | Zeilen |
| ---------------------------------- | -----: |
| `waste_regions`                    |     14 |
| `waste_cities`                     |    596 |
| `waste_streets`                    |  1.438 |
| `waste_house_numbers`              |  1.438 |
| `waste_collection_locations`       |    718 |
| `waste_fractions`                  |      7 |
| `waste_tours`                      |     65 |
| `waste_location_tour_links`        |  2.938 |
| `waste_tour_date_shifts`           |      0 |
| `waste_global_date_shifts`         |      0 |
| `waste_location_tour_pickup_dates` |    160 |
| `waste_custom_recurrence_presets`  |      0 |
| `waste_holiday_rules`              |    120 |

## Migrationsrelevante Abweichungen

- Die Quelle läuft auf PostgreSQL 17.6, die bestehenden Studio-Swarm-Instanzen auf PostgreSQL 16. Ein vollständiger Schema-Downgrade ist nicht Teil des Cutovers. Das Ziel wird aus den versionierten Waste-Migrationen aufgebaut; anschließend werden ausschließlich die explizit inventarisierten Fachdaten importiert.
- Das aktuelle Zielschema enthält zusätzlich `waste_tour_assignments`, `waste_tour_assignment_locations`, `waste_email_reminder_subscriptions`, `waste_email_reminder_subscription_items`, `waste_email_reminder_outbox` und `waste_settings`. Diese migrationsbedingt zusätzlichen Zieltabellen dürfen beim Vergleich vorhanden sein; alle 13 Quelltabellen müssen jedoch exakt dieselben Zeilenzahlen besitzen.
- Alle 13 inventarisierten Supabase-Tabellen haben Row Level Security deaktiviert. Dadurch können sie abhängig von den bestehenden Grants über Supabase-Clientrollen erreichbar sein. RLS wird vor dem Offline-Cutover nicht spontan aktiviert, weil fehlende Policies die laufende Anwendung sperren könnten. Das Risiko endet mit der Laufzeitumschaltung und der anschließenden schreibgeschützten Aufbewahrung der Quelle.
- Die Fachdaten verwenden ausschließlich UUID, Text, Integer, Boolean, Date, `timestamptz`, JSONB und Text-Arrays. Für diese Daten wurde der getrennte Import in ein PostgreSQL-16-Zielschema erfolgreich lokal erprobt.

## Erzeugte Quellartefakte

Die geschützten Artefakte liegen außerhalb des Git-Repositories unter `~/.config/sva-waste-migration/backups/2026-08-02-source-pg17-host/`. Das Custom-Archiv enthält ausschließlich `public.waste_*`; das Data-only-Artefakt enthält 7.494 explizite, spaltengebundene Datensätze. Prüfsummen werden getrennt neben den Artefakten aufbewahrt.
