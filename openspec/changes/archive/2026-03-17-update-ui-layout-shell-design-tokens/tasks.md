# Implementation Tasks

## 0. Governance

- [x] 0.1 Proposal, Design und Spec-Delta mit dem Team abstimmen
- [x] 0.2 Betroffene arc42-Abschnitte aktualisieren oder eine begründete Abweichung dokumentieren
- [x] 0.3 Relevante UI-/Entwicklungsdokumentation zur Shell- und Token-Strategie aktualisieren

## 1. Design-Token-Grundlage

- [x] 1.1 Farbpalette aus dem Vorgängerprojekt als CSS-Variablen für die App definieren
- [x] 1.2 Light- und Dark-Mode-Werte für die semantischen Shell-Tokens definieren
- [x] 1.3 Theme-Slots so strukturieren, dass Varianten künftig anhand einer `instance_id` aufgelöst werden können
- [x] 1.4 Semantische Tailwind-/shadcn-Tokens für Shell-relevante Farben und Flächen mappen
- [x] 1.5 Focus-, Border-, Radius- und Surface-Werte der Shell an die Token-Basis anbinden

## 2. Shell-Migration

- [x] 2.1 `Header`, `Sidebar` und `AppShell` von direkten Tailwind-Farben auf semantische Klassen umstellen
- [x] 2.2 Skip-Link, Skeletons und aktive Shell-Zustände visuell und semantisch an die neue Token-Basis anpassen
- [x] 2.3 Theme- und Modus-Auflösung für die Shell an die Laufzeit-Konfiguration anbinden
- [x] 2.4 Mobile Sidebar als Drawer/`Sheet` und reduzierten Mobile-Header umsetzen

## 3. Shadcn-/Primitive-Angleichung

- [x] 3.1 Entscheiden, welche wenigen Primitives im Shell-Scope eingeführt werden (`Sheet`, optional `DropdownMenu`, optional `Avatar`)
- [x] 3.2 Shell-Interaktionen auf diese Primitives ausrichten, ohne komplexe Alt-Interaktionen zu übernehmen
- [x] 3.3 Fortgeschrittene Muster wie Flyout-Submenüs, Desktop-Collapse-Logik und Spezial-Header-Menüs explizit aus dem Initial-Scope heraushalten oder als Follow-up dokumentieren

## 4. Verifikation

- [x] 4.1 Unit- und ggf. Komponententests für Header, Sidebar und AppShell auf die neue Struktur aktualisieren oder ergänzen
- [x] 4.2 Tests oder Assertions für Theme-/Modus-Auflösung anhand von `instance_id` ergänzen
- [x] 4.3 Relevante Nx-Tests für Unit, Types und Lint erfolgreich ausführen
- [x] 4.4 Manuelle Prüfung für Mobile-, Tablet- und Desktop-Shell sowie Kontrast- und Fokusverhalten dokumentieren
