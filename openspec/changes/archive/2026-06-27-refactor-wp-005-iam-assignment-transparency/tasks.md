> Standabgleich mit dem aktuellen Codestand: `inactiveReason`, `inheritedFromOrganizationId` und `runtimeScope` sind in den relevanten Backend- und UI-Pfaden vorhanden. Der User-Update-Pfad arbeitet diff-basiert, der Permission-Store projiziert `organizationId` nicht mehr blanket, und `media.*` sowie `waste-management.*` hängen nicht mehr unnötig am aktiven Organisationskontext. Die repo-seitigen Implementierungs-, Dokumentations- und Nachweisschritte dieses Changes sind damit abgeschlossen; zusätzlicher Zielumgebungs-Showcase bleibt ein operativer Folgeschritt außerhalb dieses Repos.

## 1. Implementierung

- [x] 1.1 OpenSpec-Deltas und WP-005-Abnahmerahmen für Transparenz- und Assignment-Verhalten auf den aktuellen Restumfang einengen
- [x] 1.2 Transparenzvertrag für Benutzer-Berechtigungsspuren in `@sva/core` und `iam-admin` um die noch fehlende Scope-Semantik (`runtimeScope`, korrekte Instanz-vs-Org-Projektion) erweitern
- [x] 1.3 Diff-basierte Persistenzpfade für Benutzer-Rollen und Benutzer-Gruppen gegen alle relevanten Mutationspfade verifizieren und nur verbleibende Restlücken im `auth-runtime` schließen
- [x] 1.4 Benutzerdetail-UI für Herkunft, Vererbungsweg, Restriktionen, Gültigkeiten und die Unterscheidung instanzweit vs. organisationsbezogen nachschärfen
- [x] 1.5 Konflikt-, Vererbungs-, Geo- und Metadatenerhalt-Tests ergänzen oder anpassen
- [x] 1.6 Relevante arc42-Abschnitte unter `docs/architecture/` und den operativen WP-005-Abnahmebericht aktualisieren

## 2. Verifikation

- [x] 2.1 `openspec validate refactor-wp-005-iam-assignment-transparency --strict` erfolgreich ausführen
- [x] 2.2 Betroffene Unit-Tests in `core`, `iam-admin`, `auth-runtime` und `sva-studio-react` grün ausführen
- [x] 2.3 Betroffene Type-Checks und Server-Runtime-Gates grün ausführen
- [x] 2.4 WP-005-Abnahmefälle für Mehrfachherkunft, Gruppenstatus, Gültigkeitsfenster und Geo-Restriktion dokumentiert nachweisen
