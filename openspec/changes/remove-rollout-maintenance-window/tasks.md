## 1. Verträge und Workflow

- [x] 1.1 `maintenance_window` aus `Promote`-Inputs, Validierung, Environment-Übergabe und Evidenz entfernen.
- [x] 1.2 Wartungsfenster aus dem Backup-Agent-Request und Production-Submitter entfernen, ohne alte Ergebnisobjekte unlesbar zu machen.
- [x] 1.3 Migration, Bootstrap, Backup, Staging-Parität, Production-Freigabe und Postconditions unverändert fail-closed halten.

## 2. Tests

- [x] 2.1 Backup-Vertrag und Submitter ohne Wartungsfenster testen.
- [x] 2.2 Workflow-Vertrag für Staging- und Production-`run` ohne Wartungsfenster testen.
- [x] 2.3 Kleinste relevante Unit-, Type- und Workflow-Gates ausführen.

## 3. Dokumentation und Abschluss

- [x] 3.1 Kanonischen Rollout-Leitfaden und betroffene Betriebsdokumentation aktualisieren.
- [x] 3.2 Arc42-Abschnitte 06, 07, 08 und 10 auf den verbleibenden Sicherheitsvertrag aktualisieren; Abschnitt 11 prüfen und wegen seines Restore-Fokus unverändert lassen.
- [x] 3.3 OpenSpec strikt validieren, Tasks abhaken und PR mit grünen Checks eröffnen.
