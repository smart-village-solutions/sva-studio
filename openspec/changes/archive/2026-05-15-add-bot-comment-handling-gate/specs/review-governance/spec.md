## ADDED Requirements

### Requirement: Bot-Kommentare muessen vor Merge bearbeitet werden
Das Repository SHALL vor dem Merge fuer jeden relevanten PR-Kommentar von `Copilot` oder `chatgpt-codex-connector[bot]` einen nachvollziehbaren Bearbeitungsnachweis verlangen.

#### Scenario: Review-Thread wurde umgesetzt und abgeschlossen
- **GIVEN** ein Review-Thread auf einem Diff stammt von `Copilot` oder `chatgpt-codex-connector[bot]`
- **AND** ein Maintainer antwortet inhaltlich auf den Hinweis
- **AND** der Thread wird anschliessend als resolved markiert
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als bearbeitet

#### Scenario: Normaler PR-Kommentar wird bewusst nicht umgesetzt
- **GIVEN** ein normaler PR-Konversationskommentar stammt von `Copilot` oder `chatgpt-codex-connector[bot]`
- **AND** ein Maintainer antwortet mit einem standardisierten Bearbeitungsmarker
- **AND** die Antwort enthaelt eine kurze Begruendung, warum das Feedback bewusst nicht umgesetzt wird
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als bearbeitet

#### Scenario: Kommentar ohne Nachweis bleibt offen
- **GIVEN** ein relevanter Bot-Kommentar in einem Pull Request
- **AND** es gibt weder eine qualifizierte Antwort noch einen sonstigen gueltigen Bearbeitungsnachweis
- **WHEN** das PR-Gate den Status der Bot-Kommentare auswertet
- **THEN** gilt dieser Bot-Kommentar als unbearbeitet
- **AND** der Pull Request darf das Bot-Kommentar-Gate nicht bestehen

### Requirement: Bearbeitungsnachweise muessen standardisierte Abschlusszustaende tragen
Das Repository SHALL fuer relevante Bot-Kommentare standardisierte Abschlusszustaende verwenden, damit akzeptierte, abgelehnte und anderweitig erledigte Entscheidungen maschinell und menschlich nachvollziehbar bleiben.

#### Scenario: Akzeptierter Kommentar ist maschinenlesbar markiert
- **GIVEN** ein relevanter Bot-Kommentar wurde umgesetzt
- **WHEN** ein Maintainer den Abschluss dokumentiert
- **THEN** verwendet die Antwort einen standardisierten Marker fuer einen akzeptierten Abschluss
- **AND** der Marker ist fuer die Gate-Auswertung maschinenlesbar

#### Scenario: Abgelehnter Kommentar ist maschinenlesbar markiert
- **GIVEN** ein relevanter Bot-Kommentar wird bewusst nicht umgesetzt
- **WHEN** ein Maintainer den Abschluss dokumentiert
- **THEN** verwendet die Antwort einen standardisierten Marker fuer einen abgelehnten Abschluss
- **AND** die Antwort enthaelt eine kurze fachliche oder technische Begruendung

### Requirement: Bot-Kommentar-Gate muss Review-Threads und normale PR-Kommentare getrennt auswerten
Das Repository SHALL relevante Bot-Review-Threads und relevante normale Bot-PR-Kommentare als getrennte Kommentararten auswerten und pro Art den passenden Abschlussnachweis verlangen.

#### Scenario: Review-Thread braucht Antwort und Resolve
- **GIVEN** ein relevanter Bot-Kommentar ist Teil eines Review-Threads auf einem Diff
- **WHEN** der Kommentar als bearbeitet gewertet werden soll
- **THEN** reicht eine blosse textuelle Antwort ohne Resolve nicht aus
- **AND** der Thread braucht zusaetzlich einen Abschluss im Thread-Zustand

#### Scenario: Normaler PR-Kommentar braucht Antwort statt Resolve
- **GIVEN** ein relevanter Bot-Kommentar ist ein normaler PR-Konversationskommentar
- **WHEN** der Kommentar als bearbeitet gewertet werden soll
- **THEN** darf das Gate keinen nativen Resolve-Zustand voraussetzen
- **AND** es verlangt stattdessen eine standardisierte menschliche Antwort als Nachweis

#### Scenario: Kommentare anderer Autoren blockieren dieses Gate nicht
- **GIVEN** ein Kommentar stammt nicht von `Copilot` und nicht von `chatgpt-codex-connector[bot]`
- **WHEN** das Bot-Kommentar-Gate den Pull Request auswertet
- **THEN** zaehlt dieser Kommentar nicht zum Pflichtumfang dieses Gates
