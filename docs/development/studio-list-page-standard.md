# Studio-Standard für Listen- und Tabellen-Seiten

## Ziel

Verwaltungsseiten im Studio sollen dieselbe Grundstruktur nutzen:

- Breadcrumbs aus der bestehenden Shell
- Seitentitel
- Beschreibungs- oder Infotext
- optionale Primäraktion auf Titelhöhe rechts
- Tabellenfläche mit Toolbar
- Auswahlspalte links, Aktionsspalte rechts
- sortierbare Spaltenköpfe
- Tabs nur bei mehreren gleichrangigen Tabellenbereichen

## Bausteine

Neue wiederverwendbare Listen- und Seitenbausteine werden über `@sva/studio-ui-react` bereitgestellt, sobald sie Host- und Plugin-Custom-Views gemeinsam nutzen sollen. App-interne Komponenten bleiben nur Übergangsadapter oder Shell-nahe Implementierungsdetails.

Plugin-Listen dürfen fachliche Wrapper aufbauen, müssen dabei aber `@sva/studio-ui-react` komponieren. Lokale Basis-Tabellen, eigene Button-/Input-Systeme oder App-interne UI-Imports werden über `pnpm check:plugin-ui-boundary` und ESLint blockiert.

### `StudioListPageTemplate`

Verantwortlich für:

- Titel
- Beschreibung
- optionale Primäraktion
- optionale Tabs

Nicht verantwortlich für:

- Breadcrumbs
- Shell-Layout
- fachliche Datenbeschaffung

### `StudioDataTable`

Verantwortlich für:

- Sortierung
- optionale Mehrfachauswahl
- Bulk-Aktionsleiste
- Toolbar-Slots für Filter und Sekundäraktionen
- feste Aktionsspalte
- mobile Kartenansicht

## Einsatzregeln

- `Neu erstellen` nur anzeigen, wenn die Seite tatsächlich eine Erstellungsaktion anbietet.
- Tabs nur für gleichrangige Tabellenbereiche verwenden, nicht als Ersatz für Detail-Navigation.
- Die erste Spalte ist reserviert für Auswahl-Checkboxen, wenn Mehrfachauswahl aktiv ist.
- Die letzte Spalte ist reserviert für Zeilenaktionen.
- Fachliche Hooks, Mutationen und Dialoge bleiben in der Route; Layout- und Tabellenlogik liegt in den Shared-Komponenten.

## Bereits migrierte Seiten

- Benutzerverwaltung
- Rollenverwaltung
- Inhaltsliste

## Noch offene Migrationen

- Gruppenverwaltung
- Instanzverwaltung
- weitere Verwaltungslisten im Studio
