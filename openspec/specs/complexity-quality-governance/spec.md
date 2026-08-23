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

### Requirement: Account-Import-Hotspots werden ohne Vertragsänderung zerlegt

Das System SHALL die Profilreparatur und Berichtsbildung des Account-Imports in kleine überprüfbare Entscheidungs- und Seiteneffektbausteine zerlegen. Die Senkung MUST durch Fallow-Metriken belegt werden und darf nicht durch Suppressionen, geänderte Schwellen oder eine zusätzliche parallele Importabstraktion entstehen.

#### Scenario: Profilreparatur-Hotspots verschwinden aus dem Fallow-Bericht

- **GIVEN** `repairIdentityUserProfileIfPossible` und die Import-Berichtsbildung überschreiten die dokumentierten CRAP- oder Komplexitätsgrenzen
- **WHEN** die internen Entscheidungsgrenzen refaktoriert werden
- **THEN** liegen die Ziel-Funktionen unter den kanonischen Fallow-Schwellen oder sind durch kleinere Bausteine ersetzt
- **AND** der New-only-Audit führt keine neue Complexity, Dead Code oder Duplikation ein
- **AND** Characterization-Tests belegen unveränderte Fallback-, Mandanten-, Fehler- und Report-Semantik

### Requirement: Sicherheitskritische Entscheidungs-Hotspots werden fachlich zerlegt

Das System SHALL einen sicherheitskritischen Komplexitäts-Hotspot entlang stabiler fachlicher Entscheidungsgrenzen in kleine reine Bausteine zerlegen. Die Senkung MUST durch maschinenlesbare Komplexitätsmetriken belegt werden und darf nicht durch Suppressionen, geänderte Grenzwerte oder einen parallelen Entscheidungspfad entstehen.

#### Scenario: ABAC-Hotspot wird messbar reduziert

- **GIVEN** `evaluateAbacRules` überschreitet die dokumentierten Komplexitätsgrenzen
- **WHEN** die interne ABAC-Auswertung refaktoriert wird
- **THEN** verschwindet der ursprüngliche Fallow-Hotspot oder liegt nachweislich unter den kanonischen Grenzwerten
- **AND** das Complexity-Gate bleibt ohne neue Suppression grün
- **AND** Characterization-Tests belegen die unveränderte Entscheidungssemantik

### Requirement: Operative Acceptance-Runner halten fachliche Orchestrierung sichtbar

Das System SHALL komplexe operative Acceptance-Runner in typisierte fachliche Prüfschritte zerlegen, ohne ihre sicherheitsrelevante Ausführungsreihenfolge hinter generischen Engines oder Factories zu verbergen.

#### Scenario: Acceptance-Hotspot wird refaktoriert

- **WHEN** ein Acceptance-Runner wegen Datei-, Funktions- oder zyklomatischer Komplexität zerlegt wird
- **THEN** bleiben Pflichtprüfungen und deren Reihenfolge am öffentlichen CLI-Einstieg explizit nachvollziehbar
- **AND** Exitcodes, Fehlercodes, Redaction, Cleanup und Berichtsausgabe werden vor der Extraktion charakterisiert

#### Scenario: Complexity-Baseline wird reduziert

- **WHEN** der Refactor einen getrackten Complexity-Befund nachweislich behebt
- **THEN** wird ausschließlich der behobene Baseline-Eintrag gemäß kanonischem Policy-Vertrag entfernt
- **AND** es wird keine neue Suppression oder gleichwertige Ausnahme eingeführt

### Requirement: Komplexe React-Editorbereiche werden entlang testbarer Zuständigkeiten zerlegt

Das System SHALL kritische React-Editor-Hotspots in reine Ableitungen, kontrollierte Zustandskoordination und präsentationale Abschnitte zerlegen, ohne UI-, Berechtigungs- oder Persistenzverträge zu verändern. Die Zerlegung MUST durch Characterization-Tests und maschinenlesbare Komplexitätsmetriken belegt werden.

#### Scenario: POI-Betreiberbereich verliert den kritischen Hotspot

- **GIVEN** `PoiDetailOperatorTab` überschreitet die dokumentierten Komplexitätsgrenzen
- **WHEN** der Betreiberbereich intern refaktoriert wird
- **THEN** bleibt `PoiDetailOperatorTab` der einzige Einbindungspunkt des Content-Tabs
- **AND** Feld-IDs, Texte, Validierungszustände, Berechtigungsentscheidungen und Geocoding-Verträge bleiben unverändert
- **AND** der ursprüngliche kritische Fallow-Befund verschwindet ohne Suppression oder Grenzwertänderung
- **AND** keine neu extrahierte React-Komponente wird selbst zu einem kritischen Hotspot

### Requirement: Kritische öffentliche Datenlader trennen I/O von Ableitung

Das System SHALL bei kritischen öffentlichen Datenladern den parametrisierten
Datenzugriff von I/O-freier Normalisierung und fachlicher Ergebnisableitung trennen,
ohne dafür öffentliche Vertragsflächen zu vergrößern.

#### Scenario: Öffentlicher Loader wird entflechtet

- **WHEN** ein öffentlicher Datenlader als kritischer Komplexitäts-Hotspot refaktoriert wird
- **THEN** bleiben SQL-, Schema- und Fehlergrenzen in der serverseitigen I/O-Schicht
- **AND** deterministische Normalisierung und Zusammenführung sind unabhängig vom Datenbanktransport testbar
- **AND** die bestehende öffentliche Repository-Fassade bleibt für ihre Konsumenten stabil

### Requirement: Kritische öffentliche Konfigurationsgrenzen besitzen nachvollziehbare Entscheidungsbausteine

Das System SHALL komplexe Normalisierungen an öffentlichen Konfigurationsgrenzen in kleine, typsichere und fachlich benannte Entscheidungsbausteine zerlegen, ohne bestehende Sicherheits- oder Vertragsregeln abzuschwächen.

#### Scenario: Komplexität sinkt bei unverändertem Vertrag

- **WHEN** die Waste-Reminder-Normalisierung refaktoriert wird
- **THEN** sinkt ihre kanonisch gemessene Komplexität unter den kritischen Bereich
- **AND** belegen Characterization-Tests die unveränderte Fail-closed-, Ausgabe- und Secret-Semantik
- **AND** wird keine Suppression als Ersatz für die tatsächliche Senkung eingeführt

