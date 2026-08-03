## Context

Der Abfallkalender filtert nach Fraktionen, während konkrete Einsätze organisatorisch Touren zugeordnet sind. Ein Ereignis kann mehrere Abholorte haben und für einen übergeordneten Ort gelten.

## Decisions

- Einsätze werden als `waste_tour_assignments` mit `tour_id`, `pickup_date` und optionalem `note` gespeichert.
- `waste_tour_assignment_locations` verbindet einen Einsatz mit mindestens einem Abholort.
- Mehrere Einsätze derselben Tour am selben Tag sind zulässig; nur eine doppelte Ortszuordnung innerhalb desselben Einsatzes wird verhindert.
- Öffentliche Abfragen matchen den konkreten Abholort und seine Vorfahren; allgemeine Tour-Ort-Links sind keine Voraussetzung für explizite Einsätze.
- Ein expliziter Einsatz ersetzt einen sonst identischen berechneten Wiederholungstermin. Mehrere explizite Einsätze bleiben getrennt.
- Die Fraktionen eines Einsatzes stammen ausschließlich aus der bestehenden Tour–Fraktion-Beziehung.

## Migration

Jeder bisherige `waste_location_tour_pickup_dates`-Datensatz wird idempotent in einen Einsatz mit genau einem Ort überführt. Die alten Leser bleiben bis zum erfolgreichen Wechsel kompatibel.

## Risks

- Die Umstellung berührt mehrere Datenpfade. Charakterisierungs- und Migrationsprüfungen müssen vor dem Umschalten der Leser grün sein.
- Ein fehlerhafter Hierarchieabgleich kann Einsätze zu breit ausspielen. Tests decken konkrete, Straßen- und Orts-Ebene ab.
