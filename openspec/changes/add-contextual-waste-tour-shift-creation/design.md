## Context

Tourbezogene Ausweichtermine werden bereits über die route-basierte Scheduling-Erstellungsansicht gepflegt. Tourenliste und Jahreskalender zeigen denselben fachlichen Kontext, bieten dort aber bisher nur lesende Informationen. Das Tourformular trennt turnusbasierte Touren von individuellen und bedarfsabhängigen Touren.

Jahresunabhängige Ausweichtermine werden für jedes Materialisierungsjahr auf ein konkretes Datum expandiert. Die bestehende Materialisierung bewahrt dabei keine ausdrückliche Spezifität und kann zwei Regeln desselben Ursprungs nacheinander statt nach einer fachlichen Override-Regel behandeln. Studio-Kalender, Mainserver-Materialisierung und Public-Waste-Projektion besitzen zudem eigene Teile dieser Auswahl- und Datumslogik.

Im aktuellen Worktree werden Tourenliste und Verschiebungsdetails bereits durch den separaten Change `add-tour-assignment-table-sorting` beziehungsweise dessen begleitende Änderungen berührt. Der Change `add-versioned-waste-tenant-migrations` führt den verbindlichen Roll-forward-Pfad für externe Waste-Tenant-Datenbanken ein. Die Umsetzung muss beide Änderungen erhalten, die nächste freie stabile Tenant-Migrations-ID verwenden und den neuen Navigations- und Fachpfad additiv ergänzen.

Für die betroffenen Ausweichtermin-Daten wurde bestätigt, dass kein produktiv zu erhaltender Bestand existiert. Die Umstellung darf deshalb einen harten Schema- und Datenvertrag voraussetzen; automatische Konfliktbereinigung oder eine parallele Legacy-Repräsentation sind nicht erforderlich.

## Goals / Non-Goals

- Goals:
  - vorhandene Nutzerkontexte ohne zweite Erstellungsoberfläche nutzbar machen;
  - den ursprünglichen Arbeitskontext einschließlich ungespeicherter Formulare erhalten, ohne Verschiebungen gegen ungespeicherte Terminlogik anzulegen;
  - Tour und optional Originaldatum zuverlässig vorausfüllen;
  - Links teilbar und nach einem Reload stabil halten;
  - eindeutige Regeln und eine ausdrückliche Priorität zwischen jährlicher Grundregel und jahresbezogener Ausnahme erzwingen;
  - Kalenderdaten in Datenbank, Server und Browser ohne Uhrzeit- oder Zeitzonenbedeutung behandeln;
  - dieselbe wirksame Tourregel in Studio, Materialisierung und Public Waste verwenden;
  - alle Aktionen per Tastatur und mit verständlichem zugänglichem Namen bedienen können.
- Non-Goals:
  - ortsspezifische Verschiebungen;
  - direkte Änderung bestehender Ausweichtermine im Jahreskalender;
  - Umdeutung individueller Termine, bedarfsabhängiger Touren oder expliziter Tour-Einsätze zu Verschiebungsregeln;
  - Änderung der bestehenden Priorität zwischen Tour-, globalen und Feiertagsregeln;
  - automatische Bereinigung oder Migration eines produktiven Legacy-Datenbestands;
  - eine zweite Scheduling-Erstellungsoberfläche.

## Decisions

### Eine bestehende Erstellungsansicht für alle Einstiege

Alle neuen Aktionen öffnen die bestehende Erstellungsansicht in einem neuen Browser-Tab mit `tab=scheduling`, `schedulingView=create` und `schedulingEntryType=tour-shift`. Es entsteht kein zusätzliches Dialog- oder Speicherverhalten in der Tourenansicht. Der Ausgangstab bleibt mit seinem aktuellen Listen-, Filter-, Kalender-, Dialog- und Formularzustand geöffnet.

Die Einstiege werden als native Links mit `target="_blank"` und `rel="noopener noreferrer"` umgesetzt. Dadurch bleiben Linkvorschau, Kontextmenü sowie das Öffnen per Tastatur erhalten; eine imperative Popup-Öffnung ist nicht erforderlich.

