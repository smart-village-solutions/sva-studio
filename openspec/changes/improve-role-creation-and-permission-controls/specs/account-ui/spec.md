## MODIFIED Requirements

### Requirement: Rollen-Verwaltungsseite

Das System MUST eine Rollen-Verwaltungsseite unter `/admin/roles` bereitstellen, die das Anzeigen und Bearbeiten von System- und Custom-Rollen ermöglicht, technische Kompatibilitätsfelder aus dem normalen Bedienfluss heraushält und nur fachlich geänderte Teilflächen speicherbar macht.

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
- **DANN** sind mindestens Anzeigename, Beschreibung, `externalRoleName`, `managedBy`, Sync-Zustand und Mitgliederzahl sichtbar, soweit das jeweilige Rollenmodell diese Werte führt
- **UND** das interne Kompatibilitätsfeld `roleLevel` wird in Rollenliste, Rollenanlage und normaler Rollenbearbeitung weder angezeigt noch bearbeitet
- **UND** System-Rollen und extern verwaltete Rollen sind als read-only kenntlich
- **UND** destruktive oder fachlich nicht zulässige Aktionen sind nicht nur deaktiviert, sondern auch verständlich begründet

#### Scenario: Administrator legt eine Rolle ohne technische Doppeleingabe an

- **WENN** ein Administrator einen gültigen Anzeigenamen und optional eine Beschreibung für eine Custom-Rolle eingibt
- **DANN** verlangt die UI weder einen technischen Rollenschlüssel noch ein `roleLevel`
- **UND** sendet sie den Anzeigenamen als fachlich führenden Namen an den serverseitigen Create-Vertrag
- **UND** zeigt sie den erzeugten technischen Schlüssel nach erfolgreicher Anlage nur als nicht bearbeitbare Zusatzinformation unter „Technische Details“

#### Scenario: Rollenrechte werden fachlich lesbarer dargestellt

- **WENN** ein Administrator die Rechte einer Rolle öffnet
- **DANN** priorisiert die UI lokalisierte fachliche Bezeichnungen, Gruppierungen und Beschreibungen der Rechte
- **UND** erklärt sie die Scopes `own`, `organization` und `all` in fachlich verständlichen Begriffen
- **UND** technische Werte wie `permissionKey` bleiben höchstens ergänzende, einklappbare Detailinformation
- **UND** die Oberfläche zwingt Administratoren nicht zur Interpretation roher technischer Schlüssel

#### Scenario: Veröffentlichungs- und Sichtbarkeitsrechte bleiben unterscheidbar

- **WENN** die Rechte `content.publish` und `content.changeStatus` in einer Rolle verfügbar sind
- **DANN** zeigt die UI sie als getrennte positive Rechte „Veröffentlichen“ und „Sichtbarkeitsstatus ändern“
- **UND** erklärt sie deren unterschiedliche fachliche Wirkung
- **UND** leitet sie aus einer Auswahl keine weitergehende Permission ab

#### Scenario: Unveränderte allgemeine Rollendaten sind nicht speicherbar

- **WENN** der normalisierte Entwurf der allgemeinen Rollendaten dem zuletzt bestätigten Serverzustand entspricht
- **DANN** ist die zugehörige Speicheraktion deaktiviert
- **UND** wird sie erst nach einer fachlichen Änderung aktiviert
- **UND** kehrt sie nach erfolgreichem Speichern und Aktualisieren der Vergleichsbasis in den deaktivierten Zustand zurück

#### Scenario: Unveränderte Rollenrechte sind nicht speicherbar

- **WENN** Permission-IDs und Assignment-Scopes fachlich dem zuletzt bestätigten Serverzustand entsprechen
- **DANN** sind beide Positionen der wiederholten Speicheraktion deaktiviert
- **UND** reine Reihenfolgeunterschiede gelten nicht als Änderung
- **UND** bleiben beide Positionen an denselben Dirty-, Saving-, Saved-, Fehler- und Disabled-Zustand gebunden

#### Scenario: Fehlgeschlagene Rollenspeicherung bleibt wiederholbar

- **WENN** eine Speicherung geänderter Rollenmetadaten oder Rollenrechte fehlschlägt
- **DANN** bleibt der Entwurf als geändert erhalten
- **UND** kehrt die Speicheraktion aus dem Saving-Zustand in einen erneut ausführbaren Zustand zurück
- **UND** wird der Fehler gemäß dem gemeinsamen Save-Feedback-Vertrag persistent und verständlich angezeigt

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

### Requirement: Vertiefte IAM-Metadaten in bestehenden Admin-Ansichten

Das System MUST heute verdeckte IAM-Metadaten in den bestehenden Benutzer-, Rollen-, Organisations- und Kontextansichten sichtbar machen, soweit dies fachlich sinnvoll und sicher ist. Interne Kompatibilitätsfelder ohne notwendige Bedienwirkung MUST dabei aus normalen Fachansichten herausgehalten werden.

#### Scenario: Benutzerdetail zeigt Profil- und Rollenmetadaten

- **WENN** ein Administrator `/admin/users/:userId` öffnet
- **DANN** wird ein vorhandener Avatar verwendet, andernfalls ein Platzhalter
- **UND** Rollen-Gültigkeitsfenster und andere zuweisungsbezogene Metadaten sind sichtbar
- **UND** die Historie zeigt echte IAM-Aktivitäten statt eines statischen Empty-States, sofern Daten vorhanden sind

#### Scenario: Rollenansicht zeigt externe Abbildung und Sync-Interna

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** sind pro Rolle neben Anzeigename und Beschreibung auch `externalRoleName`, `managedBy` sowie relevante Sync-Informationen sichtbar
- **UND** wird das interne Kompatibilitätsfeld `roleLevel` nicht als fachlich zu pflegende Rollenmetadaten dargestellt
- **UND** Fehlerzustände des Rollen-Syncs sind in der UI nachvollziehbar

#### Scenario: Organisationsansicht zeigt Hierarchie- und Membership-Details

- **WENN** ein Administrator `/admin/organizations` oder den Membership-Dialog öffnet
- **DANN** sind Hierarchiepfad, Kindorganisationen, Metadata sowie Membership-Zeitpunkte sichtbar
- **UND** Default-Kontext und Sichtbarkeit einer Membership bleiben klar erkennbar

#### Scenario: Organisationskontext-Switcher zeigt mehr als nur den Anzeigenamen

- **WENN** ein Benutzer mehrere Organisationskontexte zur Auswahl hat
- **DANN** zeigt der globale Kontext-Switcher zusätzliche Kontextinformationen wie Organisationstyp, Schlüssel oder Standardkontext-Markierung
- **UND** die Shell bleibt dabei kompakt und responsiv
