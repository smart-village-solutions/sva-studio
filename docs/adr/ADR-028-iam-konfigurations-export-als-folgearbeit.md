# ADR-028: IAM-Konfigurations-Export als dokumentierte Folgearbeit

**Status:** Accepted
**Entscheidungsdatum:** 2026-03-31
**Entschieden durch:** SVA Studio Team

## Kontext

Der Sammel-Change `complete-iam-offer-packages-3-to-5` konsolidiert unter anderem die früheren Einzel-Changes zur Organisationshierarchie und zur Permission-Caching-Logik. Ein maschinenlesbarer Export der gesamten IAM-Konfiguration wäre fachlich wünschenswert, erweitert den Scope dieser Angebotsbausteine aber deutlich.

## Entscheidung

Ein vollständiger IAM-Konfigurations-Export für Gruppen, Rollen, strukturierte Permissions und Org-/Geo-Hierarchie wird nicht Teil dieses Changes. Er bleibt als explizite technische Schuld und Folgearbeit dokumentiert.

## Begründung

- Die aktuellen Pakete priorisieren Durchsetzung, Transparenz, Snapshot-Performance und Rechtstext-Enforcement.
- Ein belastbarer Export benötigt ein eigenes kanonisches Austauschformat, Migrationsregeln und Governance für externe Konsumenten.
- Die bereits archivierten Einzel-Changes bleiben dadurch fachlich konsolidiert, ohne den Abschluss des Bündel-Changes zu blockieren.

## Konsequenzen

### Positive Konsequenzen

- Der aktuelle Change bleibt abschließbar und fachlich fokussiert
- Exportformat und externe Migrationsfälle können separat mit klarer Owner-Zuordnung spezifiziert werden

### Negative Konsequenzen

- Externe Migration oder Konfigurationssicherung benötigt vorerst manuelle oder projektspezifische Wege
- Technische Schuld bleibt bewusst bestehen

### Mitigationen

- Folgechange für IAM-Konfigurations-Export einplanen
- Technische Schuld in arc42 Abschnitt 11 und in dieser ADR referenzieren

## Verwandte ADRs

- `ADR-022-iam-groups-geo-hierarchie-permission-caching.md`
- `ADR-024-iam-groups-als-eigenstaendige-entitaet.md`
- `ADR-026-redis-als-primary-permission-cache.md`
