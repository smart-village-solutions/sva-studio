# Change: Public-Waste-Reminder-Actions entflechten

## Why

Der öffentliche Reminder-Page-Handler vermischt konfigurierte Statusseiten, DOI-Aktivierung, signierte Abmeldetoken, Repository-Zugriffe und Redirect-Auswahl in einer verzweigten Orchestrierung. Eine verhaltensgleiche Trennung der beiden Aktionspfade macht die sicherheits- und datenschutzrelevante Prüfpriorität explizit und überprüfbar.

## What Changes

- trennt DOI-Bestätigung und Abmeldung in schmale interne Handler
- trennt die unveränderte Signup-Orchestrierung in Rate-Limit-, Wertaufbau- und Persistenzschritte
- bewahrt Tokenformat, Kryptografie, Secretquelle, Zeitsemantik, Repository-Verträge, Redirects und sichtbare Texte
- charakterisiert alle Erfolgs-, Negativ-, Idempotenz-, Reihenfolge- und Fallback-Pfade gegen den Altcode
- ändert keine Endpoints, Datenbankabfragen oder öffentlichen Verträge

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/server/public-waste-email-reminders.server.ts` und zugehöriger Unit-Test
- Affected arc42 sections: `08-cross-cutting-concepts`
