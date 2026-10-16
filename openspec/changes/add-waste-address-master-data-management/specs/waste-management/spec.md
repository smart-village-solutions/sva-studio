## ADDED Requirements

### Requirement: Waste-Management bietet eine eigenständige Pflege der Adress-Stammdaten

Das System SHALL im Haupttab `Stammdaten` die Regionen, Orte, Straßen und Hausnummern als getrennte Tabellen bereitstellen. Ein Dropdown über der Tabelle SHALL die sichtbare Ebene bestimmen und als typisierten Navigationszustand erhalten.

#### Scenario: Benutzer wählt eine Stammdatenebene

- **WHEN** ein Benutzer im Tab `Stammdaten` eine der vier Ebenen auswählt
- **THEN** zeigt die Tabelle ausschließlich Datensätze dieser Ebene und bei entsprechender Berechtigung passende Aktionen zum Anlegen, Bearbeiten und Löschen
- **AND** die Auswahl bleibt nach Navigation und Neuladen erhalten
- **AND** der Tab `Abholorte` bleibt für die Pflege konkreter Abholorte zuständig

#### Scenario: Tabellenwechsel und Orientierung

- **GIVEN** ein Benutzer betrachtet eine spätere Seite einer gefilterten Stammdatentabelle
- **WHEN** er im beschrifteten Datentyp-Dropdown eine andere Ebene auswählt
- **THEN** sieht er deren Titel, passende Elternspalten und Aktionen sowie die erste Ergebnisseite ohne Filter der vorherigen Ebene
- **AND** die Auswahl ist in Desktop- und Mobilnavigation erreichbar und bleibt nach einem Neuladen erhalten

#### Scenario: Benutzer grenzt gleichnamige Adressdaten ein

- **GIVEN** mehrere Orte oder Straßen tragen denselben Namen
- **WHEN** der Benutzer nach Adressdaten sucht oder eine Elternzuordnung auswählt
- **THEN** kann er die Tabelle nach der passenden Elternebene filtern
- **AND** Elternoptionen zeigen Postleitzahl und übergeordnete Adresse, soweit vorhanden, sodass gleichnamige Einträge unterscheidbar sind
- **AND** ein Filterwechsel beginnt auf der ersten Ergebnisseite

#### Scenario: Suche ohne Treffer oder fehlender Eltern-Datensatz

- **WHEN** eine Suche keine Ergebnisse liefert
- **THEN** zeigt die Tabelle einen Hinweis zum Filter und lässt ihn zurücksetzen
- **AND** ein vollständig leerer Datenbestand wird davon unterscheidbar angezeigt
- **AND** wenn zum Anlegen eine benötigte Elternebene fehlt, erklärt die Oberfläche die Abhängigkeit und bietet den Wechsel zu deren Anlegeaktion an

#### Scenario: Benutzer besitzt nur Leserechte

- **WHEN** ein Benutzer ohne `waste-management.master-data.manage` die Stammdaten betrachtet
- **THEN** kann er die vier Tabellen lesen und die Ebene wechseln
- **AND** Aktionen zum Anlegen, Bearbeiten und Löschen werden nicht angeboten

#### Scenario: Stammdatentabelle bleibt bedienbar

- **WHEN** ein Benutzer die Tabelle und ihre Dialoge per Tastatur oder auf einem schmalen Bildschirm bedient
- **THEN** bleiben Ebenenauswahl, Suche, Seitennavigation und Zeilenaktionen erreichbar und verständlich beschriftet
- **AND** nach dem Schließen eines Dialogs kehrt der Fokus zur auslösenden Aktion oder nach einer Löschung zu einer sinnvollen Tabellenaktion zurück

#### Scenario: Benutzer legt eine Adressebene an

- **WHEN** ein berechtigter Benutzer eine Region, einen Ort, eine Straße oder eine Hausnummer anlegt
- **THEN** werden Name beziehungsweise Nummer und die für diese Ebene nötige Elternzuordnung über den vorhandenen Waste-Schreibpfad gespeichert
- **AND** der Ort kann optional eine Region und eine Postleitzahl erhalten
- **AND** Straße und Hausnummer benötigen jeweils einen Ort beziehungsweise eine Straße
- **AND** die Elternauswahl verwendet stabile IDs als Werte und zeigt den Adresskontext statt bloßer Namen

### Requirement: Adress-Stammdaten lassen sich ohne widersprüchliche Folgeadressen bearbeiten