Nach erfolgreichem Speichern wechselt ausschließlich der neue Browser-Tab zur Liste der Ausweichtermine. Das Abbrechen bleibt ebenfalls auf den neuen Tab beschränkt. Beide Pfade entfernen den übernommenen Kontext.

### Kontext über normalisierte Search-Parameter

Die optionalen Search-Parameter `schedulingTourId` und `schedulingOriginalDate` transportieren die vorausgewählte Tour und das ursprüngliche Datum. `tourId` bleibt ausschließlich dem Tourformular vorbehalten. `schedulingOriginalDate` ist nur zusammen mit `schedulingTourId` gültig. Das Datum wird als reales ISO-Kalenderdatum `YYYY-MM-DD` normalisiert.

Die Scheduling-Erstellungsansicht übernimmt den Kontext nach dem Laden genau einmal in ein noch nicht durch den Benutzer bearbeitetes Formular. Spätere Render-, Lade- oder Navigationseffekte überschreiben keine Benutzereingaben. Die URL behält den initialen Kontext, damit ein Reload dieselbe Ausgangsvorbelegung wiederherstellt; sie bildet keine laufenden Formularänderungen ab.

Eine nicht verfügbare Tour oder ein ungültiges Datum wird nicht in das Formular übernommen. Statt stiller Übernahme zeigt die Ansicht einen lokalisierten, nicht blockierenden Hinweis, dass die verlinkte Vorauswahl nicht mehr verfügbar ist. Bei einem widersprüchlichen `global-shift` werden beide Tourkontextparameter verworfen.

Die Anwesenheit von `schedulingTourId` kennzeichnet den kontextuellen Einstieg. Dort entfällt der umschaltbare Typ-Select. Ein kompakter, nicht editierbarer Kontextblock benennt Tour und optional Originaldatum; lange Tournamen dürfen umbrechen oder gekürzt werden, ohne Aktionen oder Formularfelder aus dem sichtbaren Bereich zu verdrängen, und bleiben zugänglich vollständig verfügbar. Tour und Originaldatum bleiben in den eigentlichen Formularfeldern bewusst korrigierbar. Die allgemeine Scheduling-Erstellung ohne Tourkontext behält ihre bisherige Typauswahl.

### Gespeicherte Terminlogik als Ausgangspunkt

Die Aktion im Tourformular richtet sich nach der persistierten Tour. Sie erscheint nur im Bearbeitungsmodus einer gespeicherten turnusbasierten Tour: feste Turnusse und gespeicherte Abstandspresets sind anwendbar, individuelle und bedarfsabhängige Touren nicht.

Weichen Turnus, Abstandspreset, Startdatum oder Enddatum im Formular vom persistierten Stand ab, bleibt die Aktion sichtbar, ist aber deaktiviert. Ein zugänglicher Hinweis fordert zum vorherigen Speichern auf. Änderungen an Name, Beschreibung oder Sichtbarkeit blockieren die Aktion nicht. Eine ungespeicherte Umstellung einer individuellen oder bedarfsabhängigen Tour auf einen Turnus schaltet die Aktion nicht vorzeitig frei.

### Eindeutigkeit und Jahres-Override

Jahresbezogene Regeln sind pro Tour und vollständigem `original_date` eindeutig. Jahresunabhängige Regeln sind pro Tour und Kombination aus Monat und Tag des `original_date` eindeutig. Eine jährliche Grundregel und eine jahresbezogene Ausnahme für denselben Monat und Tag dürfen gleichzeitig existieren.

Für ein konkretes Tourvorkommen wird zuerst die passende jahresbezogene Regel gewählt. Nur wenn keine existiert, darf die auf dieses Jahr expandierte jährliche Grundregel greifen. Beide Regeln werden nie additiv auf dasselbe ursprüngliche Vorkommen angewendet. Die bestehende Priorität zwischen Tour-, globalen und Feiertagsregeln bleibt unverändert.

