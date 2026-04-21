## ADDED Requirements

### Requirement: Auditspur für Plugin-Action-Registrierung und -Ausführung
Das Audit-System MUST Registrierungs- und Ausführungsereignisse von Plugin-Aktionen mit Namespace-Kontext nachvollziehbar protokollieren.

#### Scenario: Plugin-Action-Ausführung wird mit Namespace-Kontext erfasst
- **WHEN** eine Plugin-Aktion erfolgreich, fehlgeschlagen oder verweigert ausgeführt wird
- **THEN** enthält das Audit-Event mindestens `actionId`, `actionNamespace`, `actionOwner`, `result`, `requestId`, `traceId`
- **AND** die Felder bleiben zwischen operativem Log und Audit-Datensatz semantisch konsistent

#### Scenario: Cross-Namespace-Denial ist auditierbar
- **WHEN** eine Plugin-Aktion wegen fehlender Namespace-Freigabe verweigert wird
- **THEN** wird ein Audit-Ereignis mit Ergebnis `denied` erzeugt
- **AND** das Ereignis enthält die angeforderte vollständig qualifizierte Action-ID
