## ADDED Requirements

### Requirement: Standardisierter Runtime-Doctor pro Profil

Das System SHALL für jedes kanonische Runtime-Profil ein offizielles `doctor`-Kommando bereitstellen, das nicht nur Erreichbarkeit, sondern auch Schema- und Kontextdiagnostik ausführt.

#### Scenario: Root-Scripts bilden den Diagnosepfad ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:doctor:<profil>`-Skripte für `local-keycloak`, `local-builder` und `acceptance-hb`
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Debug-Kommandos

#### Scenario: Doctor-Ausgabe ist maschinenlesbar

- **WHEN** ein `env:doctor:<profil>`-Befehl mit `--json` ausgeführt wird
- **THEN** liefert das System pro Check mindestens `status`, `code`, `message` und optionale `details`
- **AND** die Ausgabe enthält keine Secrets oder PII
