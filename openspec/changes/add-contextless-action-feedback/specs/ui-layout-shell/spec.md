## ADDED Requirements

### Requirement: Layout-Shell stellt den Anker für kontextlose Aktionsrückmeldungen bereit

Die Layout-Shell MUST genau einen hostverantworteten Surface- und Live-Region-Anker für zulässige kontextlose Aktionsrückmeldungen bereitstellen.

#### Scenario: Reguläre Route emittiert eine zulässige globale Rückmeldung

- **WHEN** eine Host- oder Plugin-Route eine zulässige kontextlose Rückmeldung auslöst
- **THEN** rendert die Shell sie unabhängig von der konkreten Route über den gemeinsamen Anker
- **AND** bleibt der Routeninhalt der fachliche Eigentümer der auslösenden Aktion

#### Scenario: Plugin versucht eine parallele globale Surface einzuführen

- **WHEN** ein Plugin einen eigenen globalen Toast- oder Live-Region-Container bereitstellt
- **THEN** gilt dies als Verstoß gegen die hostverantwortete UI-Grenze
- **AND** wird der gemeinsame Shell-Anker nicht dupliziert
