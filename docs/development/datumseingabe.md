# Gemeinsame Datumseingabe

## Vereinbarter Umfang

`DatePicker` in `@sva/studio-ui-react` verbindet eine direkt beschreibbare Eingabe mit einem optionalen Kalender. Der Veranstaltungseditor ist der erste Verbraucher. Der Entwurf wurde im Arbeitsdialog zu Issue #1280 freigegeben.

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
/>
```

`labels` enthält die übersetzten Bezeichnungen `openCalendar`, `calendar`, `navigation`, `previousMonth`, `nextMonth`, `formatHint`, `today`, `selected` und `errors` für `invalid`, `required`, `min`, `max`. Für mehrere Felder erhalten Öffnen-Schaltfläche und Kalender einen feldbezogenen Namen. Unterstützte Locales sind `de-DE`, `en-GB` und `en-US`; Events verwendet für Englisch `en-GB`.

`value` ist ein gültiges ISO-Kalenderdatum oder `null`. `onChange` liefert bei ungültigem Eingabetext `null` und den Fehlercode. `onValidationChange` meldet zusätzlich Änderungen der Gültigkeit durch Pflichtfeld oder Datumsgrenzen. Bei Formularbibliotheken muss dieser Fehler die Submit-Validierung blockieren; ausschließlich auf `value === null` zu prüfen würde ungültigen Text mit einem leeren optionalen Feld verwechseln. Die Events-Integration in `events.detail-date-input.tsx` zeigt die Anbindung über `useController`.

`onBlur` und der weitergereichte Input-Ref unterstützen Touched-Zustand und Fehlerfokus. `error` nimmt eine übersetzte Formularfehlermeldung entgegen. Für native Formulare setzt die Komponente `setCustomValidity`; `name` erzeugt einen versteckten ISO-Wert für `FormData`. Ein Formular mit `noValidate` muss die Fehler selbst prüfen, wie der Events-Editor. `min` und `max` erwarten gültige ISO-Kalenderdaten.

Externe Änderungen von `value` aktualisieren die Anzeige. Ein vollständiger Formularreset einschließlich eines unvollständigen Entwurfs bei unverändertem `value` erfolgt durch einen neuen React-`key`. Verbraucher sollen Felder bei Tabwechseln montiert halten, wenn sie Entwürfe erhalten möchten.
