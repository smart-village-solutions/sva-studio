## ADDED Requirements

### Requirement: Einheitliche Runtime-Profile für Entwicklungs- und Betriebsmodi

Das System SHALL drei kanonische Runtime-Profile (`local-keycloak`, `local-builder`, `acceptance-hb`) bereitstellen und deren nicht-sensitive Konfiguration versioniert im Repository führen.

#### Scenario: Profildefinitionen sind versioniert

- **WHEN** das Repository geprüft wird
- **THEN** existieren versionierte Profildefinitionen unter `config/runtime/`
- **AND** jedes Profil setzt `SVA_RUNTIME_PROFILE` eindeutig
- **AND** lokale standortspezifische Overrides bleiben außerhalb der versionierten Basisdateien

### Requirement: Standardisierte Runtime-Kommandos pro Profil

Das System SHALL für jedes Runtime-Profil standardisierte Befehle für `up`, `down`, `update`, `status`, `smoke` und `migrate` bereitstellen.

#### Scenario: Root-Scripts bilden das Operations-Interface ab

- **WHEN** `package.json` im Repository geprüft wird
- **THEN** existieren `env:*:<profil>`-Skripte für alle drei Runtime-Profile
- **AND** die Skripte delegieren an eine gemeinsame Implementierung statt an profilindividuelle Ad-hoc-Kommandos

#### Scenario: Smoke-Checks prüfen Kernabhängigkeiten

- **WHEN** ein Runtime-`smoke`-Befehl ausgeführt wird
- **THEN** prüft er mindestens Live-/Ready-Health, Auth-Verhalten und Mainserver-Basisfunktion
- **AND** lokale Profile prüfen zusätzlich den OTEL-Collector
- **AND** das Acceptance-Profil prüft den serverseitigen Stack-Zustand
