## 1. Implementierung

- [x] 1.1 OpenSpec-Deltas für kaskadierendes Rollenlöschen in `iam-core` und den Warnhinweis in `account-ui` ergänzen
- [x] 1.2 Backend-Persistenz so ändern, dass `DELETE /api/v1/iam/roles/:id` direkte Benutzer- und Gruppenzuordnungen vor dem Rollen-Delete entfernt
- [x] 1.3 Audit-, Invalidierungs- und Delete-Handler-Tests auf die neue Kaskaden-Semantik anpassen
- [x] 1.4 Rollen-UI-Dialogtext und zugehörige UI-Tests auf die neue Warnsemantik anpassen
- [x] 1.5 Relevante Dokumentation in `docs/guides/`, `docs/api/` und `docs/architecture/` aktualisieren
- [x] 1.6 Kleinsten relevanten Gate-Pfad ausführen und Ergebnisse prüfen
