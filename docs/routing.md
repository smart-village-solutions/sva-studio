# Routing und Plugin-Routen

## Scopegebundene Access-Entscheidungen

Geschützte Host- und Plugin-Routen verwenden den zentral aufgelösten Effective-Access-Zustand. Tenant-Routen verlangen vollständig qualifizierte Actions und, sofern vorhanden, die zugehörige Modulzuweisung. Plattform-Routen verwenden technische Plattformrollen. Ein nicht aufgelöster, ladender, fehlerhafter oder degradierter Zustand wird fail-closed auf den vorhandenen Fehlerpfad umgeleitet; die Verfügbarkeit von Dev-Auth ist kein Bypass.

`/auth/me` liefert Identität und Session-Kontext. Seine flache Permission-Projektion ist keine führende Route-Entscheidung. Scope- und Organisationswechsel erhöhen die Access-Generation; verspätete Antworten einer vorherigen Generation dürfen keinen Route- oder Sidebar-Link wieder freigeben.

Mutationscontrols und ihre unabhängige Serverautorisierung sind unter [Servergrenze für scopegebundenen UI-Zugriff](./guides/ui-access-server-enforcement.md) inventarisiert.

Ausfuehrliche Architektur-Dokumentation: [docs/architecture/routing-architecture.md](./architecture/routing-architecture.md)

## Ist-Stand

SVA Studio nutzt eine code-basierte Route-Registry: Core- und Plugin-Routen werden programmatisch kombiniert.
Der Router wird in `apps/sva-studio-react/src/router.tsx` aus `rootRoute` und gemergten Route-Factories gebaut.

## Core-Routen

Core-Routen werden in der App definiert und in der Registry registriert.

## Plugin-Routen

Plugins exportieren Route-Factories, die im Router registriert werden.
Aktuell registriert der Host produktive Plugin-Routen aus `@sva/plugin-news`, zum Beispiel unter `/plugins/news`.
