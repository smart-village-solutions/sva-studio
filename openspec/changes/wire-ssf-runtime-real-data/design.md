## Context

Die fachliche SSF-Konfiguration wird bereits aus der getrennten
Plugin-Datenbank gelesen. Nur die vorgelagerten Host-Gates verwenden noch
Platzhalter. Der Instanzdatensatz wird vor den Gates bereits kanonisch geladen.

## Decisions

### Ein Pool pro Serverprozess

`@sva/plugin-ssf/runtime` stellt einen lazy Resolver für den konfigurierten
Pool bereit. Sowohl Plugin-Handler als auch Host-Readiness verwenden denselben
Resolver. Ohne `SVA_STUDIO_SSF_DATABASE_URL` wird kein Pool erzeugt und der
Endpoint bleibt geschlossen.

### Zeitzone gehört zum generischen Instanzprofil

Die Zeitzone ist keine SSF-Einstellung. `iam.instances.time_zone` ist ein
nicht-leerer Pflichtwert mit `Europe/Berlin` als migrationssicherem Default.
Der Runtime-Pfad verwendet den bereits geladenen `InstanceRegistryRecord` und
führt keine zweite Registry-Abfrage aus. Die bestehende IANA-Validierung am
SSF-Readiness-Gate bleibt die Laufzeitgrenze.

### Readiness bleibt fail-closed

Ein Tenant gilt nur als datenbankbereit, wenn `ssf.tenants` einen gültigen
vorbereiteten Datensatz enthält. Die Autorisierungsrevision stammt weiterhin
ausschließlich aus der bestätigten Projektion. Datenbankfehler werden vom
bestehenden Host-Fehlerpfad als `503` behandelt.

## Non-Goals

- Kein IAM-Projektions-Trigger und keine automatische SSF-Tenant-Provisionierung
- Keine Branding-Media-Auflösung
- Keine Administrationsoberfläche für die Zeitzone
- Kein Deployment oder produktives Enablement
