# UI-Shell Theming

## Ziel

Die Layout-Shell von `apps/sva-studio-react` verwendet semantische Design-Tokens als gemeinsame Grundlage für:

- Light- und Dark-Mode
- instanzabhängige Theme-Varianten über `instanceId`
- Tailwind-/shadcn-kompatible UI-Bausteine

## Leitlinien

- Shell-nahe Komponenten verwenden bevorzugt semantische Klassen wie `bg-background`, `text-foreground`, `bg-card`, `bg-sidebar`, `border-border` und `text-muted-foreground`.
- Direkte Farbcodes oder projektspezifische Tailwind-Farben wie `slate-*` oder `emerald-*` sollen in neuen Shell-Komponenten nicht mehr verwendet werden.
- Theme-Auswahl erfolgt zentral über `ThemeProvider` und `src/lib/theme.ts`.
- `instanceId` bestimmt optional die Theme-Variante; unbekannte Werte fallen auf `sva-default` zurück.
- Light-/Dark-Mode bleibt ein separater Modus und darf nicht über Theme-Namen kodiert werden.

## Relevante Dateien

- `apps/sva-studio-react/src/styles.css`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/ui/sheet.tsx`

## Erweiterungsregeln

- Neue Theme-Varianten nur zentral in `src/lib/theme.ts` und den zugehörigen CSS-Token-Overrides ergänzen.
- Neue Shell-Interaktionen bevorzugt über standardisierte Primitives modellieren, aktuell insbesondere Drawer-/`Sheet`-Muster.
- Größere Route-Flächen sollen bei Anpassungen opportunistisch auf semantische Tokens migriert werden, ohne die Shell erneut zu fragmentieren.
