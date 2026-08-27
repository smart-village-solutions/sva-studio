# ADR-054: Waste-Mainserver-Abgleichsstatus über Quellrevision

**Datum:** 27. August 2026
**Status:** ✅ Accepted
**Kontext:** Waste Management, Mainserver-Synchronisierung, Bedienbarkeit

## Entscheidung

Der Status des manuellen Waste-Mainserver-Abgleichs wird ohne Dry-Run aus zwei bereits verantworteten Zuständen abgeleitet:

- Eine monotone `BIGINT`-Quellrevision in jeder externen Waste-Tenant-Datenbank wird durch Statement-Trigger auf allen für die Terminmaterialisierung relevanten Fachtabellen erhöht.
- Der vorhandene zentrale Studio-Jobstore hält im Ergebnis eines erfolgreichen `waste-management.sync-mainserver`-Jobs die gelesene Quellrevision und das materialisierte Jahresfenster fest.

Revision und Fachbestand werden innerhalb desselben wiederholbaren Read-Snapshots gelesen. Nur die exakte Übereinstimmung von Revision und Jahresfenster gilt als `clean`. Fehlende oder ältere Jobresultate, eine rückläufige Revision und nicht erreichbare Datenquellen bleiben `unknown` beziehungsweise `pending`; daraus wird keine Mainserver-Parität behauptet.

## Begründung

Ein Dry-Run würde beim Seitenaufruf den externen Mainserver lesen und die vollständige Differenzberechnung ausführen. Ein Zeitstempel allein könnte gleichzeitige Änderungen und gleiche Zeitauflösungen nicht zuverlässig unterscheiden. Die monotone Revision ist dagegen günstig zu lesen, transaktionssicher und macht den fachlich benötigten Zustand sichtbar, ohne einen zweiten Abgleichspfad einzuführen.

## Konsequenzen

- Die Statusroute liest nur Waste-Tenant-Datenbank und zentralen Jobstore; sie kontaktiert den Mainserver nicht.
- Die exakten Create-/Delete-Zahlen entstehen weiterhin erst im echten Job nach dessen Mainserver-Snapshot.
- Relevante Fachänderungen während oder nach einem Lauf erhöhen die Revision und lassen einen weiteren Abgleich ausstehen.
- Die Triggerliste ist ein enger, getesteter Vertrag. PDF-, Reminder- und andere für die Terminmaterialisierung irrelevante Tabellen sind ausgeschlossen.
- Die UI ergänzt genau einen pluginlokalen Statusblock; der gemeinsame Studio-Header und die generische Job-Infrastruktur bleiben unverändert.

## Verworfene Alternativen

- **Nur Zeitstempel des letzten Abgleichs:** zu schwach für atomare, gleichzeitige und rückdatierte Änderungen.
- **Dry-Run beim Seitenaufruf:** unnötige Mainserver-Last und langsamer, fehleranfälliger Read-Pfad.
- **Eigene Outbox pro Fachtabelle:** genauer auf Einzelebene, aber für den binären Bedienstatus und den bestehenden Vollabgleich unverhältnismäßig komplex.

## Verweise

- `openspec/changes/add-waste-mainserver-sync-status/`
- [Bausteinsicht](../architecture/05-building-block-view.md)
- [Laufzeitsicht](../architecture/06-runtime-view.md)
- [Querschnittliche Konzepte](../architecture/08-cross-cutting-concepts.md)
