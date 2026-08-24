## ADDED Requirements

### Requirement: Tourbezogene Ausweichtermine sind aus ihrem Arbeitskontext erreichbar

Das System SHALL berechtigten Benutzern ermöglichen, die bestehende Erstellungsansicht für tourbezogene Ausweichtermine direkt aus Tourenliste, Verschiebungsdetails, Jahreskalender und Terminlogik einer gespeicherten wiederkehrenden Tour in einem neuen Browser-Tab zu öffnen, ohne den Ausgangskontext zu ersetzen.

#### Scenario: Neuer Browser-Tab erhält den begonnenen Workflow

- **WHEN** ein Benutzer einen kontextuellen Einstieg zum Anlegen eines tourbezogenen Ausweichtermins aktiviert
- **THEN** öffnet das System die bestehende Scheduling-Erstellungsansicht über einen nativen sicheren Link in einem neuen Browser-Tab
- **AND** der ursprüngliche Browser-Tab behält seinen Listen-, Filter-, Kalender-, Dialog- und Formularzustand
- **AND** Speichern oder Abbrechen verändert ausschließlich den neuen Browser-Tab

#### Scenario: Benutzer legt aus der Verschiebungsspalte einen Ausweichtermin an

- **WHEN** ein Benutzer mit `waste-management.scheduling.manage` in der Tourenliste eine Tour ohne Verschiebungen sieht oder die vorhandenen Verschiebungen einer Tour geöffnet hat
- **THEN** bietet das System in der Tabellenzelle die räumlich kompakte Aktion `Anlegen` an
- **AND** ihr zugänglicher Name benennt den tourbezogenen Ausweichtermin, die Tour und den neuen Browser-Tab vollständig
- **AND** der geöffnete Detaildialog verwendet sichtbar die eindeutige Bezeichnung `Tourbezogenen Ausweichtermin anlegen`
- **AND** die bestehende Scheduling-Erstellungsansicht wird in einem neuen Browser-Tab mit der betroffenen Tour vorausgewählt geöffnet

#### Scenario: Benutzer verschiebt einen regulären Termin aus dem Jahreskalender

- **WHEN** ein Benutzer mit `waste-management.scheduling.manage` im Jahreskalender einen regulären, noch nicht verschobenen Termin einer turnusbasierten Tour auswählt
- **THEN** öffnet das System die bestehende Scheduling-Erstellungsansicht für einen tourbezogenen Ausweichtermin in einem neuen Browser-Tab
- **AND** Tour und ursprüngliches Datum sind vorausgefüllt
- **AND** das Zieldatum bleibt eine bewusste Eingabe des Benutzers
- **AND** der sichtbare Aktionstext bleibt räumlich kompakt
- **AND** der zugängliche Name benennt Datum, Tour und den neuen Browser-Tab vollständig

#### Scenario: Bereits verschobener Kalendertermin erzeugt keine zweite Aktion

- **WHEN** der Jahreskalender einen bereits verschobenen Ersatztermin darstellt
- **THEN** bietet das System an diesem Ersatztermin keine Aktion zum Anlegen einer weiteren Verschiebung an
- **AND** der Ursprungstermin bleibt wie bisher nachvollziehbar

#### Scenario: Kontextuelle Erstellung bleibt auf Tourverschiebung fokussiert

- **WHEN** die Erstellungsansicht über einen gültigen Tourkontext geöffnet wurde
- **THEN** zeigt das System statt der Typauswahl einen kompakten Kontextblock mit Tour und optionalem Originaldatum
- **AND** Tour und Originaldatum bleiben in ihren Formularfeldern bewusst korrigierbar
- **AND** die allgemeine Scheduling-Erstellung ohne Tourkontext behält ihre bestehende Typauswahl

### Requirement: Kontextuelle Vorauswahl bleibt sicher und reload-stabil

Das System SHALL Tour und optionales Originaldatum über eigene normalisierte Search-Parameter initial vorausfüllen, ohne spätere Benutzereingaben zu überschreiben oder fremden Tourformularzustand wiederzuverwenden.

