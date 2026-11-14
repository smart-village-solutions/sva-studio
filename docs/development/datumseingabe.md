# Gemeinsame Datumseingabe

## Vereinbarter Umfang

`DatePicker` in `@sva/studio-ui-react` verbindet eine direkt beschreibbare Eingabe mit einem optionalen Kalender. Der Veranstaltungseditor war der erste Verbraucher; die übrigen Studio-Eingaben verwenden inzwischen die nachfolgend beschriebenen gemeinsamen Bausteine. Der Entwurf wurde im Arbeitsdialog zu Issue #1280 freigegeben.

- Kalender und Popover folgen dem shadcn-Muster mit React DayPicker und Radix Popover. `date-fns` übernimmt das strikte Kalenderdatum-Parsing. Eigene Kalender-, Fokus- oder Zeitzonenalgorithmen werden vermieden.
- Öffentliche Werte sind `YYYY-MM-DD` oder `null`. Unvollständiger beziehungsweise ungültiger Eingabetext bleibt sichtbar; der Änderungs-Callback meldet zusätzlich den Validierungsfehler. Verbraucher müssen diesen beim Speichern berücksichtigen.
- Die Komponente ist unabhängig von React Hook Form. Beschriftungen und Meldungen kommen aus den Übersetzungen des Verbrauchers; die Locale steuert Eingabeformat und Kalender.
- Monatsnavigation verändert ausschließlich die Ansicht. Erst die Tagesauswahl verändert den Wert. Escape schließt ohne Auswahl; der Fokus kehrt zur Kalenderschaltfläche zurück.
- Leeren, Pflichtfeld, Mindest-/Höchstdatum, deaktivierte und schreibgeschützte Felder werden unterstützt. Einzelne Datumswerte sind der erste Umfang; Zeitstempel und Zeitraumauswahl bleiben eigene Aufgaben.
- Ungültige Eingaben werden nach Verlassen des Feldes beziehungsweise einem Speicherungsversuch verständlich angezeigt. Fehler und Formathinweis sind mit der Eingabe verknüpft.

## Events-Integration

Jedes Start-/Enddatum wird als einzelnes Formularfeld aktualisiert. Die Terminliste darf dabei nicht ersetzt werden. Validierung muss auch weitere Terminzeilen sowie das Speichern aus einem anderen Tab abdecken. Bereits besuchte Tabs bleiben montiert und erhalten unvollständigen Eingabetext.

## Nachweise

Gezielte Vitest-Prüfungen decken ungültige Kalendertage, Schaltjahre, Formatierung, Werte ohne Zeitzonenverschiebung, Eingabezwischenstände, Kalendernavigation, Grenzen und Formularintegration ab. Parsing delegiert die Kalenderarithmetik an `date-fns`; deterministische Randfalltests prüfen den schmalen Formatvertrag anstelle einer weiteren Property-Test-Abhängigkeit.

Browserprüfungen müssen Tastatur, Maus, Fokus, schmale Ansichten und automatisierte Accessibility-Prüfungen abdecken. Eine vollständige Screenreader-Abnahme muss mit realer Assistenztechnik erfolgen; automatisierte Tests ersetzen sie nicht.

## Verwendung

```tsx
import { DatePicker } from '@sva/studio-ui-react';

<DatePicker
  id="event-start"
  label={t('fields.dateStart')}
  locale="de-DE"
  labels={datePickerLabels}
  value={dateValue}
  onChange={(value, error) => {
    setDateValue(value);
    setDateError(error);
  }}
  onValidationChange={setDateError}
/>;
```

`labels` enthält die übersetzten Bezeichnungen `openCalendar`, `calendar`, `navigation`, `previousMonth`, `nextMonth`, `formatHint`, `today`, `selected` und `errors` für `invalid`, `required`, `min`, `max`. Für mehrere Felder erhalten Öffnen-Schaltfläche und Kalender einen feldbezogenen Namen. Unterstützte Locales sind `de-DE`, `en-GB` und `en-US`; Events verwendet für Englisch `en-GB`.

`value` ist ein gültiges ISO-Kalenderdatum oder `null`. `onChange` liefert bei ungültigem Eingabetext `null` und den Fehlercode. `onValidationChange` meldet zusätzlich Änderungen der Gültigkeit durch Pflichtfeld oder Datumsgrenzen. Bei Formularbibliotheken muss dieser Fehler die Submit-Validierung blockieren; ausschließlich auf `value === null` zu prüfen würde ungültigen Text mit einem leeren optionalen Feld verwechseln. Die Events-Integration in `events.detail-date-input.tsx` zeigt die Anbindung über `useController`.

`onBlur` und der weitergereichte Input-Ref unterstützen Touched-Zustand und Fehlerfokus. `error` nimmt eine übersetzte Formularfehlermeldung entgegen. Für native Formulare setzt die Komponente `setCustomValidity`; `name` erzeugt einen versteckten ISO-Wert für `FormData`. Ein Formular mit `noValidate` muss die Fehler selbst prüfen, wie der Events-Editor. `min` und `max` erwarten gültige ISO-Kalenderdaten.

