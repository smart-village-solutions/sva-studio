# Change: Öffentlichen Abfallkalender dauerhaft an eine URL-Region binden

## Why

Kommunale Webseiten binden den öffentlichen Abfallkalender über regionsspezifische iFrames ein. Die vorhandene `regionId`-Filterung der öffentlichen API wird von der Weboberfläche bislang nicht als unveränderlicher Seitenkontext übernommen, sodass spätere Adresswechsel wieder eine regionsübergreifende Auswahl ermöglichen.

## What Changes

- Eine gültige `regionId` aus der Seiten-URL als unveränderlichen Kontext der geöffneten Web-App übernehmen.
- Auswahlfluss, Cookie-Wiederherstellung und Adresswechsel auf diese Region begrenzen.
- Formal ungültige und unbekannte Regionen verständlich und ohne ungefilterten Fallback ablehnen.
- Kalender, PDF, iCal und E-Mail-Erinnerungen weiterhin aus derselben regionsgebundenen finalen Auswahl ableiten.
- Den regionsgebundenen Ablauf mit fokussierten Unit- und E2E-Tests absichern.

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/routes/index.tsx`, app-lokale Repository-Auswahl und zugehörige Tests
- Affected docs: `docs/reference/public-waste-api.md`
- Affected arc42 sections: keine; die bestehende App-, API- und Datenbankgrenze bleibt unverändert