#### Scenario: Gültiger Kontext wird genau einmal übernommen

- **WHEN** `schedulingTourId` eine verfügbare Tour und `schedulingOriginalDate` ein gültiges ISO-Kalenderdatum bezeichnet
- **THEN** übernimmt das System beide Werte nach dem Laden genau einmal in ein noch unbearbeitetes Formular
- **AND** spätere Benutzereingaben werden nicht durch Lade- oder Navigationseffekte überschrieben
- **AND** ein Reload stellt die ursprüngliche Vorauswahl aus der URL wieder her

#### Scenario: Ungültiger Route-Kontext wird sichtbar verworfen

- **WHEN** eine kontextuelle Erstellungs-URL ein ungültiges Datum oder eine nicht verfügbare Tour enthält
- **THEN** übernimmt das System den ungültigen Wert nicht in das Formular
- **AND** zeigt einen nicht blockierenden Hinweis auf die nicht mehr verfügbare Vorauswahl
- **AND** ein Ausweichtermin kann nicht unbemerkt mit veraltetem Route-Kontext gespeichert werden

#### Scenario: Widersprüchlicher globaler Kontext verwirft Tourparameter

- **WHEN** eine URL `schedulingEntryType=global-shift` mit Tourkontext kombiniert
- **THEN** verwirft das System `schedulingTourId` und `schedulingOriginalDate`
- **AND** zeigt keine tourbezogene Vorauswahl in der globalen Erstellung

#### Scenario: Verlassen der Erstellung bereinigt den Kontext

- **WHEN** ein Benutzer die kontextuelle Erstellung abbricht oder erfolgreich speichert
- **THEN** entfernt das System beide Kontextparameter aus der folgenden Listen-URL

### Requirement: Tourformular verwendet ausschließlich gespeicherte Terminlogik als Verschiebungskontext

Das System SHALL den Einstieg aus dem Tourformular nur für eine gespeicherte turnusbasierte Tour und nur auf Basis ihres persistierten Terminstands anbieten.

#### Scenario: Gespeicherte turnusbasierte Tour bietet den Einstieg an

- **WHEN** ein Benutzer mit `waste-management.scheduling.manage` eine gespeicherte Tour mit festem Turnus oder gespeichertem Abstandspreset bearbeitet
- **THEN** bietet die Terminlogik eine Aktion zum Anlegen eines tourbezogenen Ausweichtermins an
- **AND** die bestehende Scheduling-Erstellungsansicht wird in einem neuen Browser-Tab mit der gespeicherten Tour vorausgewählt geöffnet

#### Scenario: Ungespeicherte Terminänderung blockiert den Einstieg

- **WHEN** Turnus, Abstandspreset, Startdatum oder Enddatum vom persistierten Tourstand abweicht
- **THEN** bleibt die Erstellungsaktion sichtbar, aber deaktiviert
- **AND** ein zugänglicher Hinweis fordert zum vorherigen Speichern der Tour auf
- **AND** Änderungen ausschließlich an Name, Beschreibung oder Sichtbarkeit blockieren die Aktion nicht

#### Scenario: Direkte Terminpflege bleibt von Verschiebungsregeln getrennt

- **WHEN** ein Benutzer eine gespeicherte individuelle oder bedarfsabhängige Tour bearbeitet
- **THEN** bietet die Terminlogik keinen kontextuellen Einstieg für eine Verschiebungsregel an
- **AND** eine ungespeicherte Umstellung auf einen Turnus schaltet die Aktion nicht vorzeitig frei
- **AND** individuelle Termine und explizite Tour-Einsätze werden weiterhin direkt an der Tour gepflegt

#### Scenario: Schreibaktion folgt der Scheduling-Berechtigung

- **WHEN** ein Benutzer nicht über `waste-management.scheduling.manage` verfügt
- **THEN** zeigt das System keine der kontextuellen Erstellungsaktionen an
- **AND** die lesenden Tour- und Kalenderinformationen bleiben gemäß den bestehenden Rechten sichtbar

