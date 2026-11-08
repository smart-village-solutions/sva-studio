## ADDED Requirements

### Requirement: Instanzgebundener Anwendungsarbeitsplatz

Das System SHALL das optionale Plugin `application-workspace` anbieten. Bei wirksamer Aktivierung SHALL jeder angemeldete Benutzer der betreffenden Instanz die Übersicht unter `/plugins/application-workspace` lesen dürfen, auch ohne Fachrolle oder individuell vergebenes Leserecht. Route und Lesehandler MUST Anmeldung, verifizierten Instanzkontext und aktuelle Modulaktivierung unabhängig prüfen.

#### Scenario: Angemeldeter Benutzer ohne Fachrolle

- **GIVEN** das Plugin ist für die aktuelle Instanz wirksam aktiv
- **WHEN** ein angemeldeter Benutzer ohne Fachrolle die Übersicht aufruft
- **THEN** erhält er die Kacheln seiner Instanz
- **AND** benötigt er kein Einstellungsrecht

#### Scenario: Fehlender oder unzulässiger Kontext

- **WHEN** ein anonymer Benutzer, ein Plattformbenutzer ohne Instanzkontext oder ein Benutzer einer Instanz ohne aktive Modulzuweisung die Route oder den Lesehandler direkt aufruft
- **THEN** gibt das System keine kommunale Kachelkonfiguration frei

### Requirement: Feste Studio-Kachel und konfigurierbare Anwendungen

Die Übersicht SHALL die unveränderliche SVA-Studio-Kachel mit Studio-Icon, lokalisiertem Beschreibungstext und CtA sowie dem internen Ziel `/` immer zuerst anzeigen. Weitere Kacheln SHALL eine stabile Kennung, eine über die gemeinsame Design-System-Komponente ausgewählte Tabler-Iconkennung, eine absolute HTTPS-Ziel-URL ohne eingebettete Zugangsdaten, lokalisierte Namen, Beschreibungen und CtA-Texte sowie eine pflegbare Reihenfolge besitzen. Das System MUST Eingaben client- und serverseitig validieren und Texte als Text rendern.

#### Scenario: Erste Aktivierung ohne zusätzliche Kacheln

- **WHEN** die aktivierte Instanz noch keine zusätzlichen Anwendungen konfiguriert hat
- **THEN** zeigt die Übersicht die Studio-Kachel als ersten und einzigen Eintrag
- **AND** führt deren CtA im selben Tab zurück nach `/`

#### Scenario: Manipulation der Studio-Kachel

- **WHEN** eine Mutation die feste Studio-Kachel löschen, verschieben oder ihr Ziel ändern soll
- **THEN** weist der Server die Mutation zurück
- **AND** bleibt die Studio-Kachel unverändert an erster Stelle

#### Scenario: Externe Anwendung öffnen

- **WHEN** ein Benutzer den Link einer konfigurierten Kachel aktiviert
- **THEN** öffnet der Browser die gespeicherte HTTPS-Adresse in einem neuen Tab mit `noopener noreferrer`
- **AND** ist der neue Tab vorab zugänglich und lokalisiert angekündigt
- **AND** werden keine Studio-Tokens oder Zugangsdaten angehängt

#### Scenario: Ungültige URL oder Icon

- **WHEN** eine Kachel mit einem ausführbaren URL-Schema, eingebetteten URL-Zugangsdaten oder einem frei übermittelten SVG/HTML-Icon gespeichert werden soll
- **THEN** lehnen Client und Server die Eingabe mit verständlichem Fehler ab
- **AND** bleibt die gespeicherte Konfiguration unverändert

#### Scenario: Gespeichertes Icon ist nicht mehr verfügbar

- **WHEN** eine gespeicherte Iconkennung nicht mehr zum unterstützten Tabler-Katalog gehört
- **THEN** zeigt die Übersicht ein sicheres Standardsymbol bei unverändertem Text und Ziel

### Requirement: Mehrsprachige Kachelinhalte

Das Plugin SHALL Name, Beschreibung und CtA-Text je Kachel für alle zentral unterstützten Studio-Sprachen pflegbar machen. Deutsch MUST für alle drei Felder befüllt sein. Fehlende, leere oder nur aus Leerraum bestehende Übersetzungen SHALL je Feld auf Deutsch zurückfallen. Feste UI-Texte MUST den bestehenden Übersetzungspfad nutzen und initial Deutsch und Englisch abdecken.

#### Scenario: Teilweise englische Übersetzung

- **GIVEN** Name und CtA sind auf Englisch gepflegt, die Beschreibung fehlt
- **WHEN** ein Benutzer Englisch auswählt
- **THEN** erscheinen Name und CtA auf Englisch sowie die Beschreibung auf Deutsch
- **AND** bleiben alle gespeicherten Sprachwerte unverändert

#### Scenario: Fehlender deutscher Pflichttext

- **WHEN** eine Kachel ohne deutschen Namen, Beschreibung oder CtA-Text gespeichert werden soll
- **THEN** schlägt die Validierung feldbezogen fehl
- **AND** wird kein unvollständiger Datensatz veröffentlicht

