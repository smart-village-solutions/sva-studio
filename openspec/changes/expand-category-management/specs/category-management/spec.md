## ADDED Requirements

### Requirement: Das Studio bietet eine vollständige mandantengebundene Kategorienverwaltung

Das System MUST berechtigten Benutzern eine eigenständige Kategorienverwaltung im bestehenden Kategorienmodul bereitstellen. Die Management-Sicht MUST aktive und inaktive lokale Kategorien mit stabiler ID, Name, Aktivstatus, Parent, Position, Icon, Benachrichtigungs-E-Mail, Datentypen sowie Erstellungs- und Änderungszeitpunkt darstellen.

Normale Kategorieauswahlen in Content-Editoren MUST weiterhin ausschließlich aktive Kategorien aus ihrem bestehenden Auswahlvertrag erhalten. Management-Daten dürfen nicht implizit in diese Auswahlpfade gelangen.

#### Scenario: Berechtigter Benutzer öffnet die Kategorienverwaltung

- **WHEN** ein Benutzer mit wirksamem `categories.read` und verwendbaren Mainserver-Management-Credentials die Kategorienseite öffnet
- **THEN** lädt das Studio die explizite Management-Sicht einschließlich inaktiver Kategorien
- **AND** stellt es die vollständigen Management-Felder ohne freie technische GraphQL-Daten dar

#### Scenario: Content-Editor lädt Kategorieoptionen

- **WHEN** ein Content-Editor den bestehenden parameterlosen Kategorie-Auswahlvertrag verwendet
- **THEN** liefert das Studio ausschließlich aktive Kategorien
- **AND** eine inaktive Management-Kategorie wird nicht auswählbar

#### Scenario: Management-Vertrag ist nicht verfügbar

- **WHEN** der Ziel-Mainserver die Management-Query oder die erforderliche Management-Rolle nicht bereitstellt
- **THEN** zeigt das Studio einen deterministischen Readiness- beziehungsweise Vertragsfehler
- **AND** fällt es nicht unbemerkt auf eine unvollständige Active-only-Verwaltungsansicht zurück

### Requirement: Kategorien lassen sich vollständig und verlustfrei anlegen und bearbeiten

Das System MUST Kategorien mit Name, Aktivstatus, optionalem Parent, optionaler Position, optionalem Icon, optionaler einzelner Benachrichtigungs-E-Mail und null bis mehreren Datentypen anlegen und anhand ihrer ID bearbeiten können. Create und Update MUST das vollständige fachliche Formularmodell validieren und über den typisierten Mainserver-Vertrag speichern. Ein Create MUST pro fachlichem Anlegeversuch einen stabilen `Idempotency-Key` verwenden und bei einem Retry desselben Versuchs denselben Schlüssel wiederverwenden.

Leere optionale Werte MUST ihre bestehende Zuordnung entfernen. Nach einem bestätigten Save MUST das Studio den führenden Management-Zustand neu laden und darf einen Erfolg nur bei leerer fachlicher Fehlerliste behaupten.

Name und optionale Textwerte MUST getrimmt werden. Der Name MUST nicht leer sein, die optionale Position MUST eine Ganzzahl ab `0` sein, und die optionale E-Mail MUST genau eine syntaktisch gültige Adresse enthalten. Icon- und Datentyp-Identifier MUST die bestätigten Vertragsgrenzen einhalten. Neue Kategorien MUST standardmäßig aktiv sein. Gleiche Positionen innerhalb derselben Hierarchieebene dürfen bestehen bleiben und MUST stabil nach Position, Name und ID dargestellt werden.

#### Scenario: Kategorie wird mit allen Feldern angelegt

- **WHEN** ein Benutzer mit `categories.create` ein gültiges vollständiges Formular absendet
- **THEN** erstellt das Studio die Kategorie über den hostgeführten `saveCategory`-Vertrag
- **AND** zeigt der anschließende Management-Read alle Werte verlustfrei an

#### Scenario: Kategorie wird ohne ausdrücklichen Status angelegt

- **WHEN** ein Benutzer das Create-Formular für eine neue Kategorie öffnet
- **THEN** ist die Kategorie standardmäßig aktiv
- **AND** wird dieser Zustand vor dem Absenden sichtbar und änderbar dargestellt

#### Scenario: Create-Antwort geht nach möglichem Upstream-Erfolg verloren

- **WHEN** ein Create mit unbekanntem Transportausgang wiederholt wird
- **THEN** verwendet das Studio denselben `Idempotency-Key` wie beim ursprünglichen Anlegeversuch
- **AND** liefert die Host-Fassade ein vorhandenes terminales Ergebnis als Replay zurück
- **AND** führt sie bei einer nichtterminalen Reservation keinen automatischen zweiten `saveCategory`-Aufruf aus
- **AND** lädt das Studio vor einer neuen Create-Entscheidung die Management-Sicht neu

