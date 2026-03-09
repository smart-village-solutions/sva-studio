# Change: Design-Token- und Shell-Angleichung für das UI-Layout

## Why

Die aktuelle Shell in `apps/sva-studio-react` ist funktional und erweiterbar, verwendet visuell aber noch überwiegend direkte Tailwind-Farbklassen wie `slate-*`, `emerald-*` und `red-*`. Dadurch ist die App weder konsistent an die gewünschte SVA-Studio-Farbwelt angebunden noch gut auf eine spätere shadcn-/Design-System-Angleichung vorbereitet.

Aus dem Vorgängerprojekt liegen konkrete Layout- und Farb-Vorgaben vor. Ein Teil davon ist mit geringem Risiko übertragbar, insbesondere die semantische Shell-Struktur, responsive Grundmuster und die Farbtoken. Komplexe Interaktionsmuster wie Flyout-Navigationen oder stark verschachtelte Header-Menüs würden den aktuellen Scope hingegen unnötig aufblähen.

## What Changes

- Die bestehende `ui-layout-shell` wird auf eine design-token-basierte Farb- und Semantikschicht umgestellt
- Die Farbpalette aus dem Vorgängerprojekt wird als priorisierte Basis für `background`, `foreground`, `card`, `popover`, `sidebar`, `primary`, `muted`, `border`, `ring` und `destructive` übernommen und auf Tailwind-/shadcn-kompatible Tokens gemappt
- Die Token-Basis wird so aufgebaut, dass sowohl Light- als auch Dark-Mode unterstützt werden
- Die Token-Basis wird so strukturiert, dass künftig mehrere Themes abhängig von einer `instance_id` geladen oder aktiviert werden können
- Header, Sidebar und Shell-nahe Flächen werden schrittweise von direkten Tailwind-Farben auf semantische Klassen umgestellt
- Die Shell erhält eine belastbare responsive Basis mit Mobile-Drawer/`Sheet` für Navigation und einem reduzierten Mobile-Header
- Niedrigrisiko-Komfortmuster mit shadcn-Primitives werden vorbereitet oder eingeführt, insbesondere `Sheet`, `DropdownMenu` und `Avatar` dort, wo sie klaren Nutzen haben
- Komplexe Muster aus dem Vorgängerprojekt bleiben zunächst explizit außerhalb des Scopes, insbesondere kollabierte Flyout-Submenüs, pixelgenaue Active-Indikatoren und umfangreiche Header-Sonderlogik
- Relevante Architektur- und UI-Dokumentation wird auf die neue Token- und Shell-Strategie aktualisiert

## Impact

- **Affected specs:** `ui-layout-shell`
- **Affected code:**
  - `apps/sva-studio-react/src/styles.css`
  - `apps/sva-studio-react/tailwind.config.cjs`
  - `apps/sva-studio-react/src/components/AppShell.tsx`
  - `apps/sva-studio-react/src/components/Header.tsx`
  - `apps/sva-studio-react/src/components/Sidebar.tsx`
  - `apps/sva-studio-react/src/routes/__root.tsx`
  - Theme-/Instance-nahe Provider oder Konfigurationsstellen in `apps/sva-studio-react/src/`
  - Shell-nahe UI-Komponenten und betroffene Routen in `apps/sva-studio-react/src/routes/`
  - ggf. neue shadcn-nahe Primitives oder Wrapper unter `apps/sva-studio-react/src/components/`
- **Affected arc42 sections:**
  - `04-solution-strategy`
  - `05-building-block-view`
  - `08-cross-cutting-concepts`
  - `10-quality-requirements`
  - `11-risks-and-technical-debt`
