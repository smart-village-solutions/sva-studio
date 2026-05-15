## MODIFIED Requirements

### Requirement: Routing konsumiert den Build-time-Registry-Snapshot des Hosts

Das Routing-System SHALL Plugin-Routen und registrierte Admin-Ressourcen aus einem kanonischen Plugin-Snapshot des Hosts beziehen statt aus app-lokalen Plugin-Listen, manuellen Merge-Pfaden oder ungeprüften Package-Imports.

Der Snapshot darf build-time, dev-time oder install-time erzeugt werden, muss aber immer denselben validierten Host-Vertrag repräsentieren.

#### Scenario: Host uebergibt normalisierte Plugin-Beitraege an das Routing

- **WHEN** die Frontend-App ihren Router erzeugt
- **THEN** uebergibt sie dem Routing die normalisierten Plugin- und Admin-Ressourcen-Beitraege aus einem gemeinsamen, validierten Plugin-Snapshot
- **AND** das Routing muss diese Beitraege nicht erneut aus mehreren hostseitigen Hilfsregistries oder app-lokalen Plugin-Arrays zusammensuchen

#### Scenario: Routing nutzt denselben Snapshot fuer lokale und installierte Plugins

- **GIVEN** ein Plugin stammt aus dem lokalen Development-Load
- **AND** ein anderes Plugin stammt aus einer installierten Distribution
- **WHEN** das Routing den Route-Baum materialisiert
- **THEN** behandelt es beide Plugins ausschließlich über denselben Snapshot-Vertrag
- **AND** die Quellform des Plugins ist für das Routing irrelevant

### Requirement: Host-Enforced Plugin Route Materialization

The system SHALL materialize plugin-provided routes only through the host routing registry and SHALL reject package-provided runtime route handlers that bypass host-owned guards, path conventions, search-parameter validation, or snapshot publication.

Plugin-provided UI components SHALL remain allowed when they are bound to a host-materialized route and do not define independent route handlers, guard functions, or search-parameter parsing outside the registry contract.

#### Scenario: Plugin route is materialized by host
- **GIVEN** a plugin declares an admin route contribution
- **WHEN** the host builds the route tree from the validated plugin snapshot
- **THEN** the route is created with the host-owned guard, canonical path, and search-parameter schema
- **AND** the plugin UI is rendered only inside the host-materialized route boundary

#### Scenario: Plugin attempts to bypass host routing
- **GIVEN** a plugin exposes a runtime route outside the registry or snapshot contract
- **WHEN** the host validates plugin contributions
- **THEN** the contribution is rejected before the route tree is built
- **AND** the diagnostics include `plugin_guardrail_route_bypass` with plugin namespace and contribution identifier
