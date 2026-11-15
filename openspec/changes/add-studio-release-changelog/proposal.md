# Change: Studio-Releases im Changelog anzeigen

## Why

Issue #1284 erhält nach Nutzerfreigabe eine eigene Changelog-Seite statt der bewusst entfernten technischen Startseitenbox. Der Produktentscheid und der begrenzte technische Entwurf wurden im Gespräch freigegeben.

## What Changes

- Authentifizierte Seite `/changelog` mit Link unten in der Sidebar für alle angemeldeten Nutzer.
- App-lokaler, begrenzter Abruf regulärer `studio-vX.Y.Z`-Releases des festen Studio-Repositories, mit kurzem Cache und sicherem Markdown.
- Lade-, Leer- und Fehlerzustand sowie de/en-Bedienelemente.

## Impact

- Affected specs: ui-layout-shell
- Affected code: Studio-Sidebar, App-Seite/API und zentrale Routing-Registrierung
- Affected arc42 sections: 05 und 08 (Informationsabruf und Sicherheitsgrenzen)
- Nicht-Ziele: Release-Erzeugung, Deploymentabgleich, neue Permissions/Module, Einstellungen, DB oder Packages.

## Grenzen und Nachweise

UI und GET-API verlangen Anmeldung ohne zusätzliche Rollen. Nur die feste GitHub-API darf abgerufen werden; keine nutzerbestimmten Zieladressen oder Redirects. Timeout, Antwortgrößenlimit, kurzer Cache und parallele Abrufzusammenfassung begrenzen externe Last. Markdown aktiviert kein HTML und lädt keine externen Bilder. Gezielte Server-/Routing-/UI-Tests und i18n-/Type-Prüfung sichern diese Grenzen.
