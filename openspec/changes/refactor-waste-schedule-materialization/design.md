## Kontext
Das Studio verwaltet Waste-Termine bislang regelorientiert im Frontend-Datensatzmodell.
Mainserver-Sync konsumiert aber bereits persistierte Einzeltermine. Bei bestehendem Modell bleiben `pickup_dates` oft leer, obwohl Regelketten vorhanden sind.

## Ziele und Nicht-Ziele
- Ziele
  - Eindeutige fachliche Modellierung von Feiertags- und Abweichungsregeln
  - Deterministische Materialisierung der tatsächlich zu übertragenden Termine
  - Transparenter und kontrollierter Sync-Strom (`rules -> materialized_dates -> mainserver sync`)
- Nicht-Ziele
  - Erweiterung auf unbegrenzte Folgejahre
  - Neuimplementierung der Regelbearbeitung in der UI (bestehende Formlogik bleibt adaptiert)

## Entscheidungen
- Entscheidung: Neues explizites Regelmodell mit Scope und Wirkung
  - `scope`: `global` oder `tour`
  - `trigger_kind`: mindestens `holiday` (weiterer Trigger später erweiterbar)
  - `trigger_weekday` oder externer Trigger-Tag (z. B. Feiertagsdatum)
  - `direction`: `advance` oder `postpone`
  - `coverage`: `single_pickup` oder `rest_of_week`
- Entscheidung: Zwei-Phasen-Synchronisation
  - Phase 1: Materialisierungsjob innerhalb der Synchronisationskette
  - Phase 2: Mainserver-Sync aus den materialisierten Einzelterminen
- Entscheidung: Fensterhärtung auf aktuelles Jahr + Folgejahr
  - Für unbeschränkte Wiederkehrreihen werden nur diese Jahre neu berechnet.

## Risiken und Gegenmaßnahmen
- Risiko: Regelkonflikte (mehrere Regeln pro Termin) können zu undefinierten Ergebnissen führen
  - Gegenmaßnahme: Deterministische Reihenfolge nach Gültigkeit, Priorität, Änderungszeit; harte Fehler im Widerspruchsfall.
- Risiko: Bestehende Daten sind semantisch nicht direkt migrierbar
  - Gegenmaßnahme: Read-only Analyse/Validierung vor Migration, Downtimefreie Migrationsfenster mit Protokoll.
- Risiko: Materialisierung und Sync kosten zusätzliche Laufzeit
  - Gegenmaßnahme: nur zweijähriges Fenster, batchweises Upsert mit idempotenten Schlüsseln.

## Migrations-Plan
- Migration V1: Neue Regel- und materialisierte Tabellen
- Migration V2: Mapping von Altfeldern und alten Verschiebungszeilen auf neues Modell
- Migration V3: Backfill der materialisierten Tabelle für laufendes und Folgejahr
- Migration V4: Umschaltung der Sync-Pipeline auf materialisierte Termine

## Offene Fragen
- Welche fachliche Priorität gilt bei konkurrierenden Regeln (z. B. Tour- und Globalregel am selben Tag)?
- Soll pro Regel eine explizite Versionskennzeichnung für Audit und Reverts benötigt werden?
