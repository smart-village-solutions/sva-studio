## ADDED Requirements

### Requirement: Strukturierte Action-Feedback-Outcomes
Das System SHALL für mutierende oder statusrelevante Aktionen ein strukturiertes Action-Feedback-Outcome-Modell bereitstellen.

Ein Outcome MUST mindestens enthalten:

- Ergebnisart
- referenzierte Feedback-Klasse
- einen fachlichen Bezug zum betroffenen Objekt oder Bereich
- optionale Folgeaktionen

#### Scenario: Save-Aktion liefert strukturiertes Outcome
- **WHEN** eine Save-Aktion erfolgreich abgeschlossen wird
- **THEN** erzeugt das System ein strukturiertes Outcome statt nur einer impliziten UI-Meldung
- **AND** das Outcome referenziert eine kanonische oder registrierte Feedback-Klasse
- **AND** der Bezug zum betroffenen Formular oder Datensatz bleibt erhalten

#### Scenario: Fehler wird in Outcome abgebildet
- **WHEN** eine Aktion fachlich oder technisch fehlschlägt
- **THEN** wird der Fehler in ein strukturiertes Error-Outcome mit Klassenbezug und Kontext überführt
- **AND** eine rein flüchtige globale Fehlermeldung ohne Kontextbezug ist nicht der einzige Vertrag

### Requirement: Kanonischer Host-Kern für Feedback-Klassen
Das System SHALL einen kleinen kanonischen Satz hostdefinierter Feedback-Grundtypen bereitstellen.

Der Host-Kern MUST mindestens Muster für:

- inline-nahen Erfolg
- undo-fähiges Löschen
- persistente Fehler
- Formularvalidierungsfehler
- Progress-/Job-Rückmeldungen
- nicht blockierende Warnungen
- blockierende Bestätigungen

#### Scenario: Delete verwendet undo-fähiges Grundmuster
- **WHEN** eine Standard-Delete-Aktion erfolgreich abgeschlossen wird
- **THEN** verwendet das Outcome einen Grundtyp für undo-fähiges Löschen
- **AND** eine reine Erfolgsmeldung ohne Undo ist nicht das bevorzugte Standardmuster

#### Scenario: Langläufer verwendet Job-Feedback-Muster
- **WHEN** eine Aktion asynchron oder langlaufend ausgeführt wird
- **THEN** wird sie über Progress- oder Job-Grundtypen statt über eine Kette kurzlebiger Toasts rückgemeldet

### Requirement: Registrierte Plugin-Erweiterungen mit Host-Validierung
Das System SHALL plugin-eigene Feedback-Klassen nur als registrierte, namespaced Erweiterungen eines hostdefinierten Grundtyps akzeptieren.

Eine registrierte Klasse MUST mindestens enthalten:

- `classId`
- `baseClass`
- `defaultScope`
- `persistence`
- `screenReaderPolicy`

#### Scenario: Plugin registriert gültige Feedback-Klasse
- **GIVEN** ein Plugin mit Namespace `news`
- **WHEN** es die Klasse `news.publish-with-warnings` registriert
- **THEN** akzeptiert der Host die Klasse nur, wenn sie an einen erlaubten Host-Grundtyp gebunden ist
- **AND** die Klasse wird in die hostgeführte Feedback-Registry aufgenommen

#### Scenario: Plugin registriert Klasse im fremden Namespace
- **GIVEN** ein Plugin mit Namespace `news`
- **WHEN** es eine Klasse wie `events.bulk-result` registrieren will
- **THEN** weist der Host die Registrierung deterministisch zurück
- **AND** die Klasse wird nicht teilweise veröffentlicht

### Requirement: Host-Fallback für ungültige oder unbekannte Klassen
Das System SHALL für unbekannte, unvollständige oder inkompatible Feedback-Klassen eine sichere Host-Fallback-Strategie bereitstellen.

#### Scenario: Unregistrierte Klasse wird emittiert
- **WHEN** ein Plugin oder Core-Pfad ein Outcome mit einer nicht registrierten Feedback-Klasse liefert
- **THEN** rendert der Host diese Klasse nicht nativ vertrauensvoll
- **AND** das Outcome wird auf einen sicheren kanonischen Host-Grundtyp zurückgeführt
- **AND** die Fallback-Nutzung bleibt beobachtbar

### Requirement: Hostgeführte Accessibility- und Surface-Regeln
Das System SHALL Rendering-Surface, Priorisierung, Fokusverhalten und Screenreader-Semantik hostgeführt aus der Feedback-Klasse ableiten.

#### Scenario: Save-Erfolg bleibt nicht blockierend
- **WHEN** ein Outcome einen inline-nahen Erfolgsgrundtyp verwendet
- **THEN** kündigt der Host die Rückmeldung über eine passende nicht blockierende Live-Region an
- **AND** er verschiebt den Fokus nicht automatisch auf eine globale Meldung

#### Scenario: Persistenter Fehler bleibt kontextbezogen
- **WHEN** ein Error-Outcome einen persistenten Fehlergrundtyp verwendet
- **THEN** bleibt die Rückmeldung sichtbar und handlungsrelevant
- **AND** der Host erzwingt keinen Auto-Dismiss
- **AND** die Meldung bleibt mit dem betroffenen Objekt oder Bereich verknüpfbar
