# Delta: account-ui

## MODIFIED Requirements

### Requirement: Vertiefte IAM-Metadaten in bestehenden Admin-Ansichten

Das System MUST heute verdeckte IAM-Metadaten in den bestehenden Benutzer-, Rollen-, Organisations- und Kontextansichten sichtbar machen, soweit dies fachlich sinnvoll und sicher ist. Rollenansichten werden dafür von einer reinen Tabellenansicht zu einem Arbeitsbereich für Metadaten, Berechtigungen, Zuweisungen und Rechtevorschau erweitert.

#### Scenario: Benutzerdetail zeigt Profil- und Rollenmetadaten

- **WENN** ein Administrator `/admin/users/:userId` öffnet
- **DANN** wird ein vorhandener Avatar verwendet, andernfalls ein Platzhalter
- **UND** Rollen-Gültigkeitsfenster und andere zuweisungsbezogene Metadaten sind sichtbar
- **UND** die Historie zeigt echte IAM-Aktivitäten statt eines statischen Empty-States, sofern Daten vorhanden sind

#### Scenario: Rollenansicht zeigt externe Abbildung und Sync-Interna

- **WENN** ein Administrator `/admin/roles` öffnet
- **DANN** sind pro Rolle neben Name und Beschreibung auch `externalRoleName`, `managedBy`, `roleLevel` sowie relevante Sync-Informationen sichtbar
- **UND** Fehlerzustände des Rollen-Syncs sind in der UI nachvollziehbar

#### Scenario: Organisationsansicht zeigt Hierarchie- und Membership-Details

- **WENN** ein Administrator `/admin/organizations` oder den Membership-Dialog öffnet
- **DANN** sind Hierarchiepfad, Kindorganisationen, Metadata sowie Membership-Zeitpunkte sichtbar
- **UND** Default-Kontext und Sichtbarkeit einer Membership bleiben klar erkennbar

#### Scenario: Organisationskontext-Switcher zeigt mehr als nur den Anzeigenamen

- **WENN** ein Benutzer mehrere Organisationskontexte zur Auswahl hat
- **DANN** zeigt der globale Kontext-Switcher zusätzliche Kontextinformationen wie Organisationstyp, Schlüssel oder Standardkontext-Markierung
- **UND** die Shell bleibt dabei kompakt und responsiv

#### Scenario: Rollenarbeitsbereich bündelt Kernaufgaben

- **WENN** ein Administrator eine Rolle in `/admin/roles` auswählt
- **DANN** erhält er einen strukturierten Arbeitsbereich mit mindestens den Tabs `Allgemein`, `Berechtigungen`, `Zuweisungen` und `Vorschau`
- **UND** die Oberfläche bleibt mit bestehenden Admin-Patterns wie Card-, Table-, Dialog- und Tab-Strukturen konsistent
- **UND** neue Komponenten basieren auf `shadcn/ui`

## ADDED Requirements

### Requirement: Fachliche Rechteverwaltung pro Rolle

Das System MUST in der Rollenverwaltung eine fachlich lesbare Oberfläche bereitstellen, mit der Berechtigungen pro Rolle nach Ressource, Aktion und Scope verwaltet werden können.

#### Scenario: Rechte-Matrix für Kernaktionen

- **WENN** ein Administrator den Tab `Berechtigungen` einer Rolle öffnet
- **DANN** sieht er eine Rechte-Matrix mit mindestens den Aktionen `Lesen`, `Erstellen`, `Bearbeiten`, `Löschen` und `Exportieren`
- **UND** `Exportieren` ist als eigenständiges Recht pro Ressource dargestellt
- **UND** die Darstellung verwendet fachliche Ressourcennamen statt technischer Permission-Keys als primäre UI-Sprache

#### Scenario: Scope-Dimensionen sind explizit filterbar und bearbeitbar

