## ADDED Requirements

### Requirement: Studio-Changelog enthält nutzerrelevante ausgelieferte Änderungen

Das System SHALL im Studio nur Einträge anzeigen, deren Änderung für Nutzende erkennbaren Wert hat und im tatsächlich ausgelieferten Quellstand enthalten ist. Ein PR ohne solchen Wert SHALL keinen künstlichen Eintrag benötigen; ein vorhandener Eintrag SHALL weiter in Struktur und Inhalt geprüft werden.

#### Scenario: Reines Refactoring oder routinemäßiges Update

- **WHEN** ein PR ausschließlich interne Refactorings oder routinemäßige Dependency-Updates enthält
- **THEN** darf der PR ohne Studio-Changelog-Eintrag bestehen
- **AND** erscheint er nicht allein deshalb als Meldung in der Studio-Oberfläche
- **AND** bleibt er über PR und Git-Vergleich nachvollziehbar

#### Scenario: Technisches Update behebt ein sichtbares Problem

- **WHEN** ein technisches Update ein für Nutzende wahrnehmbares Problem oder eine relevante Sicherheitswirkung behebt
- **THEN** kann es einen kurzen Eintrag mit der Wirkung für Nutzende erhalten
- **AND** wird der technische Implementierungsdetailgrad nicht zum Inhalt der Meldung

#### Scenario: Vorhandener Eintrag ist ungültig

- **WHEN** ein PR einen Studio-Changelog-Eintrag hinzufügt oder ändert
- **THEN** prüft das bestehende Gate Datei, PR-Zuordnung und Inhalt
- **AND** blockiert es ungültige Einträge

### Requirement: Release Notes folgen dem tatsächlich ausgelieferten Vergleich

Das System SHALL GitHub-Release-Notes und das veröffentlichte Studio-Changelog anhand der tatsächlich ausgelieferten Commit-Bereiche und der kuratierten Nutzereinträge ableiten. Die höchste PR-Nummer oder der neueste `main`-Stand SHALL keine Release-Grenze sein.

#### Scenario: Reguläres Release enthält spätere Main-Arbeit nicht

- **WHEN** ein älterer geprüfter Main-Commit nach Production promotet wird und `main` bereits weitere PRs enthält
- **THEN** erwähnen die Notes nur Änderungen bis zum promoteten Commit seit dem letzten Production-Tag
- **AND** zeigt das im Image enthaltene Studio-Changelog keine späteren, noch nicht ausgelieferten Einträge

#### Scenario: Hotfix-Release enthält nur den Patch

- **WHEN** ein Hotfix vom letzten Production-Tag ausgeliefert wird
- **THEN** enthalten seine Notes nur die seit diesem Tag ausgelieferte Korrektur
- **AND** werden wartende Main-Features weder angekündigt noch als ausgeliefert markiert

#### Scenario: Alter Hotfix-Quellstand erzeugt das In-App-Changelog

- **GIVEN** der Production-Basistag enthält die neue Bereichsauswahl noch nicht
- **WHEN** ein Hotfix-Image aus dem darauf basierenden Quellstand gebaut wird
- **THEN** enthält der Hotfix-Quellstand die nötige Changelog-Anpassung
- **AND** wird das tatsächlich gebaute In-App-Changelog gegen den ausgelieferten Bereich geprüft

#### Scenario: Reguläres Release folgt auf einen Hotfix

- **GIVEN** ein Hotfix wurde aus einer von `main` abgezweigten Production-Linie ausgeliefert und sein Fix nach `main` übernommen
- **WHEN** der nächste reguläre `main`-Kandidat veröffentlicht wird
- **THEN** enthalten Notes und In-App-Changelog die inzwischen neu ausgelieferten Änderungen
- **AND** wird die bereits veröffentlichte Hotfix-Korrektur auch bei abweichender Commit-Abstammung nicht erneut angekündigt

#### Scenario: Neues stabiles GitHub-Release wird veröffentlicht

- **WHEN** der Production-Promote erfolgreich abgeschlossen ist und Live-Digest samt Commit geprüft sind
- **THEN** werden die redaktionell geprüften Release Notes mit dem stabilen GitHub-Release veröffentlicht
- **AND** bleibt eine zuvor veröffentlichte Beta als Pre-release gekennzeichnet
