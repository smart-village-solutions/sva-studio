# Change: Touren nach Gültigkeitsjahr filtern

## Why

Die Tourenübersicht bietet bislang nur einzelne Datumsgrenzen für den ersten und letzten Termin. Für die regelmäßige Jahresplanung fehlt eine schnelle fachliche Auswahl, die sowohl überlappende Gültigkeitszeiträume als auch explizite Termine im betreffenden Kalenderjahr berücksichtigt.

## What Changes

- Der Filterdialog der Tourenübersicht erhält die Auswahl `Alle Touren`, `Letztes Jahr`, `Aktuelles Jahr` und `Nächstes Jahr`.
- `Alle Touren` bleibt der initiale und kanonische Defaultzustand.
- Wiederkehrende Touren werden bei mindestens eintägiger Überschneidung ihres offenen oder geschlossenen Gültigkeitszeitraums mit dem ausgewählten Kalenderjahr angezeigt.
- Touren mit expliziten Terminen werden angezeigt, wenn mindestens ein Termin im ausgewählten Kalenderjahr liegt.
- Der Jahresfilter wird als typisierter Search-Parameter reload-stabil und mit den bestehenden Filtern kombinierbar umgesetzt.
- Die Jahresauswertung bleibt lokale View-Model-Logik; API und Datenbankverträge ändern sich nicht.

## Impact

- Affected specs: `waste-management`
- Affected code: Search-Parameter, Filterzustand, Touren-View-Model und Filterdialog in `packages/plugin-waste-management`
- Affected arc42 sections: keine; die bestehende Plugin-, Routing- und Datenzugriffsarchitektur bleibt unverändert
