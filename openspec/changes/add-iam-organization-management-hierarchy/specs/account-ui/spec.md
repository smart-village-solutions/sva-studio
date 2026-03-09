## ADDED Requirements
### Requirement: Organisations-Verwaltungsseite

Das System MUST eine Organisations-Verwaltungsseite unter `/admin/organizations` bereitstellen, auf der berechtigte Administratoren Organisationen instanzgebunden pflegen können.

#### Scenario: Organisationsliste laden

- **WENN** ein Administrator `/admin/organizations` aufruft
- **DANN** wird eine Liste oder Tabelle der Organisationen der aktiven Instanz angezeigt
- **UND** die Oberfläche zeigt Name, Parent, Anzahl untergeordneter Organisationen und Anzahl zugeordneter Accounts
- **UND** ein Loading-State wird angezeigt, bis die Daten geladen sind

#### Scenario: Organisation suchen und filtern

- **WENN** ein Administrator einen Suchbegriff oder Filter setzt
- **DANN** werden die sichtbaren Organisationen nach Name, Key oder Status gefiltert
- **UND** die Trefferzahl wird über eine `aria-live="polite"`-Region aktualisiert

#### Scenario: Organisationen nach Typ filtern

- **WENN** ein Administrator einen Typfilter wie `municipality`, `district` oder einen äquivalenten unterstützten Organisationstyp setzt
- **DANN** werden nur Organisationen des gewählten Typs angezeigt
- **UND** die aktive Filterung bleibt in der Oberfläche eindeutig erkennbar

### Requirement: Organisation anlegen und bearbeiten

Das System MUST Administratoren eine einfache UI zum Anlegen und Bearbeiten von Organisationen bereitstellen.

#### Scenario: Organisation anlegen

- **WENN** ein Administrator auf „Organisation anlegen" klickt
- **DANN** öffnet sich ein Formular-Dialog oder eine Detailansicht mit mindestens Name, Key, Typ und Parent-Auswahl
- **UND** bei erfolgreichem Speichern erscheint die neue Organisation direkt in der Liste

#### Scenario: Parent-Validierungsfehler anzeigen

- **WENN** ein Administrator eine ungültige Parent-Zuordnung speichert
- **DANN** zeigt die Oberfläche eine verständliche Fehlermeldung an
- **UND** das Formular bleibt geöffnet, damit die Eingabe korrigiert werden kann

#### Scenario: Organisationspolicy bearbeiten

- **WENN** ein Administrator in der Organisationsbearbeitung eine Basispolicy wie `content_author_policy` ändert
- **DANN** zeigt die Oberfläche ein dafür vorgesehenes Eingabeelement mit verständlicher Beschreibung
- **UND** die Änderung wird nach erfolgreichem Speichern im Detailbereich sichtbar

### Requirement: Organisationszuordnungen für Accounts verwalten

Das System MUST in der Organisationsverwaltung die Zuordnung von Accounts zu Organisationen unterstützen.

#### Scenario: Account einer Organisation zuordnen

- **WENN** ein Administrator in der Organisationsdetailansicht einen Account auswählt und zuordnet
- **DANN** wird die Zuordnung gespeichert
- **UND** die Mitgliederliste der Organisation aktualisiert sich ohne vollständigen Seitenwechsel

#### Scenario: Account-Zuordnung entfernen

- **WENN** ein Administrator eine bestehende Organisationszuordnung entfernt
- **DANN** wird die Zuordnung nach Bestätigung gelöscht
- **UND** die UI zeigt den aktualisierten Stand der Organisation an

#### Scenario: Default-Kontext einer Mitgliedschaft setzen

- **WENN** ein Administrator für einen Account innerhalb der Organisationszuordnungen einen Default-Kontext setzt
- **DANN** visualisiert die Oberfläche eindeutig, welche Zuordnung aktuell als Default gilt
- **UND** konkurrierende Default-Markierungen werden verhindert oder vor dem Speichern aufgelöst

#### Scenario: Mitgliedschaft als intern oder extern kennzeichnen

