## ADDED Requirements

### Requirement: Nachrichten-Mutationen erhalten und erweitern das Payload

Der Mainserver-Nachrichtenadapter MUST vorhandene Payload-Eigenschaften erhalten und dabei `wasteLocationKeys` gezielt ersetzen oder entfernen.

#### Scenario: Gezielte Nachricht wird gespeichert

- **WHEN** eine Nachricht mit ausgewählten Abholorten gespeichert wird
- **THEN** sendet Create oder Update ein dedupliziertes Array unter `payload.wasteLocationKeys`
- **AND** bleiben nicht zugehörige Payload-Eigenschaften unverändert

#### Scenario: Globale Nachricht wird gespeichert

- **WHEN** eine Nachricht ohne Abholortziele gespeichert wird
- **THEN** wird `wasteLocationKeys` im Payload weggelassen
- **AND** bleiben nicht zugehörige Payload-Eigenschaften unverändert
