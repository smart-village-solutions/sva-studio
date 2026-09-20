## Context

Kategorien tragen im Mainserver mit `dataTypes` die Information, für welche Content-Arten sie vorgesehen sind. Eine leere Liste bedeutet fachlich, dass die Kategorie für alle Content-Typen gilt; eine nicht leere Liste kann einen oder mehrere erlaubte Typen enthalten. Der bestehende GraphQL-Read kann `dataTypes` bereits liefern, die Studio-Fassade und die News-, Event- und POI-Editoren verwenden diese Information derzeit jedoch nicht.

Der gewünschte Zuschnitt beschränkt sich auf das Studio. Er verhindert falsche neue Auswahlen im regulären Editor, schützt aber nicht die Mainserver-Persistenzgrenze. Diese Einschränkung ist Teil des vereinbarten Scopes und wird nicht durch zusätzliche Studio-Schreibprüfungen kaschiert, weil solche Prüfungen weiterhin umgehbar und anfällig für zwischenzeitliche Änderungen wären.

## Goals

- News, Events und POI bieten nur aktive Kategorien an, deren `dataTypes` leer sind oder den jeweiligen kanonischen Datentyp enthalten.
- Fehler oder ungültige Filter dürfen nicht zu einer ungefilterten Ersatzliste führen.
- Bereits gespeicherte, nicht mehr angebotene Kategorien bleiben im Formular sichtbar und entfernbar.
- Der bestehende parameterlose Kategorien-Read bleibt kompatibel.
- Die Umsetzung erweitert ausschließlich vorhandene Studio-Pfade.

## Non-Goals

- Keine Garantie, dass jeder im Mainserver persistierte Content-Kategorie-Link kompatibel ist.
- Keine Mainserver-Schreibvalidierung, Transaktions- oder Locking-Logik.
- Keine Änderung der Kategorienverwaltung beim Entfernen eines Datentyps.
- Keine Bestandsmigration oder Bereinigung historischer Konflikte.
- Keine generische Abstraktion für weitere Content-Typen.

## Decisions

### Die bestehende Active-only-Kategorienroute erhält einen engen Filter

`GET /api/v1/mainserver/categories` akzeptiert optional genau einen `dataType`. Zulässig sind in diesem Change nur `news_item`, `event_record` und `point_of_interest`. Ohne Parameter bleibt das bestehende Verhalten erhalten.

Die Studio-Fassade lädt die aktiven Kategorien in genau einem vorhandenen GraphQL-Read und nimmt `dataTypes` in dessen interne Antwort auf. Mit `dataType` gibt sie eine Kategorie genau dann zurück, wenn deren validierte Typenliste leer ist oder den angeforderten Typ enthält:

`category.dataTypes.length === 0 || category.dataTypes.includes(dataType)`

Damit gelten Kategorien ohne Typ für alle Content-Arten; Kategorien mit einem oder mehreren Typen gelten jeweils für jeden exakt enthaltenen Typ. Ein leerer, mehrfacher oder unbekannter Request-Wert wird vor dem Upstream-Aufruf als bestehender `invalid_request`-Fehler abgelehnt.

Nur eine tatsächlich gelieferte leere Liste wird als universell behandelt. Fehlt `dataTypes` entgegen dem bestehenden GraphQL-Vertrag oder ist der Wert nicht als Stringliste validierbar, verwendet die Fassade den vorhandenen `invalid_response`-Pfad und liefert keine ungefilterte Ersatzliste. Das Feld bleibt interne Filtermetadaten; die bestehenden Plugin-Optionsmodelle müssen nicht verbreitert werden.

### Jeder Consumer sendet seinen festen fachlichen Typ

Die drei bestehenden API-Funktionen rufen dieselbe Route mit einem festen Query-Parameter auf:

| Consumer | Kanonischer Datentyp |
| --- | --- |
| News | `news_item` |
| Events | `event_record` |
| POI | `point_of_interest` |

Die drei Werte bleiben nahe an den jeweiligen Consumern explizit. Eine Registry, Factory oder neue gemeinsame Clientabstraktion wäre für diese feste Zuordnung unnötig.

### Fehler bleiben im vorhandenen Ladepfad

Bei einem fehlgeschlagenen Kategorien-Read oder ungültigen `dataTypes` zeigt der jeweilige Editor seinen vorhandenen lokalisierten Ladefehler und keine auswählbaren Optionen an. Es entsteht kein neuer fachlicher Mainserver-Fehlervertrag und keine Sonderbehandlung anhand freier Upstream-Meldungstexte.

### Historische Werte bleiben sichtbar und entfernbar

Ist eine am geladenen Content gespeicherte Kategorie nicht im gefilterten Optionskatalog enthalten, bleibt ihr Name über das vorhandene Multi-Select-Verhalten als ausgewählter, nicht verfügbarer Wert sichtbar. Der Benutzer kann ihn entfernen; nach der Entfernung wird er nicht erneut angeboten.

Der Editor verwirft einen solchen Wert bei einer fachfremden Bearbeitung nicht allein deshalb, weil er im Optionskatalog fehlt. Ob der Mainserver den unveränderten oder entfernten Wert akzeptiert, bleibt Bestandteil seines bestehenden Schreibvertrags.

### Die Lösung akzeptiert eine klar benannte Schutzlücke

Die Filterung schützt ausschließlich die Kategorieauswahl im Studio. Direkte Mainserver-Clients, manipulierte Content-Mutationsrequests und Änderungen an `Category.dataTypes` nach einer Auswahl können weiterhin inkompatible Zustände erzeugen oder erhalten. Der Change behauptet deshalb weder serverseitige Durchsetzung noch vollständige Bestandskonsistenz.

Eine spätere verbindliche Integritätsregel wäre ein separater Mainserver-Change mit eigenem Auftrag. Dieser Studio-Change bereitet dafür keine Shadow-Validierung, Feature-Flags oder Migrationsinfrastruktur vor.

## Risks and Mitigations

- Ein falscher kanonischer Typ blendet gültige Kategorien aus → feste Dreiermatrix und gezielte Tests für leere, einzelne und mehrere Typangaben.
- Fehlende `dataTypes` werden versehentlich wie eine leere Liste behandelt → Runtime-Validierung unterscheidet fehlende oder ungültige Werte von der fachlich universellen leeren Liste.
- Der Mainserver liefert `dataTypes` in einer Zielumgebung nicht vertragsgemäß → vorhandener Ladefehler, leere Auswahl und kein ungefilterter Fallback.
- Ein historisch ausgewählter Wert fehlt im neuen Katalog → sichtbar und entfernbar erhalten, nicht still verwerfen.
- Andere Clients umgehen die Studio-Auswahl → als akzeptierte Scope-Grenze dokumentiert; keine irreführende Integritätsgarantie.

## Implementation Readiness

Vor Codebeginn ist nur noch gegen den vorgesehenen Mainserver-Zielstand zu bestätigen, dass die vorhandene Kategorienabfrage das Feld `dataTypes` als nicht-nullbare Stringliste liefert. Danach kann die Änderung als ein einzelner Studio-Lieferabschnitt umgesetzt und mit gezielten Route-, Service-, API- und Editor-Tests abgesichert werden.
