## ADDED Requirements

### Requirement: Wiederholte Primäraktionen für lange Bearbeitungsflächen

Das Studio SHALL gemeinsame UI-Verträge bereitstellen, mit denen lange seitengroße oder eingebettete Bearbeitungsflächen dieselbe Primäraktion oberhalb und unterhalb ihres fachlichen Inhalts anzeigen. Die Verträge SHALL einheitliche Abstände, Ausrichtung und visuelle Trennung verwenden, ohne fachliche Aktionslogik zu besitzen.

#### Scenario: Detailseite stellt eine Primäraktion bereit

- **GIVEN** eine lange Detailseite übergibt eine Primäraktion
- **WHEN** das gemeinsame Detailseiten-Template gerendert wird
- **THEN** erscheint dieselbe Primäraktion im Seitenkopf und nach dem Seiteninhalt
- **AND** ausschließlich für den Seitenkopf bestimmte Sekundäraktionen werden nicht automatisch wiederholt

#### Scenario: Eingebettete Bearbeitungsfläche besitzt eine eigene Mutationsgrenze

- **GIVEN** eine lange Tabelle, Liste oder Teilfläche wird unabhängig von der umgebenden Detailseite gespeichert
- **WHEN** die gemeinsame Formular-Aktionsleiste verwendet wird
- **THEN** erscheint dieselbe Primäraktion oberhalb und unterhalb dieser Teilfläche
- **AND** die Aktion bleibt an deren eigenen Handler und Zustand gebunden

#### Scenario: Detailseite besitzt keine wiederholte Primäraktion

- **GIVEN** eine Detailseite übergibt keine Primäraktion
- **WHEN** das gemeinsame Detailseiten-Template gerendert wird
- **THEN** erzeugt das Template keine leere untere Aktionsfläche