- **WENN** ein Administrator Rechte für eine Rolle bearbeitet
- **DANN** kann er die Geltung mindestens über `Module`, `Datentypen`, `räumliche Kategorien`, `inhaltliche Kategorien`, `Organisationen` und `Instanzen` eingrenzen
- **UND** Standardfälle bleiben ohne Aufklappen verständlich
- **UND** weiterführende Scopes werden progressiv offengelegt statt ungefiltert als Vollformular dargestellt

#### Scenario: Erste Version nutzt eine feste Initial-Taxonomie

- **WENN** die erste Version der Rechteverwaltung konfiguriert oder gerendert wird
- **DANN** stehen als Module mindestens `content`, `iam`, `interfaces`, `legal` und `organizations` zur Verfügung
- **UND** Datentypen werden mindestens für Content-, IAM-, Legal-, Interfaces- und Organisationsobjekte entlang der im Design definierten Initial-Taxonomie angeboten
- **UND** die UI verwendet dafür lokalisierte Fachbegriffe konsistent in Filtern, Matrixzeilen, Dialogen und Vorschau statt rohe Contract-IDs

#### Scenario: Rechtepflege bleibt auf kleinen und mittleren Viewports nutzbar

- **WENN** der Berechtigungsarbeitsbereich auf 320 px, 768 px oder 1024 px genutzt wird
- **DANN** bleiben Rollenliste, Berechtigungseditor, Dialoge und Vorschau ohne Fokusverlust nutzbar
- **UND** Kernaktionen wie Speichern, Abbrechen und Kontextwechsel bleiben ohne unverständlichen Horizontal-Overflow erreichbar
- **UND** auf 320 px und 768 px wird statt einer dauerhaft voll ausgerollten Matrix ein alternatives Karten-, Akkordeon- oder gleichwertig lineares Interaktionsmuster verwendet

#### Scenario: Berechtigungsarbeitsbereich ist tastatur- und screenreader-tauglich

- **WENN** ein Administrator den Rollenarbeitsbereich ohne Maus nutzt
- **DANN** sind Tabs, Matrix, Scope-Bearbeitung, Dialoge und Änderungsreview vollständig per Tastatur erreichbar
- **UND** Fokus-Reihenfolge, Fokus-Rückgabe und Statusmeldungen sind semantisch nachvollziehbar
- **UND** deaktivierte oder ownership-blockierte Aktionen besitzen eine dauerhaft verfügbare textliche Begründung statt ausschließlich visueller Hinweise

### Requirement: Ownership-Regeln für Datensatzbesitz

Das System MUST in der Rollen- und Fach-UI ein verständliches Ownership-Modell für Datensatzbesitz bereitstellen, das Besitz als übertragbare Entscheidungshoheit über eigene Daten abbildet.

#### Scenario: Ownership wird getrennt von Standardrechten dargestellt

- **WENN** ein Administrator Besitzregeln für eine Rolle oder Ressource konfiguriert
- **DANN** erscheinen Ownership-Regeln in einer eigenen Sektion getrennt von CRUD- und Exportrechten
- **UND** die UI erklärt verständlich, dass Ownership bestimmt, was mit "eigenen" Daten passieren darf

#### Scenario: Besitz kann übertragen werden

- **WENN** ein Administrator oder berechtigter Fachnutzer den Besitz eines Datensatzes ändern darf
- **DANN** bietet die UI einen geführten Transfer-Dialog oder eine gleichwertige Interaktion zur Besitzübertragung
- **UND** die Übertragung zeigt bisherigen und zukünftigen Besitzer innerhalb des zulässigen Instanz- und Organisationskontexts eindeutig an
- **UND** der Vorgang ist nicht nur implizit über Rollenwechsel modelliert
- **UND** die Übertragung wird nach Bestätigung sofort wirksam

#### Scenario: Besitzübertragung erfordert einen überprüfbaren Bestätigungsschritt

