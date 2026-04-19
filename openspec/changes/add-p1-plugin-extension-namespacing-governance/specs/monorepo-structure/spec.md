## ADDED Requirements

### Requirement: Plugin-Identität steuert alle abgeleiteten Registrierungsnamen

Das System SHALL eine kanonische Plugin-Identität verwenden, aus der alle pluginbezogenen Registrierungsnamen abgeleitet werden.

#### Scenario: Plugin-ID bildet Basis für weitere Namen

- **WHEN** ein Plugin Content-Typen, Admin-Ressourcen oder weitere Host-Beiträge registriert
- **THEN** leiten sich deren technische Bezeichner aus der kanonischen Plugin-ID ab
- **AND** frei erfundene, nicht zuordenbare Registrierungsnamen gelten nicht als normkonform

#### Scenario: Hosteigene Präfixe bleiben reserviert

- **WHEN** ein Plugin einen reservierten oder hosteigenen Namensraum verwenden möchte
- **THEN** verweigert der Governance-Vertrag diese Zuordnung
- **AND** die Namenshoheit verbleibt beim Host
