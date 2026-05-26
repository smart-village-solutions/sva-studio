## 1. Implementierung

- [ ] 1.1 OpenSpec-Deltas und WP-005-Abnahmerahmen für Transparenz- und Assignment-Verhalten formalisieren
- [ ] 1.2 Transparenzvertrag für Benutzer-Berechtigungsspuren in `@sva/core` und `iam-admin` erweitern
- [ ] 1.3 Diff-basierten Persistenzpfad für Benutzer-Rollen und Benutzer-Gruppen im `auth-runtime` implementieren
- [ ] 1.4 Benutzer- und Gruppendetail-UI für Herkunft, Vererbungsweg, Restriktionen und Gültigkeiten nachschärfen
- [ ] 1.5 Konflikt-, Vererbungs-, Geo- und Metadatenerhalt-Tests ergänzen oder anpassen
- [ ] 1.6 Relevante arc42-Abschnitte unter `docs/architecture/` und den operativen WP-005-Abnahmebericht aktualisieren

## 2. Verifikation

- [ ] 2.1 `openspec validate refactor-wp-005-iam-assignment-transparency --strict` erfolgreich ausführen
- [ ] 2.2 Betroffene Unit-Tests in `core`, `iam-admin`, `auth-runtime` und `sva-studio-react` grün ausführen
- [ ] 2.3 Betroffene Type-Checks und Server-Runtime-Gates grün ausführen
- [ ] 2.4 WP-005-Abnahmefälle für Mehrfachherkunft, Gruppenstatus, Gültigkeitsfenster und Geo-Restriktion dokumentiert nachweisen
