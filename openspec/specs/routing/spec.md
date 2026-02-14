# Capability: routing

## Purpose
Definiert die Anforderungen an das typsichere, code-basierte Routing mit kombinierbarer Route-Registry für Core und Plugins.

## Requirements
### Requirement: Code-Route-Registry
Das System SHALL eine programmatische Route-Registry bereitstellen, die Routen aus Core und Plugins kombiniert.

#### Scenario: Core und Plugin Routen kombiniert
- **WHEN** die App startet
- **THEN** sind Core- und Plugin-Routen gemeinsam im Router registriert

### Requirement: Plugin-Route-Exports
Plugins SHALL eigene Routen als Exporte bereitstellen können, die von der Route-Registry aufgenommen werden.

#### Scenario: Plugin liefert Route-Definition
- **WHEN** ein Plugin eine Route exportiert
- **THEN** kann die App diese Route registrieren
