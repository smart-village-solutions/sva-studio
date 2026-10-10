## Umsetzung des freigegebenen Entwurfs
- [x] 1. Instanzbezogene API-Adresse und Regionsbindung im bestehenden Pfad ergänzen und gezielt testen.
- [x] 2. Browser-Einstieg und isolierte Styles im bestehenden Build ergänzen.
- [x] 3. Öffentliche HTTP-Antworten für Cross-Origin-Nutzung ohne Credentials ergänzen und testen.
- [x] 4. Eingebettete Tastatur-, Fokus-, Export- und Axe-Prüfung durchführen.
- [x] 5. API-Dokumentation und arc42 05/08 aktualisieren; Unit-, Type-, Lint-, Build-, OpenSpec- und Dateiplatzierungsprüfungen ausführen.

## Lokale Evidenz am 10.10.2026

- `public-waste-calendar-web:test:unit`: 194 Tests grün, ein vorhandener Test übersprungen; nach finalen Ergänzungen 18 gezielte API-/Widget-/Seiten-Tests grün.
- `public-waste-calendar-web:test:e2e`: 4/4 grün; der bestehende Target baut nun vorher das App-Artefakt. Cross-Origin-Einbettung mit zwei Regionen, Host-CSS, Tastatur, Tab/Shift+Tab, nativer Modalität, Fokusrückgabe und tatsächlichem iCal-/PDF-Download geprüft; Axe ohne Verstöße.
- `public-waste-calendar-web:typecheck`, `public-waste-calendar-web:lint`, `public-waste-calendar-web:build` und Skript-Typecheck grün.
- OpenSpec strict und Dateiplatzierung grün.
- Arbeitsstand auf `feature/public-waste-embed`; kein Merge oder Deployment. Manuelle Screenreader-Abnahme bleibt gesondert erforderlich.
- Vor PR-Erstellung: Dokumentationsprüfung und Komplexitäts-Gate grün (keine neuen Findings); die beiden betroffenen Funktionen lokal vereinfacht und mit 15 gezielten Tests erneut geprüft.
