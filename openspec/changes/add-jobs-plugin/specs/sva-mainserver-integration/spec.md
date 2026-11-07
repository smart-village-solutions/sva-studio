## ADDED Requirements

### Requirement: Stellenanzeigen verwenden den bestehenden Mainserver-Vertrag

Das System MUST Stellenanzeigen über den bestehenden GenericItem-Vertrag mit exakt `genericType: "Job"` lesen, über `createGenericItem` mit ausdrücklich gesetztem `forceCreate: true` anlegen beziehungsweise mit bestehender ID bearbeiten und über `destroyRecord(recordType: "GenericItem")` löschen. `forceCreate` MUST nicht als Schutz gegen externe-ID-Upserts interpretiert werden. Es MUST ohne neue fachliche Datenhaltung und ohne Änderungen am externen Mainserver oder der App auskommen.

#### Scenario: Bestehende Legacy-Anzeige wird ohne Migration geöffnet

- **WHEN** eine berechtigte Person einen existierenden Job öffnet
- **THEN** liest das Plugin die bestehende ID und den bestehenden Datenvertrag
- **AND** verändert das Öffnen weder Payload noch Firmen-, Kontakt-, Medien- oder Datumsbeziehungen

#### Scenario: Fremder GenericItem-Typ wird abgelehnt

- **WHEN** eine Job-Detail- oder Mutationsroute eine ID mit anderem GenericItem-Typ erhält
- **THEN** lehnt sie die Operation vor einer Provider-Mutation ab

### Requirement: Job-Neuanlagen verhindern erkennbare externe-ID-Kollisionen

Das System MUST vor einer Neuanlage mit externer ID einen frischen vollständigen typübergreifenden Kollisionsread im tatsächlichen Provider durchführen. Dies MUST auch technisch erzeugte externe IDs umfassen. Ein bestehender Treffer oder nicht nachweisbare Vollständigkeit MUST den Create vor einer Provider-Mutation sperren. Die interne Sicherheitsprüfung MUST keine fremden Inhalte oder zusätzlichen Leserechte an den Job-Benutzer ausgeben.

#### Scenario: Externe ID einer Baustelle darf diese nicht als Job überschreiben

- **GIVEN** derselbe Provider besitzt eine Baustelle mit der bei Job-Neuanlage eingegebenen externen ID
- **WHEN** der Job-Create vorbereitet wird
- **THEN** wird die Kollision unabhängig vom vorhandenen GenericItem-Typ erkannt und vor dem Write abgelehnt
- **AND** bleiben Typ, Inhalt und Beziehungen der Baustelle unverändert
- **AND** beträgt die Provider-Write-Aufrufzahl null

#### Scenario: Gefilterter Kollisionsread beweist keine freie externe ID

- **WHEN** der Kollisionsread den providerweiten GenericItem-Bestand nicht vollständig nachweisen kann
- **THEN** wird der Create vor dem Write gesperrt
- **AND** stellt ein leeres gefiltertes Ergebnis keinen Kollisionsfreiheitsnachweis dar

### Requirement: Job-Updates erhalten den autoritativen Bestand

Das System MUST vor Updates sämtliche durch den tatsächlichen Mainserver-Schreibpfad ersetzten Felder und Beziehungen frisch mit derselben Identität lesen und einen Inhaltsfingerprint gegen die Editor-Baseline prüfen. Nicht bearbeitete Payload-Schlüssel, Felder, Beziehungen, Reihenfolgen und Metadaten MUST erhalten bleiben. Beschädigte, ausgelassene oder nicht verlustfrei rekonstruierbare API-Inhaltsdaten MUST vor dem Provider-Write zur Ablehnung führen. Als ausdrücklich akzeptierte vorläufige Ausnahme MUST die vom bisherigen Mainserver neu erzeugte technische Importreferenz einschließlich Referenz-ID, Erstellungszeit und Importmarker von der Erhaltzusage ausgenommen sein; SVA-1786 verfolgt die getrennte Behebung. Diese Ausnahme MUST keine anderen Inhalte oder Beziehungen freigeben.

#### Scenario: Reine Titeländerung erhält Firmen und zusätzliche Metadaten

- **GIVEN** ein Job enthält mehrere Firmen, Kontakte, Textblöcke, Medien, Datumswerte und unbekannte Payload-Schlüssel
- **WHEN** ausschließlich der Titel geändert wird
- **THEN** baut der Server den Write aus seinem frischen vollständigen Snapshot auf
- **AND** prüft ein unabhängiger Readback die Änderung und den Erhalt der übrigen Daten
- **AND** behält die Anzeige ihre bisherige GenericItem-ID und Provider-Zuordnung

#### Scenario: Editor-Baseline ist veraltet

- **WHEN** der frische autoritative Inhalt vom beim Öffnen erfassten Fingerprint abweicht
- **THEN** wird das Update als Konflikt ohne Provider-Write abgewiesen
- **AND** bleiben die lokalen Eingaben zur ausdrücklichen Neubewertung erhalten

#### Scenario: Updateziel ist bei der letzten Prüfung verschwunden

- **WHEN** die bestehende ID vor der Mutation nicht mehr als derselbe berechtigte Job bestätigt werden kann
- **THEN** wird der Vorgang ohne Provider-Write abgelehnt
- **AND** wird kein Create oder Upsert über eine externe ID als Ersatz versucht

