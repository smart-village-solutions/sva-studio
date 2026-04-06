## Context
Studio-Seiten benötigen ein wartbares Standardmuster für Listenansichten, ohne die bestehende `AppShell` zu ersetzen. Die Lösung muss mit shadcn/Tailwind, TanStack Router und bestehenden fachlichen Hooks kompatibel bleiben.

## Decisions
- Breadcrumbs bleiben Teil der bestehenden Shell; das neue Template beginnt unterhalb der Breadcrumbs.
- Das Seiten-Template kapselt Titel, Beschreibung, optionale Primäraktion und optionale Tabs.
- Die Datentabelle kapselt Auswahlspalte links, Aktionen-Spalte rechts, sortierbare Header, Toolbar-Slots und mobile Kartenansicht.
- Für Sortierung und Tabellenzustand wird `@tanstack/react-table` verwendet.
- Tabs werden als Radix/shadcn-Primitive eingeführt und nur für gleichrangige Tabellenbereiche vorgesehen.

## Consequences
- Neue Verwaltungsseiten können auf einer stabilen UI-Baseline aufbauen.
- Bestehende Seiten können schrittweise migriert werden, ohne ihre fachlichen Daten-Hooks neu zu schreiben.
- Desktop- und Mobile-Darstellung werden aus einer gemeinsamen Datenbeschreibung erzeugt statt aus separaten Seitenimplementierungen.