Die Auswahl wird als framework-agnostische, pure Core-Logik modelliert und von Studio-Jahreskalender, Mainserver-Materialisierung und Public-Waste-Projektion verwendet. Die interne Regelrepräsentation bewahrt ihre Spezifität auch nach der Expansion auf ein konkretes Jahr.

Doppelte Regeln derselben Spezifität werden durch partielle Unique-Indizes unter konkurrierenden Requests zuverlässig verhindert. Die Runtime übersetzt die Datenbankverletzung in einen stabilen fachlichen `409 Conflict`; sie überschreibt keinen vorhandenen Datensatz. Wenn eine jahresbezogene Ausnahme eine jährliche Grundregel verdrängt, zeigt die Erstellungsansicht vor dem Speichern einen nicht blockierenden Hinweis auf das betroffene Jahr.

### PostgreSQL DATE und Date-only-Grenze

`waste_tour_date_shifts.original_date` und `actual_date` werden als PostgreSQL `DATE` gespeichert. Ein partieller Unique-Index schützt jahresbezogene Regeln auf `(tour_id, original_date) WHERE has_year`; ein partieller Ausdrucksindex schützt jahresunabhängige Regeln auf Tour, Monat und Tag, wenn `has_year` falsch ist.

Außerhalb PostgreSQL bleibt der Fachtyp ein normalisierter ISO-String `YYYY-MM-DD`. Repository-SELECTs formatieren `DATE` unabhängig vom Session-`DateStyle` ausdrücklich mit `to_char(..., 'YYYY-MM-DD')`; Schreibparameter werden als bereits normalisierte ISO-Werte ausdrücklich mit `::date` gebunden. Der Standardparser von `node-postgres` darf diese Fachwerte nicht in JavaScript-`Date`-Objekte umwandeln. Berechnung und Darstellung verwenden zentrale Date-only- beziehungsweise UTC-Helfer und erzeugen keine lokale Mitternacht. Prozesszeitzone sowie Sommer- und Winterzeit dürfen das Kalenderdatum nicht verändern.

Der harte Schnitt erhält keine parallelen Textspalten, keinen automatischen Legacy-Backfill und keine automatische Dublettenauflösung. Die versionierte Tenant-Migration läuft über den geschützten Waste-Migrationspfad. Falls entgegen der bestätigten Ausgangslage betroffene Zeilen vorhanden sind, stoppt der Preflight fail-closed und verlangt einen expliziten Reset statt einer geratenen Transformation.

### Fachlich begrenzte und räumlich robuste Einstiege

Die Verschiebungsspalte bietet für eine Tour eine eindeutige Aktion, wenn der Benutzer Scheduling verwalten darf. Eine leere Zelle zeigt räumlich kompakt `Anlegen`; ihr zugänglicher Name lautet vollständig `Tourbezogenen Ausweichtermin anlegen` und enthält den Tournamen sowie den Hinweis auf den neuen Browser-Tab. Der gemischte Detaildialog für tourbezogene, globale und feiertagsbedingte Einträge bietet genug Raum und verwendet sichtbar die genaue Bezeichnung `Tourbezogenen Ausweichtermin anlegen`.

Im Jahreskalender sind ausschließlich reguläre, nicht bereits verschobene Vorkommen turnusbasierter Touren bedienbar. Sichtbar bleibt die Aktion kurz und passt in die Kalenderzelle. Der vollständige zugängliche Name enthält lokalisiertes Datum, Tourname und den Hinweis auf den neuen Browser-Tab. Die vollständig bedienbare Trefferfläche besitzt sichtbare Hover-, Aktiv- und Fokuszustände. Bereits verschobene Ersatztermine bleiben erklärende Anzeige; Korrekturen erfolgen über den vorhandenen Ausweichtermin in der Scheduling-Tabelle.

### Berechtigungen und Fehlerdarstellung

