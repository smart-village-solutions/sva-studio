## ADDED Requirements

### Requirement: Waste-Management erkennt ausstehende Mainserver-Terminabgleiche ohne Dry-Run

Das System MUST für die aktive Instanz erkennen, ob Mainserver-relevante Änderungen der externen Waste-Fachdatenbank nach dem letzten erfolgreichen Terminabgleich committed wurden, ohne beim Statuslesen den SVA Mainserver abzufragen oder die vollständige Differenz zu berechnen.

#### Scenario: Mainserver-relevante Waste-Daten werden geändert

- **WHEN** eine Anlage, Änderung oder Löschung committed wird, die den bestehenden Mainserver-Terminmaterialisierungspfad beeinflusst
- **THEN** erhöht die externe Waste-Fachdatenbank ihren monotonen Quelländerungsstand
- **AND** zeigt der Status bis zu einem kompatiblen erfolgreichen Abgleich `pending`

#### Scenario: Nicht materialisierte Waste-Daten werden geändert

- **WHEN** ausschließlich PDF-Stamminhalte, Reminder-Betriebsdaten oder andere nicht in Mainserver-Termine einfließende Felder geändert werden
- **THEN** erhöht das System den Mainserver-Terminänderungsstand nicht
- **AND** erzeugt diese Änderung allein keinen ausstehenden Terminabgleich

#### Scenario: Status wird beim Öffnen der Waste-Seite gelesen

- **WHEN** ein berechtigter Benutzer die Waste-Seite öffnet
- **THEN** liest das System nur den tenantlokalen Quelländerungsstand, die zentrale Jobhistorie und das erwartete Jahresfenster
- **AND** ruft weder den SVA Mainserver noch den Diff-Algorithmus auf

#### Scenario: Status kann nicht sicher ermittelt werden

- **WHEN** die Waste-Datenbank nicht erreichbar ist, der letzte erfolgreiche Job keinen kompatiblen Revisionsnachweis enthält oder Statusmetadaten ungültig sind
- **THEN** liefert das System `unknown`
- **AND** behauptet keinen sauberen Mainserver-Abgleich

### Requirement: Erfolgreiche Mainserver-Jobs bestätigen eine konkrete Waste-Quellrevision

Das System MUST den letzten erfolgreichen Terminabgleich aus dem zentralen Plugin-Operations-Jobstore bestimmen und im terminalen Jobergebnis die tatsächlich gelesene Waste-Quellrevision sowie das verarbeitete Jahresfenster persistieren.

#### Scenario: Letzter erfolgreicher Abgleich wird bestimmt

- **WHEN** mehrere gestartete, erfolgreiche, fehlgeschlagene oder abgebrochene Mainserver-Sync-Jobs vorhanden sind
- **THEN** gilt ausschließlich der nach `finishedAt` jüngste Job derselben Instanz mit Jobtyp `waste-management.sync-mainserver`, Status `succeeded` und kompatiblem Ergebnis als letzter erfolgreicher Abgleich
- **AND** werden Startzeit, Fehlerjob oder bloßes Job-Event nicht als Erfolg interpretiert

#### Scenario: Job liest einen konsistenten Quellstand

- **WHEN** ein Mainserver-Sync-Job seinen Waste-Quellbestand lädt
- **THEN** liest er Quellrevision und materialisierungsrelevante Daten aus einem konsistenten PostgreSQL-Snapshot
- **AND** persistiert die gelesene Revision und das verwendete Jahresfenster im erfolgreichen Jobergebnis

#### Scenario: Waste-Daten ändern sich während des Jobs

- **WHEN** nach dem gelesenen Quellsnapshot eine weitere Mainserver-relevante Änderung committed wird
- **THEN** besitzt die externe Waste-Datenbank eine höhere Revision als der erfolgreiche Job
- **AND** bleibt der Status nach Jobabschluss `pending`

#### Scenario: Materialisierungsfenster wechselt

