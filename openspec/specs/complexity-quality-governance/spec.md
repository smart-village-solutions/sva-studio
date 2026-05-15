# complexity-quality-governance Specification

## Purpose
Die Capability definiert Qualitäts- und Governance-Regeln für Komplexität, Wartbarkeit und Reviewbarkeit zentraler Module, damit technische Risiken früh sichtbar und verbindlich bearbeitet werden.
## Requirements
### Requirement: Automatisierte Komplexitätsmessung für zentrale Module
Das System SHALL für definierte zentrale Module automatisiert Komplexitätsmetriken erfassen und auswerten.

#### Scenario: Zentrales Modul wird im Qualitätslauf bewertet
- **GIVEN** ein Modul ist als zentral registriert
- **WHEN** der lokale Qualitätslauf oder die CI-Pipeline ausgeführt wird
- **THEN** werden mindestens Dateigröße, Funktionslänge, Cyclomatic Complexity und Anzahl öffentlicher Exports erfasst
- **AND** das Ergebnis ist als maschinenlesbarer Report pro Modul oder Datei verfügbar

#### Scenario: Kritische Modulklassen sind explizit im Scope
- **GIVEN** IAM-Server-, Routing- oder Security-nahe Pfade sind als kritisch markiert
- **WHEN** die Komplexitätsauswertung läuft
- **THEN** werden diese Pfade verpflichtend ausgewertet
- **AND** sie können nicht stillschweigend aus dem Scope fallen

### Requirement: Nachvollziehbare Schwellwerte pro Modulklasse
Das System SHALL dokumentierte und versionierte Schwellwerte für jede überwachte Komplexitätsmetrik und Modulklasse bereitstellen.

#### Scenario: Reviewer prüft einen Grenzwert
- **WHEN** ein Reviewer oder Maintainer einen Quality-Fund nachvollziehen will
- **THEN** findet er den zugehörigen Grenzwert mit Modulklasse, Metrikname und Soll-Wert in der versionierten Policy
- **AND** die Policy enthält Begründung oder Verweis auf den Review-/Entscheidungskontext

#### Scenario: Kritische Module erhalten strengere Regeln
- **GIVEN** ein Modul ist als kritisch klassifiziert
- **WHEN** seine Policy ausgewertet wird
- **THEN** dürfen dafür strengere Grenzwerte oder zusätzliche Hotspot-Regeln gelten als für nur zentrale Module

### Requirement: Pflicht-Folgeprozess bei Schwellwertüberschreitung
Das System SHALL jede Schwellwertüberschreitung in zentralen oder kritischen Modulen als verpflichtenden Refactoring-Bedarf ausweisen.

#### Scenario: Überschreitung wird im PR sichtbar
- **WHEN** ein Modul einen definierten Grenzwert überschreitet
- **THEN** benennt der Quality-Report mindestens Modul, Datei oder Symbol, Metrik, Ist-Wert und Soll-Wert
- **AND** der Befund ist in PR- oder CI-Ausgabe für Reviewer sichtbar

#### Scenario: Refactoring-Ticket ist verpflichtend
- **WHEN** eine Schwellwertüberschreitung festgestellt wird
- **THEN** verweist der Workflow auf ein bestehendes oder neu angelegtes Refactoring-Ticket
- **AND** die Überschreitung gilt nicht als folgenlos akzeptiert

### Requirement: Trends und Baselines für Komplexitätshotspots
Das System SHALL für überwachte Module Baselines oder Trendinformationen bereitstellen, damit Verschlechterungen nachvollziehbar sind.

#### Scenario: Neue Änderung verschlechtert einen Hotspot
- **GIVEN** für ein kritisches Modul existiert eine Baseline oder ein letzter bekannter Messwert
- **WHEN** eine Änderung die Komplexität weiter erhöht
- **THEN** zeigt der Report die Verschlechterung gegenüber dem Referenzwert
- **AND** der Befund kann für Priorisierung von Refactoring-Aufgaben verwendet werden

### Requirement: Boundary-Hotspots dürfen nicht durch Parallelimplementierungen kaschiert werden

Das System SHALL bei Refactors von Komplexitäts-Hotspots parallel gepflegte Implementierungen in benachbarten Schichten als Architekturproblem behandeln und auf eine führende Ownership zurückführen, wenn bereits fachliche Divergenz sichtbar ist.

#### Scenario: Boundary-Refactor entdeckt divergierende Doppelimplementierung

- **WHEN** ein Komplexitäts-Hotspot in einer zentralen oder kritischen Capability auf parallele Implementierungen derselben Verantwortung verweist
- **THEN** bewertet der Refactor diese Situation nicht nur als Dateisplitting-Aufgabe
- **AND** dokumentiert, welche Schicht die führende Ownership übernimmt
- **AND** entfernt oder delegiert mindestens eine der Doppelimplementierungen

#### Scenario: Root-API kritischer Packages wird auf stabile Verträge reduziert

- **WHEN** ein kritisches Package wegen `publicExports` als Hotspot auffällt
- **THEN** wird geprüft, welche Exporte echte Vertragsfläche und welche nur interne Helper sind
- **AND** bleiben interne Helper nicht ohne Bedarf im Root-Entry erhalten
- **AND** verschiebt der Refactor solche Hilfen auf interne Module oder engere Subpath-Entrypoints

