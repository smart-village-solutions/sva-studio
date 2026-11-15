## ADDED Requirements

### Requirement: Gemeinsamer App-Konfigurationsabgleich mit unverändertem Mainserver

Das System SHALL den JSON-Abgleich aller App-Konfigurationsplugins im bestehenden serverseitigen Package `@sva/sva-mainserver` bündeln. Der Mainserver MUST für diesen Lieferumfang unverändert bleiben. Der Integrationsweg MUST GraphQL bleiben; zusätzliche Admin-REST-/Session-Pfade und DB-Direktzugriffe sind ausgeschlossen. Das System MUST vor dem Schreiben frisch lesen, erkannte Konflikte feldbezogen behandeln, ausschließlich autorisierte eigene Änderungen auf den aktuellen Bestand anwenden und das Ergebnis unabhängig zurücklesen. Es MUST das akzeptierte Risiko externer Änderungen zwischen Lesen und Schreiben von einer atomaren Konfliktgarantie unterscheiden.

#### Scenario: Zwei Plugins ändern getrennte Felder

- **GIVEN** Allgemein und Design bearbeiten dieselbe `globalSettings`-Variante
- **WHEN** ihre Änderungen über den gemeinsamen Studio-Pfad gespeichert werden
- **THEN** bleiben beide Änderungen und fremde Felder erhalten
- **AND** verwenden beide denselben serverseitigen Abgleich statt eigener Writer

#### Scenario: Eigener Pfad wurde widersprüchlich geändert

- **WHEN** der Fresh Read eine widersprüchliche Änderung eines bearbeiteten Pfads oder seines Containers gegenüber der Bearbeitungsgrundlage zeigt
- **THEN** erfolgt kein Write bis zur bewussten Konfliktauflösung
- **AND** bleiben die eigenen Formularänderungen erhalten

#### Scenario: Externe Änderung nach dem Fresh Read

- **WHEN** ein externer Schreiber nach dem Fresh Read denselben Mainserver-Datensatz ändert
- **THEN** behauptet Studio keinen atomaren Schutz vor Überschreiben
- **AND** ersetzt weder eine Studio-Sperre noch ein Readback diese fehlende Garantie

### Requirement: Explizite und vollständige Variantenverwaltung

Das System SHALL berechtigten Redakteuren die Auswahl, Bearbeitung, Neuanlage und Löschung versionierter und unversionierter Dokumentvarianten ermöglichen. Namen, Kommune, Datentyp und ausgewählte Identität MUST ausdrücklich gebunden bleiben. Ein App-Fallback MUST NOT stillschweigend zur gewählten Variante oder zum Abwesenheitsbeweis werden. Neue Versionen MUST eine ausdrücklich gewählte bestehende Variante vollständig kopieren; fremde und unbekannte Inhalte MUST erhalten bleiben.

#### Scenario: Neue Version aus gewählter Vorlage

- **GIVEN** der Redakteur besitzt das zusätzliche übergreifende Variantenrecht und wählt Vorlage und Zielversion
- **WHEN** er die Neuanlage bestätigt
- **THEN** kopiert der gemeinsame Ablauf das vollständige bestätigte Quelldokument und wendet nur autorisierte eigene Feldänderungen an
- **AND** bleiben Vorlage und vorhandene Varianten unverändert
- **AND** wird ein bereits vorhandenes Ziel nicht automatisch überschrieben

#### Scenario: Version gezielt löschen

- **GIVEN** der Redakteur besitzt das zusätzliche übergreifende Variantenrecht
- **WHEN** er die dokumentweite Löschung einer bestimmten Variante bestätigt
- **THEN** betrifft die Mutation nur die gewählte Datensatzidentität
- **AND** wird die Abwesenheit unabhängig über einen exakten Lesepfad oder vollständigen bestätigten Bestand geprüft
- **AND** zählt eine nachfolgende App-Fallback-Antwort nicht als Löschbeweis

#### Scenario: Bisheriger OAuth-Pfad reicht nicht für die Variantenverwaltung

