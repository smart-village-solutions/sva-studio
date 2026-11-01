# Gültigkeitszeiträume von Waste-Touren bearbeiten

Der Bereich `Touren` im Waste-Management-Plugin erlaubt, den tourweiten Gültigkeitszeitraum mehrerer Touren gemeinsam zu ändern. Der Zeitraum besteht aus `Gültig ab` und `Gültig bis` und beeinflusst den wiederkehrenden Turnus der Tour. Einzelne Abholtermine und Terminverschiebungen bleiben unverändert. Abholort-Zuordnungen besitzen keinen eigenen Gültigkeitszeitraum und übernehmen immer den Zeitraum ihrer Tour.

## Status mehrerer Touren ändern

Touren besitzen die drei fachlichen Status `Entwurf`, `Veröffentlicht` und `Archiviert`. Neue,
duplizierte und ins Folgejahr übernommene Touren beginnen als Entwurf. Nur veröffentlichte Touren
liefern operative oder öffentliche Termine; Entwürfe und archivierte Touren bleiben im Studio
sichtbar und bearbeitbar. Der Status einer einzelnen Tour kann direkt über ihr Status-Badge
geändert werden.

1. Filtern Sie die Tourenliste auf den gewünschten Bestand.
2. Wählen Sie einzelne Touren über ihre Checkboxen oder mit `Alle gefilterten Touren auswählen` sämtliche Filtertreffer aus. Diese explizite Auswahl umfasst auch weitere Ergebnisseiten.
3. Öffnen Sie `Status ändern`, wählen Sie bewusst `Entwurf`, `Veröffentlicht` oder `Archiviert` und bestätigen Sie die Änderung.

Die Auswahl bleibt bei Filterwechseln erhalten; die Oberfläche nennt deshalb zusätzlich ausgewählte Touren außerhalb des aktuellen Filters. Mit `Auswahl aufheben` kann sie vollständig verworfen werden. Die Statusänderung wird für alle ausgewählten Touren atomar gespeichert. Fehlt eine Tour oder schlägt das Speichern fehl, wird keine Tour geändert und die Auswahl bleibt für einen erneuten Versuch erhalten. Pro Änderung können höchstens 1.000 Touren ausgewählt werden.

## Mehrere Touren bearbeiten

1. Wählen Sie in der Tourentabelle die gewünschten Touren aus.
2. Öffnen Sie `Gültigkeitszeitraum ändern`.
3. Legen Sie fest, ob `Gültig ab` unverändert bleiben oder durch ein neues Datum ersetzt werden soll. `Gültig bis` kann zusätzlich entfernt werden.
4. Prüfen Sie die Zusammenfassung und bestätigen Sie mit `Zeitraum ändern`.

Die Änderung wird für die gesamte Auswahl atomar gespeichert. Ist eine Tour nicht mehr vorhanden, nicht geeignet oder würde bei mindestens einer Tour ein Enddatum vor dem Startdatum entstehen, wird keine der ausgewählten Touren geändert. Der Dialog nennt bei einem Datumskonflikt jede betroffene Tour mit dem resultierenden Beginn und Ende.

## Unterstützte Touren

Die Mehrfachbearbeitung gilt für feste Wiederholungen wie wöchentlich, zweiwöchentlich, vierwöchentlich und jährlich sowie für Touren mit einem benutzerdefinierten Wiederholungsabstand. Individuelle Touren und bedarfsabhängige Touren besitzen keinen turnusbasierten Gültigkeitszeitraum. Der Dialog nennt solche Touren und blockiert das Speichern, bis sie aus der Auswahl entfernt wurden.

`Gültig ab` ist zugleich der Startanker für die Berechnung wiederkehrender Termine und kann deshalb nicht entfernt werden. Soll eine Tour vorübergehend keine Termine liefern, setzen Sie sie stattdessen auf `Entwurf` oder `Archiviert`.

## Tourensatz in das Folgejahr übernehmen

Die Aktion `Tourensatz ins Folgejahr übernehmen` führt durch Quelljahr, Vorschau und Bestätigung. Als Quelle stehen ausschließlich das aktuelle und das vorherige Kalenderjahr zur Verfügung; das Ziel ist unveränderlich das direkte Folgejahr. Erforderlich sind die Berechtigungen für Touren- und Terminplanung.

Die Vorschau zeigt jede relevante veröffentlichte Tour in einer von drei Gruppen:

- `Wird übernommen`: Die Tour kann ausgewählt werden. Ein möglicher paralleler Planungsstand muss ausdrücklich bestätigt werden.
- `Gilt bereits im Folgejahr`: Die Quelltour reicht fachlich bereits in das Zieljahr und wird nicht kopiert.
- `Blockiert`: Ungültige Planungsdaten, eine abweichend belegte stabile Zielidentität oder ein nicht eindeutig abbildbares Datum verhindern die Übernahme. Für Schalttage und Datumskollisionen kann die Vorschau ein Ersatzdatum im Folgejahr verlangen.

