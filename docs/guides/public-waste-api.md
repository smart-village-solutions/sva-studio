# Öffentliche Waste-API

## Zweck und Grenze

Die Public-Waste-Runtime stellt öffentliche, ausschließlich lesende Endpunkte für die Standortauswahl und den Abfallkalender bereit. Externe Verbraucher können zuerst alle öffentlich auswählbaren Abholorte laden und anschließend den bestehenden Kalenderendpunkt für genau einen Katalogeintrag verwenden.

Der Ortskatalog verändert keine Waste-Fachdaten. Er liefert keine E-Mail-Abonnements, Consent-, Token-, Outbox-, Credential-, Audit- oder Jobdaten.

## Abholorte laden

```http
GET /api/public-waste/locations
Accept: application/json
```

Die Antwort enthält alle aktiven Abholortkombinationen, die bereits über den öffentlichen Auswahlfluss erreichbar sind. Identische Auswahlpfade werden anhand ihres Standortschlüssels dedupliziert und deterministisch sortiert.

```json
{
  "items": [
    {
      "id": "11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:all:~",
      "municipality": {
        "id": "11111111-1111-4111-8111-111111111111",
        "name": "Karstädt"
      },
      "district": {
        "id": "22222222-2222-4222-8222-222222222222",
        "name": "Birkholz"
      },
      "streetOrCollectionDistrict": {
        "id": "all",
        "name": "Alle Straßen"
      },
      "houseNumber": {
        "id": "all",
        "label": "Alle Hausnummern"
      },
      "mappingComplete": true,
      "missingFields": [],
      "calendarQuery": {
        "regionId": "11111111-1111-4111-8111-111111111111",
        "cityId": "22222222-2222-4222-8222-222222222222",
        "streetId": "all"
      }
    }
  ]
}
```

Das Mapping verwendet ausschließlich vorhandene Daten:

- `municipality` projiziert die vorhandene Region.
- `district` projiziert den vorhandenen Ort.
- Eine fehlende konkrete Straße verwendet die bestehende Auswahl-ID `all` mit `Alle Straßen`.
- Eine fehlende konkrete Hausnummer verwendet `all` mit `Alle Hausnummern`.

Fehlt die Region, bleibt die Gemeinde unbekannt:

```json
{
  "municipality": null,
  "mappingComplete": false,
  "missingFields": ["municipality"]
}
```

Der Endpunkt setzt weder den Ort als Ersatzgemeinde ein noch ergänzt er einen Defaultwert. Solche Einträge müssen beim externen Abgleich kontrolliert zugeordnet werden.

## Kalender für einen Abholort laden

Die Werte aus `calendarQuery` werden unverändert an den bestehenden Kalenderendpunkt übergeben. Zusätzlich benötigt dieser einen Referenztag im Format `YYYY-MM-DD`.

```http
GET /api/public-waste/calendar?regionId=11111111-1111-4111-8111-111111111111&cityId=22222222-2222-4222-8222-222222222222&streetId=all&referenceDate=2026-08-16
Accept: application/json
```

Fehlt `regionId` in `calendarQuery`, wird der Parameter ausgelassen. `cityId` und `streetId` sind immer vorhanden; `houseNumberId` wird nur bei einer konkreten Hausnummer übertragen.

Der Verbraucher verbindet jede Kalenderantwort mit dem zugehörigen Katalogeintrag. Der Kalender behält dabei unverändert seine bestehende Terminberechnung, Fraktionsbezeichnungen, Verschiebungen und Vererbung über übergeordnete Abholorte.

## Bewusste Nicht-Ziele

Dieser Ausbau führt keine Quellenversion, keinen neuen fachlichen Abfallartencode, keine neue Termin-ID, keine Pagination und keinen Sammelendpunkt für alle Termine ein. Rate Limiting und weitere Ingress-Regeln werden getrennt von diesem fachlichen API-Change behandelt.
