# Delta: account-ui

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
- **DANN** ist ein klarer Link- oder Deep-Link-Einstieg in das bestehende IAM-Cockpit für die erste Ausbaustufe ausreichend
- **UND** eine eingebettete Szenario-Prüfung innerhalb der Rollenansicht ist optional
- **UND** fehlende Inline-Prüfmasken machen den Rollenarbeitsbereich in diesem Change nicht unvollständig

## ADDED Requirements

### Requirement: Inkrementeller Berechtigungsarbeitsbereich für Rollen

Das System MUST die bestehende Rollenverwaltung um einen inkrementellen Berechtigungsarbeitsbereich erweitern, der auf den vorhandenen Rollen- und Permission-Daten aufsetzt.

#### Scenario: Arbeitsbereich baut auf vorhandenem Rollenmodell auf

- **WENN** die Rechtepflege einer Rolle erweitert wird
- **DANN** verwendet die UI weiterhin die bestehenden Rollen-APIs, Rollenmetadaten und Permission-Zuordnungen als Grundlage
- **UND** die erste Version verlangt kein neues Ownership-, Transfer- oder Override-Modell
- **UND** die Umsetzung bleibt kompatibel zu den aktuellen Create/Edit/Delete- und Reconcile-Flows

#### Scenario: Fachliche und technische Sicht ergänzen sich

- **WENN** eine Rolle Berechtigungen mit technischen Referenzen enthält
- **DANN** kann die UI diese in eine fachlich lesbare Darstellung übersetzen oder gruppieren
- **UND** technische Referenzen bleiben für Debugging, Support oder Migration erreichbar
- **UND** sichtbare UI-Bezeichnungen werden lokalisiert statt aus technischen IDs direkt abgeleitet

#### Scenario: Read-only-Rollen bleiben sicher und nachvollziehbar

- **WENN** eine System-Rolle oder extern verwaltete Rolle geöffnet wird
- **DANN** bleiben Bearbeitungs- und Löschaktionen gesperrt
- **UND** der read-only-Zustand wird in Detail- und Berechtigungsdarstellungen konsistent fortgeführt
- **UND** die UI suggeriert keine Bearbeitbarkeit, die serverseitig nicht vorgesehen ist

#### Scenario: Serverseitiger Konflikt überschreibt optimistische Bearbeitbarkeit

- **WENN** eine Rolle in der UI zunächst bearbeitbar wirkt
- **UND** der Server die Änderung wegen zwischenzeitlicher Externverwaltung, Systemschutz oder Konfliktzustand verweigert
- **DANN** zeigt die Oberfläche einen verständlichen Fehler- oder Konflikthinweis statt eines generischen Fehlers
- **UND** der Rollenarbeitsbereich synchronisiert sich auf den serverseitig gültigen Zustand zurück
- **UND** irreführende Editierhinweise werden entfernt

#### Scenario: Rechtepflege bleibt responsiv und zugänglich

- **WENN** der Berechtigungsarbeitsbereich auf 320 px, 768 px oder 1024 px verwendet wird
- **DANN** bleiben Rollenliste, Detailbereich, Dialoge und Prüfeinstiege ohne unverständlichen Horizontal-Overflow nutzbar
- **UND** alle Interaktionen sind per Tastatur erreichbar
- **UND** Status, Fehlermeldungen und read-only-Hinweise sind für Screenreader semantisch verständlich

### Requirement: Rechtebewusste Fach-UI in priorisierten Modulen

Das System MUST in priorisierten Fachmodulen sichtbare und konsistente Zustände für erlaubte, deaktivierte und serverseitig verweigerte Aktionen verwenden.

#### Scenario: Inhaltsmodul vermeidet unverständliche Rechtefehler

- **WENN** ein Nutzer Listen- oder Detailansichten für Inhalte verwendet
- **DANN** sind Aktionen wie Anlegen oder Bearbeiten möglichst an die wirksamen Rechte gebunden
- **UND** serverseitige Verweigerungen werden verständlich dargestellt
- **UND** die Oberfläche reduziert blind sichtbare Aktionen ohne realistische Ausführbarkeit

#### Scenario: Zustände folgen einer konsistenten Zustandslogik

- **WENN** eine Aktion in einer Fach- oder Admin-UI nicht uneingeschränkt verfügbar ist
- **DANN** unterscheidet die UI nachvollziehbar mindestens zwischen `erlaubt`, `deaktiviert`, `read-only` und `serverseitig verweigert`
- **UND** die Zustandslogik wird in priorisierten Modulen konsistent angewendet

#### Scenario: Fehlende oder unvollständige Rechteinformationen führen nicht zu Scheinsicherheit

- **WENN** einer Fach- oder Admin-UI für eine Aktion keine belastbare Rechte- oder Diagnosedatenbasis vorliegt
- **DANN** zeigt die Oberfläche keine unbegründete Freigabe an
- **UND** sie verwendet einen defensiven Zustand mit verständlichem Hinweis statt technischer Rohdaten
- **UND** eine serverseitige Prüfung bleibt die maßgebliche Entscheidungsinstanz

### Requirement: Verifizierbare Rechteverwaltungs-UI

Das System MUST für den inkrementellen Rollenarbeitsbereich und die angrenzenden Fach-UI-Flächen eine umsetzungsnahe Verifikationsstrategie definieren.

#### Scenario: Unit- und Integrationsprüfungen decken Zustandslogik ab

- **WENN** die Rechteverwaltungs-UI umgesetzt oder geändert wird
- **DANN** decken Unit- oder Integrationstests mindestens fachliche Berechtigungsdarstellung, technische Detailumschaltung, Read-only-Zustände und serverseitige Verweigerungen ab
- **UND** die Tests prüfen lokalisierte UI-Texte statt hartcodierter Strings

#### Scenario: E2E- und Responsive-Prüfungen sichern den Bedienfluss ab

- **WENN** End-to-End-Prüfungen für `/admin/roles` oder priorisierte Fachseiten ausgeführt werden
- **DANN** verifizieren sie mindestens den Rollenarbeitsbereich, den Prüfeinstieg und die Zustände auf 320 px, 768 px und 1024 px
- **UND** sie prüfen, dass keine kritischen Bedienpfade durch Layout-Brüche oder unverständlichen Horizontal-Overflow unbenutzbar werden

#### Scenario: Accessibility- und i18n-Prüfungen sind Teil der Umsetzung

- **WENN** Komponenten oder Flows für die Rechteverwaltung geändert werden
- **DANN** umfassen die Verifikationsschritte Tastaturbedienung, Screenreader-Semantik, Statuskommunikation sowie die Prüfung, dass sichtbare UI-Bezeichnungen aus i18n-Keys stammen
- **UND** fehlende Übersetzungen oder verletzte Accessibility-Grundanforderungen gelten als Umsetzungsdefekte
