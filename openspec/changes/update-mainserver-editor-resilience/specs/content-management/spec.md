## ADDED Requirements

### Requirement: Mainserver-Editoren bleiben bei Teilabweichungen nutzbar

Das System MUST einen erfolgreich gelieferten Mainserver-Datensatz anzeigen, sobald dessen stabile Mainserver-ID und die für die autorisierte typisierte Route erforderlichen harten Mindestfelder sicher erkannt wurden. Der Inhaltstyp MUST aus der typisierten Route stammen und darf nicht aus fehlenden Antwortfeldern erraten werden. Abweichungen in optionalen Feldern oder Fehler in zusätzlichen Studio-Diensten MUST auf die betroffene Feldgruppe oder Zusatzfunktion begrenzt bleiben und dürfen die Anzeige oder unabhängige Bearbeitung des übrigen Datensatzes nicht verhindern.

#### Scenario: Optionales Mainserver-Feld besitzt eine unerwartete Form

- **WENN** die Detailantwort eine sichere Mainserver-ID enthält und der Inhaltstyp durch die autorisierte typisierte Route feststeht
- **UND** ein optionales Feld oder ein einzelner optionaler Listeneintrag nicht dem bestätigten Adaptervertrag entspricht
- **DANN** zeigt der Editor alle sicher interpretierbaren Daten an
- **UND** kennzeichnet ausschließlich die betroffene Feldgruppe als degradiert oder schreibgeschützt
- **UND** unabhängige Feldgruppen bleiben bearbeitbar

#### Scenario: Optionaler Zusatzdienst schlägt fehl

- **WENN** der Mainserver-Detailrequest erfolgreich ist
- **UND** Medienreferenzen, Kategorien, Historie, Karte oder ein vergleichbarer Zusatzdienst nicht geladen werden können
- **DANN** bleibt der Mainserver-Datensatz sichtbar und bearbeitbar
- **UND** der betroffene Abschnitt zeigt einen lokalisierten, wiederholbaren Fehlerzustand
- **UND** die UI bezeichnet den Datensatz nicht als fehlend oder vollständig nicht ladbar

#### Scenario: Hartes Mindestfeld kann nicht sicher bestimmt werden

- **WENN** die Mainserver-Detailantwort keine sicher verwendbare Inhalts-ID oder keinen für die Fachroute erforderlichen Typdiskriminator besitzt
- **DANN** blockiert das System die Detailbearbeitung mit einem deterministischen Vertragsfehler
- **UND** es erzeugt keinen synthetischen Datensatz und führt keine Mutation aus

### Requirement: Degradierte Mainserver-Felder werden verlustarm bearbeitet

Das System MUST bei einer Aktualisierung ausschließlich die vom jeweiligen Editor kontrollierten und gültigen Feldgruppen ersetzen. Unbekannte Payload-Schlüssel und deklarierte Passthrough-Felder, die unmittelbar zuvor über den bestätigten GraphQL-Vertrag verlustfrei gelesen wurden und vom Mutation-Input akzeptiert werden, MUST erhalten bleiben. Nicht sicher interpretierbare Feldgruppen MUST unverändert und schreibgeschützt bleiben, wenn Auslassung nachweislich Erhaltung bedeutet oder die Gruppe vollständig aus dem aktuellen Read rekonstruiert werden kann.

#### Scenario: Benutzer bearbeitet unabhängige Felder neben einer Abweichung

- **GIVEN** ein geladener Datensatz besitzt eine nicht sicher interpretierbare optionale Feldgruppe
- **AND** andere Editorfelder sind gültig und bearbeitbar
- **WHEN** der Benutzer ausschließlich gültige Editorfelder aktualisiert
- **THEN** ersetzt der Schreibpfad nur die kontrollierten geänderten Feldgruppen
- **AND** erhält die abweichende Feldgruppe sowie deklarierte Payload- und Passthrough-Werte unverändert
- **AND** sendet keine unbekannten oder nur gelesenen Felder an den Mutation-Input

#### Scenario: Mutation kann eine abweichende Feldgruppe nicht sicher erhalten

- **GIVEN** der Mainserver-Mutationsvertrag verlangt eine Feldgruppe, die Studio nicht sicher rekonstruieren oder durch Auslassung erhalten kann
- **WHEN** der Benutzer speichern möchte
- **THEN** blockiert das System die unsichere Mutation vor dem GraphQL-Aufruf
- **AND** erklärt feldbezogen, welche Daten nicht sicher erhalten werden können
- **AND** der geladene Datensatz bleibt weiterhin sichtbar und anderweitig nutzbar

#### Scenario: Feld liegt außerhalb des GraphQL-Vertrags

- **WHEN** ein Wert vom bestätigten GraphQL-Lesevertrag nicht abgefragt oder vom Mutation-Input nicht akzeptiert wird
- **THEN** verspricht Studio weder Anzeige noch Erhaltung oder Bearbeitung dieses Werts
- **AND** führt keinen untypisierten GraphQL-Bypass oder vollständigen Rohdateneditor ein

#### Scenario: Parallele externe Änderung tritt zwischen Read und Write auf

- **GIVEN** der Mainserver bietet keine Revision, keinen ETag und keine vergleichbare Mutationsvorbedingung
- **WHEN** sich ein Providerfeld zwischen dem vorbereitenden Read und der Mutation extern ändert
- **THEN** verspricht Studio keine konfliktfreie Zusammenführung
- **AND** stellt es Read-Merge-Write nicht als Schutz vor Last-Writer-Wins-Verlusten dar
