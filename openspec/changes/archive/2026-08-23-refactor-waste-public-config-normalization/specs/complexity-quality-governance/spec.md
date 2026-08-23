## ADDED Requirements

### Requirement: Kritische öffentliche Konfigurationsgrenzen besitzen nachvollziehbare Entscheidungsbausteine

Das System SHALL komplexe Normalisierungen an öffentlichen Konfigurationsgrenzen in kleine, typsichere und fachlich benannte Entscheidungsbausteine zerlegen, ohne bestehende Sicherheits- oder Vertragsregeln abzuschwächen.

#### Scenario: Komplexität sinkt bei unverändertem Vertrag

- **WHEN** die Waste-Reminder-Normalisierung refaktoriert wird
- **THEN** sinkt ihre kanonisch gemessene Komplexität unter den kritischen Bereich
- **AND** belegen Characterization-Tests die unveränderte Fail-closed-, Ausgabe- und Secret-Semantik
- **AND** wird keine Suppression als Ersatz für die tatsächliche Senkung eingeführt
