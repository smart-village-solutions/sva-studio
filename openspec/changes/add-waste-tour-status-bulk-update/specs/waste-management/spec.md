## ADDED Requirements

### Requirement: Waste-Touren besitzen einen eindeutigen redaktionellen Status

Das System SHALL jede Waste-Tour ausschließlich mit einem der Status `draft`, `published` oder
`archived` führen. Es SHALL nur `published` als operative und öffentlich ausspielbare Tour
behandeln und SHALL `draft` sowie `archived` weiterhin im Studio bearbeitbar halten.

#### Scenario: Neue Tour beginnt als Entwurf

- **WHEN** eine Tour regulär neu angelegt, dupliziert oder ohne expliziten Status importiert wird
- **THEN** speichert das System sie mit `status = draft`
- **AND** veröffentlicht oder materialisiert es ihre Termine nicht

#### Scenario: Benutzer archiviert eine Tour

- **WHEN** ein berechtigter Benutzer eine Tour auf `archived` setzt
- **THEN** bleibt die Tour im Studio sichtbar und bearbeitbar
- **AND** kann sie später auf `draft` oder `published` gesetzt werden
- **AND** gilt sie nicht als öffentlich oder operativ

#### Scenario: Bestandsdaten werden eindeutig migriert

- **WHEN** ein Waste-Schema mit dem bisherigen Feld `active` migriert wird
- **THEN** wird `active = true` als `published` übernommen
- **AND** wird `active = false` als `draft` übernommen
- **AND** wird kein Bestandsdatensatz ohne ausdrückliche Information als `archived` klassifiziert

#### Scenario: Getrennte Releases verwenden eine befristete Kompatibilität

- **GIVEN** Studio und Public-Waste-App werden über getrennte Releasepfade ausgeliefert
- **WHEN** noch ein produktiver Verbraucher das bisherige Feld `active` benötigt
- **THEN** hält die Migration `active` und `status` deterministisch konsistent
- **AND** verhindert sie widersprüchliche Schreibwerte
- **AND** wird die Kompatibilität nach nachgewiesener Umstellung aller Verbraucher vollständig
  entfernt

#### Scenario: Legacy-Import enthält einen Aktivstatus

- **WHEN** ein unterstütztes Legacy-Datenaustauschprofil `active` statt `status` enthält
- **THEN** übernimmt der Import `true` als `published` und `false` als `draft`
- **AND** schreibt ein neuer Export ausschließlich `status`

### Requirement: Waste-Management ändert den Status ausgewählter Touren atomar

Das System SHALL berechtigten Benutzern erlauben, mehrere ausdrücklich ausgewählte Waste-Touren
in einer atomaren Sammelaktion auf `draft`, `published` oder `archived` zu setzen. Es MUST den
gewünschten Zielstatus statt einer Toggle-Anweisung übertragen und MUST die bestehende
Berechtigung `waste-management.tours.manage` serverseitig durchsetzen.

#### Scenario: Benutzer wählt mehrere Touren manuell aus

- **WHEN** ein Benutzer einzelne Touren über ihre Zeilen-Checkboxen auswählt
- **THEN** bleibt jede Auswahl an die jeweilige Tour-ID gebunden
- **AND** zeigt die Oberfläche jederzeit die vollständige Anzahl ausgewählter Touren
- **AND** ist die Sammelaktion ohne Auswahl nicht ausführbar

#### Scenario: Benutzer wählt die vollständige gefilterte Ergebnismenge aus

- **GIVEN** die gefilterte Tourenliste umfasst mehrere Seiten
- **WHEN** der Benutzer `Alle gefilterten Touren auswählen` aktiviert
- **THEN** wählt das System alle Touren der vollständigen gefilterten Ergebnismenge aus
- **AND** begrenzt es die Auswahl nicht auf die aktuell sichtbare Seite
- **AND** kann der Benutzer einzelne Touren anschließend wieder abwählen

#### Scenario: Benutzer ändert den Filter bei bestehender Auswahl

- **WHEN** ein Benutzer einen Listenfilter anwendet, ändert oder zurücksetzt
- **THEN** wählt das System keine zusätzliche Tour automatisch aus
- **AND** verwirft es keine weiterhin vorhandene ausgewählte Tour
- **AND** weist es die Anzahl ausgewählter Touren außerhalb des aktuellen Filters aus
- **AND** verändert es keinen Tourstatus

#### Scenario: Benutzer bestätigt einen Zielstatus