#### Scenario: Unterstützte weitere Studio-Sprache

- **WHEN** der zentrale Studio-Sprachkatalog eine weitere Sprache bereitstellt
- **THEN** kann dieselbe Kachelverwaltung deren Texte ohne parallelen Sprachkatalog pflegen
- **AND** gilt bei fehlenden Werten derselbe deutsche Fallback

### Requirement: Berechtigte und instanzisolierte Konfigurationsverwaltung

Das System SHALL den Einstellungsarbeitsplatz mit `application-workspace.settings.read` und Änderungen zusätzlich mit `application-workspace.settings.update` schützen. Beide Rechte MUST den bestehenden Module-IAM-Vertrag verwenden. Wirksame Pluginaktivierung und verifizierter Instanzkontext MUST bei jedem Zugriff geprüft werden. Konfiguration SHALL instanzweit gelten, unabhängig vom aktiven Organisationskontext. Änderungen MUST über den bestehenden Auditpfad nachweisbar sein.

#### Scenario: Berechtigter Editor verwaltet Kacheln

- **GIVEN** das Plugin ist aktiv und der Benutzer besitzt beide Einstellungsrechte
- **WHEN** er eine Kachel hinzufügt, bearbeitet, verschiebt oder nach Bestätigung löscht
- **THEN** speichert das System die Änderung ausschließlich für die verifizierte Instanz
- **AND** zeigt ein unabhängiger erneuter Lesezugriff den gespeicherten Stand
- **AND** entsteht der zugehörige Auditnachweis

#### Scenario: Direkte Mutation ohne ausreichende Rechte

- **WHEN** ein Benutzer ohne beide Einstellungsrechte oder nach Rechteentzug eine Mutation direkt aufruft
- **THEN** verweigert der Server die Änderung
- **AND** wird kein erfolgreicher Schreibzustand gemeldet

#### Scenario: Fremde Instanz- oder Kachelkennung

- **WHEN** eine Anfrage eine Instanz- oder Kachelkennung eines anderen Mandanten übermittelt
- **THEN** gewährt dies weder Lese- noch Schreibzugriff auf dessen Konfiguration

### Requirement: Dauerhafte und konfliktgeprüfte Speicherung

Das System SHALL Konfiguration und Reihenfolge dauerhaft und atomar über bestehende Studio-Persistenz speichern. Veraltete Speicherstände MUST als Versionskonflikt abgelehnt werden. Fehler MUST Eingaben erhalten und einen erneuten Versuch ermöglichen, ohne falschen Erfolg zu melden. Kontextwechsel MUST alte Antworten verwerfen; Deaktivierung MUST Zugriff entziehen, ohne Konfiguration zu löschen.

#### Scenario: Zwei Editoren speichern denselben Ausgangsstand

- **GIVEN** ein Editor hat die Konfiguration seit dem Laden eines zweiten Editors geändert
- **WHEN** der zweite Editor seinen veralteten Stand speichert
- **THEN** erhält er eine verständliche Konfliktmeldung
- **AND** bleibt der erste gespeicherte Stand erhalten

#### Scenario: Technischer Lade- oder Speicherfehler

- **WHEN** die Persistenz nicht erreichbar ist
- **THEN** zeigt die Oberfläche einen wiederholbaren Fehler statt einer erfolgreichen leeren Konfiguration oder Speicherbestätigung
- **AND** bleiben vorhandene Eingaben erhalten

#### Scenario: Instanzwechsel während einer Anfrage

- **WHEN** der Kontext wechselt, bevor eine alte Anfrage abgeschlossen ist
- **THEN** erscheint deren Antwort nicht in der neuen Instanzansicht

#### Scenario: Deaktivierung und Reaktivierung

- **WHEN** das Plugin deaktiviert und später für dieselbe Instanz reaktiviert wird
- **THEN** sind Einstieg, Route und Handler während der Deaktivierung gesperrt
- **AND** ist nach Reaktivierung die zuvor gespeicherte Konfiguration wieder verfügbar

### Requirement: Zielanwendungen behalten Anmeldung und Autorisierung

Der Arbeitsplatz MUST reguläre Anwendungslinks ohne Tokenweitergabe, gemeinsame Cookie-Manipulation, serverseitige Zielabfragen oder automatische Kontoanlage verwenden. Eine sichtbare Kachel MUST keine Rechte in einer Zielanwendung erteilen. Das System SHALL SSO ausschließlich als Eigenschaft einer separat eingerichteten Anbindung der Zielanwendung an einen gemeinsamen Identity Provider beschreiben und keinen universellen angemeldeten Zustand versprechen.

#### Scenario: Zielanwendung verlangt Anmeldung oder verweigert Zugriff

- **WHEN** die Zielanwendung wegen fehlender Sitzung, MFA oder fehlender Rechte eine Anmeldung oder Ablehnung zeigt
- **THEN** bleiben deren Sicherheitsregeln wirksam
- **AND** versucht das Plugin keine Umgehung durch Studio-Zugangsdaten