Externe Änderungen von `value` aktualisieren die Anzeige. Ein vollständiger Formularreset einschließlich eines unvollständigen Entwurfs bei unverändertem `value` erfolgt durch einen neuen React-`key`. Verbraucher sollen Felder bei Tabwechseln montiert halten, wenn sie Entwürfe erhalten möchten.

## Wertarten und gemeinsame Bausteine

Die Locale bestimmt Eingabe und Anzeige, niemals das Format der API-Payload. Die bestehende Redaktionszeitzone ist `Europe/Berlin`; die Browser-/Betriebssystemzeitzone darf API-Werte nicht bestimmen.

| Fachlicher Wert                 | UI-Baustein aus `@sva/studio-ui-react`                                              | Wertvertrag                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Kalendertag                     | `DatePicker` mit eigener Feldumgebung oder `DateInput` in vorhandenem `StudioField` | `YYYY-MM-DD`, keine Offsetumrechnung                                                                         |
| Kalendertag mit React Hook Form | `FormDateInput`                                                                     | Kanonischer String im Formular, sichtbare lokalisierte Eingabe als Fokusziel                                 |
| Uhrzeit                         | `TimeInput`                                                                         | `HH:mm`, bei vorhandener Genauigkeit auch Sekunden/Bruchteile; kein künstliches Datum                        |
| Lokales Datum und Uhrzeit       | `LocalDateTimeInput`                                                                | Lokale ISO-Komponenten ohne Offset; API-Konvertierung bleibt beim Verbraucher                                |
| Absoluter Zeitpunkt             | `InstantInput`                                                                      | ISO-Zeitpunkt mit Offset; lokale Bearbeitung in der Redaktionszeitzone, neue Werte werden als UTC ausgegeben |

`TimeInput` nutzt das native Uhrzeitfeld; `step="any"` vermeidet eine unbeabsichtigte Einschränkung auf volle Minuten. `LocalDateTimeInput` kombiniert `DateInput` mit `TimeInput`, damit auch bei kombinierten Werten jeder Datumsteil denselben lokalisierten Kalender verwendet. Sein `onValueChange` liefert weiterhin einen einzelnen lokalen ISO-String; bei einem nativen Formular trägt ein verstecktes Feld diesen kanonischen Wert. `DateInput` nutzt denselben Kalender und dieselbe Entwurfslogik wie `DatePicker`, ohne eine zweite Beschriftungshierarchie aufzubauen. Gemeinsame Kalendertexte liegen in den de/en-Ressourcen unter `shared.datePicker`.

Ungültige Datumsentwürfe bleiben sichtbar und werden nicht als leere gültige Werte behandelt. Gemeinsame Eingaben beachten ihre Constraints auch in Formularen mit `noValidate`. Verbraucher mit direktem Speicheraufruf außerhalb eines Submit-Ereignisses müssen weiterhin ihre fachliche Formular-/Serialisierungsvalidierung ausführen. Der Vorschau-Button der Jahresübernahme verwendet dafür die Gültigkeitsprüfung des gesamten Formulars einschließlich der Zieljahresgrenzen. Listenfilter übertragen nur vollständige kanonische Kalendertage.

## Darstellung

Die frameworkfreien SDK-Funktionen unterscheiden dieselben Bedeutungen:

- `formatCalendarDate`: Kalendertag ohne Verschiebung durch eine Zeitzone.
- `formatTimeOfDay`: Uhrzeit ohne Datum/Offset, vorhandene Sekundenpräzision bleibt sichtbar.
- `formatLocalDateTime`: lokale Datum-/Uhrzeitbestandteile ohne Interpretation als Zeitpunkt.
- `formatDateTimeInEditorTimeZone`: absolute Zeitpunkte in der Redaktionszeitzone.
- `formatTechnicalDateTimeInEditorTimeZone`: technische Zeitpunkte einschließlich Sekunden und Millisekunden.

Dazu gehören `isCalendarDate`, `isTimeOfDay`, `isLocalDateTime` und `isInstant` zur expliziten Validierung an bestehenden Formulargrenzen. Ein Wert ohne Offset ist kein bestätigter absoluter Zeitpunkt. Anzeigen formatieren Werte; sie schreiben keine lokalisierten Texte in API-Felder zurück.

## Verbraucher und API-Grenzen

