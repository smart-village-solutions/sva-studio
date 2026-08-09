## ADDED Requirements

### Requirement: Globale Kurzrückmeldung setzt fehlenden stabilen Kontext voraus

Das System MUST eine kurzlebige globale Rückmeldung auf Aktionen begrenzen, für die kein geeigneter stabiler Button-, Formular-, Detail-, Listen-, Job- oder Bereichskontext existiert.

#### Scenario: Link wird ohne Zielbereich kopiert

- **WHEN** ein Benutzer einen Link kopiert und kein stabiler Ergebnisbereich vorhanden ist
- **THEN** darf das System den Erfolg über die globale Kurzrückmeldung anzeigen
- **AND** bleibt die Meldung auf die erfolgte Aktion beschränkt

#### Scenario: Aktion besitzt einen sichtbaren Ergebnisbereich

- **WHEN** eine Aktion ihren Status in einem stabilen sichtbaren Kontext darstellen kann
- **THEN** erscheint die Rückmeldung dort
- **AND** wird kein zusätzlicher globaler Toast als Standardrückmeldung erzeugt

### Requirement: Die Shell hostet eine einzige kontrollierte globale Surface

Das System MUST globale Kurzrückmeldungen über genau eine hostverantwortete Shell-Surface und gemeinsame UI-Primitives darstellen.

#### Scenario: Host und Plugin emittieren Meldungen

- **WHEN** Host- und Plugin-Aktionen zulässige kontextlose Rückmeldungen auslösen
- **THEN** werden beide über dieselbe Host-Surface dargestellt
- **AND** erzeugt kein Plugin einen eigenen globalen Toast-Container

### Requirement: Globale Meldungen bleiben minimal und überlastungssicher

Das System MUST globale Meldungen mit stabilen IDs deduplizieren, ihre gleichzeitig sichtbare Anzahl begrenzen und wiederholte Live-Region-Ankündigungen vermeiden.

#### Scenario: Dieselbe Aktion emittiert mehrfach denselben Erfolg

- **WHEN** dieselbe Meldungs-ID in kurzer Folge erneut emittiert wird
- **THEN** erzeugt das System keine unbeschränkten visuellen Duplikate
- **AND** kündigt die Live-Region den identischen Inhalt nicht als Meldungssturm an

#### Scenario: Mehrere unterschiedliche Meldungen treffen ein

- **WHEN** mehr Meldungen eintreffen als gleichzeitig dargestellt werden dürfen
- **THEN** wendet der Host eine deterministische Queue- und Priorisierungsregel an
- **AND** bleibt keine kritische persistente Fehlermeldung von dieser flüchtigen Queue abhängig

### Requirement: Automatisches Ausblenden bleibt zugänglich

Das System MUST automatisch ausblendbare globale Meldungen manuell schließbar machen, bei Hover und Tastaturfokus pausieren und ohne automatische Fokusverschiebung ankündigen.

#### Scenario: Benutzer fokussiert eine globale Meldung

- **WHEN** der Benutzer eine Meldung oder ihre Folgeaktion fokussiert
- **THEN** pausiert ein laufender Ausblendzeitraum
- **AND** bleibt die Meldung bedienbar, bis der Fokus sie verlassen hat oder der Benutzer sie schließt

### Requirement: Handlungsrelevante Fehler bleiben außerhalb flüchtiger globaler Meldungen

Das System MUST technische Fehler, Konflikte, Datenverlust- oder Security-Risiken mit weiterem Handlungsbedarf persistent im zuständigen stabilen Kontext darstellen.

#### Scenario: Aktion scheitert mit erforderlicher Nutzerhandlung

- **WHEN** ein Fehler eine Wiederholung, Korrektur oder Entscheidung des Benutzers erfordert
- **THEN** ist eine automatisch verschwindende globale Meldung nicht die einzige Rückmeldung
- **AND** bleibt der Fehler im zuständigen Kontext persistent und handlungsorientiert sichtbar
