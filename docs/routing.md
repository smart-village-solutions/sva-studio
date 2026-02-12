# Routing und Plugin-Routen

Ausfuehrliche Architektur-Dokumentation: `docs/architecture/routing-architecture.md`

## Code-Route-Registry
Das SVA Studio nutzt eine Code-basierte Route-Registry. Core- und Plugin-Routen werden programmatisch kombiniert.

## Core-Routen
Core-Routen werden in der App definiert und in der Registry registriert.

## Plugin-Routen
Plugins exportieren Route-Factories, die im Router registriert werden. Beispiel: `@sva/plugin-example` liefert eine Route unter `/plugins/example`.