#### Scenario: Gefilterte Kategorien können verlorene Zuordnungen verdecken

- **GIVEN** der Detail-Read liefert nur aktive Kategorien und der vollständige Kategorie-Snapshot schließt verborgene Zuordnungen nicht sicher aus
- **WHEN** ein Job-Update vorbereitet wird
- **THEN** wird es vor der ersetzenden Mutation abgewiesen
- **AND** gilt die fachliche Baustellen-Ausnahme nicht für Jobs
- **AND** wird ein unvollständiger oder rollenbedingt gefilterter Snapshot nicht als leerer sicherer Bestand behandelt

### Requirement: Job-Writes sind operationsgebunden und werden unabhängig geprüft

Das System MUST vorhandene Idempotenz-, Operations-, Kontextbindungs-, Medien- und Historienverträge nutzen. Provider-Writes MUST ohne automatischen Retry erfolgen. Provider-Erfolg mit lokaler Nachverarbeitung, vollständiger Erfolg und unklarer Provider-Ausgang MUST unterscheidbar bleiben. Wiederaufnahme MUST ausschließlich lesend nachweisen und lokal nachverarbeiten, ohne den Provider-Write zu wiederholen.

#### Scenario: Anlageantwort geht nach erfolgreichem Write verloren

- **WHEN** der Provider eine Anzeige angelegt hat, die Antwort aber verloren geht
- **THEN** bleibt der Vorgang einschließlich Reload gegen erneutes Schreiben gesperrt
- **AND** kann derselbe berechtigte Kontext das Ergebnis über eindeutige Operationsidentität und vollständigen Sollzustand prüfen
- **AND** entsteht durch die Wiederaufnahme keine zweite Anzeige

#### Scenario: Ausdrücklich gesetzte externe ID bleibt erhalten

- **GIVEN** die Person hat bei Neuanlage eine externe ID eingegeben
- **WHEN** ein Write und gegebenenfalls seine Ergebnisprüfung erfolgen
- **THEN** wird die externe ID nicht durch eine technische Operations-ID ersetzt
- **AND** verlangen Kandidatenprüfung und Readback zusätzlich eine eindeutige Operationsmarkierung und den vollständigen Sollzustand
- **AND** bleibt ein mehrdeutiger oder nicht beweisbarer Ausgang ungeklärt

#### Scenario: Lokale Mediennachverarbeitung schlägt fehl

- **GIVEN** der Provider-Write ist bereits unabhängig nachgewiesen
- **WHEN** eine lokale Medienbindung, Projektion oder Historiennachverarbeitung fehlschlägt
- **THEN** meldet das System den getrennten Teilzustand
- **AND** wiederholt die Wiederaufnahme keinen Content-Write

### Requirement: Job-Löschungen prüfen Objekt und Ergebnis

Das System MUST unmittelbar vor einer Löschung exakten Typ, Existenz, Provider-/Objektzugriff, Kontextbindung, Fachrecht, Modulaktivierung und CSRF prüfen. Nicht sicher beherrschte abhängige Fachbeziehungen MUST die Löschung vor dem Write sperren. Vollständiger Erfolg MUST einen unabhängigen Nachweis der Nichtexistenz unter demselben Principal und abgeschlossene lokale Nachverarbeitung voraussetzen.

#### Scenario: Löschung betrifft ausschließlich die bestätigte Anzeige

- **WHEN** eine konkrete Anzeige mit gültiger Bestätigung gelöscht wird
- **THEN** verwendet die Mutation ausschließlich deren frisch autorisierte ID
- **AND** schreibt sie keine Firma, keinen Ort und keine Geschwisteranzeigen neu
- **AND** werden zentrale Medienassets nicht wegen aufgelöster Verwendung mitgelöscht

#### Scenario: Fehlender Zugriff beweist keine Löschung

- **WHEN** der nachfolgende Read wegen Rechteänderung, Filterung oder technischer Störung kein verlässliches Ergebnis liefert
- **THEN** wird kein vollständiger Löscherfolg gemeldet
- **AND** wird die Löschmutation nicht automatisch wiederholt

### Requirement: Lokale Konkurrenzprüfung verspricht keine externe Atomarität

Das System MUST den bestehenden Studio-Mutationsschutz sowie frischen Read, Fingerprint und Readback verwenden und die nicht atomare Grenze zu externen CMS-/Importer-Writes dokumentieren. Diese Grenze MUST auch neue externe-ID-Kollisionen und gelöschte Updateziele nach der letzten Vorprüfung umfassen. Es MUST keine konfliktfreie externe Zusammenführung, atomare Kollisionsgarantie oder automatische öffentliche Ablaufsteuerung zusagen.

#### Scenario: Externer Schreibzugriff liegt außerhalb des Studio-Locks

- **WHEN** ein fremdes System zwischen letzter Prüfung und Provider-Write dieselbe Anzeige ändert
- **THEN** gilt der Studio-Lock nicht als atomare externe Revisionsvorbedingung
- **AND** bleiben dieses Restrisiko und der unabhängige Readback Bestandteil des Vertrags und der Abnahme
