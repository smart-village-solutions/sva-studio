# Change: GenericType für Featured Projects korrigieren

## Why

Die vorhandenen Featured-Project-Datensätze sind im Mainserver mit `genericType: "FeaturedProject"` gekennzeichnet. Das Studio verwendet derzeit abweichend `PROJECT` und kann diese Datensätze deshalb weder zuverlässig lesen noch korrekt fortschreiben.

## What Changes

- **BREAKING**: Projekte-Routen lesen und schreiben ausschließlich GenericItems mit `genericType: "FeaturedProject"`.
- Der bisherige Diskriminator `PROJECT` wird ohne Übergangs- oder Fallback-Verhalten entfernt.
- Inhaltsprojektion, Tests und Dokumentation werden auf den korrigierten Diskriminator abgestimmt.

## Impact

- Affected specs: `content-management`, `sva-mainserver-integration`
- Affected code: `packages/plugin-projects`, `packages/sva-mainserver`, `apps/sva-studio-react`
- Affected arc42 sections: `docs/architecture/05-building-block-view.md`
