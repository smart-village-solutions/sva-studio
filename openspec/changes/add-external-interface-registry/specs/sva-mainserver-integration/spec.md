## MODIFIED Requirements

### Requirement: Instanzgebundene Mainserver-Konfiguration

The system SHALL resolve instance-specific SVA-Mainserver endpoint configuration from the central external-interface registry.

#### Scenario: Mainserver configuration is loaded for an instance

- **WHEN** a server-side Mainserver operation resolves the active instance configuration
- **THEN** it reads the canonical `sva_mainserver` interface from the external-interface registry
- **AND** disabled or missing records remain fail-closed
