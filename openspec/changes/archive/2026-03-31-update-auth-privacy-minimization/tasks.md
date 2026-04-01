## 1. Implementierung

- [x] 1.1 SessionUser auf minimalen Auth-Kern reduzieren und Frontend/Tests daran anpassen.
- [x] 1.2 Logout-Logging auf sicheren Redirect-Summary umstellen und tokenhaltige URLs aus operativen Logs fernhalten.
- [x] 1.3 Logger- und OTEL-Redaction gegen JWTs, sensitive Query-Parameter und tokenartige Freitextwerte absichern.
- [x] 1.4 Profilanzeige und Profilpflege auf explizite Profil-API statt Session-PII ausrichten.
- [x] 1.5 Betroffene Unit-Tests und Typechecks aktualisieren.

## 2. Spezifikation und Governance

- [x] 2.1 OpenSpec-Deltas fuer `iam-core`, `iam-auditing` und `monitoring-client` ergaenzen.
- [x] 2.2 Development Rules und aktive Doku auf Datenminimierung, Token-Logging-Verbot und getrennten Profil-Sync synchronisieren.
