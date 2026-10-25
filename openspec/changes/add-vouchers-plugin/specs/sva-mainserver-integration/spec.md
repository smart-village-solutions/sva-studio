## ADDED Requirements

### Requirement: Typisierter Gutschein-Aggregatpfad ohne Mainserver-Änderung

Studio SHALL Gutschein-Erstellung und Inhaltsbearbeitung über den bestehenden typisierten POI-Schreibpfad mit verschachtelten `vouchers` ausführen. Der Pfad MUST vor dem Schreiben den vollständigen benötigten POI-/Gutscheinbestand frisch lesen und außerhalb der gewählten Fachänderung inhaltlich erhalten. Der akzeptierte Verlust umfasst Einlösungen und ersetzte technische IDs, nicht andere Ortsdaten oder Gutschein-Inhalte. Nicht verlustfrei les-/schreibbare Bestände MUST vor der Mutation abgelehnt werden.

#### Scenario: Gutschein wird an einem Ort ergänzt

- **GIVEN** ein vollständig lesbarer und rückschreibbarer Ort mit sichtbaren und unsichtbaren Gutscheinen
- **WHEN** eine berechtigte, bestätigte Erstellung ausgeführt wird
- **THEN** wird genau ein Gutschein zum vollständigen Bestand ergänzt
- **AND** werden bestehende Gutschein-Inhalte und erforderliche POI-Beziehungen mitgeführt
- **AND** wird keine Top-Level-GenericItem-Mutation als Ersatzvertrag verwendet

#### Scenario: Unvollständiger Roundtrip

- **WHEN** eine vorhandene Beziehung, ein Geschwistergutschein oder ein erforderliches Feld nicht sicher gelesen oder zurückgeschrieben werden kann
- **THEN** lehnt Studio den Schreibvorgang vor der Mutation mit einem verständlichen Grund ab
- **AND** sendet es keine reduzierte Payload auf Verdacht

#### Scenario: Vergangene Ankündigung bleibt im Detail verborgen

- **GIVEN** ein POI enthält eine vergangene oder undatierte Ankündigung und das gefilterte Detailfeld liefert eine leere Liste
- **WHEN** ein Inhalts-Save des POIs oder eines seiner Gutscheine vorbereitet wird
- **THEN** gilt die leere Liste nicht als Nachweis der Abwesenheit von Ankündigungen
- **AND** wird der Save ohne nachgewiesene wirksame Lösch-Ausnahme blockiert, sobald Ankündigungen vorhanden sind oder deren Abwesenheit nicht vollständig geprüft werden kann
- **AND** bleiben Lesen und separate Sichtbarkeitsaktionen weiterhin berechtigt verfügbar

#### Scenario: Inaktive Kategorien fehlen im Detail

- **WHEN** ein POI oder Gutschein Zuordnungen zu inaktiven Kategorien besitzt
- **THEN** werden diese über einen vollständig nachgewiesenen öffentlichen Lesevertrag erhalten oder der Inhalts-Save vor Ausführung blockiert
- **AND** gelten Rollenfilter oder unvollständige Pagination nicht als Nachweis eines leeren Bestands

### Requirement: Autorisierung umfasst den vollständigen Reset-Bereich

Studio MUST die vorhandenen Mandanten-, Organisations-, Datenanbieter-, Principal- und Action-Regeln für die Aggregatwirkung prüfen. Eine Gutschein-Action allein SHALL keine unberechtigte Änderung des POIs oder anderer Gutscheine ermöglichen. Bestehende Ownership MUST erhalten bleiben oder der Vorgang vor dem Write abgelehnt werden.

#### Scenario: Firmeninhaber wählt fremden Ort

- **WHEN** eine Anfrage einen fremden Ort, unberechtigte Geschwistergutscheine oder nicht erhaltbare Anbieterzuordnungen enthält
- **THEN** wird sie vor GraphQL-Ausführung abgelehnt
- **AND** erhalten Browser und Logs keine fremden oder personenbezogenen Einlösedaten