Wöchentliche, zweiwöchentliche, vierwöchentliche und benutzerdefinierte Tagesabstände setzen standardmäßig ihren bisherigen Rhythmus ab Jahresbeginn ohne Neustart fort. Beginnt die Quelltour im Januar, kann deshalb auch ein regulärer Termin vor dem entsprechenden Kalendertag im Folgejahr angezeigt werden. Für eine bewusst geänderte Phase kann pro Tour ein abweichender erster regulärer Termin im Folgejahr eingetragen werden; leer bedeutet Fortsetzung des bisherigen Turnus. Die aktualisierte Vorschau ist vor der Bestätigung zu prüfen. Beginnt eine Tour dagegen erst später im Quelljahr, bleibt dieser spätere Gültigkeitsbeginn erhalten. Touren mit geändertem Wiederholungsabstand werden aus der Auswahl genommen und gesondert geplant. Konkrete Termine werden auf den nächstgelegenen gleichen Wochentag im Folgejahr abgebildet und überschreiten dessen Grenzen nicht. Tourfelder, Abfallarten, Abholorte, konkrete Termine, Einsätze und tourbezogene Verschiebungen werden gemeinsam übernommen.

Bei Touren, die bereits vor dem Quelljahr begonnen haben, wird nur der im Quelljahr wirksame Gültigkeitsausschnitt übertragen; der ursprüngliche Beginn bleibt der Taktanker. Jährliche Touren behalten dagegen den Monat und Tag ihres ursprünglichen Jahrestags. Endet ihr wirksamer Ausschnitt bereits vor diesem Jahrestag, wird kein invertierter Zielzeitraum erzeugt und die Tour bleibt blockiert. Bereits bestehende jährliche Touren mit demselben Jahrestag werden als mögliche parallele Planung angezeigt. Jahresbezogene Verschiebungen über Silvester behalten ihren relativen Jahresversatz. Nicht automatisch abbildbare Grenzen werden getrennt als Gültigkeitsbeginn oder Gültigkeitsende benannt; Ersatztage sind ausschließlich für die von der Vorschau gemeldeten Ressourcen und das jeweils an der Eingabe ausgewiesene Zieljahr zulässig. Dieses kann bei einer jahresübergreifenden Verschiebung nach dem direkten Folgejahr liegen. Doppelte jahresunabhängige Verschiebungsregeln können durch ein Ersatzdatum nicht verändert werden und müssen in den Quelldaten bereinigt werden. Die Vorschau zeigt außerdem den tatsächlichen festen oder benutzerdefinierten Turnus, Quell- und Zielzeitraum mit Wochentagen, bis zu fünf konkrete Datumsabbildungen, Mengen je Beziehungstyp, ausgeschlossene Daten sowie die konkreten Merkmale möglicher Konflikte. „Ergebnis anzeigen“ entfernt alte Such-, Fraktions- und Datumsfilter und zeigt die Entwürfe im Zieljahr.

Nach der Bestätigung entstehen alle neuen Touren atomar und zunächst als Entwurf. Prüfen Sie anschließend die gefilterte Tourenliste, wählen Sie alle fachlich freigegebenen Touren aus und setzen Sie diese gemeinsam über `Status ändern` auf `Veröffentlicht`. Die Quelle bleibt unverändert; vorhandene Zieltouren werden weder ersetzt noch gelöscht. Pro Vorgang sind höchstens 1.000 Touren und 100.000 kopierrelevante Beziehungen zulässig.

Unter `Abfallkalender → Abholorte` kann die Vollständigkeit der Fraktionszuordnung für ein Kalenderjahr geprüft werden; die Jahresangabe setzt Start und Ende der Prüfung. Die Planungsprüfung bezieht Entwürfe ein und kennzeichnet ausdrücklich, dass diese noch keine öffentlichen Termine liefern. Für eine Prüfung der veröffentlichten Abdeckung kann die Einbeziehung von Entwürfen ausgeschaltet werden. Bei wiederkehrenden Touren gilt ein erster regulärer Abholtag im Januar nicht allein als Lücke vor diesem Termin. Ein tatsächlich späterer Tourbeginn im Jahr bleibt eine Lücke. Die Prüfung bewertet Zuordnungen, nicht die tatsächliche Terminfolge; die ersten Abholtermine müssen in der Tourenvorschau geprüft werden. Die getrennten Filter `Tourenjahr` und `Tourstatus` begrenzen Tourauswahl und Tourangaben in der Abholortliste auf Touren mit Gültigkeit im gewählten Jahr und dem gewählten Status (Entwurf, veröffentlicht oder archiviert). Die Abholorte und die Seiteneinteilung bleiben sichtbar und unverändert.

Aktuelle JSON- und Tabellenexporte schreiben den Status als `draft`, `published` oder `archived`.
Beim Import wird ein fehlender Status als `draft` behandelt; ältere Daten mit `active = true`
werden als `published`, mit `active = false` als `draft` übernommen.

