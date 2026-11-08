## ADDED Requirements

### Requirement: Baustellen verwenden den vorhandenen GenericItem-Vertrag ohne Bestandsmigration

Das System MUST Baustellen über die bestehende Studio-Mainserver-Anbindung als GenericItems mit exakt `genericType: "ConstructionSite"` lesen, anlegen und unter Beibehaltung ihrer ID aktualisieren. Fachliche Zusatzangaben MUST unter `payload.direction`, `payload.cause` und `payload.restrictions[].description` bleiben; kanonische Inhalte, Zeiträume, Orte, Kategorien und Medien MUST ihre vorhandenen GenericItem-Felder verwenden. Eine zweite fachliche Datenhaltung oder externe Schemaänderung MUST unterbleiben.

Ausdrücklich fachlich akzeptierte Ausnahme: Zuordnungen zu deaktivierten Kategorien MUST beim Speichern entfallen dürfen. Die Erhaltungsanforderung MUST für aktive Kategorien und alle übrigen nicht bearbeiteten Inhalte und Beziehungen unverändert gelten.

#### Scenario: Bestandsbaustelle wird ohne Migration bearbeitet

- **GIVEN** eine Baustelle wurde im alten CMS angelegt
- **WHEN** eine berechtigte Person ihren Titel im Studio ändert
- **THEN** bleibt ihre Mainserver-GenericItem-ID unverändert
- **AND** bleiben nicht bearbeitete Payload-Schlüssel, Relationen, Metadaten und Reihenfolgen erhalten
- **AND** ersetzt die Titeländerung weder Sichtbarkeit noch weitere Inhalte durch Formular-Defaults

#### Scenario: Deaktivierte Kategoriezuordnung darf beim Speichern entfallen

- **GIVEN** eine Baustelle besitzt eine aktive und eine deaktivierte Kategoriezuordnung, die der Mainserver im Detail-Read ausblendet
- **WHEN** eine berechtigte Person den Titel ändert und speichert
- **THEN** darf die deaktivierte Zuordnung entsprechend der ausdrücklich akzeptierten fachlichen Regel entfallen
- **AND** bleiben die aktive Zuordnung und sämtliche übrigen nicht bearbeiteten Inhalte erhalten
- **AND** erzeugt eine spätere Reaktivierung der Kategorie keine versprochene automatische Wiederzuordnung

#### Scenario: Beschädigter Bestand wird nicht als leeres Objekt gespeichert

- **GIVEN** eine Payload-Struktur oder Relation lässt sich über den vorhandenen Vertrag nicht verlustfrei lesen und erhalten
- **WHEN** eine Bearbeitung eine schädliche Vollersetzung auslösen würde
- **THEN** blockiert der Server diese Mutation vor dem Provider-Write
- **AND** erklärt die Oberfläche die betroffene Datenstruktur und eine konkrete nächste Korrekturmöglichkeit
- **AND** wird kein leeres Ersatzobjekt oder eine leere Ersatzliste gespeichert

### Requirement: Baustellenänderungen prüfen aktuellen Zugriff und erkennbaren Konflikt

Das System MUST unmittelbar vor einem Update einen frischen Detail-Read mit der tatsächlich verwendeten Identität durchführen, Typ und Zugriff erneut prüfen und erkennbare Inhaltsänderungen gegenüber der Editor-Baseline als Konflikt behandeln. Der Server MUST unberührte Werte aus seinem eigenen aktuellen Bestand ergänzen. Eine alleinige `updatedAt`-Prüfung MUST nicht als vollständige Inhaltsprüfung gelten. Die Oberfläche MUST Formulareingaben bei Konflikten erhalten.

#### Scenario: Fremder Typ oder verlorene Berechtigung verhindert den Write

- **GIVEN** der aktuelle Datensatz besitzt einen anderen Typ oder ist für die aufgelöste Identität nicht mehr bearbeitbar
- **WHEN** die Person Speichern auslöst
- **THEN** erfolgt keine Provider-Mutation
- **AND** ersetzt eine vom Client übermittelte Typ-/Provider-Angabe die erneute Prüfung nicht

#### Scenario: Zwischenzeitlicher Inhalt löst einen Konflikt aus

- **GIVEN** das alte CMS hat einen Inhalt seit Laden des Studio-Editors geändert
- **WHEN** der frische Read vor dem Studio-Write die Abweichung erkennt
- **THEN** verhindert das System ein stilles Überschreiben und erhält die Eingaben für Vergleich und erneutes Laden
- **AND** behauptet es keine atomare Sperre gegenüber weiteren externen Änderungen nach diesem Read

### Requirement: Baustellenschreiben benötigen Readback und eindeutiges Teilfehlerverhalten

Das System MUST nach einer Mutation den Datensatz unabhängig wieder lesen und beabsichtigte Änderungen sowie relevante erhaltene Daten prüfen. Provider-Erfolg, lokale Bindungs-/Projektions-/Historien-/Mediennachverarbeitung und unklarer Write-Ausgang MUST unterscheidbar sein. Ein unklarer Ausgang oder lokaler Teilfehler MUST keinen blinden erneuten Anlagevorgang auslösen.

#### Scenario: Provider-Erfolg mit lokalem Fehler erzeugt keine Dublette

- **GIVEN** die Baustelle wurde im Mainserver angelegt, aber die lokale Nachverarbeitung schlägt fehl
- **WHEN** das Studio den Fehler anzeigt oder die Person die Bearbeitung wieder aufnimmt
- **THEN** bleibt die bekannte Provider-ID dem Vorgang zugeordnet
- **AND** verwendet die Wiederaufnahme die vorhandenen Nachverarbeitungs-/Readback-Verträge statt einer erneuten Content-Anlage
- **AND** wird der Provider-Erfolg nicht als vollständiger Misserfolg dargestellt

#### Scenario: Antwortverlust führt zuerst zur Zustandsklärung

- **GIVEN** nach Versand des Writes ist dessen Ausgang unbekannt
- **WHEN** die Person erneut Speichern auslöst oder die Seite neu lädt
- **THEN** klärt der bestehende Operations-/Readback-Pfad zunächst den bekannten Vorgang
- **AND** erfolgt kein automatischer zweiter Write allein aufgrund des Transportfehlers

#### Scenario: App-Abnahme bleibt ein eigenständiger Nachweis

- **GIVEN** lokale Mapping-, Routen- und UI-Tests sind erfolgreich
- **WHEN** der Lieferstand bewertet wird
- **THEN** werden sie nicht als produktive Darstellung oder fachliche App-Abnahme ausgewiesen
- **AND** erfordert ein externer Schreibtest ein konkret freigegebenes Zielsystem, Konto und Testdatenset
