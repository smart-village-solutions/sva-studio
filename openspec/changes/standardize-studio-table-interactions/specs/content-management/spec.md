## ADDED Requirements

### Requirement: Zentrale Inhaltstabelle verwendet die gemeinsamen Tabelleninteraktionen

Die zentrale Inhaltstabelle MUST die gemeinsamen Studio-Muster für anklickbare Informationen, Status-Badges, Icon-Aktionen, mobile Aktionsbeschriftungen und oben ausgerichtete Body-Zellen verwenden. Die Migration MUST bestehende Berechtigungs-, Principal-, Projektions-, Sortier-, Paginierungs- und Mutationsverträge unverändert erhalten.

#### Scenario: Benutzer darf einen Inhalt öffnen

- **WENN** ein Inhalt gemäß der bestehenden Zeilenzugriffsauflösung lesbar ist
- **DANN** erscheint sein Titel als primäre anklickbare Information
- **UND** führt der Titel zum bereits aufgelösten `editPath`
- **UND** beschreibt sein zugänglicher Name weiterhin, ob der Inhalt bearbeitbar oder nur lesbar geöffnet wird
- **UND** rendert die Aktionsspalte kein redundantes Öffnen-/Bearbeiten-Icon für dasselbe Ziel

#### Scenario: Benutzer darf einen Inhalt nicht öffnen

- **WENN** ein Inhalt gemäß der bestehenden Zeilenzugriffsauflösung nicht lesbar ist
- **DANN** erscheint sein Titel als reiner Text ohne Fokusziel und ohne irreführende Interaktivität
- **UND** erzeugt die Tabelle keinen Link auf ein nicht erlaubtes Ziel

#### Scenario: Benutzer betrachtet oder ändert den Content-Status

- **WENN** die Inhaltstabelle einen Content-Status rendert
- **DANN** verwendet sie das gemeinsame beschriftete Status-Badge
- **UND** bleibt ein nicht änderbarer Status rein informativ
- **UND** öffnet ein änderbarer Status weiterhin den bestehenden Statusdialog unter Beibehaltung von Berechtigungs- und Principal-Auflösung
- **UND** bleibt der Dialog bei einem Mutationsfehler geöffnet und zeigt einen verständlichen nächsten Schritt

#### Scenario: Benutzer löscht einen Inhalt

- **WENN** die bestehende Berechtigungs- und Principal-Auflösung das Löschen erlaubt
- **DANN** erscheint Löschen als gemeinsame destruktive Icon-Aktion
- **UND** bleibt die bestehende Bestätigung vor der Mutation erhalten
- **UND** erhält die Aktion in der mobilen Kartenansicht eine sichtbare Beschriftung

#### Scenario: Inhaltstabelle verarbeitet Daten und Navigation

- **WENN** die Inhaltstabelle auf die gemeinsamen Interaktionsmuster migriert wird
- **DANN** bleiben Projection, Filterung, globale Sortierung, Pagination, Content-Typ-Auflösung und Mainserver-Mutationsverträge unverändert
- **UND** bleiben alle Body-Zellen nach dem gemeinsamen Tabellenstandard oben ausgerichtet
