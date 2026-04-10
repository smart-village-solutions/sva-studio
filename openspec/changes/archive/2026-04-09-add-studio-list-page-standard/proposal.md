# Change: Studio-Standard für Listen- und Tabellen-Seiten

## Why
Studio-Verwaltungsseiten bauen Seitenkopf, Toolbar, Tabellen-Layout, Auswahlspalten, Bulk-Aktionen und Sortierung derzeit mehrfach und uneinheitlich nach. Das erhöht UI-Drift, Testaufwand und die Kosten weiterer Verwaltungsansichten.

## What Changes
- Einführung eines kanonischen Listen-Seiten-Templates für Studio-Verwaltungsseiten
- Einführung einer wiederverwendbaren Datentabellen-Primitive mit Sortierung, Auswahlspalte, Bulk-Aktionen und mobiler Kartenansicht
- Einführung von Tabs-Primitives für Seiten mit mehreren gleichrangigen Tabellenbereichen
- Migration der ersten Verwaltungsseiten auf das neue Muster
- Ergänzung von Entwicklerdoku für den Seitenstandard

## Impact
- Affected specs: `ui-layout-shell`
- Affected code: `apps/sva-studio-react/src/components`, `apps/sva-studio-react/src/routes/admin/*`, `apps/sva-studio-react/src/routes/content/*`, `apps/sva-studio-react/src/i18n/resources.ts`
- Affected arc42 sections: 05-building-block-view, 08-cross-cutting-concepts, 09-architecture-decisions