- **WHEN** das aktuelle und folgende Kalenderjahr nicht mehr dem Jahresfenster des letzten erfolgreichen Jobs entsprechen
- **THEN** zeigt das System auch ohne neue Datenmutation `pending`
- **AND** verlangt keinen Dry-Run, um diesen Zustand zu bestimmen

#### Scenario: Mainserver wurde außerhalb des Studio-Sync-Pfads verändert

- **WHEN** ein fremder Prozess den SVA Mainserver direkt verändert, ohne die Waste-Quelldatenbank oder den Studio-Sync-Job zu verwenden
- **THEN** behauptet der Quelländerungsstatus keine vollständige Datenparität
- **AND** bleibt eine solche Fremdänderung außerhalb dieses Statusvertrags

### Requirement: Ausstehender Waste-Mainserver-Abgleich ist handlungsleitend sichtbar

Das System MUST den Mainserver-Synchronisierungsbedarf im Waste-Fachbereich eindeutig darstellen und den echten Background-Job nach seinem Start aus dem zentralen Jobvertrag verfolgen.

#### Scenario: Waste-Seitenkopf bleibt mit anderen Plugins konsistent

- **WHEN** die Waste-Management-Hauptseite unabhängig vom Synchronisierungsstatus dargestellt wird
- **THEN** verwendet sie den gemeinsamen Studio-Seitenkopf für Breadcrumb, H1, fachliche Beschreibung und den optionalen Verweis zur öffentlichen Abfallkalender-Webversion
- **AND** benennen der aktuelle Breadcrumb und die H1 die Seite einheitlich als `Abfallkalender`
- **AND** erscheinen Synchronisierungsstatus und Synchronisierungsaktion gemeinsam in einem direkt folgenden Bereich vor der Waste-Tabnavigation
- **AND** wird die Synchronisierungsaktion nicht als davon getrennte primäre Headeraktion dargestellt

#### Scenario: Änderungen stehen zur Synchronisierung aus

- **WHEN** der Status `pending` ist und der Benutzer den Mainserver-Abgleich ausführen darf
- **THEN** zeigt die UI einen kompakten Statusblock `Abgleich steht aus`
- **AND** hebt sie darin die Synchronisierungsaktion `Änderungen synchronisieren` mit vorhandenen Design-System-Mitteln hervor
- **AND** benennt textlich, dass ein Abgleich aussteht
- **AND** fordert dazu auf, vor dem Start alle geplanten Änderungen an Terminen und Abholorten abzuschließen und zu speichern
- **AND** erklärt, dass Änderungen während oder nach der Übertragung einen weiteren Abgleich erfordern
- **AND** verwendet Farbe nicht als einziges Unterscheidungsmerkmal

#### Scenario: Dringende Änderung ist während eines Abgleichs erforderlich

- **WHEN** ein Benutzer während eines laufenden Mainserver-Abgleichs eine dringende Waste-Änderung speichern muss
- **THEN** blockiert der beratende Hinweis die fachliche Mutation nicht
- **AND** bleiben aktiver Job und Quellzustand als getrennte Vertragsfelder darstellbar
- **AND** bleibt die neuere Quellrevision nach Jobabschluss als `pending` sichtbar
- **AND** kann der Benutzer den erforderlichen weiteren Abgleich anschließend gezielt starten

#### Scenario: Kein Abgleich steht aus

- **WHEN** aktuelle Quellrevision und Jahresfenster durch den letzten erfolgreichen Job bestätigt sind
- **THEN** zeigt die UI den Status `clean`
- **AND** zeigt sie keinen Synchronisierungsbutton
- **AND** nennt sie unaufdringlich den letzten erfolgreichen Abschlusszeitpunkt

#### Scenario: Synchronisierungsstatus ist unbekannt