- **WHEN** die vorhandene Anbindung weder einen vollständigen Variantenbestand noch einen identitätserhaltenden Schreib- und Lesepfad nachweist
- **THEN** wird der fehlende technische Zugang ausdrücklich ausgewiesen
- **AND** verwendet Studio nicht stillschweigend ein anderes Konto, Admin-Session, DB-Zugriff oder eine erhöhte Mainserver-Rolle
- **AND** wird der freigegebene Umfang nicht heimlich auf bekannte oder unversionierte Varianten reduziert

### Requirement: Verlustfreie Feldänderungen und getrennte Berechtigungen

Das System MUST unbekannte und fremde JSON-Schlüssel, fehlend/null/false, Array-Reihenfolge und Eintragsidentitäten erhalten. Es MUST Konfigurationsrechte je Plugin von Inhaltsrechten trennen und zusätzlich ein übergreifendes Recht für Anlegen und Löschen ganzer Dokumentvarianten prüfen. Session, Plugin-Aktivierung, Tenant, Principal, Pfadzuständigkeit, Eingaben und Browser-CSRF MUST serverseitig geprüft werden. Konfigurationsinhalte und Credentials MUST NOT vollständig in Audit, Fehler oder Logs übernommen werden.

#### Scenario: Reines Inhaltsrecht oder fremder Feldpfad

- **WHEN** ein direkter API-Aufruf nur Inhaltsrechte besitzt oder ein fremdes Feld ändern will
- **THEN** lehnt der Host ihn vor jedem Mainserver-Write ab

#### Scenario: Variantenlöschung nur mit Plugin-Feldrecht

- **WHEN** ein Nutzer mit Plugin-Konfigurationsrecht ohne zusätzliches übergreifendes Variantenrecht eine ganze `globalSettings`-Variante löschen will
- **THEN** lehnt der Host den Vorgang vor dem Write ab
- **AND** bleiben die Einstellungen aller Plugins erhalten

#### Scenario: Formular deckt nur einen Teil des Dokuments ab

- **WHEN** eine zulässige Feldänderung gespeichert wird
- **THEN** entsteht der Write aus dem frischen vollständigen Bestand und den ausdrücklichen eigenen Änderungen
- **AND** ersetzt das Formular weder die Gesamtkonfiguration noch einen fremden Container
- **AND** werden Arrays nicht pauschal nach Index zusammengeführt

### Requirement: Direkte Speicherung mit unabhängigem Ergebnisnachweis

Das System SHALL nach einer Änderungsvorschau direkt im Mainserver speichern, ohne dauerhaften Studio-Entwurf oder separate Veröffentlichungsaktion. Erfolg MUST durch einen unabhängigen Fresh Read mit passendem Inhalt und Identitätsmetadaten bestätigt werden. Bei unklarem Schreibausgang MUST vor jeder Wiederholung ein Ergebnisabgleich erfolgen; automatische Mutationsretries MUST unterbleiben. Bestätigte Speicherung, fehlender Readback-Nachweis und ungeklärter Ausgang MUST unterscheidbar sein. App-Wirkung MUST getrennt von Speicherung ausgewiesen werden.

#### Scenario: Write liefert ID aber Readback schlägt fehl

- **WHEN** die Mutation eine ID liefert und der unabhängige Readback fehlschlägt oder abweicht
- **THEN** meldet Studio keinen bestätigten Speichererfolg
- **AND** behauptet es nicht, dass sicher nichts gespeichert wurde

#### Scenario: Neuanlage endet mit Timeout

- **WHEN** der Ausgang eines Create-Requests unklar ist
- **THEN** prüft der gemeinsame Ablauf zuerst die explizite Zielidentität und den aktuellen Bestand
- **AND** wiederholt er keine Mutation blind
- **AND** bleibt ein nicht eindeutig zuordenbares Ergebnis ausdrücklich ungeklärt

#### Scenario: Gespeicherte Einstellung ist im Client noch nicht sichtbar

- **WHEN** der Mainserver-Readback bestätigt ist und die App noch einen gecachten Stand verwendet
- **THEN** bleibt die Speicherung bestätigt
- **AND** wird keine sofortige Aktualisierung aller Clients behauptet
