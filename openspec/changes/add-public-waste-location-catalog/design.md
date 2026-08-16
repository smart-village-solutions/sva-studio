## Context

Die Public-Waste-App besitzt bereits einen mehrstufigen Auswahlfluss über Region, Ort, Straße und optional Hausnummer sowie einen Kalenderendpunkt für eine vollständige Auswahl. Ein externer Verbraucher kann damit Termine laden, kennt aber nicht ohne rekursives Durchlaufen des UI-orientierten Auswahlflusses alle abfragbaren Abholorte.

Die zugrunde liegenden Waste-Daten verwenden die bestehende Hierarchie `Region -> Ort -> Straße -> Hausnummer`. Region, Straße und Hausnummer können an einem Abholort fehlen; der Ort ist vorhanden. Der neue Vertrag darf diese Daten nur lesen und darf fehlende Ebenen weder persistieren noch durch fachlich ungesicherte Werte ersetzen.

## Goals / Non-Goals

### Goals

- eine vollständige, deterministisch sortierte Liste der aktiven vorhandenen Abholorte bereitstellen
- vorhandene technische IDs und Originalbezeichnungen verlustfrei ausgeben
- jeden Katalogeintrag unmittelbar mit dem bestehenden Kalenderendpunkt nutzbar machen
- das vereinbarte Mapping `Region -> municipality` und `Ort -> district` transparent anwenden
- unvollständige Mappings sichtbar ausgeben, statt sie zu verwerfen oder zu vervollständigen
- ausschließlich die bestehende öffentliche Read-Rolle und Public-Waste-Runtime verwenden

### Non-Goals

- Änderungen, Backfills oder Migrationen von Waste-Fachdaten
- Umbenennung bestehender Tabellen, Spalten, Core-Typen oder redaktioneller Begriffe
- Einführung einer Pflicht-Region oder einer künstlichen Gemeinde
- Änderung oder Duplizierung der Kalenderberechnung
- neuer Sammel-Endpunkt für alle Termine aller Abholorte
- Einführung einer Quellenversion, eines neuen fachlichen Fraktionscodes oder eines neuen Terminstatusmodells
- Import, Export oder Klonen von Waste-Tenant-Daten

## Decisions

### Decision: Der Ortskatalog ist eine reine Projektion bestehender Abholorte

`GET /api/public-waste/locations` liest aktive Abholorte und ihre vorhandene Adresshierarchie. Der Endpunkt schreibt keine Daten und besitzt keinen Reparatur-, Seed- oder Normalisierungspfad.

Jeder Eintrag enthält mindestens:

- einen stabil aus den vorhandenen Auswahl-IDs gebildeten Standortschlüssel `id`
- `municipality` als vorhandene Regions-ID und unveränderten Regionsnamen oder `null`
- `district` als vorhandene Orts-ID und unveränderten Ortsnamen
- `streetOrCollectionDistrict` als vorhandene Straße oder die etablierte Auswahl `all`
- `houseNumber` als vorhandene Hausnummer oder die etablierte Auswahl `all`
- `mappingComplete` und `missingFields`
- `calendarQuery` mit den existierenden Parametern `regionId`, `cityId`, `streetId` und optional `houseNumberId`

Der Vertrag transportiert die Originalnamen der vorhandenen Hierarchie und ersetzt sie nicht durch normalisierte oder neu erzeugte Namen. Die API-Feldnamen sind eine Ausgabeprojektion und ändern die persistente Bedeutung oder Benennung nicht.

### Decision: Fehlende Regionen bleiben sichtbar unvollständig

Wenn ein Abholort keine Region besitzt, ist `municipality` gleich `null`. Der vorhandene Ort bleibt unter `district` erhalten. Der Eintrag wird mit `mappingComplete: false` und `missingFields: ["municipality"]` ausgeliefert.

Der Endpunkt darf in diesem Fall insbesondere nicht:

- den Ort zugleich als Gemeinde ausgeben
- eine Default-Gemeinde verwenden
- den Eintrag stillschweigend ausblenden
- einen Schreibzugriff zur Vervollständigung auslösen

Damit kann der externe Abgleich vollständige Einträge automatisch verarbeiten und unvollständige Einträge kontrolliert einer manuellen Zuordnung zuführen.

### Decision: Sammelwerte verwenden die bestehende Auswahlsemantik

Ein Abholort ohne konkrete Straße wird mit `streetOrCollectionDistrict.id = "all"` und der bestehenden öffentlichen Bezeichnung `Alle Straßen` ausgegeben. Eine fehlende konkrete Hausnummer wird entsprechend mit `houseNumber.id = "all"` und `Alle Hausnummern` dargestellt. Diese Werte sind Parameter der bereits vorhandenen öffentlichen Auswahlsemantik und werden nicht in die Fachdaten geschrieben.

### Decision: Der bestehende Kalenderendpunkt bleibt führend

Der Ortskatalog berechnet keine Termine. Ein Verbraucher übernimmt die gelieferte `calendarQuery` in `GET /api/public-waste/calendar` und verbindet die Antwort mit dem Katalogeintrag. Terminfenster, Fraktionsbezeichnungen, Verschiebungen, Vererbung über übergeordnete Abholorte und Deduplizierung bleiben vollständig in der bestehenden Kalenderlogik.

Der erste Ausbau verspricht keine neue `sourceVersion`, keinen zusätzlichen fachlichen Abfallartencode und keine über die bestehende Kalender-ID hinausgehende Termin-ID. Diese empfohlenen Metadaten dürfen später additiv spezifiziert werden, werden hier aber nicht erfunden.

### Decision: Der öffentliche Vertrag enthält keine nicht öffentlichen Waste-Daten

Der Katalog liefert nur aktive Abholorte und die Adresswerte, die der bestehende öffentliche Auswahlfluss bereits einzeln zugänglich macht. Inaktive Abholorte, E-Mail-Abonnements, Consent-, Token-, Outbox-, Credential-, Audit- oder Jobdaten bleiben ausgeschlossen. Die bestehende eingeschränkte Public-Waste-Datenbankrolle bleibt die Zugriffsgrenze.

## Risks / Trade-offs

- Ein fehlendes `municipality` verhindert für einzelne Einträge einen vollautomatischen Vergleich nach dem gewünschten Gesamtschlüssel. Die sichtbare Unvollständigkeit ist jedoch zuverlässiger als ein falsches Mapping.
- Die gesammelt abrufbare Liste erleichtert die technische Enumeration bereits öffentlich auswählbarer Adressen. Der Vertrag begrenzt sich deshalb strikt auf aktive öffentliche Auswahlwerte und enthält keine personenbezogenen oder operativen Daten.
- Interne Begriffe `Region` und `Ort` bleiben bestehen, während der Ausgabevertrag `municipality` und `district` verwendet. Tests und Dokumentation müssen diese reine Projektion ausdrücklich sichern.
- Mehrere technische Abholortdatensätze können denselben Auswahlpfad beschreiben. Die Ausgabe dedupliziert deterministisch nach dem bestehenden Standortschlüssel, ohne Quelldatensätze zu verändern.

## Migration Plan

Es gibt keine Datenmigration. Die Runtime erhält den neuen Read-Endpunkt additiv. Ein Rollback entfernt ausschließlich Route, Read-Projektion und zugehörige Dokumentation; Fachdaten und bestehende öffentliche Endpunkte bleiben unverändert.

## Open Questions

Keine offenen Produktentscheidungen. Pagination oder zusätzliche Terminmetadaten bleiben mögliche, getrennt zu spezifizierende Erweiterungen, falls reale Antwortgrößen oder der spätere Abgleich sie erfordern.