### Requirement: Fachliche Identität überlebt technische Neuanlage

Studio MUST vorhandene `payload.id`-Kennungen und unbekannte Payload-Schlüssel erhalten, neue Kennungen serverseitig erzeugen und nach dem Save die neu vergebenen Datenbank-IDs eindeutig zuordnen. Fehlende Kennungen SHALL beim bestätigten Save ergänzt werden; doppelte oder uneindeutige Identitäten MUST zu einem Konflikt führen.

Für eine Neuanlage MUST die serverseitig erzeugte UUID vor dem destruktiven Schreibrequest dem Browser bekannt und für den Ergebnisabgleich nach einem Tab-Reload verfügbar sein. Schlüssel und Save-Versuch MUST an Akteur, Ort und aktiven Kontext gebunden werden. Studio SHALL dafür bestehende Operationsverträge oder eine minimale Speicherung der Kennung im Session-Storage des aktuellen Tabs nutzen, ohne neue Recovery-Infrastruktur einzuführen.

#### Scenario: Mainserver vergibt neue IDs

- **WHEN** der bestätigte POI-Save Gutschein- und Kontingentdatensätze ersetzt
- **THEN** liest Studio das Ergebnis zurück und ordnet es über die erhaltenen UUIDs zu
- **AND** aktualisiert es betroffene POI-/Gutschein-Projektionen, Referenzen und Detailcaches über bestehende Hostmechanismen
- **AND** dokumentiert die vorhandene Historie den bestätigten Vorgang ohne Wiederherstellungsversprechen für Einlösungen

### Requirement: Konflikte und unbestätigte Saves bleiben ehrlich

Studio MUST erkennbare redaktionelle Änderungen am relevanten Bestand zwischen Bestätigung und Schreiben ablehnen und erneute Bestätigung verlangen. Es SHALL keine atomische Konkurrenzsicherheit ohne entsprechenden Mainserver-Vertrag behaupten. Unbestätigte destruktive Requests MUST vor einer Wiederholung abgeglichen werden und SHALL nicht automatisch wiederholt werden.

#### Scenario: Bestand wurde zwischenzeitlich redaktionell geändert

- **WHEN** der serverseitige Vorabvergleich einen anderen relevanten Inhaltsstand feststellt
- **THEN** erfolgt keine Mutation
- **AND** verlangt Studio erneutes Laden und Bestätigen

#### Scenario: Mutation endet mit Timeout oder Readback-Fehler

- **WHEN** kein eindeutiger Ausgang vorliegt oder nur der anschließende Ergebnisabgleich scheitert
- **THEN** unterscheidet Studio unbestätigtes Speichern von bestätigtem Speichern mit ausstehendem Abgleich
- **AND** löst es keinen zweiten destruktiven Request ohne eindeutige Klärung aus
- **AND** öffnet es keine auf geratenen IDs beruhende Detailansicht

#### Scenario: Erfolgreiche Neuanlage mit verlorenem Response

- **GIVEN** zwei Gutscheine besitzen denselben Inhalt und der Save-Versuch hat eine vorab bekannte UUID
- **WHEN** der Mainserver erfolgreich speichert und vor Rückgabe der Antwort ein Verbindungs- oder Serverprozessabbruch auftritt
- **THEN** kann Studio auch nach einem Tab-Reload unter erneuter Autorisierung den gespeicherten Gutschein über diese UUID im gebundenen Ort eindeutig suchen
- **AND** verwendet es weder Inhaltsgleichheit als Identität noch einen neuen Erstellungsschlüssel als automatischen Retry
- **AND** bleibt bei verlorener Kennung oder nicht eindeutig abgeschlossenem ursprünglichem Request der Ausgang ungeklärt statt eine sichere Wiederholung zu behaupten

### Requirement: Gutschein-Nutzung aus vorhandenen Kontingentdaten

