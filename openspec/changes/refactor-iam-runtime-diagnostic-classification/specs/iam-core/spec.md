## ADDED Requirements

### Requirement: IAM-Runtime-Diagnostik wertet konkurrierende Signale deterministisch aus

Der IAM-Diagnosekern MUST gleichzeitig vorliegende sichere Signale in einer stabilen First-match-Reihenfolge auswerten und für identische Eingaben dieselbe bestehende Klassifikation, denselben Status und dieselbe empfohlene Aktion liefern.

#### Scenario: Synchronisationsphasen behalten ihre Reihenfolge

- **WHEN** ein Pre-Sync-Grund gemeinsam mit Sync-Metadaten vorliegt
- **THEN** gewinnt die bestehende Pre-Sync-Klassifikation
- **AND** gewinnt ein Sync-Signal weiterhin vor einem Post-Sync-Grund

#### Scenario: Identitätsauflösung gewinnt vor Infrastrukturdiagnose

- **WHEN** ein Session- oder Actor-Signal gemeinsam mit einem Keycloak- oder Datenbanksignal vorliegt
- **THEN** gewinnt weiterhin die Session- beziehungsweise Actor-Klassifikation
- **AND** bleiben Status und empfohlene Aktion mit dem bisherigen Vertrag kompatibel

#### Scenario: Datenbanksignal gewinnt vor nachgelagertem Fallback

- **WHEN** ein Datenbanksignal gemeinsam mit einem Mapping-Grund oder Registry-Fallback vorliegt
- **THEN** gewinnt weiterhin die Datenbank- oder Schema-Klassifikation

#### Scenario: Sichere Eingaben bleiben begrenzt und kompatibel

- **WHEN** Diagnose-Details snake_case-, camelCase-, unbekannte, nicht-stringförmige oder sensitive Werte enthalten
- **THEN** normalisiert der Diagnosekern weiterhin nur die bekannten Sync-Felder
- **AND** gibt er ausschließlich die bestehende Safe-Details-Allowlist aus
