## Context
Das Waste-Management verwaltet bereits manuelle globale Date-Shifts und instanzbezogene Einstellungen. Es fehlt jedoch ein strukturierter Weg, Feiertage pro Bundesland automatisiert zu laden, dauerhaft als fachliche Regelentwürfe zu persistieren und getrennt von manuellen globalen Regeln zu pflegen.

## Goals
- Persistiertes Bundeslandkürzel pro Waste-Instanz
- Synchroner Feiertagsabgleich für aktuelles Jahr bis `aktuelles Jahr + 9`
- Persistierte Feiertags-Regelentwürfe mit Quell-, Konflikt- und Konfigurationsstatus
- Eigene Pflegeoberfläche im Scheduling-Bereich
- Manuelle globale Regeln bleiben unangetastet

## Non-Goals
- Keine sofortige automatische Ableitung wirksamer globaler Date-Shifts
- Kein Löschen importierter Feiertagsentwürfe bei später fehlender Quellbestätigung
- Keine asynchrone Job-Orchestrierung für den Feiertagssync in diesem Change

## Decisions
- Das Bundesland wird als kontrolliertes Kürzel in den Waste-Settings gespeichert.
- Der Feiertagssync läuft synchron beim Settings-Speichern und über eine separate manuelle Regenerationsaktion.
- Feiertage werden als eigener append-only Bestand für Regelentwürfe persistiert, nicht in bestehende manuelle globale Date-Shifts gemischt.
- Konflikte mit manuellen globalen Regeln werden markiert, aber nie automatisch überschrieben.

## Risks / Trade-offs
- Der Settings-Speicherpfad bekommt zusätzliche Verantwortung durch den externen Sync; deshalb muss der Sync-Status getrennt vom Settings-Speicherergebnis zurückgegeben werden.
- Die externe Feiertagsquelle kann jahresweise oder temporär ausfallen; `partial_success` muss deshalb ein expliziter fachlicher Status sein.
- Ein 10-Jahres-Bestand erzeugt mehr UI-Dichte; die Scheduling-Ansicht braucht deshalb Filter- oder Gruppierungslogik.

## Validation
- Failing Tests zuerst für Core-Verträge, Repository-Methoden, Settings-Sync und Scheduling-UI
- Danach gezielte Nx-Unit-Runs für `core`, `data-repositories`, `auth-runtime` und `plugin-waste-management`
- Abschließend `pnpm test:types`, `pnpm test:eslint` und erneute OpenSpec-Validierung