- **GIVEN** mindestens eine Tour ist ausgewählt
- **WHEN** der Benutzer im Bestätigungsdialog `Entwurf`, `Veröffentlicht` oder `Archiviert` als
  Zielstatus wählt und ausdrücklich bestätigt
- **THEN** zeigt der Dialog Anzahl und Zielstatus der betroffenen Touren
- **AND** setzt der Server denselben Zielstatus für alle ausgewählten Touren in einer Transaktion
- **AND** bleiben alle übrigen Tourfelder und Beziehungen unverändert
- **AND** lädt die Oberfläche nach Erfolg die Tourenliste neu und leert die Auswahl

#### Scenario: Wiederholte Zielsetzung ist idempotent

- **WHEN** eine ausgewählte Tour bereits den gewünschten Zielstatus besitzt
- **THEN** bleibt ihr fachlicher Zustand unverändert
- **AND** führt dies nicht zu einem Teilerfolg oder Fehler für die übrige Auswahl

#### Scenario: Benutzer bricht den Dialog ab

- **WHEN** der Benutzer den Statusdialog ohne Bestätigung schließt
- **THEN** sendet die Oberfläche keinen Änderungsrequest
- **AND** bleiben Auswahl und Tourstatus unverändert

#### Scenario: Eine ausgewählte Tour fehlt oder die Speicherung schlägt fehl

- **WHEN** mindestens eine angeforderte Tour nicht mehr vorhanden ist oder ein Datenbankzugriff
  fehlschlägt
- **THEN** rollt der Server die vollständige Statusänderung zurück
- **AND** bleibt keine ausgewählte Tour teilweise geändert
- **AND** zeigt die Oberfläche einen Fehler, behält die Auswahl und meldet keinen Erfolg

#### Scenario: Berechtigung oder Request-Schutz fehlt

- **WHEN** ein Request ohne `waste-management.tours.manage`, gültigen Instanzkontext oder gültigen
  CSRF-Nachweis eingeht
- **THEN** lehnt der Server ihn vor der Fachmutation ab
- **AND** wird keine Tour geändert

#### Scenario: Sammeländerung ist per Tastatur und Screenreader bedienbar

- **WHEN** ein Benutzer Auswahl, Sammelaktion, Zielstatus und Bestätigung ohne Zeigegerät bedient
- **THEN** besitzen alle Controls eindeutige zugängliche Namen und Zustände
- **AND** wird der Fehlerzustand assistiven Technologien als Meldung bekannt gegeben

## MODIFIED Requirements

### Requirement: Waste-Management prüft die lückenlose Fraktionszuordnung aktiver Abholorte

Das System SHALL für eine gewählte Abfallfraktion und einen einschließlich begrenzten Prüfzeitraum
ermitteln, ob jeder aktive Abholort durch mindestens eine Standort–Tour-Zuordnung zu einer
veröffentlichten Tour dieser Fraktion lückenlos abgedeckt ist.

#### Scenario: Mehrere Zuordnungen decken den Prüfzeitraum gemeinsam ab

- **WHEN** sich die zentralen Gültigkeitszeiträume mehrerer einem aktiven Abholort zugeordneter
  veröffentlichter Touren derselben Fraktion überlappen oder unmittelbar aneinander anschließen
- **THEN** bewertet das System den Abholort als vollständig abgedeckt

#### Scenario: Abholort besitzt keine passende Zuordnung

- **WHEN** ein aktiver Abholort keiner Tour der gewählten Fraktion zugeordnet ist
- **THEN** weist das System den Abholort als `Keine Zuordnung` aus

#### Scenario: Abholort ist nur nicht veröffentlichten Touren zugeordnet

- **WHEN** ein aktiver Abholort für die gewählte Fraktion ausschließlich Touren im Status `draft`
  oder `archived` zugeordnet ist
- **THEN** berücksichtigt das System diese Touren nicht als operative Abdeckung
- **AND** weist den Abholort als `Keine Zuordnung` aus

#### Scenario: Passende Zuordnungen lassen zeitliche Lücken

- **WHEN** ein aktiver Abholort passenden veröffentlichten Touren zugeordnet ist, deren zentrale
  Gültigkeitszeiträume den Prüfzeitraum nicht vollständig abdecken
- **THEN** weist das System den Abholort als `Zeitraum unvollständig` aus
- **AND** zeigt die nicht abgedeckten Zeiträume an

#### Scenario: Unbegrenzte Tourgrenze deckt den Prüfzeitraum ab

- **WHEN** Start- oder Enddatum einer passenden Tour leer ist
- **THEN** behandelt das System die jeweilige Grenze für die Prüfung als unbegrenzt

