## ADDED Requirements

### Requirement: Release Notes enthalten nutzerrelevante ausgelieferte Änderungen

Das System SHALL Release Notes nur aus nutzerrelevanten Einträgen des tatsächlich ausgelieferten Quellstands erstellen. Ein PR ohne solchen Wert SHALL keinen künstlichen Eintrag benötigen; ein vorhandener Eintrag SHALL weiter in Struktur und Inhalt geprüft werden.

#### Scenario: Reines Refactoring oder routinemäßiges Update

- **WHEN** ein PR ausschließlich interne Refactorings oder routinemäßige Dependency-Updates enthält
- **THEN** darf der PR ohne Changelog-Eintrag bestehen
- **AND** bleibt er über PR und Git-Vergleich nachvollziehbar

#### Scenario: Technisches Update behebt ein sichtbares Problem

- **WHEN** ein technisches Update ein für Nutzende wahrnehmbares Problem oder eine relevante Sicherheitswirkung behebt
- **THEN** kann es einen kurzen Eintrag mit der Wirkung für Nutzende erhalten
- **AND** wird der technische Implementierungsdetailgrad nicht zum Inhalt der Meldung

#### Scenario: Vorhandener Eintrag ist ungültig

- **WHEN** ein PR einen Changelog-Eintrag hinzufügt oder ändert
- **THEN** prüft das bestehende Gate Datei, PR-Zuordnung und Inhalt
- **AND** blockiert es ungültige Einträge

### Requirement: Release Notes folgen dem tatsächlich ausgelieferten Vergleich

Das System SHALL GitHub-Release-Notes anhand der tatsächlich ausgelieferten Commit-Bereiche und der kuratierten Nutzereinträge ableiten. Die höchste PR-Nummer oder der neueste `main`-Stand SHALL keine Release-Grenze sein.

#### Scenario: Reguläres Release enthält spätere Main-Arbeit nicht

- **WHEN** ein älterer geprüfter Main-Commit nach Production promotet wird und `main` bereits weitere PRs enthält
- **THEN** erwähnen die Notes nur Änderungen bis zum promoteten Commit seit dem letzten Production-Tag

#### Scenario: Hotfix-Release enthält nur den Patch

- **WHEN** ein Hotfix vom letzten Production-Tag ausgeliefert wird
- **THEN** enthalten seine Notes nur die seit diesem Tag ausgelieferte Korrektur
- **AND** werden wartende Main-Features weder angekündigt noch als ausgeliefert markiert

#### Scenario: Reguläres Release folgt auf einen Hotfix

- **GIVEN** ein Hotfix wurde aus einer von `main` abgezweigten Production-Linie ausgeliefert und sein Fix nach `main` übernommen
- **WHEN** der nächste reguläre `main`-Kandidat veröffentlicht wird
- **THEN** enthalten die Notes die inzwischen neu ausgelieferten Änderungen
- **AND** wird die bereits veröffentlichte Hotfix-Korrektur auch bei abweichender Commit-Abstammung nicht erneut angekündigt

#### Scenario: Neues stabiles GitHub-Release wird veröffentlicht

- **WHEN** der Production-Promote erfolgreich abgeschlossen ist und Live-Digest samt Commit geprüft sind
- **THEN** werden die redaktionell geprüften Release Notes mit dem stabilen GitHub-Release veröffentlicht
- **AND** bleibt eine zuvor veröffentlichte Beta als Pre-release gekennzeichnet

### Requirement: Das Studio-Dashboard zeigt keine einzelnen PR-Einträge

Das System SHALL auf der Studio-Startseite keine einzelnen PR-Changelog-Einträge anzeigen oder abrufen.

#### Scenario: Angemeldete Person öffnet die Startseite

- **WHEN** eine angemeldete Person die Studio-Startseite öffnet
- **THEN** erscheinen die verfügbaren Aktionskarten ohne PR-Changelog-Abschnitt
- **AND** wird kein PR-Changelog-Endpunkt aufgerufen
