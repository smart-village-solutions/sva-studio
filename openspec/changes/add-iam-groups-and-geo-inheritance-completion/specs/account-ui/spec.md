## ADDED Requirements

### Requirement: Gruppenverwaltung im Admin-Bereich

Das System MUST im Admin-Bereich eine Oberfläche zur Verwaltung instanzgebundener Gruppen bereitstellen.

#### Scenario: Administrator verwaltet Gruppen

- **WENN** ein berechtigter Administrator die Gruppenverwaltung öffnet
- **DANN** kann er Gruppen anlegen, bearbeiten, deaktivieren und löschen
- **UND** sieht pro Gruppe mindestens Name, Beschreibung, Typ, Mitgliederzahl und zugewiesene Rechtebündel

#### Scenario: Gruppenzuweisung zu Benutzerkonten

- **WENN** ein Administrator ein Benutzerkonto bearbeitet
- **DANN** kann er Gruppenmitgliedschaften zuweisen oder entziehen
- **UND** die UI zeigt bestehende Gruppenmitgliedschaften samt Gültigkeit und Herkunft korrekt an

### Requirement: Sichtbare Gruppenherkunft in IAM-Transparenzdaten

Das System MUST gruppenbasierte Herkunft von Berechtigungen in den relevanten IAM-Ansichten sichtbar machen.

#### Scenario: Effektive Berechtigung stammt aus einer Gruppe

- **WENN** eine effektive Berechtigung eines Benutzers aus einer Gruppenmitgliedschaft stammt
- **DANN** zeigt die UI diese Herkunft explizit an
- **UND** Administratoren müssen die Berechtigung nicht durch manuelle Rohdatenanalyse rekonstruieren