Das System SHALL Namen beziehungsweise Nummern und die fachlich vorhandenen Elternzuordnungen der Adress-Stammdaten bearbeiten können. Eine Elternänderung SHALL abhängige Abholorte konsistent halten und SHALL E-Mail-Abos, deren geografische Auswahl sich ändern würde, nur nach ausdrücklicher Bestätigung samt Positionen und Outbox entfernen.

#### Scenario: Benutzer korrigiert Text oder Postleitzahl

- **WHEN** ein berechtigter Benutzer den Namen einer Region, eines Orts oder einer Straße, die Nummer einer Hausnummer oder die Postleitzahl eines Orts ändert
- **THEN** bleiben die Datensatz-IDs, Kindobjekte und bestehenden Tour-Zuordnungen erhalten

#### Scenario: Benutzer ändert die Elternzuordnung

- **WHEN** ein berechtigter Benutzer einen Ort einer anderen Region, eine Straße einem anderen Ort oder eine Hausnummer einer anderen Straße zuordnet
- **THEN** zeigt der Bearbeitungsdialog vor dem Speichern Quelle, Ziel und die Anzahl der Abholorte, die mitwandern würden
- **AND** zeigt er die Anzahl betroffener E-Mail-Abos und Outbox-Einträge einschließlich der separat ausgewiesenen `sent`-Einträge
- **AND** bleibt Speichern bis zum erfolgreichen Laden dieser Vorschau gesperrt
- **AND** prüft das System die Auswirkungen auf abhängige Abholorte und aktualisiert deren Adresskette atomar
- **AND** lässt es keine widersprüchlichen oder unbemerkt verallgemeinerten Abholort-Adressen zurück

#### Scenario: Vorschau eines Elternwechsels ist veraltet

- **GIVEN** die abhängigen Abholorte oder die Menge betroffener Abos haben sich seit der angezeigten Vorschau geändert
- **WHEN** der Benutzer die neue Elternzuordnung speichern will
- **THEN** lehnt das System die Änderung ohne Teilmutation ab und verlangt eine aktualisierte Vorschau

#### Scenario: Verschiebung betrifft E-Mail-Abos

- **GIVEN** eine Elternänderung würde die geografische Auswahl mindestens eines bestehenden E-Mail-Abos verändern
- **WHEN** der Benutzer die Änderung speichern will
- **THEN** verlangt das System eine gesonderte ausdrückliche Bestätigung der Löschung dieser Abos samt Positionen und Outbox aller Status einschließlich `sent`
- **AND** erläutert es, dass gespeicherte Versandhistorie entfällt, aber bereits zugestellte E-Mails nicht zurückgerufen werden
- **AND** ohne diese Bestätigung verändert es weder Stammdaten noch Abholorte oder Abos

#### Scenario: Bestätigter Elternwechsel mit betroffenen Abos

- **GIVEN** der Benutzer hat die Vorschau und die Löschung der betroffenen Abos ausdrücklich bestätigt
- **WHEN** der Elternwechsel ausgeführt wird
- **THEN** aktualisiert das System die Adresskette abhängiger Abholorte und löscht die betroffenen Abos mit Positionen und Outbox in einer Tenant-Transaktion
- **AND** bleiben Abos anderer Adressbereiche, Fraktionen, Touren und Tour-Zuordnungen der erhaltenen Abholorte bestehen
- **AND** werden bei einer Straßen- oder Hausnummernverschiebung ortsweite Abos nicht allein wegen der Verschiebung gelöscht

### Requirement: Adress-Löschungen zeigen ihre Wirkung vor der Bestätigung

Das System SHALL für jede der vier Adress-Stammdatenebenen eine tenantgebundene, berechtigte Löschvorschau mit den betroffenen Datensätzen und ihren Anzahlen bereitstellen. Eine Löschung SHALL erst nach ausdrücklicher Bestätigung der angezeigten Wirkung ausgeführt werden.

#### Scenario: Benutzer prüft eine Löschung

- **WHEN** ein berechtigter Benutzer die Löschung einer Region, eines Orts, einer Straße oder einer Hausnummer anfordert
- **THEN** sieht er zuerst die Anzahlen betroffener Adressdaten, Abholorte und E-Mail-Abos sowie die getrennte Anzahl bereits als `sent` markierter Outbox-Einträge
- **AND** erkennt er, dass mit `sent`-Einträgen gespeicherte Versandhistorie entfällt, bereits zugestellte E-Mails aber nicht zurückgerufen werden
- **AND** kann er weitere Anzahlen für Tour-Zuordnungen, ortsbezogene Termine, vollständig beziehungsweise teilweise betroffene Einsätze, Abo-Positionen und übrige Outbox-Einträge aufklappen
- **AND** sind die Folgen nach zu löschenden und erhaltenen Daten gruppiert; Zählwerte von null überladen die Bestätigung nicht
- **AND** die Vorschau enthält keine E-Mail-Adressen, Tokens oder Outbox-Payloads

