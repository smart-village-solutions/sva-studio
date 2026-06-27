## 1. Implementierung

- [x] 1.1 UI-Vertrag fuer den Monitoring-Einstieg und den darin liegenden Benchmark-Bereich unter `/monitoring` definieren und i18n-Keys vorbereiten
- [x] 1.2 Geschuetzten Start-/Read-Endpoint im Server fuer sessiongebundene Benchmark-Laeufe ergaenzen
- [x] 1.3 Messlogik fuer `cache-hit`, `cache-miss` und `recompute` serverseitig auf den bestehenden Authorize-Pfad abbilden
- [x] 1.4 Ergebnisvertrag fuer GUI und Report-Output vereinheitlichen
- [x] 1.5 UI fuer Start, Laufstatus, Ergebnisanzeige und Fehlerzustaende implementieren
- [x] 1.6 Unit-/Type-/UI-Tests fuer neue UI- und Serverpfade ergaenzen
- [x] 1.7 Relevante arc42-Abschnitte unter `docs/architecture/` aktualisieren oder bewusst unveraendert dokumentieren

## 2. Verifikation

- [x] 2.1 Betroffene Unit-Tests gruen ausfuehren
- [x] 2.2 Betroffene Type-Checks gruen ausfuehren
- [x] 2.3 Dateiplatzierungs- und i18n-Gates gruen ausfuehren
- [x] 2.4 GUI-gestuetzten Benchmark im Monitoring mindestens einmal lokal oder gegen eine Testumgebung erfolgreich demonstrieren
