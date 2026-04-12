## ADDED Requirements

### Requirement: Root-Scripts bilden den Studio-Releasepfad ab

Das System SHALL fuer `studio` einen Root-Skript-Einstieg bereitstellen, der den lokalen Operator-Schritt fuer produktionsnahe Mutationen kapselt.

#### Scenario: Lokaler Studio-Release ist als Root-Skript verfuegbar

- **WHEN** ein Operator den finalen `studio`-Deploy aus dem Repository heraus starten will
- **THEN** existiert ein dediziertes Root-Skript fuer den lokalen Release-Einstieg
- **AND** dieses Skript verlangt explizit `image_digest`, `release_mode` und `rollback_hint`
- **AND** es fuehrt `env:precheck:studio`, `env:deploy:studio`, `env:smoke:studio` und `env:feedback:studio` in fester Reihenfolge aus
