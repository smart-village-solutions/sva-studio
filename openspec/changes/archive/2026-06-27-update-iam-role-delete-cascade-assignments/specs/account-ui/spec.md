## MODIFIED Requirements

### Requirement: Rollen-Verwaltungsseite

Das System MUST eine Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von System- und Custom-Rollen ermöglicht.

#### Scenario: Rollenansicht bleibt der zentrale Einstieg für Rechtepflege

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** bleibt die Rollenliste mit Suche, Sortierung, Rollenmetadaten und Aktionen der primäre Einstiegspunkt
- **UND** Rollenrechte werden innerhalb derselben Seite oder desselben Bedienflusses vertieft statt in ein separates Top-Level-Modul ausgelagert
- **UND** die bestehende Expand-, Detail- oder gleichwertige Arbeitsbereichslogik bleibt mit vorhandenen Admin-Patterns konsistent

#### Scenario: Detailroute bleibt Teil desselben Rollenverwaltungsflusses

- **WENN** eine Rolle aus der Rollenliste in einen vertieften Arbeitsbereich geöffnet wird
- **DANN** ist eine dedizierte Detailroute wie `/admin/roles/$roleId` zulässig, sofern sie Teil desselben Rollenverwaltungsflusses bleibt
- **UND** die Rollenliste weiterhin der primäre Einstiegspunkt ist
- **UND** kein separates Top-Level-Admin-Modul für Rechtepflege entsteht

#### Scenario: Rollenmetadaten und Editierbarkeit sind eindeutig sichtbar

- **WENN** eine Rolle in der Rollenansicht dargestellt wird
- **DANN** sind mindestens `externalRoleName`, `managedBy`, `roleLevel`, Sync-Zustand und Mitgliederzahl sichtbar
- **UND** System-Rollen und extern verwaltete Rollen sind als read-only kenntlich
- **UND** destruktive oder fachlich nicht zulässige Aktionen sind nicht nur deaktiviert, sondern auch verständlich begründet

#### Scenario: Rollenrechte werden fachlich lesbarer dargestellt

- **WENN** ein Administrator die Rechte einer Rolle öffnet
- **DANN** priorisiert die UI fachliche Bezeichnungen, Gruppierungen oder Beschreibungen der Rechte
- **UND** technische Werte wie `permissionKey` bleiben höchstens ergänzende Detailinformation
- **UND** die Oberfläche zwingt Administratoren nicht zur ausschließlichen Interpretation roher technischer Schlüssel

#### Scenario: Rollenansicht verzahnt sich mit bestehender IAM-Prüfung

- **WENN** ein Administrator aus einer Rolle heraus eine Rechteentscheidung nachvollziehen möchte
- **DANN** bietet die Rollenansicht einen klaren Einstieg in die bestehende IAM-Rechteübersicht oder Szenario-Prüfung
- **UND** es wird kein davon losgelöster zweiter Prüfworkflow mit abweichender Logik eingeführt

#### Scenario: Cockpit-Einstieg genügt für die erste Ausbaustufe

- **WENN** die Rollenverwaltung eine bestehende IAM-Prüffunktion integriert
- **DANN** genügt ein klarer Einstieg in das bestehende IAM-Cockpit oder eine gleichwertige Transparenzfunktion
- **UND** fehlende eingebettete Prüfformen machen die Rollenverwaltung in dieser Ausbaustufe nicht unvollständig

#### Scenario: Bestätigtes Löschen weist auf Kaskadeneffekt hin

- **WENN** ein Administrator eine löschbare Custom-Rolle aus der Rollenliste löschen möchte
- **DANN** erklärt der Bestätigungsdialog vor dem Absenden, dass bestehende Benutzer- und Gruppenzuordnungen der Rolle ebenfalls entfernt werden
- **UND** der Administrator kann den Löschvorgang an dieser Stelle noch abbrechen
