## ADDED Requirements

### Requirement: Studio hält gemeinsame Mailvorlagen und bestätigt deren Synchronisierung

Das System SHALL Einladung und E-Mail-Bestätigung je Instanz gemeinsam im Studio
speichern. Die bestehende Serververerbung SHALL erhalten bleiben. Quellrevisionen
MUST auch beim Reset monoton steigen. Speichern MUST vor einem externen Write
committen. Die Synchronisierung MUST ausschließlich die drei zum Anlass gehörenden
deutschen Schlüssel im Registry-gebundenen Realm schreiben und zurücklesen.
Fehler MUST die Quelle erhalten und einen nicht synchronisierten Status anzeigen.

#### Scenario: Übertragung schlägt fehl

- **WHEN** nach dem Speichern ein Keycloak-Write oder Readback scheitert
- **THEN** bleibt der Studio-Stand gespeichert
- **AND** wird kein synchronisierter Zustand behauptet und kein Versand freigegeben

#### Scenario: Direkte Keycloak-Änderung oder gleichzeitige Bearbeitung

- **WHEN** aktuelle Keycloak-Texte vom Studio-Stand abweichen
- **THEN** bleiben beide sichtbar und die Studio-Quelle unverändert
- **AND** prüfen ausdrückliche Übernahme und Übertragung die aktuelle Quellrevision sowie beide Textsnapshots erneut

#### Scenario: Kommunenname oder Startseiten-Link ändern sich

- **WHEN** relevante Instanzdaten oder die geerbte Servervorlage gespeichert werden
- **THEN** wird die jeweilige Projektion neu kompiliert und ihr Abgleich angestoßen
- **AND** wird eine extern abweichende Fassung nicht automatisch überschrieben

#### Scenario: Einladungsversand bei Abweichung

- **WHEN** der aktuelle lesende Vergleich eine Abweichung, einen Ausfall oder einen nicht bestätigten Fehler ergibt
- **THEN** wird der Versand mit einem Hinweis auf den Vorlagenabgleich blockiert
- **AND** schreibt der Versand weder Realm-Texte noch Themes

#### Scenario: Bestehende E-Mail-Bestätigung

- **WHEN** Registrierung oder bestehende Adressänderung eine Bestätigung anfordern
- **THEN** verwendet die gemeinsame Main-Server-Methode send-verify-email
- **AND** bleiben Registrierungspasswort, Passwort-Reset, Absender und Nachricht an die alte Adresse unverändert

### Requirement: Beide Mailanlässe erhalten allgemeine Vorlagen mit optionalen Instanz-Overrides

Das System SHALL für Einladung und Bestätigung jeweils eine bearbeitbare allgemeine
Vorlage anbieten. Ein optionaler Instanz-Override MUST Vorrang haben. Das Entfernen
eines Overrides MUST wieder die aktuelle allgemeine Vorlage verwenden. Änderungen
allgemeiner Standards MUST ausschließlich erbende Instanzen abgleichen und eigene
Overrides unverändert lassen; der Zustand MUST unter der Instanzsperre erneut geprüft werden.

#### Scenario: Allgemeinen Bestätigungsstandard ändern

- **GIVEN** eine Instanz erbt und eine weitere besitzt einen eigenen Override
- **WHEN** die allgemeine Bestätigungsvorlage gespeichert wird
- **THEN** wird die neue Quelle vor dem Abgleich committet
- **AND** wird nur die erbende Instanz mit Keycloak abgeglichen
- **AND** bleiben Einladungsdaten und eigene Overrides unverändert

#### Scenario: Bestätigungs-Override entfernen

- **WHEN** der eigene Bestätigungstext einer Instanz zurückgesetzt wird
- **THEN** bleibt die Instanzquelle null und verwendet die aktuelle allgemeine Vorlage
- **AND** greifen spätere Änderungen des Standards wieder für diese Instanz

#### Scenario: Gleichzeitiger Instanz-Override

- **WHEN** vor Erwerb der Instanzsperre ein eigener Override gespeichert wird
- **THEN** überspringt der allgemeine Abgleich diese Instanz ohne Keycloak-Write