### Requirement: Waste-Tourenliste verwendet die gemeinsamen Tabelleninteraktionen

Das Waste-Management MUST in der Tourenliste die gemeinsamen Studio-Muster für Icon-Aktionen,
Status-Badges, anklickbare Informationen und einheitlich oben ausgerichtete Body-Zellen verwenden.
Die Migration MUST bestehende Fachlogik, Berechtigungen, Navigation und Mutationen erhalten und
die drei Tourstatus konsistent darstellen.

#### Scenario: Benutzer betrachtet anklickbare Tourinformationen

- **WENN** ein Benutzer die Tourenliste öffnet
- **DANN** erscheinen Tourname, verknüpfte Fraktionen, Verschiebungen und Abholortanzahl im
  gemeinsamen Muster für anklickbare Informationen
- **UND** werden Fraktionen nicht als Status-Badges dargestellt
- **UND** öffnet der Tourname das bestehende Bearbeitungsziel
- **UND** öffnen Verschiebungen weiterhin ihre Details beziehungsweise das bestehende
  Erstellungsziel

#### Scenario: Tour besitzt keine Abholortzuordnung

- **GIVEN** eine Tour besitzt `0` zugeordnete Abholorte
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Erstellungsflow für Zuordnungen
- **UND** ist die Zahl im selben Informationsmuster wie eine positive Anzahl dargestellt

#### Scenario: Tour besitzt bestehende Abholortzuordnungen

- **GIVEN** eine Tour besitzt mindestens eine Abholortzuordnung
- **WENN** der Benutzer die Abholortanzahl aktiviert
- **DANN** öffnet die Liste weiterhin den bestehenden Bearbeitungsflow für Zuordnungen
- **UND** ändert die visuelle Vereinheitlichung keine Zuordnungsdaten

#### Scenario: Benutzer ändert den Tourstatus

- **WENN** ein berechtigter Benutzer das Status-Badge einer Tour aktiviert
- **DANN** öffnet sich ein zugänglicher Dialog mit aktuellem Status und den drei Zielwerten
  `Entwurf`, `Veröffentlicht` und `Archiviert`
- **UND** wird die Statusmutation erst durch die vorgesehene Bestätigung ausgelöst
- **UND** bleibt das Badge mit dem aktuellen Statuswert beschriftet

#### Scenario: Benutzer verwendet eine Tour-Zeilenaktion

- **WENN** ein Benutzer Kalender, Duplizieren oder Löschen in der Aktionsspalte verwendet
- **DANN** erscheint die jeweilige Aktion als gemeinsamer Icon-Aktionsbutton mit zugänglichem
  Tooltip
- **UND** wird keine redundante Bearbeiten-Aktion angeboten, wenn der Tourname bereits dasselbe
  Ziel öffnet
- **UND** bleiben Berechtigungen, Bestätigung und Zielverhalten der Aktion unverändert

#### Scenario: Tourenzeile enthält ein- und mehrzeilige Inhalte

- **WENN** die Tourenzeile gerendert wird
- **DANN** sind alle Body-Zellen einschließlich Auswahl, Werte, Status und Aktionsgruppe einheitlich
  oben ausgerichtet
- **UND** verwenden die Zellen dasselbe vertikale Padding
- **UND** bleiben Controls innerhalb ihrer eigenen Trefferfläche zentriert

### Requirement: Waste-Management klassifiziert den vollständigen relevanten Quellbestand

Das System SHALL alle veröffentlichten Touren berücksichtigen, deren Gültigkeitszeitraum das
Quelljahr überschneidet oder die mindestens einen expliziten Termin im Quelljahr besitzen. Es
SHALL jede relevante Tour nachvollziehbar genau als `wird übernommen`, `gilt bereits im Folgejahr`
oder `blockiert` klassifizieren.

#### Scenario: Auf das Quelljahr begrenzte Tour wird übernommen

- **WHEN** eine veröffentlichte Tour im Quelljahr wirksam ist und weder ihr Gültigkeitszeitraum
  noch ein expliziter Termin bereits im Folgejahr wirksam ist
- **THEN** klassifiziert das System die Tour als `wird übernommen`
- **AND** lässt es den Benutzer die Tour vor der Bestätigung abwählen

#### Scenario: Quelltour gilt bereits im Folgejahr

- **WHEN** eine veröffentlichte Quelltour durch ihren Gültigkeitszeitraum oder einen expliziten
  Termin bereits im Folgejahr wirksam ist
