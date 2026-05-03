## 1. Spezifikation

- [ ] 1.1 `media-management`-Deltas für async-first-Medienverarbeitung, sofortige Referenzierbarkeit und kontrollierte Delivery-Degradation ergänzen
- [ ] 1.2 die Abhängigkeit auf die generische Studio-Job-Fähigkeit aus `add-waste-management-plugin` explizit festhalten und media-spezifische Job-Sonderwege ausschließen
- [ ] 1.3 Job-, Asset- und Delivery-Status sauber gegeneinander abgrenzen, ohne die spätere Plattformimplementierung vorwegzunehmen
- [ ] 1.4 `openspec validate add-media-async-processing --strict` ausführen

## 2. Umsetzung

- [ ] 2.1 die generische Studio-Job-Fähigkeit als Voraussetzung bereitstellen oder auf den dann aktuellen Plattformvertrag aufsetzen
- [ ] 2.2 beim Upload-Abschluss Asset-Annahme, erste Referenzierbarkeit und Anlegen eines plattformkonformen Medienjobs implementieren
- [ ] 2.3 die nachgelagerte Variantenverarbeitung und technischen Prüfungen als Medienjob an die generische Job-Orchestrierung anbinden
- [ ] 2.4 Asset-, Job- und Delivery-Statusübergänge inklusive Original-/Placeholder-Fallback implementieren
- [ ] 2.5 Fehlerzustände so anbinden, dass spätere Wiederholung über neue plattformkonforme Jobs möglich bleibt

## 3. Qualität und Dokumentation

- [ ] 3.1 Integrations- und Vertragstests für Asset-Annahme, laufende Verarbeitung, fehlgeschlagene Verarbeitung und Delivery-Fallback ergänzen
- [ ] 3.2 Tests ergänzen, dass Medien keine parallele Job-Sonderlogik neben der generischen Studio-Job-Fähigkeit einführen
- [ ] 3.3 Architektur- und Betriebsdokumentation für die Andockstelle an die generische Studio-Job-Fähigkeit fortschreiben
