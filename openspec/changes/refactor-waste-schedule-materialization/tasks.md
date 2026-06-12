## 1. Model
- [ ] 1.1 Neue Tabellen/Typen für explizite Terminregelung im instanzbasierten Waste-Schema definieren
- [ ] 1.2 Persistierte Materialisierungstabelle für konkrete Tourtermine pro `instance + year` ergänzen
- [ ] 1.3 Migration/Backward-Compat-Mapping von bisherigen Shift-/Holiday-Tabellen in das neue Regelmodell

## 2. Repositories und APIs
- [ ] 2.1 Datenzugriffe auf neue Regel- und Materialisierungstabellen kapseln
- [ ] 2.2 Bestehende Reihen-/Ausnahmenlogik auf neue Modelle umstellen
- [ ] 2.3 Fachmodell im Repo strikt typisieren und Validatoren für Trigger/Wirksamkeit ergänzen

## 3. Materialisierung
- [ ] 3.1 Materialisierungsservice implementieren (Regel -> konkrete Termine)
- [ ] 3.2 Berechnung auf Jahrfenster {aktuelles Jahr, Folgejahr} begrenzen
- [ ] 3.3 Unterstützte Semantik implementieren:
  - holiday trigger
  - advance / postpone
  - coverage `single_pickup` und `rest_of_week`
- [ ] 3.4 Idempotente Ersetzung/Update der materialisierten Termine für das Fenster implementieren

## 4. Hauptjob-Sync
- [ ] 4.1 Mainserver-Sync so umbauen, dass er vor dem Transport den Materialisierungsjob ausführt
- [ ] 4.2 Transport ausschließlich gegen materialisierte Termine
- [ ] 4.3 Bestehende Fehlerszenarien (GraphQL-Validierung, Tokenzugang) unverändert behandeln
- [ ] 4.4 Ergebnissummierung (`studioItemCount`, `mainserverItemCount`, `createCount`, `deleteCount`) auf die Materialisierungsausgabe beziehen

## 5. Monitoring und Bedienung
- [ ] 5.1 Job-Result-Details um Materialisierungskennzahlen ergänzen
- [ ] 5.2 Fehlertexte für unmappbare/konfliktbehaftete Regeln klarer ausgeben
- [ ] 5.3 Admin-Hinweis bei ungefüllter Materialisierungstabelle ohne Eingriffe im UI ergänzen

## 6. Tests
- [ ] 6.1 Unit-Tests für Regelmodell und Materialisierung (single pickup, rest of week)
- [ ] 6.2 Integrationstest: Sync nutzt nur materialisierte Datensätze
- [ ] 6.3 Regressionstest: Feiertagsszenarien aus den letzten Beispielen (Do/Di) in deterministische Ergebnisse

## 7. Doku
- [ ] 7.1 Change im OpenSpec vollständig mit `openspec validate` prüfen
- [ ] 7.2 Relevante architekturbezogene Stellen in `docs/architecture/` aktualisieren
- [ ] 7.3 Migrations-/SQL-Doku im `docs/development/` aktualisieren