## Ortstermine an die App übertragen

Ein Termin für einen aktiven Abholort mit `Alle Straßen` gilt beim Mainserver-Abgleich für alle vorhandenen aktiven Straßen- und Hausnummernadressen desselben Orts. Das gilt sowohl für berechnete Tourtermine als auch für explizite Einsätze, etwa des Schadstoffmobils. Der Termin bleibt im Studio einmal auf Ortsebene gepflegt; erst die Transferaufbereitung erzeugt die konkreten Straßentermine für die bestehende App-Schnittstelle.

Datum, Abfallart, Tourhinweis und individueller Hinweis mit Standzeit und Haltestelle werden übernommen. Identische direkte und geerbte Termine werden anhand des bestehenden Übertragungsschlüssels einschließlich Hinweis nur einmal übertragen. Unterschiedliche Haltestellenhinweise am selben Tag bleiben getrennte Termine. Regionale Einschränkungen werden berücksichtigt; bei einer Zieladresse ohne eigene Region gilt die Region ihres Orts. Inaktive Abholorte, Adressen anderer Orte und Straßen ohne aktiven Abholort erhalten keine geerbten Termine.

Eine Zuordnung zu einer konkreten Straße wird weiterhin nur für diese Adresse übertragen. Soll ein Schadstoffmobil-Termin bei allen Straßen erscheinen, muss sein Geltungsbereich auf Ortsebene liegen; die tatsächliche Haltestelle gehört in den Termin- oder Tourhinweis. Webkalender und PDF verwenden weiterhin ihre bestehende hierarchische Kalenderabfrage. Nach Auslieferung der Transferänderung muss der Mainserver-Abgleich erneut ausgeführt werden; eine App-Änderung ist dafür nicht erforderlich.

## Verschiebungen nachvollziehen

Die Bearbeitungsseite einer gespeicherten Tour bündelt die Abholortzuordnung, den Jahreskalender und einen Link zu den auf diese Tour gefilterten Einsätzen und tourbezogenen Ausweichterminen. Die Terminliste öffnet sich in einem neuen Tab, damit ungespeicherte Formularangaben erhalten bleiben. Der Jahreskalender zeigt den gespeicherten Planungsstand; bei ungespeicherten Änderungen an der Terminlogik muss die Tour zuerst gespeichert werden.

Die Spalte `Verschiebungen` der Tourentabelle zählt tourspezifische und globale Verschiebungen sowie tatsächlich berechnete Feiertagsverschiebungen. Ist mindestens eine Verschiebung vorhanden, öffnet der Zähler eine Detailansicht mit ursprünglichem und neuem Datum, Quelle und vorhandenem Grund. Zähler und Detailansicht basieren auf derselben chronologisch sortierten Datenmenge.

Benutzer mit der Berechtigung `waste-management.scheduling.manage` können einen tourbezogenen Ausweichtermin direkt an drei Stellen anlegen:

- in einer leeren Verschiebungszelle beziehungsweise aus der Detailansicht vorhandener Verschiebungen,
- an einem regulären, noch nicht verschobenen Termin im Jahreskalender,
- in der Terminlogik einer gespeicherten turnusbasierten Tour.

Die Aktion öffnet die vorhandene Erfassungsansicht in einem neuen Browser-Tab. Der Ausgangstab behält dadurch Filter, Kalender, Dialoge und ungespeicherte Formularinhalte. Ein kompakter Kontextblock ersetzt dort die allgemeine Typauswahl. Tour und – beim Einstieg aus dem Jahreskalender – ursprüngliches Datum sind vorausgewählt; beide Werte bleiben in den regulären Feldern sichtbar, das Zieldatum bleibt eine bewusste Eingabe. Weicht die Terminlogik im Tourformular vom gespeicherten Stand ab, ist die Aktion deaktiviert und erklärt sichtbar, dass die Änderung zuerst gespeichert werden muss.

Eine jahresbezogene Ausnahme ersetzt für denselben Ursprung ausschließlich im konkreten Jahr eine vorhandene jährliche Grundregel. Vor dem Speichern weist das Formular auf diese Übersteuerung hin. Regeln derselben Spezifität sind pro Tour und Ursprung eindeutig; bei einem Konflikt bleibt der vorhandene Eintrag unverändert und die Fehlermeldung bleibt ohne Weiterleitung direkt im Formular sichtbar.

## Verwendete Abfallarten löschen

Eine Abfallart kann nicht gelöscht werden, solange sie einer Tour zugeordnet ist. Das gilt auch für Entwürfe und archivierte Touren. Zuerst die Abfallart in den betroffenen Touren ersetzen oder die betreffenden Touren löschen; danach kann eine nicht mehr verwendete Abfallart entfernt werden. Das Löschen einer Tour löscht ihre Zuordnungen, aber keine Abfallarten.
