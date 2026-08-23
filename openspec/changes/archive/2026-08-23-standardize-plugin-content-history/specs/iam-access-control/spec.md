## ADDED Requirements

### Requirement: Plugin-Historien verwenden einheitlich content.readHistory

Das System MUST jeden Lesezugriff auf die Historie eines Plugin-Inhalts mit `content.readHistory` im aktiven Instanz-, Content-Typ-, Inhalts- und Ownership-Scope autorisieren. Plugin-eigene Berechtigungen dürfen diese Prüfung ergänzen, aber nicht ersetzen oder abschwächen.

#### Scenario: Berechtigter Benutzer liest Plugin-Historie

- **WENN** ein Benutzer `content.readHistory` im aufgelösten Scope des Inhalts besitzt
- **DANN** darf der Host die für diesen Inhalt sichtbaren Historieneinträge ausgeben
- **UND** die Antwort enthält keine Einträge einer anderen Instanz oder eines nicht erlaubten Ownership-Scopes

#### Scenario: Benutzer besitzt nur Content-Leserecht

- **WENN** ein Benutzer den Inhalt lesen darf, aber `content.readHistory` im aufgelösten Scope nicht besitzt
- **DANN** verweigert der Host den History-Read fail-closed
- **UND** das Plugin zeigt keine zuvor geladenen oder anderweitig beschafften Historieneinträge

#### Scenario: Fachhistorie verwendet zusätzliche Berechtigung

- **WENN** eine fachliche Plugin-Historie wie Waste Management eine zusätzliche modulbezogene Berechtigung verlangt
- **DANN** prüft der Host sowohl den fachlichen Vertrag als auch die verbindliche Instanz- und Datensatzisolation
- **UND** keine pluginlokale Prüfung ersetzt die zentrale Autorisierungsentscheidung