- **WENN** ein Administrator eine Organisationszuordnung erstellt oder bearbeitet
- **DANN** kann er die Zuordnung als intern oder extern kennzeichnen
- **UND** die Kennzeichnung ist in der Mitgliederliste sichtbar

### Requirement: Org-Kontextwechsel für Multi-Org-Accounts

Das System MUST Benutzern mit mehreren Organisationszuordnungen eine kleine, zugängliche UI zum Wechsel des aktiven Organisationskontexts bereitstellen.

#### Scenario: Org-Kontextwechsel anzeigen

- **WENN** ein authentifizierter Benutzer mehreren Organisationen derselben Instanz zugeordnet ist
- **DANN** zeigt die Oberfläche einen Org-Switcher mit den verfügbaren Organisationen an
- **UND** der aktuell aktive Organisationskontext ist eindeutig markiert

#### Scenario: Org-Kontext erfolgreich wechseln

- **WENN** ein Benutzer im Org-Switcher eine andere zulässige Organisation auswählt
- **DANN** wird der aktive Organisationskontext über den vorgesehenen IAM-Contract aktualisiert
- **UND** die Oberfläche aktualisiert kontextabhängige Daten ohne inkonsistenten Zwischenzustand

#### Scenario: Deaktivierte Organisation wird im Org-Switcher nicht als aktive Zieloption angeboten

- **WENN** eine einem Benutzer zugeordnete Organisation deaktiviert ist
- **DANN** wird sie nicht als regulär auswählbare aktive Zieloption angeboten
- **UND** die Oberfläche verhindert einen inkonsistenten Wechsel in einen deaktivierten Kontext

#### Scenario: Org-Kontextwechsel per Tastatur

- **WENN** ein Benutzer den Org-Switcher ausschließlich per Tastatur bedient
- **DANN** ist der Wechsel vollständig ohne Maus möglich
- **UND** Statusänderungen werden für assistive Technologien verständlich angekündigt

#### Scenario: Org-Kontextwechsel schlägt fehl

- **WENN** der Wechsel des Organisationskontexts serverseitig abgewiesen oder technisch unterbrochen wird
- **DANN** zeigt die Oberfläche eine verständliche, internationalisierte Fehlermeldung an
- **UND** der zuvor aktive Organisationskontext bleibt in der UI konsistent sichtbar

### Requirement: Accessibility und i18n für Organisations-UI

Das System MUST die Organisationsverwaltung vollständig internationalisiert und tastaturbedienbar bereitstellen.

#### Scenario: Organisationsverwaltung wird per Tastatur bedient

- **WENN** ein Administrator die Organisationsverwaltung ohne Maus nutzt
- **DANN** sind Liste, Filter, Dialoge und Zuordnungsaktionen vollständig per Tastatur erreichbar
- **UND** Fokusführung, Dialog-Beschriftung und Statusmeldungen entsprechen den bestehenden Accessibility-Mustern

#### Scenario: Keine hardcodierten UI-Texte in Organisations-Views

- **WENN** die Organisationsverwaltung gerendert wird
- **DANN** stammen alle sichtbaren Texte aus i18n-Keys
- **UND** die Komponenten enthalten keine hardcodierten Nutzertexte

### Requirement: Responsives Organisations-UI

Das System MUST die Organisationsverwaltung und den Org-Switcher auf den definierten Projekt-Breakpoints funktionsfähig halten.

#### Scenario: Organisationsverwaltung auf 320 px

- **WENN** die Organisationsverwaltung auf einem 320-px-Viewport genutzt wird
- **DANN** bleiben Liste, Filter, Detaildialoge und Mitgliedschaftsaktionen ohne horizontalen Pflicht-Scroll für Kernaktionen bedienbar
- **UND** der Org-Switcher bleibt erreichbar und verständlich beschriftet

#### Scenario: Organisationsverwaltung auf 768 px und 1024 px

- **WENN** die Organisationsverwaltung auf 768 px oder 1024 px dargestellt wird
- **DANN** bleiben Hierarchieinformationen, Typfilter und Zuordnungsaktionen vollständig nutzbar
- **UND** Layoutwechsel führen nicht zu Fokusverlust oder unzugänglichen Aktionen
