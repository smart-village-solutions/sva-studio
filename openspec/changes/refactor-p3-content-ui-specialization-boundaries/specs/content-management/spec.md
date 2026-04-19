## ADDED Requirements

### Requirement: Content-Views dürfen fachlich spezialisiert werden, ohne den Kern zu forkieren

Das System SHALL spezialisierte fachliche Listen-, Detail- und Editor-Ansichten auf Basis eines gemeinsamen Content-Kerns zulassen.

#### Scenario: Fachplugin spezialisiert die Darstellung

- **WHEN** ein Plugin eine domänenspezifische Inhaltsansicht bereitstellt
- **THEN** darf es Darstellung und Eingabebereiche fachlich spezialisieren
- **AND** Kernmetadaten und Kernsemantik bleiben mit dem gemeinsamen Content-Vertrag kompatibel

#### Scenario: Fachview ersetzt den Kern nicht

- **WHEN** eine spezialisierte Ansicht gerendert wird
- **THEN** bleibt sie ein Aufsatz auf den gemeinsamen Content-Kern
- **AND** sie erzeugt keinen separaten Core-Fork für dieselbe Inhaltsdomäne