#### Scenario: Bestehende Kategorie wird vollständig aktualisiert

- **WHEN** ein Benutzer mit `categories.update` Name, Status, Parent, Position, Icon, E-Mail oder Datentypen einer vorhandenen Kategorie ändert
- **THEN** verwendet das Studio ausschließlich die Kategorie-ID aus dem kanonischen Ressourcenpfad
- **AND** speichert es das vollständige validierte Modell atomar über den Mainserver
- **AND** lädt es nach bestätigtem Erfolg den aktuellen Zustand neu

#### Scenario: Optionaler Wert wird geleert

- **WHEN** ein Benutzer Parent, Position, Icon oder E-Mail im Formular ausdrücklich entfernt
- **THEN** übermittelt das Studio die passende Clear-Semantik an den Mainserver
- **AND** erscheint der Wert nach dem Save-Roundtrip nicht erneut

#### Scenario: Mainserver liefert feldbezogene Validierungsfehler

- **WHEN** `saveCategory` einen oder mehrere strukturierte Fehler mit Code und Feldbezug zurückgibt
- **THEN** behauptet das Studio keinen Erfolg
- **AND** ordnet es bekannte Fehler dem passenden lokalisierten Formularfeld zu
- **AND** bleiben die übrigen Formulareingaben zur Korrektur erhalten

#### Scenario: Eingabe verletzt den lokalen Formularvertrag

- **WHEN** Name leer, Position negativ oder nicht ganzzahlig, E-Mail syntaktisch ungültig oder ein Identifier außerhalb der bestätigten Vertragsgrenzen ist
- **THEN** blockiert das Studio den Upstream-Aufruf
- **AND** zeigt es einen lokalisierten feldbezogenen Fehler

#### Scenario: Geschwister besitzen dieselbe Position

- **WHEN** mehrere Kategorien derselben Hierarchieebene dieselbe Position besitzen
- **THEN** bleiben die Werte erhalten
- **AND** zeigt das Studio sie deterministisch nach Position, Name und ID

### Requirement: Parent- und Statusänderungen bleiben zyklusfrei und nachvollziehbar

Das System MUST `parentId: null` als Wurzelzuordnung unterstützen und bekannte Selbst- oder Nachfahrenbeziehungen bereits in der Parent-Auswahl ausschließen. Der Mainserver MUST dennoch die verbindliche mandantengebundene und atomare Zyklusprüfung ausführen.

Ändert ein Benutzer den Aktivstatus einer Kategorie mit Nachfahren, MUST das Studio die Kaskadenwirkung vor der Mutation verständlich bestätigen lassen. Nach Erfolg MUST die tatsächlich vom Mainserver gemeldete Menge `affectedDescendantIds` für Feedback und Refresh maßgeblich sein.

#### Scenario: Kategorie wird an die Wurzel verschoben

- **WHEN** ein Benutzer den Parent einer Kategorie entfernt und das Update bestätigt
- **THEN** sendet das Studio `parentId: null`
- **AND** zeigt der erneute Management-Read die Kategorie als Wurzelkategorie

#### Scenario: Ungültiger Parent wird ausgewählt oder manipuliert

- **WHEN** eine Kategorie selbst, ein Nachfahre oder eine fremde Municipality-Kategorie als Parent angefordert wird
- **THEN** wird die Änderung clientseitig verhindert oder serverseitig fail-closed abgewiesen
- **AND** entsteht kein partiell veränderter Kategorienbaum
- **AND** werden keine fremden Kategoriedetails offengelegt

#### Scenario: Parent-Status wird mit Nachfahren geändert

- **WHEN** ein Benutzer den Aktivstatus einer Kategorie mit Nachfahren ändern will
- **THEN** erklärt die UI vor dem Speichern die Kaskadenwirkung
- **AND** verlangt eine eindeutige Bestätigung
- **AND** meldet sie nach Erfolg die anhand von `affectedDescendantIds` tatsächlich betroffenen Nachfahren

### Requirement: Datentypzuordnungen verwenden kontrollierte Optionen und erhalten unbekannte Werte

Das System MUST auswählbare Studio-Datentypen aus dem vorhandenen validierten Plugin-/Content-Type-Registry-Snapshot beziehen und bestätigte Legacy-Mainserver-Typen kompatibel ergänzen. Die Kategorienoberfläche MUST menschenlesbare lokalisierte Bezeichnungen darstellen und darf keine freie Texteingabe für Datentyp-Identifier anbieten.

Bereits gespeicherte Datentypen, die im aktuellen Optionskatalog fehlen, MUST sichtbar bleiben und bei einem Update erneut übertragen werden, solange der Benutzer sie nicht ausdrücklich entfernt.

#### Scenario: Benutzer weist registrierte Datentypen zu