### Requirement: Tourbezogene Ausweichtermine sind pro Ursprung und Spezifität eindeutig

Das System SHALL mehrdeutige tourbezogene Ausweichtermine konkurrenzsicher verhindern und zwischen jahresunabhängiger Grundregel und jahresbezogener Ausnahme unterscheiden.

#### Scenario: Zweite jahresbezogene Regel wird abgelehnt

- **WHEN** für dieselbe Tour und dasselbe vollständige Originaldatum bereits eine jahresbezogene Regel existiert
- **THEN** lehnt das System eine zweite Regel derselben Spezifität mit `409 Conflict` ab
- **AND** überschreibt die vorhandene Regel nicht

#### Scenario: Zweite jahresunabhängige Regel wird abgelehnt

- **WHEN** für dieselbe Tour und denselben Monat und Tag bereits eine jahresunabhängige Regel existiert
- **THEN** lehnt das System eine zweite jahresunabhängige Regel mit `409 Conflict` ab
- **AND** überschreibt die vorhandene Regel nicht

#### Scenario: Jahresbezogene Ausnahme überschreibt jährliche Grundregel

- **GIVEN** für eine Tour gilt eine jahresunabhängige Grundregel an einem Monat und Tag
- **WHEN** für dasselbe konkrete Originaldatum eines Jahres eine jahresbezogene Regel existiert
- **THEN** verwendet das System in diesem Jahr ausschließlich die jahresbezogene Regel
- **AND** wendet die jährliche Grundregel nicht zusätzlich auf dasselbe Vorkommen an
- **AND** in anderen Jahren bleibt die jährliche Grundregel wirksam

#### Scenario: Benutzer erkennt die Override-Wirkung vor dem Speichern

- **WHEN** eine jahresbezogene Ausnahme eine vorhandene jährliche Grundregel für dasselbe Vorkommen verdrängen würde
- **THEN** zeigt das Formular einen nicht blockierenden Hinweis auf das betroffene Jahr
- **AND** der Benutzer kann die ausdrückliche Ausnahme speichern

### Requirement: Tourbezogene Ausweichtermine verwenden einen zeitzonenfreien Date-only-Vertrag

Das System SHALL Original- und Zieldatum als PostgreSQL `DATE` persistieren und außerhalb der Datenbank ausschließlich als normalisierte ISO-Kalenderdaten ohne Uhrzeit- oder Zeitzonenbedeutung transportieren.

#### Scenario: Prozesszeitzone verändert kein Kalenderdatum

- **WHEN** dieselbe Tourverschiebung unter unterschiedlichen Prozesszeitzonen einschließlich `Europe/Berlin` geladen, berechnet oder dargestellt wird
- **THEN** bleiben Original- und Zieldatum als `YYYY-MM-DD` identisch
- **AND** Sommer- oder Winterzeit verschiebt keinen Wert auf den vorherigen oder folgenden Kalendertag

#### Scenario: Datenbank erzwingt Datumstyp und Eindeutigkeit

- **WHEN** das Waste-Tenant-Schema für tourbezogene Ausweichtermine provisioniert oder migriert wird
- **THEN** sind `original_date` und `actual_date` als PostgreSQL `DATE` definiert
- **AND** partielle Unique-Indizes schützen jahresbezogene Regeln nach vollständigem Datum sowie jahresunabhängige Regeln nach Monat und Tag
- **AND** Repository-Grenzen geben die Werte unabhängig vom Session-`DateStyle` als `YYYY-MM-DD` aus und wandeln sie nicht implizit in JavaScript-`Date`-Objekte um

#### Scenario: Unerwarteter Bestand stoppt den harten Schemaschnitt

- **WHEN** der Migrations-Preflight entgegen der bestätigten Ausgangslage zu erhaltende Ausweichtermin-Daten findet
- **THEN** stoppt die Migration fail-closed
- **AND** führt weder eine automatische Dublettenbereinigung noch eine geratene Datumstransformation aus
