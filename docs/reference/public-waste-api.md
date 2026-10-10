# Öffentliche Waste-API

## Zweck und Grenze

Die Public-Waste-Runtime stellt öffentliche, ausschließlich lesende Endpunkte für die Standortauswahl und den Abfallkalender bereit. Externe Verbraucher können zuerst alle öffentlich auswählbaren Abholorte laden und anschließend den bestehenden Kalenderendpunkt für genau einen Katalogeintrag verwenden.

Der Ortskatalog verändert keine Waste-Fachdaten. Er liefert keine E-Mail-Abonnements, Consent-, Token-, Outbox-, Credential-, Audit- oder Jobdaten.

## Direkt in eine externe Website einbetten

Die bestehende Kalenderoberfläche lässt sich ohne iframe mit einem div und einem JavaScript-Modul einbetten:

```html
<div data-public-waste-calendar data-region="amt-bad-wilsnack"></div>
<script type="module" src="https://abfallkalender.example/embed.js"></script>
```

Die Script-Adresse muss auf die öffentliche Kalender-Instanz zeigen. `data-region` ist verpflichtend und akzeptiert einen eindeutigen Regions-Slug aus `GET /api/public-waste/regions` oder die UUID der Region. Fehlende oder unbekannte Regionen erzeugen einen zugänglichen Fehlerzustand statt einer ungefilterten Auswahl. Die URL der externen Website hat keinen Einfluss auf die Regionsbindung.

Der Moduleinstieg startet beim Laden alle bereits vorhandenen Container mit `data-public-waste-calendar`. Mehrere Container können unterschiedliche Regionen derselben Kalender-Instanz verwenden. Das Script einmal pro Seite einbinden; dynamisch später erzeugte Container gehören nicht zu dieser automatischen Initialisierung.

Jeder Container erhält ein offenes Shadow DOM mit den bestehenden Kalenderkomponenten und deren Styles. CSS und ARIA-IDs sind dadurch auf die jeweilige Instanz begrenzt. Die Host-Seite behält ihre Navigation und ihre globalen Styles. Regionsauswahl, Kalenderansichten, PDF, iCal und konfigurierte E-Mail-Erinnerungen verwenden die vorhandenen öffentlichen Endpunkte der Script-Origin. Im Widget erfolgt keine Speicherung der Adresse in Host-Cookies; nach einem Neuladen wird sie erneut ausgewählt. Die Standalone-App behält ihren bisherigen Cookie-Restore.

Die Host-Seite benötigt eine passende Content Security Policy: `script-src` für die Kalender-Origin und die von dort importierten Module, `connect-src` für die Kalender-API sowie eine Freigabe des im Shadow DOM eingefügten Stylesheets über dessen Hash oder die entsprechende Inline-Style-Regel. Der Moduleinstieg und die importierten Chunks müssen aus demselben Release stammen. Bestehende Proxies dürfen deren CORS-Header nicht entfernen.

Die Runtime liefert CORS ohne Credential-Freigabe für die bekannten öffentlichen API-Endpunkte und JavaScript-/CSS-Assets. API-Fetches des Widgets senden keine Credentials an die Kalender-Origin. iCal-Links verwenden die normale Download-Navigation des Browsers. PDF-Antworten geben `Content-Disposition` frei, damit der Download den serverseitigen Dateinamen erhält. OPTIONS erlaubt für die Read-Endpunkte GET/HEAD und für die bestehende Erinnerungsanmeldung POST mit Content-Type. Bestätigungs- und Abmeldeseiten erhalten keine CORS-Freigabe; deren bestehende Validierung und die Limits der Erinnerungsanmeldung bleiben erhalten.

Der Kalender verwendet die vorhandenen semantischen Auswahl- und Kalenderkomponenten. Termin-Details verwenden einen nativen modalen Dialog, der auch den Host-Hintergrund sperrt und den Fokus an den auslösenden Button im Shadow DOM zurückgibt. Automatische Tests decken Tastaturbedienung, Fokus, Exporte und Axe-Prüfungen auf einer zweiten Origin ab. Eine manuelle Screenreader-Abnahme der konkreten Host-Seite wird dadurch nicht ersetzt.

## Weboberfläche an eine Region binden

Einbettende Seiten begrenzen die öffentliche Weboberfläche über einen lesbaren Regionspfad dauerhaft auf eine öffentlich auswählbare Region. Der Pfad wird aus dem Regionsnamen gebildet; Umlaute werden als `ae`, `oe` beziehungsweise `ue`, `ß` als `ss` und Worttrenner als Bindestriche geschrieben:

```text
https://abfallkalender.example/amt-bad-wilsnack
```

Die verfügbaren Namen und Slugs liefert `GET /api/public-waste/regions`. Der Katalog veröffentlicht nur nicht leere, eindeutig auflösbare Slugs. Die Auswahl beginnt direkt beim Ort. „Adresse ändern“, weitere Adresssuchen und die aus dem gewählten Standort abgeleiteten Kalender-, PDF-, iCal- und Erinnerungsaktionen behalten die URL-Region bei. Ohne Regionspfad bleibt die regionsübergreifende Auswahl unverändert. Formal ungültige, unbekannte oder nicht eindeutige Slugs werden mit einem Fehlerzustand abgelehnt; es erfolgt kein ungefilterter Fallback.

Der Slug folgt dem aktuellen Regionsnamen. Wird dieser Name in den Stammdaten geändert, muss die einbettende Seite den Link anhand des aktuellen Regionskatalogs aktualisieren. Der Pfad ist damit ein lesbarer Kundenlink, aber kein namensunabhänglicher Permalink.

Bestehende technische Einbindungen mit genau einem gültigen Suchparameter `regionId` bleiben kompatibel, sind aber nicht das Format für neue öffentliche Links.

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