| Verbraucher                                  | Fachlicher/API-Vertrag                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Veranstaltungen                              | Start-/Enddatum bleiben Kalendertage; Start-/Endzeit bleiben getrennte Uhrzeiten. Bestehende Legacy-Lesekompatibilität und Zusatzangaben bleiben erhalten.                                                                                                                                |
| Baustellen und Jobs                          | Termin-/Publikationstage und Datumsfilter bleiben `YYYY-MM-DD`.                                                                                                                                                                                                                           |
| POI und generische Öffnungszeiten            | Gültigkeitstage und Uhrzeiten bleiben getrennt; optionale Felder behalten die bestehende Leerwert-/Auslassungssemantik.                                                                                                                                                                   |
| Abfallwirtschaft                             | Touren, Verschiebungen, Gültigkeit, Zuordnungen, Jahresübernahme und Prüfbereiche verwenden Kalendertage. Jahres-/Mehrfachkalender verwenden weiterhin den vorhandenen `Calendar`, keine Einzeldatum-Auswahl.                                                                             |
| News, Content, Rechtstexte, Mitgliedschaften | Bestehende lokale Formularwerte werden im zuständigen Adapter über `fromDatetimeLocalValue` in absolute API-Zeitpunkte konvertiert.                                                                                                                                                       |
| Umfragen                                     | Lesen über `toDatetimeLocalValue`, Schreiben mit dem geladenen Referenzzeitpunkt. Unveränderte Werte behalten Präzision und die konkrete Instanz einer mehrdeutigen Winterzeit. Nicht existente Sommerzeitwerte werden vor der Mutation abgewiesen.                                       |
| FAQ und Cockpit-Karten                       | Veröffentlichungszeitpunkte werden über `InstantInput` bearbeitet; unveränderte ISO-Werte bleiben unverändert.                                                                                                                                                                            |
| Generische Termine                           | Der bestehende Mainserver-Stringvertrag und die Fixtures enthalten Kalendertage, lokale Datum-/Uhrzeitwerte und absolute Zeitpunkte. Der vorhandene Terminpfad wählt nach dem geladenen Wert den passenden Baustein; beim Leeren bleibt diese Wertart innerhalb der Terminzeile erhalten. |
| Generisches `publishedAt`                    | Absoluter Zeitpunkt über `InstantInput`; offsetfreie/localisierte Eingaben werden nicht als absolute API-Werte akzeptiert.                                                                                                                                                                |
| Generisches `publicationDate`                | Explizit dokumentierter freier technischer String; bleibt ein Textfeld und wird weder als Kalendertag erzwungen noch umgerechnet.                                                                                                                                                         |
| Bus-API-Schlüssel                            | Der gewählte einschließlich gültige Ablauftag wird weiterhin ausschließlich im vorhandenen Adapter auf den UTC-Beginn des Folgetags abgebildet. Die technische Ablaufzeit bleibt zusätzlich präzise sichtbar.                                                                             |

Der Mainserver-Snapshot unter `packages/sva-mainserver/src/generated/schema.snapshot.json` beschreibt beispielsweise `DateInput`- und `OpeningHourInput`-Werte als Strings. Das begründet keine globale UTC-Konvertierung: Maßgeblich sind zusätzlich der vorhandene fachliche Adapter, dokumentierte Semantik und Payload-/Roundtrip-Tests. Schema, Persistenz und externe APIs werden durch diese Vereinheitlichung nicht geändert.

## Präzision und Sommerzeit

`toDatetimeLocalValue` zeigt vorhandene Sekunden/Millisekunden an. Bei unveränderter Rückkonvertierung gibt `fromDatetimeLocalValue` den geladenen Referenzwert zurück, damit zusätzliche Sekundenbruchteile oder ein expliziter Offset nicht verloren gehen. Fehlt ein Referenzwert, bleibt die bestehende Auswahl der früheren Instanz einer mehrdeutigen Winterzeit maßgeblich. Eine nicht existente Uhrzeit beim Sommerzeitbeginn wird abgewiesen. Eine neue interaktive Auswahl zwischen beiden Winterzeit-Instanzen ist nicht Teil dieses Changes.

Der gemeinsame Parser und beide DayPicker-Verbraucher verwenden für reine Kalendertage ausdrücklich UTC als interne Kalenderdarstellung. Diese internen `Date`-Objekte sind keine API-Zeitpunkte. „Heute“ und das vorbelegte Planungsjahr werden aus dem Datum der Redaktionszeitzone bestimmt. Ein gezielter Reproduktionstest unter `Pacific/Apia` sichert auch den dort historisch übersprungenen Kalendertag 30.12.2011 ab; lokales System-Parsing darf ihn nicht auf den Folgetag verschieben.

Die gemeinsame UI konsumiert ausschließlich `@sva/plugin-sdk/temporal`, den schmalen browserfähigen Vertrag für diese Hilfsfunktionen und gemeinsame Übersetzungen. Die bisherige Root-Import-Sperre bleibt bestehen; neben `content-media` ist nur dieser konkrete Unterpfad freigegeben. Die Kalenderdarstellung verwendet `UTCDate` aus [`@date-fns/utc`](https://github.com/date-fns/utc), einschließlich der vom DayPicker neu konstruierten Tage. Es gibt keine eigene Kalenderarithmetik. Das vermeidet auch beim gerenderten Kalender die Abhängigkeit von historisch übersprungenen Tagen der Systemzeitzone.