- **WHEN** ein Benutzer einen oder mehrere verfügbare Datentypen auswählt und speichert
- **THEN** übermittelt das Studio deren kanonische Identifier dedupliziert
- **AND** zeigt es nach dem Roundtrip dieselben Zuordnungen mit lokalisierten Bezeichnungen

#### Scenario: Gespeicherter Datentyp ist aktuell nicht registriert

- **WHEN** eine Kategorie einen gespeicherten Datentyp enthält, der im aktuellen Registry-Snapshot und Legacy-Katalog fehlt
- **THEN** zeigt das Studio den Identifier als nicht mehr auswählbaren vorhandenen Wert
- **AND** erhält es ihn bei einem Save ohne ausdrückliche Entfernung
- **AND** bietet es ihn nicht als neue Option für andere Kategorien an

#### Scenario: Benutzer entfernt einen unbekannten gespeicherten Datentyp

- **WHEN** ein Benutzer einen als nicht verfügbar gekennzeichneten vorhandenen Datentyp ausdrücklich entfernt und speichert
- **THEN** darf das Studio ihn aus dem vollständigen Save-Input entfernen
- **AND** zeigt es nach dem Roundtrip die Entfernung an

### Requirement: Kategorien werden ausschließlich über Safe-Delete gelöscht

Das System MUST vor dem Löschen die konkrete Kategorie bestätigen lassen und ausschließlich die kategoriespezifische Mainserver-Mutation `deleteCategory` verwenden. Ein Löschen MUST blockiert bleiben, wenn Kinder, Content-Zuordnungen, External-Service-Zuordnungen, Data-Resource-Settings oder Notification-Konfigurationen vorhanden sind.

Das Studio MUST die zurückgegebenen Usage-Zahlen verständlich darstellen und darf weder rekursiv löschen noch Inhalte automatisch verschieben oder umkategorisieren.

#### Scenario: Ungenutzte Kategorie wird gelöscht

- **WHEN** ein Benutzer mit `categories.delete` eine ungenutzte Kategorie eindeutig bestätigt
- **THEN** löscht das Studio sie über `deleteCategory`
- **AND** behauptet Erfolg nur bei vorhandener `deletedCategoryId` und leerer Fehlerliste
- **AND** entfernt der anschließende Management-Read die Kategorie aus der Liste

#### Scenario: Kategorie ist noch in Benutzung

- **WHEN** `deleteCategory` das Löschen mit `CATEGORY_IN_USE` blockiert
- **THEN** bleibt die Kategorie bestehen
- **AND** zeigt das Studio die gelieferten Usage-Zahlen nach Referenzart
- **AND** führt es keinen alternativen oder rekursiven Löschpfad aus

#### Scenario: Referenz entsteht unmittelbar vor dem Löschen

- **WHEN** der angezeigte Snapshot keine Nutzung enthält, vor der Mutation aber eine Referenz entsteht
- **THEN** ist die Mainserver-Entscheidung zum Mutationszeitpunkt maßgeblich
- **AND** zeigt das Studio die aktualisierte Blockade statt eines erfundenen Erfolgs

### Requirement: Kategorienaktionen sind getrennt autorisiert und zugänglich bedienbar

Das System MUST Read, Create, Update und Delete jeweils mit `categories.read`, `categories.create`, `categories.update` und `categories.delete` autorisieren. UI-Verfügbarkeit und Serverausführung MUST dieselbe Action-Semantik verwenden; die serverseitige Prüfung bleibt verbindlich.

Alle Kategorienformulare, Auswahlfelder, Dialoge, Statusmeldungen und Fehler MUST lokalisiert, per Tastatur bedienbar, screenreader-tauglich und mit vorhandenen Studio-/shadcn-Komponenten umgesetzt sein.

#### Scenario: Benutzer besitzt nur Leserecht

- **WHEN** ein Benutzer ausschließlich `categories.read` besitzt
- **THEN** kann er die Management-Liste lesen
- **AND** sind Create-, Update- und Delete-Aktionen nicht verfügbar
- **AND** lehnt der Server einen manipulierten Mutationsrequest vor dem Upstream-Aufruf ab

#### Scenario: Benutzer besitzt nur einen Teil der Mutationsrechte

- **WHEN** ein Benutzer beispielsweise `categories.update`, aber nicht `categories.create` oder `categories.delete` besitzt
- **THEN** bietet die UI ausschließlich die Update-Aktion an
- **AND** akzeptiert der Server keine Create- oder Delete-Mutation mit dem Update-Recht

#### Scenario: Formular enthält Fehler

- **WHEN** ein Kategorienformular feldbezogene oder allgemeine Fehler enthält
- **THEN** werden Fehler programmatisch mit den betroffenen Feldern verknüpft und verständlich angekündigt
- **AND** erreicht der Fokus eine sinnvolle Fehler- oder Formularposition
- **AND** bleiben Korrektur und erneutes Absenden vollständig per Tastatur möglich
