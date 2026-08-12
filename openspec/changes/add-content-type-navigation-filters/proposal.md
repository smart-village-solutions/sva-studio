# Change: Inhaltsnavigation nach Datentyp gliedern

## Why

Die gemeinsame Inhaltsübersicht bündelt alle lesbaren Inhaltstypen, bietet aber in der Sidebar keinen direkten Einstieg in einen bestimmten Typ. Häufig genutzte Typen wie Nachrichten und Veranstaltungen sollen außerdem ohne Umweg über das Typ-Dropdown filterbar sein.

## What Changes

- Der bisherige Sidebar-Link `Inhalte` wird zu einer aufklappbaren, responsiven Navigationsgruppe.
- Die Gruppe enthält `Alle` sowie die für den aktuellen Benutzer lesbaren registrierten Inhaltstypen.
- Alle Unterpunkte verwenden weiterhin die kanonische Route `/admin/content`; typspezifische Einstiege setzen den bestehenden Search-Parameter `type`.
- Die gemeinsame Tabelle erhält Schnellfilter für `Alle`, Nachrichten und Veranstaltungen.
- Das Typ-Dropdown enthält die übrigen lesbaren Inhaltstypen, ohne Nachrichten und Veranstaltungen doppelt anzubieten.
- Filterwechsel setzen die Pagination auf Seite 1 zurück und erhalten Statusfilter, Sortierung und Seitengröße.
- Aktive Navigationszustände berücksichtigen den normalisierten Typfilter sowie die typbezogenen Erstellungs- und Detailrouten.
- Deutsche UI-Texte folgen der bestehenden Terminologie `Nachrichten`, `Veranstaltungen` und `Generische Inhalte`; englische Texte verwenden `News`, `Events` und `Generic Items`.

## Impact

- Affected specs: `content-management`, `ui-layout-shell`
- Affected code: Sidebar und Sidebar-Tests, gemeinsame Content-Liste und deren Tests, Content-Type-/Navigations-Helfer, deutsche und englische i18n-Ressourcen
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
- Keine Änderung an API, Datenbank, Projektionslogik oder serverseitiger Pagination
