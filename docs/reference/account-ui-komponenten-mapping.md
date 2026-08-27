# Komponenten-Mapping für Account-UI

## Ziel

Die Account-UI verwendet für interaktive Basisbausteine ausschließlich `shadcn/ui`-Patterns.
Es wird **keine parallele UI-Bibliothek** für dieselben Aufgaben eingeführt.

## Mapping

| Anforderung | Ziel-Komponente/Pattern | Hinweis |
|---|---|---|
| Dialoge (Bestätigen, Warnen, Formulare) | `Dialog` / `AlertDialog` | Fokus-Falle, Escape, `aria-modal` |
| Tabs (Benutzer-Detailansicht) | `Tabs` | WAI-ARIA Tabs Pattern (`tablist`, `tab`, `tabpanel`) |
| Dropdowns / Aktionsmenüs | `DropdownMenu` | Tastaturbedienung, Fokussteuerung |
| Tabellen (Benutzer, Rollen) | `Table` + semantisches Markup | `th scope`, `aria-sort`, Caption/Label |
| Formularfelder | `Input`, `Textarea`, `Select`, `Checkbox` | `aria-invalid`, `aria-describedby`, Error-Summary |
| Statusdarstellung | `Badge` | Nicht nur Farbe, immer Textlabel |
| Ladezustände | Skeleton/Status-Pattern | `aria-busy`, `role="status"` |

## Verbindliche Leitplanken

- Keine zusätzliche interne UI-Bibliothek (z. B. `@sva/ui`, `@sva/design-system`) im Scope dieses Changes.
- Keine parallelen externen Komplett-UI-Frameworks für dieselben Bausteine.
- Bestehende App-Struktur bleibt erhalten; Bausteine werden im bestehenden App-Kontext integriert.

## Technische Absicherung

Der Build prüft auf verbotene parallele UI-Bibliotheken:

- `scripts/ci/check-account-ui-foundation.ts`
- `apps/sva-studio-react/package.json` → `check:account-ui-foundation` / `build`
