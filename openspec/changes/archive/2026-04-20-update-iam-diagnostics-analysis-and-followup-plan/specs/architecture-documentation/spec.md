## ADDED Requirements

### Requirement: Analysechanges mit Diagnosewirkung liefern versionierte Befundartefakte

Die Architektur- und Betriebsdokumentation SHALL bei Analysechanges mit IAM-, Auth-, Session-, Registry- oder Provisioning-Diagnosewirkung einen versionierten Bericht, einen expliziten Live-Triage-Status und eine nachvollziehbare Folgechange-Übergabe enthalten.

#### Scenario: Repo-Analyse wird als Bericht konserviert

- **WHEN** ein Analysechange die Diagnosefähigkeit eines kritischen Laufzeitpfads bewertet
- **THEN** wird der Befund als versionierter Bericht unter `docs/reports/` abgelegt
- **AND** der Bericht dokumentiert mindestens Fehlerklassen, heutige Signale, Recovery-Pfade, erkannte Lücken und empfohlene Folgearbeit

#### Scenario: Live-Triage darf nicht stillschweigend entfallen

- **WHEN** ein Analysechange einen verpflichtenden Live-Triage-Block gegen eine reale Umgebung vorsieht
- **THEN** dokumentiert die Architektur- oder Betriebsdoku explizit, ob dieser Block durchgeführt wurde, offen ist oder an fehlender Umgebung/Testdaten scheitert
- **AND** ein offener Live-Triage-Block wird nicht als erledigt oder implizit grün kommuniziert

#### Scenario: Folgechange-Übergabe bleibt entscheidungsfähig

- **WHEN** ein Analysechange mit priorisierter Folgearbeit endet
- **THEN** dokumentiert der Bericht mindestens mehrere Zuschnittsoptionen, eine Empfehlung und einen vorbereiteten Folgechange
- **AND** können Reviewer nachvollziehen, welche Folgearbeit auf welcher Analysebasis aufsetzt