#### Scenario: Vorschau wird noch geladen oder schlägt fehl

- **WHEN** die Löschvorschau noch lädt oder mit einem Fehler endet
- **THEN** kann der Benutzer die Löschung nicht bestätigen
- **AND** bei einem Fehler bleibt der Dialog offen und erlaubt einen neuen Versuch

#### Scenario: Die bestätigte Wirkung ist veraltet

- **GIVEN** seit der Vorschau hat sich ein betroffener Teilbaum oder seine abhängige Datenmenge geändert
- **WHEN** der Benutzer die Löschung bestätigt
- **THEN** lehnt das System die Mutation als Konflikt ab und verlangt eine aktualisierte Vorschau
- **AND** der Dialog bleibt offen und zeigt die neuen Folgen vor einer erneuten Bestätigung
- **AND** es löscht keine Datensätze

### Requirement: Adress-Stammdaten werden ohne verwaiste oder verbreiterte Folgeobjekte gelöscht

Das System SHALL eine bestätigte Adress-Löschung in einer Tenant-Datenbanktransaktion ausführen. Es SHALL die aktuelle Zielmenge serverseitig erneut bestimmen und SHALL bei Fehlern sämtliche Änderungen zurückrollen.

#### Scenario: Region wird gelöscht

- **WHEN** eine Region gelöscht wird
- **THEN** entfallen die Region, ihre Orte, deren Straßen und Hausnummern sowie alle Abholorte dieser Orte
- **AND** andere oder regionslose Orte und deren Abholorte bleiben bestehen

#### Scenario: Ort wird gelöscht

- **WHEN** ein Ort gelöscht wird
- **THEN** entfallen der Ort, seine Straßen und Hausnummern sowie alle Abholorte dieses Orts einschließlich ortsweiter Abholorte
- **AND** die Region und andere Orte bleiben bestehen

#### Scenario: Straße wird gelöscht

- **WHEN** eine Straße gelöscht wird
- **THEN** entfallen die Straße, ihre Hausnummern und alle Abholorte, die diese Straße oder eine ihrer Hausnummern verwenden
- **AND** ortsweite Abholorte und andere Straßen bleiben bestehen

#### Scenario: Hausnummer wird gelöscht

- **WHEN** eine Hausnummer gelöscht wird
- **THEN** entfallen die Hausnummer und alle Abholorte, die sie verwenden
- **AND** straßenweite Abholorte und andere Hausnummern bleiben bestehen

#### Scenario: Abholorte besitzen widersprüchliche Adressverweise

- **GIVEN** ein betroffener Abholort verweist auf eine Region, einen Ort, eine Straße oder eine Hausnummer außerhalb seiner tatsächlichen Elternkette
- **WHEN** die Löschung angefordert wird
- **THEN** meldet das System einen Datenkonflikt und führt keine Löschung aus

### Requirement: Folgebeziehungen einer Adress-Löschung bleiben fachlich konsistent

Das System SHALL mit einem gelöschten Abholort dessen Tour-Zuordnungen, ortsbezogene Termine und Einsatz-Verknüpfungen entfernen. Es SHALL alle vom gelöschten Adress-Teilbaum betroffenen E-Mail-Abos unabhängig von ihrem Status samt Abo-Positionen und Outbox-Einträgen aller Status entfernen.

#### Scenario: Einsatz besitzt weitere Abholorte

- **WHEN** ein Abholort aus einem Einsatz mit weiteren Abholorten gelöscht wird
- **THEN** entfällt nur seine Einsatz-Verknüpfung
- **AND** der Einsatz und seine anderen Abholorte bleiben bestehen

#### Scenario: Einsatz verliert den letzten Abholort

- **WHEN** ein Einsatz durch die Löschung seinen letzten Abholort verliert
- **THEN** entfällt auch der leere Einsatz
- **AND** die Tour bleibt bestehen

#### Scenario: Betroffene Abos und Outbox-Einträge entfallen

- **WHEN** ein Adress-Teilbaum mit E-Mail-Abos gelöscht wird
- **THEN** entfallen seine Abos in jedem Status, ihre Abo-Positionen und Outbox-Einträge einschließlich `sent`
- **AND** ortsweite Abos bleiben bei einer Straßen- oder Hausnummernlöschung erhalten
- **AND** Fraktionen, Touren und ihre allgemeinen Termin- und Verschiebungsregeln bleiben bestehen
- **AND** bereits zugestellte E-Mails werden nicht als rückholbar dargestellt
