## Umsetzung

- [x] 1. Vorhandenen Mainserver-Speicherpfad, HTTP-Dispatcher, persönliche Auth und MCP-Allowlist prüfen.
- [x] 2. Bestehenden Interface-Pfad um tenantgebundenes GET/POST für Mainserver-Konfiguration ergänzen.
- [x] 3. Grenzfälle und bestehende Browser-/MCP-Verträge gezielt testen; Types, Lint und Runtime nachweisen.
- [x] 4. Runbook und arc42 aktualisieren; OpenSpec und Dokumentations-Gates prüfen.
- [ ] 5. PR erstellen und finale GitHub-Gates sowie Reviews für den exakten HEAD abwarten.

## Lokale Evidenz

55 Interface-/MCP-Tests, 19 bestehende persönliche Auth-/Middleware-Tests und 7 URL-/SSRF-Tests grün. App- und MCP-Typechecks, MCP-Runtime, MCP-Lint, Lint der neuen Settings-/Context-Logik, OpenSpec strict, Dateiablage und Dokumentationsprüfung grün. Der breitere Interface-App-Lint meldet drei bereits auf dem unveränderten Basiscommit `52c3afe0a` reproduzierte Import-/Boundary-Fehler; diese bleiben außerhalb dieses Zuschnitts und sind keine neue Regression. Finale CI und Merge-Freigabe sind offen.
