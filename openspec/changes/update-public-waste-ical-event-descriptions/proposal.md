# Change: Angereicherte Event-Beschreibungen im Public-Waste-iCal

## Why
Der öffentliche Abfallkalender liefert im iCal-Feed bislang pro Termin nur den Fraktionsnamen als Titel und optional eine einzelne Terminnotiz. Für Kalender-Clients fehlt damit die fachliche Kontextbeschreibung aus Fraktion, Tour und konkretem Abholhinweis direkt am jeweiligen Event.

## What Changes
- Der iCal-Feed der Capability `public-waste-calendar` ergänzt pro `VEVENT` eine gesammelte `DESCRIPTION`.
- Die Event-Beschreibung fasst verfügbare Hinweise aus Fraktionsbeschreibung, Tourbeschreibung und terminbezogener Notiz in stabiler Reihenfolge zusammen.
- Die App erweitert das öffentliche Kalenderdatenmodell um eine optionale Fraktionsbeschreibung, damit der iCal-Export dieselbe fachliche Quelle wie die UI nutzt.

## Impact
- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/lib/public-waste-contract.ts`, `apps/public-waste-calendar-web/src/lib/public-waste-repository.server.ts`, `apps/public-waste-calendar-web/src/lib/public-waste-endpoints.server.ts`, `apps/public-waste-calendar-web/src/lib/public-waste-ical.server.ts`
- Affected arc42 sections: keine

## Follow-up
- Personalisierte ICS-Links mit fraktions- und reminderbezogenen `VALARM`-Überlegungen werden bewusst nicht Teil dieses Changes und sind in GitHub-Issue `#557` festgehalten.