Die Aktionen werden nur nach aufgelöster UI-Berechtigung `waste-management.scheduling.manage` gerendert. Die Servermutation prüft dieselbe Action unabhängig von der UI. Ein Konflikt derselben Regelspezifität bleibt als persistente Inline-Fehlermeldung am Formular sichtbar und erklärt den nächsten Schritt. Wenn der vorhandene Ausweichtermin eindeutig auflösbar ist, darf die Meldung auf dessen Bearbeitungsansicht verweisen.

## Risks / Trade-offs

- Der Change erweitert sich von Navigation auf Datenmodell und gemeinsame Fachlogik. Dafür beseitigt er eine bereits vorhandene mehrdeutige Regelauflösung statt sie durch neue Einstiege leichter erreichbar zu machen.
- Zusätzliche Search-Parameter erweitern den URL-Vertrag, ermöglichen dafür aber Reload-stabile und testbare Navigation.
- Ein neuer Browser-Tab erfordert einen bewussten Kontextwechsel, erhält dafür jedoch auch ungespeicherte Formulare und geöffnete Dialoge.
- Partielle Ausdrucksindizes sind PostgreSQL-spezifisch, bilden die fachliche Eindeutigkeit aber direkt und konkurrenzsicher ab.
- Der harte Schemaschnitt ist nur zulässig, weil für die betroffenen Daten kein produktiv zu erhaltender Bestand bestätigt wurde. Eine abweichende Live-Inventur stoppt die Umsetzung beziehungsweise Migration.
- Die gemeinsame Core-Auswahlregel erweitert die betroffenen Konsumenten, reduziert aber langfristig divergierende Terminprojektionen.

## Verification

- Unit-Tests für Search-Normalisierung, Linkerzeugung, widersprüchlichen Kontext und einmalige Formularvorbelegung.
- Komponenten- und Navigationstests für leere sowie gefüllte Verschiebungsspalten, Detaildialog, Jahreskalender und Tourformular einschließlich kurzem sichtbarem Text, vollständigem zugänglichem Namen, Fokuszustand, neuem Browser-Tab und sicherem Linkvertrag.
- Negativtests für individuelle beziehungsweise bedarfsabhängige Touren, ungespeicherte terminrelevante Änderungen, bereits verschobene Kalendertermine und fehlende Scheduling-Berechtigung.
- Core-Charakterisierung für jährliche Grundregel, jahresbezogene Ausnahme, gleiche Spezifität und unveränderte globale beziehungsweise Feiertagspriorität.
- Repository- und PostgreSQL-Integrationstests für `DATE`, partielle Unique-Indizes, Update des eigenen Datensatzes, konkurrierende Inserts und stabilen `409`-Fehlervertrag.
- Paritätstests für Studio-Kalender, Mainserver-Materialisierung und Public-Waste-Projektion.
- Date-only-Tests unter mindestens zwei unterschiedlichen Prozesszeitzonen einschließlich `Europe/Berlin`; die resultierenden ISO-Kalenderdaten müssen identisch sein.
- Gezielte Unit-, Type- und Server-Runtime-Gates der betroffenen Workspaces sowie strikte OpenSpec-, File-Placement- und Schema-Dokumentationsprüfung.

## Migration Plan

1. Vor Umsetzung bestätigen, dass die betroffenen Ausweichtermin-Tabellen in allen Zielumgebungen keinen produktiv zu erhaltenden Bestand enthalten; andernfalls STOP statt Transformation.
2. Die nächste freie stabile Waste-Tenant-Migrations-ID nach dem aktiven Change `add-versioned-waste-tenant-migrations` vergeben.
3. Migration und kanonisches Neuprovisionierungs-Schema gemeinsam auf `DATE`, partielle Unique-Indizes und Postconditions umstellen.
4. Staging über den geschützten Promote-Pfad mit Backup, Tenant-Migrationsledger und Schema-Postconditions verifizieren.
5. Erst danach denselben Digest nach Production promoten; direkte SQL- oder Stack-Mutation ist kein Standardpfad.
