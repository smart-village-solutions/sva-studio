## 1. Implementierung
- [x] 1.1 Explizite `platform`-/`instance`-Scope-Typen in den Auth-/Session-Verträgen einführen
- [x] 1.2 Root-Host-Auth-Auflösung und Login-State-/Session-Pfade auf scope-aware Kontext umstellen
- [x] 1.3 Plattform-Audit-Tabelle, DB-Sink-Routing und Schema-Guard ergänzen
- [x] 1.4 Logging auf `scope_kind`, `workspace_id`, `reason_code` und redaktierte Fehlerfelder harmonisieren
- [x] 1.5 Betroffene Auth-/Audit-Tests und Typechecks aktualisieren

## 2. Dokumentation
- [x] 2.1 Neue ADR für Plattform-Scope vs. Tenant-Instanz ergänzen
- [x] 2.2 Relevante arc42-Abschnitte unter `docs/architecture/` aktualisieren
- [x] 2.3 OpenSpec-Deltas für `iam-core`, `iam-auditing` und `architecture-documentation` ergänzen
