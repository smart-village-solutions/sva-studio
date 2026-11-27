## ADDED Requirements

### Requirement: Serverseitig geladene Tabellen behalten beim Zurückwechseln ihr letztes Ergebnis

Das Studio MUST in Host- und Plugin-Routen mit serverseitig geladenen Tabellen kurzzeitig das letzte erfolgreiche Ergebnis einschließlich Pagination und zugehöriger Metadaten wiederverwenden. Es MUST dabei die aktuelle Tabellenabfrage und einen bestätigten Zugriffskontext berücksichtigen.

#### Scenario: Bekannte Ansicht wird erneut geöffnet

- **WENN** dieselbe Tabelle mit derselben Abfrage und demselben bestätigten Zugriffskontext erneut geöffnet wird
- **UND** ein wiederverwendbares Ergebnis für diese Ansicht vorliegt
- **DANN** sind die vorhandenen Zeilen beziehungsweise der bestätigte Leerzustand sofort sichtbar
- **UND** Studio aktualisiert die Tabelle im Hintergrund und ersetzt das Ergebnis nach erfolgreicher Antwort
- **UND** die Aktualisierung ersetzt die Tabelle nicht durch einen Ladeplatzhalter oder verschiebt den Fokus

#### Scenario: Eine andere Abfrage ist noch nicht geladen

- **WENN** die Tabelle mit abweichender Seite, Sortierung, Suche, Filtern, Sprache oder übergeordneter Ressource geöffnet wird
- **UND** für diese Abfrage kein wiederverwendbares Ergebnis vorliegt
- **DANN** zeigt die Tabelle ihren lokalen Erstladezustand und keine Zeilen einer anderen Abfrage

#### Scenario: Der Zugriffskontext wechselt oder die Listenabfrage wird verweigert

- **WENN** Konto, Instanz, Organisation, verwendete Identität oder wirksame Berechtigungen wechseln oder der Server die Listenabfrage verweigert
- **DANN** werden betroffene Cache-Einträge und Zeilenaktionen aus der Ansicht entfernt
- **UND** eine verspätete Antwort aus dem früheren Kontext darf keine Zeilen wiederherstellen
- **UND** nur der aktuelle bestätigte und serverseitig zugelassene Kontext kann neue Ergebnisse bereitstellen

#### Scenario: Eine Hintergrundaktualisierung scheitert vorübergehend

- **WENN** eine aktuelle Tabellenansicht bereits ein zulässiges Ergebnis zeigt und die Hintergrundaktualisierung vorübergehend scheitert
- **DANN** bleiben die bisherigen Zeilen sichtbar
- **UND** die Ansicht bietet verständliches Feedback und eine Möglichkeit zum erneuten Abruf

#### Scenario: Eine Mutation ändert ein Tabellenergebnis

- **WENN** eine Änderung oder Löschung die Ergebnisse einer Tabelle betrifft
- **DANN** werden die betroffenen Abfragen nach erfolgreicher Mutation aktualisiert oder invalidiert
- **UND** gelöschte oder inzwischen unzugängliche Zeilen erscheinen beim Zurückwechseln nicht erneut aus dem Cache
