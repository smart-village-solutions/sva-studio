# Change: Cockpit-Link als Plugin bereitstellen

## Why

Der externe Cockpit-Link ist derzeit fest in der Studio-Sidebar verdrahtet. Sein einziger Funktionsumfang ist Navigation und soll daher vom eigenen Plugin-Katalogeintrag abhängen.

## What Changes

- Ein kleines Cockpit-Plugin deklariert den bestehenden externen Link als Navigationsbeitrag.
- Der Plugin-Navigationsvertrag unterstützt externe HTTPS-Ziele; die Sidebar rendert sie als sicheren externen Link.
- Das optionale Cockpit-Modul ist standardmäßig keiner Instanz zugewiesen; erst eine gezielte Modulzuweisung, später für Guben, schaltet den Link zusätzlich zu den bestehenden Rechte-, Experimental- und Branding-Bedingungen frei.

## Impact

- Affected specs: `plugin-platform`
- Affected code: Plugin-SDK, Studio-Plugin-Katalog und Sidebar, neues `packages/plugin-cockpit`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`
