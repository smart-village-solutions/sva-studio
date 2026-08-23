## ADDED Requirements

### Requirement: Deterministische phasenweise Plugin-Registry-Validierung

Das System MUST Plugin-Access-Anforderungen und Plugin-Actions vor Veröffentlichung eines Registry-Snapshots fail-closed, phasenweise und mit stabilen Fehlercodes sowie stabiler Fehlerpriorität validieren. Eine interne Modularisierung MUST die bestehende öffentliche Plugin-API und die beobachtbare Validierungssemantik erhalten.

#### Scenario: Verknüpfte Access-Anforderungen sind mengengleich

- **WHEN** Action und Route dieselben Tenant-Actions in unterschiedlicher Reihenfolge oder mit Duplikaten deklarieren
- **THEN** behandelt der Registry-Validator die Action-Werte als dieselbe Menge
- **AND** Action-Modus, Modul, Ressourcen-Kontext und alle Capability-Felder bleiben Teil des exakten Vergleichs

#### Scenario: Capability-Feld weicht ab

- **WHEN** sich verknüpfte Access-Anforderungen in `action`, `allowed`, `instanceId`, `organizationId`, `resourceType` oder `resourceId` unterscheiden
- **THEN** wird der Registry-Snapshot mit dem bestehenden Access-Mismatch-Fehler abgewiesen

#### Scenario: Mehrere Action-Fehler liegen gleichzeitig vor

- **WHEN** ein Action-Beitrag gleichzeitig mehrere ungültige Eigenschaften besitzt
- **THEN** meldet die Registry weiterhin den nach der bestehenden Prüfungsreihenfolge priorisierten Fehlercode
- **AND** es wird keine teilweise Registry veröffentlicht

#### Scenario: Öffentliche Registry-Fassade bleibt stabil

- **WHEN** der Host `createPluginActionRegistry` oder `createPluginRegistry` verwendet
- **THEN** bleiben Signaturen, Registry-Einträge, Legacy-Alias-Auflösung und Fehlercodes unverändert
