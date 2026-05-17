## ADDED Requirements

### Requirement: Plugin-Feedback-Klassen bleiben deklarative Plattformbeiträge
Das System SHALL plugin-eigene Feedback-Klassen als deklarative, hostvalidierte Plattformbeiträge behandeln.

#### Scenario: Plugin beschreibt Feedback-Klassen deklarativ
- **WHEN** ein Plugin eigene Feedback-Klassen bereitstellen will
- **THEN** deklariert es diese über den kanonischen Plugin-Vertrag statt über eine parallele pluginlokale Runtime-Registry
- **AND** der Host validiert Namespace, Pflichtfelder und Host-Grundtypbindung vor der Veröffentlichung

### Requirement: Plugin-SDK darf generische Feedback-Authoring-Helfer bereitstellen
`@sva/plugin-sdk` MUST generische Authoring- und Emissions-Helfer für Feedback-Klassen und strukturierte Outcomes bereitstellen dürfen, ohne fachspezifisch zu werden.

#### Scenario: SDK stellt generische Feedback-Helfer bereit
- **WHEN** die Plugin-SDK-Grenze für neue Plattformfähigkeiten bewertet wird
- **THEN** darf `@sva/plugin-sdk` generische Registry- und Outcome-Helfer für die Action-Feedback-Plattform enthalten
- **AND** fachplugin-spezifische Meldungssemantik oder Einzelplugin-Renderer verbleiben außerhalb des generischen SDK