- **WENN** ein Nutzer eine Besitzübertragung bestätigt
- **DANN** zeigt die UI vor der Bestätigung den alten und neuen Besitzer, die betroffene Ressource und die fachlichen Auswirkungen in einer Review-Zusammenfassung
- **UND** Validierungs- oder Konfliktfehler werden dem Nutzer eindeutig zugeordnet
- **UND** Erfolg oder Scheitern der Übertragung werden als verständliche Statusmeldung ausgegeben

#### Scenario: Ownership-Übersteuerung bleibt Administratoren vorbehalten

- **WENN** eine UI eine ownership-bedingt blockierte Aktion mit Override-Möglichkeit darstellt
- **DANN** wird die Übersteuerungsaktion nur Administratoren angeboten
- **UND** nicht-administrative Nutzer erhalten keinen gleichwertigen Override-Pfad

#### Scenario: Ownership beeinflusst Fachaktionen sichtbar

- **WENN** ein Nutzer eine Fachansicht für einen Datensatz mit aktiven Ownership-Regeln öffnet
- **DANN** zeigt die UI Aktionszustände wie erlaubt, deaktiviert oder ownership-blockiert verständlich an
- **UND** ein ownership-bedingter Block wird nicht nur als generischer Fehler nach dem Klick sichtbar

### Requirement: Rechtevorschau und Szenario-Prüfung

Das System MUST für Rollen und effektive Rechte eine verständliche Vorschau bereitstellen, damit Administratoren Auswirkungen vor einer Änderung einschätzen können.

#### Scenario: Vorschau einer Rolle ohne Rohdatenzwang

- **WENN** ein Administrator den Tab `Vorschau` einer Rolle öffnet
- **DANN** erhält er eine lesbare Zusammenfassung, was die Rolle kann und nicht kann
- **UND** die UI priorisiert fachliche Aussagen vor Rohstrukturen oder Debug-Daten

#### Scenario: Szenario-Prüfung für konkrete Entscheidungen

- **WENN** ein Administrator eine konkrete Aktion gegen Ressource und Scope testen möchte
- **DANN** kann er ein Prüfszenario mit Aktion, Ressource und relevanten Scope-Feldern ausführen
- **UND** die UI zeigt eine nachvollziehbare Entscheidung mit Begründung an
- **UND** Ownership- oder Scope-Konflikte werden als solche kenntlich gemacht

#### Scenario: Änderungen werden vor dem Speichern als Wirkungsdiff geprüft

- **WENN** ein Administrator geänderte Rollenrechte übernehmen möchte
- **DANN** zeigt die UI vor dem Speichern einen Änderungsreview mit neu hinzugekommenen und entfernten Rechten sowie betroffenen Zuweisungen
- **UND** Scope-Erweiterungen und Ownership-bezogene Risiken werden hervorgehoben

### Requirement: Rechtebewusste Fach-UI in priorisierten Modulen

Das System MUST in priorisierten Fachmodulen sichtbare und konsistente Aktionszustände für Rechte- und Ownership-Entscheidungen verwenden.

#### Scenario: Inhaltsmodul spiegelt Rollen- und Ownership-Logik

- **WENN** ein Nutzer Listen- oder Detailansichten für Inhalte verwendet
- **DANN** sind Aktionen wie Anlegen, Bearbeiten, Löschen und Exportieren an die wirksamen Rechte gebunden
- **UND** ownership-bedingte Einschränkungen werden inline erklärt
- **UND** die Oberfläche vermeidet unnötige Fehlversuche durch blind sichtbare, aber unzulässige Aktionen

#### Scenario: Zustände folgen einer konsistenten Zustandsmatrix

- **WENN** eine Aktion in einer Fach- oder Admin-UI nicht uneingeschränkt verfügbar ist
- **DANN** unterscheidet die UI nachvollziehbar zwischen `deaktiviert mit Begründung`, `verborgen bei fachlicher Irrelevanz` und `ownership-blockiert`
- **UND** dieselbe Zustandslogik wird in priorisierten Modulen konsistent angewendet