- **WHEN** der Status `unknown` ist und der Benutzer den Mainserver-Abgleich ausführen darf
- **THEN** zeigt die UI einen Warnblock, ohne offene Änderungen oder Datenparität zu behaupten
- **AND** bleibt die manuelle Synchronisierungsaktion innerhalb dieses Blocks verfügbar

#### Scenario: Benutzer darf den erforderlichen Abgleich nicht starten

- **WHEN** der Quellzustand `pending` oder `unknown` ist und der Benutzer keine Ausführungsberechtigung für den Mainserver-Abgleich besitzt
- **THEN** zeigt die UI den fachlichen Zustand ohne Synchronisierungsaktion
- **AND** erklärt sie bei `pending`, dass eine berechtigte Person den Abgleich starten muss
- **AND** exponiert der Lesepfad keine Secrets oder rohen Mainserver-Daten

#### Scenario: Synchronisierungsstatus wird initial geladen

- **WHEN** die Waste-Seite den Synchronisierungsstatus noch lädt
- **THEN** zeigt sie einen kompakten höhenstabilen Ladezustand
- **AND** behauptet sie weder `clean` noch `pending`

#### Scenario: Synchronisierungsjob läuft

- **WHEN** der zentrale Jobstatus `queued`, `running` oder `retrying` ist
- **THEN** ersetzt die UI im Statusbereich den Startbutton durch den zentralen Jobstatus und einen Weg zum dauerhaften Vorgang
- **AND** bietet sie keinen konkurrierenden zweiten Jobstart aus derselben Aktion an
- **AND** bleibt ein nach dem gelesenen Jobsnapshot entstandener erneuter Quellbedarf unabhängig vom aktiven Job ausdrückbar

#### Scenario: Letzter Synchronisierungsversuch ist fehlgeschlagen

- **WHEN** der letzte relevante Mainserver-Sync fehlgeschlagen ist und kein späterer erfolgreicher Job den Quellabgleich bestätigt
- **THEN** bleiben Fehlerhinweis und erneute Synchronisierungsaktion gemeinsam im Fehlerblock sichtbar
- **AND** zeigt die UI den Zustand nicht als `clean`

#### Scenario: Synchronisierungsjob wurde angenommen

- **WHEN** der Host den Mainserver-Sync-Job erfolgreich annimmt
- **THEN** bestätigt die UI den Start mit stabiler Job-ID und zentralem Jobstatus
- **AND** erklärt, dass die Terminanzahl im tatsächlichen Abgleich ermittelt wird
- **AND** erzeugt keinen konkurrierenden pluginlokalen Jobstatus

#### Scenario: Echter Job hat die Differenz geplant

- **WHEN** der laufende Job den echten Mainserver-Snapshot geladen und die Create-/Delete-Differenz berechnet hat
- **THEN** persistiert er geplante Übertragungs-, Lösch- und Gesamtzahlen im zentralen Jobfortschritt
- **AND** zeigt die UI zu übertragende und zu entfernende Termine getrennt an
- **AND** weist darauf hin, dass die Verarbeitung bis zu einer Stunde dauern kann

#### Scenario: Job endet erfolgreich oder fehlerhaft

- **WHEN** der verfolgte Job einen Terminalstatus erreicht
- **THEN** leitet die UI Erfolg oder Fehler aus dem zentralen Jobdatensatz ab
- **AND** aktualisiert den Quellabgleichsstatus erneut
- **AND** bleiben Fehler und weiterhin ausstehende Änderungen handlungsleitend sichtbar

#### Scenario: Status- und Progresswerte werden zugänglich aktualisiert

- **WHEN** Jobstatus oder bedeutende Jobphase wechselt
- **THEN** kündigt die UI den Wechsel zugänglich und gedrosselt an
- **AND** verschiebt sie den Fokus nicht automatisch
- **AND** erzeugt sie für numerische Einzelupdates keine unkontrollierte Live-Region-Kette
- **AND** verwendet sie assertive Alert-Semantik nur für echte Fehler, nicht für dauerhafte `clean`- oder `pending`-Hinweise
