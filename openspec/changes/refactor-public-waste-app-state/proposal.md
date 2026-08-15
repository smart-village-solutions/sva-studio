# Change: Zustand der Public-Waste-App entflechten

## Why

Die vollständige Standortansicht bündelt Fraktionsfilter, drei Aktionspanels, PDF-Status, iCal-Reminder und E-Mail-Abo in einer einzelnen komplexen React-Komponente. Eine verhaltensgleiche Trennung macht Reset- und Accessibility-Verträge gezielt testbar.

## What Changes

- trennt die vollständige Kalenderansicht von ihrem konkreten Action-Hub
- isoliert Reminder-Auswahl und lokalen Action-Zustand in fachlich begrenzter Logik
- bewahrt sichtbare Texte, URLs, Fraktionsfilter, PDF- und Reminder-Verträge
- charakterisiert Panel-, Reset-, Fehler-, Reihenfolge- und Accessibility-Verhalten gegen den Altcode
- ändert keine Loader-, Repository-, API-, Token-, CSS- oder Routingschnittstelle

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/components/public-waste-app*`
- Affected arc42 sections: `05-building-block-view`
