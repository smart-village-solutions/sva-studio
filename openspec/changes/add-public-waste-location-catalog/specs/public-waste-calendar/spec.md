## ADDED Requirements

### Requirement: Öffentliche App liefert einen lesenden Abholortkatalog

Das System SHALL über `GET /api/public-waste/locations` alle aktiven öffentlichen Abholorte als deterministisch sortierte, ausschließlich aus bestehenden Waste-Daten projizierte Liste bereitstellen.

#### Scenario: Verbraucher lädt alle öffentlichen Abholorte

- **WHEN** ein Verbraucher den öffentlichen Abholortkatalog abruft
- **THEN** enthält die Antwort pro eindeutigem Auswahlpfad einen Standortschlüssel sowie die vorhandenen technischen IDs und Originalbezeichnungen
- **AND** identische Auswahlpfade werden deterministisch über den bestehenden Standortschlüssel dedupliziert
- **AND** inaktive Abholorte werden nicht ausgegeben

#### Scenario: Ortskatalog bleibt ein reiner Leseweg

- **WHEN** der Abholortkatalog abgerufen wird
- **THEN** liest das System ausschließlich bestehende Waste-Fachdaten
- **AND** es führt weder Schreibzugriffe noch Backfills, Seeds oder Datenmigrationen aus

### Requirement: Öffentlicher Ortskatalog mappt vorhandene Hierarchie ohne Ersatzwerte

Das System SHALL eine vorhandene Region als `municipality` und einen vorhandenen Ort als `district` mit ihren unveränderten IDs und Originalnamen projizieren.

#### Scenario: Region und Ort sind vorhanden

- **WHEN** ein aktiver Abholort eine Region und einen Ort besitzt
- **THEN** enthält `municipality` die vorhandene Regions-ID und den unveränderten Regionsnamen
- **AND** enthält `district` die vorhandene Orts-ID und den unveränderten Ortsnamen
- **AND** ist `mappingComplete` gleich `true`

#### Scenario: Region fehlt

- **WHEN** ein aktiver Abholort keine Region besitzt
- **THEN** ist `municipality` gleich `null`
- **AND** bleibt der vorhandene Ort unter `district` erhalten
- **AND** ist `mappingComplete` gleich `false`
- **AND** enthält `missingFields` den Wert `municipality`
- **AND** verwendet das System weder den Ort noch einen Defaultwert als künstliche Gemeinde

### Requirement: Öffentlicher Ortskatalog beschreibt vorhandene Auswahlbreite

Das System SHALL konkrete und übergeordnete Abholorte mit der bestehenden öffentlichen Auswahlsemantik für Straße und Hausnummer beschreiben.

#### Scenario: Abholort gilt für alle Straßen eines Orts

- **WHEN** ein aktiver Abholort keine konkrete Straße besitzt
- **THEN** enthält `streetOrCollectionDistrict` die bestehende Auswahl-ID `all`
- **AND** enthält das Feld die bestehende Originalbezeichnung `Alle Straßen`

#### Scenario: Abholort gilt für alle Hausnummern einer Straße

- **WHEN** ein aktiver Abholort eine Straße, aber keine konkrete Hausnummer besitzt
- **THEN** enthält `houseNumber` die bestehende Auswahl-ID `all`
- **AND** enthält das Feld die bestehende Originalbezeichnung `Alle Hausnummern`

### Requirement: Jeder Katalogeintrag ist mit dem bestehenden Kalenderendpunkt nutzbar

Das System SHALL für jeden Katalogeintrag eine `calendarQuery` mit den bestehenden Parametern des öffentlichen Kalenderendpunkts bereitstellen.

#### Scenario: Verbraucher lädt Termine für einen Katalogeintrag

- **WHEN** ein Verbraucher `regionId`, `cityId`, `streetId` und gegebenenfalls `houseNumberId` aus `calendarQuery` an `GET /api/public-waste/calendar` übergibt
- **THEN** verwendet der Kalenderendpunkt unverändert seine bestehende Terminberechnung
- **AND** kann der Verbraucher die Kalenderantwort anhand des Katalogeintrags dem vollständigen Abholort zuordnen

#### Scenario: Katalogeintrag besitzt keine Region

- **WHEN** ein Katalogeintrag keine vorhandene Region besitzt
- **THEN** lässt `calendarQuery` den optionalen Parameter `regionId` aus
- **AND** bleiben die übrigen vorhandenen Auswahlparameter unverändert nutzbar

### Requirement: Öffentlicher Ortskatalog wahrt die bestehende Datenminimierung

Das System SHALL im Abholortkatalog nur aktive, bereits öffentlich auswählbare Adresswerte ausgeben.

#### Scenario: Ortskatalog wird öffentlich abgerufen

- **WHEN** die Public-Waste-Runtime den Ortskatalog beantwortet
- **THEN** enthält die Antwort keine E-Mail-Abonnements, Consent-, Token-, Outbox-, Credential-, Audit- oder Jobdaten
- **AND** verwendet der Endpunkt dieselbe eingeschränkte öffentliche Datenzugriffsgrenze wie die bestehenden Public-Waste-Read-Endpunkte