Der typisierte Mainserver-Lesepfad SHALL `maxQuantity`, `availableQuantity`, `frequency` und `maxPerPerson` für die Nutzung bereitstellen. Registrierte Einlösungen MUST als `maxQuantity - availableQuantity` aus plausiblen ganzzahligen Serverwerten abgeleitet werden; bei positiver Gesamtmenge SHALL daraus die Auslastung berechnet werden. Frische Nutzung MUST über einen autorisierten Mainserver-Abruf statt allein aus einer Content-Projektion kommen. Der Adapter SHALL keine fehlenden Redemption-/Personen-/Zeitreihen-APIs simulieren.

#### Scenario: Mengen-Einlösung zählt Einheiten

- **WHEN** der Mainserver für einen Gutschein drei Redemption-Datensätze durch eine Mengen-Einlösung erzeugt
- **THEN** erhöht sich die abgeleitete Zahl um drei
- **AND** werden weder die Mengenattribute zusätzlich summiert noch drei eindeutige Personen oder drei Bedienvorgänge behauptet

#### Scenario: Überziehung und fehlende Bezugsgröße

- **WHEN** der Mainserver bei Maximum 100 die Restmenge −2 meldet
- **THEN** liefert die Darstellung 102 registrierte Einlösungen und 102 Prozent samt Überziehung, während nur der grafische Balken auf seine Darstellungsbreite begrenzt bleibt
- **AND** wird bei fehlendem oder nicht positivem Maximum keine Prozentzahl errechnet
- **AND** werden fehlende oder nicht plausible Werte nicht stillschweigend zu null normalisiert

#### Scenario: Frische und Periodengrenzen werden nachgewiesen

- **WHEN** Nutzungsdaten geladen, manuell aktualisiert oder nach einem bestätigten Aggregat-Save neu gelesen werden
- **THEN** verwendet Studio den vorhandenen autorisierten Lesepfad und prüft den Cache-Vertrag des Ziel-Mainservers
- **AND** bezeichnet der angezeigte Datenstand den letzten erfolgreichen Abruf
- **AND** werden konkrete Kalendergrenzen nur bei nachgewiesener Server-Zeitzone und Rhythmussemantik angegeben
- **AND** werden weder ein eigener Statistikdienst noch Polling- oder Snapshot-Zeitreihen eingeführt

### Requirement: Andere Studio-Writer umgehen Gutschein-Schutz nicht

Alle Studio-Pfade, die POIs mit Gutscheinen oder GenericItems vom Typ `Voucher` ändern können, MUST den passenden bestätigten Inhalts- beziehungsweise separaten Sichtbarkeitspfad verwenden oder die Aktion blockieren. POI-Löschen mit Gutscheinen SHALL im ersten Umfang blockiert werden. Der Schutz bestehender Gutscheine MUST auch bei deaktiviertem Plugin gelten.

#### Scenario: Allgemeiner Editor oder Bulk-Aktion

- **WHEN** ein allgemeiner GenericItem-Editor, eine Bulk-Aktion oder ein gewöhnlicher POI-Save einen Gutscheinbestand betrifft
- **THEN** darf die Aktion weder Gutscheine stillschweigend auslassen noch die Reset-Bestätigung umgehen
- **AND** werden nicht sicher unterstützte Aktionen vor Ausführung abgelehnt

#### Scenario: Laufzeitnachweis vor Aktivierung

- **WHEN** der Plugin-Schreibumfang für den Ziel-Mainserver freigegeben wird
- **THEN** belegen isolierte Akzeptanzdaten Inhaltserhalt, erwarteten Einlösungsreset, eindeutige ID-Rückzuordnung und Sichtbarkeit ohne Reset
- **AND** werden die Grenzen externer paralleler Änderungen und verspäteter Offline-Einlösungen dokumentiert
- **AND** gilt ein Schema-Snapshot allein nicht als Nachweis dieser Laufzeitwirkungen
