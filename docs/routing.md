# Routing und Plugin-Routen

Ausfuehrliche Architektur-Dokumentation: [docs/architecture/routing-architecture.md](./architecture/routing-architecture.md)

## Ist-Stand

SVA Studio nutzt eine code-basierte Route-Registry: Core- und Plugin-Routen werden programmatisch kombiniert.
Der Router wird in `apps/sva-studio-react/src/router.tsx` aus `rootRoute` und gemergten Route-Factories gebaut.

## Core-Routen

Core-Routen werden in der App definiert und in der Registry registriert.

## Plugin-Routen

Plugins exportieren Route-Factories, die im Router registriert werden.
Beispiel: `@sva/plugin-example` liefert eine Route unter `/plugins/example`.
