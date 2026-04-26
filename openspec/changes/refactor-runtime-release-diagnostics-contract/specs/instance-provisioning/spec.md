## MODIFIED Requirements

### Requirement: Instanzdiagnostik korreliert Provisioning- und Runtime-Fehler

Die Instanzdiagnostik SHALL Runtime-IAM-Fehler, Provisioning-Drift, Reconcile-Befunde und Operator-Checks über gemeinsame Klassifikation, sichere Details und `requestId` korrelierbar machen.

#### Scenario: Provisioning- und Legacy-Fallbacks bleiben unterscheidbar

- **WHEN** ein Instanz- oder Tenant-Fehler aus Registry-/Provisioning-Drift entsteht
- **THEN** verwendet der Diagnosekern `registry_or_provisioning_drift`
- **AND** Legacy- oder Workaround-Pfade verwenden `legacy_workaround_or_regression`, damit Betrieb und UI die Ursache nicht vermischen
