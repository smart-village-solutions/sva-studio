## ADDED Requirements
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

## MODIFIED Requirements
### Requirement: App-Stack Definition
Das System SHALL eine Web-App unter apps/studio mit React und TanStack Start bereitstellen und ein Code-basiertes Routing nutzen.

#### Scenario: Start-App vorhanden
- **WHEN** das Workspace-Setup abgeschlossen ist
- **THEN** existiert apps/studio als TanStack-Start-App mit Code-Route-Registry
