## ADDED Requirements

### Requirement: Produktives Host-Routing ist unabhaengig vom Beispiel-Plugin

Das Routing-System SHALL produktive Plugin-Routen ohne Abhaengigkeit von einem Workspace-Beispiel-Plugin zusammenfuehren.

#### Scenario: Host baut produktiven Plugin-Route-Baum ohne Beispiel-Plugin

- **WHEN** die Host-App ihren produktiven Plugin-Route-Baum erzeugt
- **THEN** benoetigt sie kein `@sva/plugin-example`, um Routing oder Plugin-Merge erfolgreich aufzubauen
- **AND** verbleibende Plugin-Referenzen im Host beziehen sich nur auf tatsaechlich unterstuetzte Plugins
