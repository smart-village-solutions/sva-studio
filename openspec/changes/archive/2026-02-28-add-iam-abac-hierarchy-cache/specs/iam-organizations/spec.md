# IAM Organizations Specification Delta (Hierarchy)

## ADDED Requirements

### Requirement: Instanzgebundene Hierarchieauswertung

Das System SHALL Hierarchie- und Vererbungsentscheidungen strikt innerhalb der aktiven `instanceId` auswerten.

#### Scenario: Hierarchiezugriff über Instanzgrenze

- **WHEN** eine Hierarchieauswertung Daten außerhalb der aktiven `instanceId` referenziert
- **THEN** werden diese Daten nicht in die effektive Berechnung einbezogen
- **AND** die Autorisierungsentscheidung bleibt instanzisoliert

## MODIFIED Requirements

(None)

## REMOVED Requirements

(None)