- **THEN** klassifiziert das System die Tour als `gilt bereits im Folgejahr`
- **AND** dupliziert es die Tour nicht
- **AND** erklärt es, dass die unveränderte Quelltour im Folgejahr weiterwirkt

#### Scenario: Tour kann nicht sicher abgebildet werden

- **WHEN** eine relevante Tour ungültige oder unvollständige Planungsdaten oder einen ungelösten
  Datumsblocker besitzt
- **THEN** klassifiziert das System die Tour als `blockiert`
- **AND** nennt es den konkreten Grund und eine geeignete manuelle Folgeaktion
- **AND** lässt es die Tour nicht bestätigen

#### Scenario: Wiederkehrender Tour fehlt der Taktanker

- **WHEN** eine Intervall- oder Jahrestour keinen Gültigkeitsbeginn als Taktanker besitzt, aber ihr
  Gültigkeitsende bis in das Folgejahr reicht
- **THEN** klassifiziert das System die Tour als `blockiert` wegen unvollständiger Planungsdaten
- **AND** klassifiziert es sie nicht als `gilt bereits im Folgejahr`

### Requirement: Waste-Management legt den bestätigten Tourensatz atomar und idempotent als Entwurf an

Das System SHALL den ausdrücklich bestätigten Tourensatz einschließlich aller Beziehungen unter
einer mandanten- und folgejahrbezogenen Sperre in einer Waste-Datenbanktransaktion mit
`status = draft` anlegen. Wiederholungen SHALL fachlich auf dieselben stabilen Zielressourcen
konvergieren.

#### Scenario: Bestätigter Tourensatz wird vollständig angelegt

- **WHEN** ein berechtigter Benutzer einen gültigen und unveränderten Vorschaustand ausdrücklich
  bestätigt
- **THEN** sperrt der Server den Jahreswechsel für Mandant und Folgejahr
- **AND** sperrt er die planungsrelevanten Tabellen des mandanteneigenen Waste-Schemas gegen
  konkurrierende Änderungen
- **AND** prüft er Quellbestand, Fingerprint und Konflikte innerhalb derselben Transaktion erneut
- **AND** legt er alle bestätigten Touren und Beziehungen gemeinsam als Entwurf und große
  Beziehungsmengen in begrenzten Batches an
- **AND** lässt er den Quellbestand unverändert
- **AND** gibt er die IDs, eine verständliche Ergebnissumme und ein Ziel zur gefilterten Tourenliste
  zurück

#### Scenario: Fehler rollt den gesamten Satz zurück

- **WHEN** das Prüfen oder Anlegen einer Tour oder Beziehung fehlschlägt
- **THEN** rollt das System die vollständige Waste-Datenbanktransaktion zurück
- **AND** bleibt kein Teilergebnis des bestätigten Satzes bestehen

#### Scenario: Identischer Request wird idempotent wiederholt

- **WHEN** derselbe mandantenbezogene Idempotenzschlüssel mit derselben fachlichen Payload erneut
  übermittelt wird
- **THEN** gibt das System dasselbe fachliche Ergebnis zurück
- **AND** erzeugt es keine weiteren Touren oder Beziehungen
- **AND** lehnt es denselben Schlüssel mit einer abweichenden Payload als Konflikt ab

#### Scenario: Identischer Request wird während der Verarbeitung erneut gesendet

- **WHEN** derselbe Idempotenzschlüssel mit derselben Payload noch verarbeitet wird
- **THEN** antwortet das System mit `idempotency_in_progress`
- **AND** startet es keine zweite Waste-Transaktion
- **AND** erzeugt es kein zusätzliches Audit-Ereignis
- **AND** erneuert der aktive Request seine Lease und darf nur mit seinem aktuellen Ownership-Token
  Audit und Antwort finalisieren

#### Scenario: Prozess endet nach dem Waste-Commit

- **WHEN** die Waste-Transaktion erfolgreich committet und der Prozess vor Abschluss des zentralen
  Idempotenzeintrags endet
- **THEN** darf eine Wiederholung nach Ablauf der kurzen Verarbeitungs-Lease die verwaiste
  Reservierung übernehmen
- **AND** rekonstruiert sie das Ergebnis anhand der stabilen Ziel- und Beziehungs-IDs
- **AND** kann der abgelöste Owner mit seinem alten Ownership-Token weder Audit noch Antwort
  finalisieren
- **AND** behandelt sie vollständig identische Daten als Replay
- **AND** behandelt sie fehlende Daten als erneut atomar ausführbar und abweichende Daten als
  `target_identity_conflict`
