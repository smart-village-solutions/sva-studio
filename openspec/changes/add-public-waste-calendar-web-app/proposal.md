# Change: Öffentliche Web-App für den Abfallkalender

## Why
Kommunen benötigen einen öffentlichen, schlicht einbettbaren Abfallkalender, der auf denselben Waste-Daten basiert wie das Studio-Waste-Management, aber ohne Studio-Login und ohne direkte Offenlegung von Datenbankzugängen funktioniert. Die bestehende Capability `waste-management` deckt die administrative Pflege ab und schließt öffentliche Bürger-Read-APIs ausdrücklich aus.

## What Changes
- Einführung einer neuen öffentlichen Capability für einen webbasierten Abfallkalender
- Einführung einer eigenständigen öffentlichen Web-App im Monorepo mit serverseitig geladener lokaler JSON-Konfiguration
- Einführung einer serverseitigen Read-Schicht für Standortauflösung, Kalenderdaten und iCal-Ausgabe gegen dieselbe Waste-Supabase
- Einführung eines öffentlichen, datengetriebenen Auswahlflusses für Region, Ort, Straße und Hausnummer beziehungsweise Hausnummerbereich
- Einführung von Terminliste, Monatskalender, Jahreskalender, Fraktionsfiltern sowie dynamisch abgeleiteten PDF- und iCal-Aktionen
- Einführung eines Cookie-basierten Preference-Vertrags für genau einen gemerkten Standort pro Browser

## Impact
- Affected specs: `public-waste-calendar`
- Affected code: `apps/` für die neue öffentliche App, neue serverseitige Waste-Read-Pfade, gemeinsame Waste-Domainlogik, öffentliche Export- und Preference-Pfade
- Affected arc42 sections: `docs/architecture/03-context-and-scope.md`, `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/07-deployment-view.md`, `docs/architecture/08-cross-cutting-concepts.md`, `docs/architecture/10-quality-requirements.md`, `docs/architecture/11-risks-and-technical-debt.md`
