## Kontext

Die bestehende Layout-Shell trennt Header, Sidebar und Content bereits sauber und erfüllt eine grundlegende A11y- und Responsive-Basis. Visuell ist sie jedoch noch stark von direkt kodierten Tailwind-Farben abhängig. Parallel ist das Team-Setup auf Tailwind und shadcn ausgerichtet, wodurch eine semantische Token-Schicht der natürliche nächste Schritt ist.

Die Vorgaben aus dem Vorgängerprojekt sind nicht als 1:1-Blueprint geeignet. Sie liefern aber ein belastbares Zielbild für Farben, Shell-Hierarchie und reduzierte responsive Muster. Das wichtigste übernehmbare Element ist die Farbwelt.

## Ziele / Nicht-Ziele

- Ziele:
  - Die Shell auf semantische Farb- und Flächentokens umstellen
  - Die Farbpalette des Vorgängerprojekts mit minimalem Migrationsrisiko übernehmen
  - Light- und Dark-Mode auf derselben semantischen Token-Basis ermöglichen
  - Eine Theme-Architektur vorbereiten, die Themes anhand einer `instance_id` auswählen kann
  - Die Shell stärker an Tailwind- und shadcn-Konventionen ausrichten
  - Mobile Navigation und Header-Verhalten robust und wartbar machen
- Nicht-Ziele:
  - Keine vollständige Replik der alten Sidebar-Interaktionen
  - Kein komplexes Flyout-System für kollabierte Navigation
  - Keine umfassende Theme-Engine mit beliebiger Laufzeit-Customization in diesem Change
  - Keine route-weite Vollmigration jeder einzelnen Oberfläche in einem Schritt

## Entscheidungen

### 1. Farben zuerst, Interaktionen später

Die Farbtoken werden priorisiert vor komplexen UI-Verhaltensänderungen. Dadurch wird der sichtbarste Mehrwert früh erreicht, ohne die Shell-Architektur mit schwer testbaren Spezialinteraktionen zu überladen.

### 2. Semantische Tokens statt direkter Tailwind-Farbwerte

Die Shell nutzt künftig semantische Tokens wie `bg-background`, `text-foreground`, `bg-card`, `bg-sidebar`, `border-border`, `text-muted-foreground`, `bg-primary` und `text-primary-foreground`. Die zugrundeliegenden CSS-Variablen orientieren sich an der Farbpalette des Vorgängerprojekts.

### 3. Light- und Dark-Mode als Teil des Zielbilds

Die Farbdefinition wird nicht nur für einen einzelnen Modus angelegt. Stattdessen werden semantische Tokens für mindestens zwei Modi definiert:

- Light Mode
- Dark Mode

Die Shell-Komponenten dürfen keine festen Annahmen über einen einzigen Modus enthalten. Fokus-, Border-, Surface- und Textfarben müssen in beiden Modi über Tokens abgeleitet werden.

### 4. Theme-Auswahl über `instance_id`

Zusätzlich zur Modusumschaltung wird eine Theme-Struktur vorgesehen, in der ein Theme über eine `instance_id` bestimmt werden kann. Das bedeutet nicht, dass im ersten Schritt bereits viele produktive Themes existieren müssen. Entscheidend ist, dass die Architektur nicht auf genau eine globale Farbkonfiguration fest verdrahtet wird.

Ein zulässiges Zielbild ist:

- Basis-Theme für SVA Studio
- davon abgeleitete Theme-Varianten pro `instance_id`
- jeweils mit Light- und Dark-Mode-Ausprägung

### 5. Shadcn-kompatible Basisschicht

Die Token-Benennung und CSS-Variablen werden so angelegt, dass Standardmuster aus shadcn ohne Sondermapping eingesetzt werden können. Wo Shell-Interaktionen neu eingeführt werden, werden bevorzugt shadcn-nahe Primitives verwendet, insbesondere `Sheet` für mobile Navigation und `DropdownMenu` für kleine Aktionsmenüs.

### 6. Schrittweise Migration statt Big-Bang

Der Change priorisiert Shell-nahe Komponenten:

1. globale Styles und Tailwind-Mapping
2. Header, Sidebar und AppShell
3. Theme- und Modus-Auflösung für Shell-Tokens
4. Shell-nahe States wie Focus, Skeletons und Surface-Styles
5. sukzessive Nachmigration betroffener Routen

### 7. Responsive Ausbau mit niedrigem Risiko

Für Mobile wird die Sidebar als Drawer/`Sheet` modelliert. Auf Desktop bleibt die Shell in der bestehenden horizontalen Struktur. Ein kollabierter Desktop-Modus kann später ergänzt werden, ist aber nicht Voraussetzung für die Farb- und Token-Migration.

## Risiken / Trade-offs

- Direkte Farbersetzungen können in bestehenden Routen Kontrast- oder Hervorhebungsprobleme sichtbar machen.
  - Mitigation: zuerst Shell-Flächen migrieren, danach gezielt Route-Komponenten nachziehen und visuell prüfen.
- Eine halbe Migration würde gemischte Semantik- und Direktfarben erzeugen.
  - Mitigation: klare Priorisierung auf Shell-Komponenten und dokumentierte Nachmigration offener Bereiche.
- Eine zu frühe Theme-Vervielfachung über `instance_id` könnte die Migration unnötig verkomplizieren.
  - Mitigation: zuerst belastbare Theme-Slots und Auflösungslogik definieren, dann nur wenige konkrete Varianten aktivieren.
- Zusätzliche UI-Primitives können unnötige Komplexität erzeugen.
  - Mitigation: nur wenige, gut begründete shadcn-Bausteine im Initial-Scope.

## Migrationsplan

1. CSS-Variablen für die SVA-Studio-Farbwelt definieren
2. Light-/Dark-Mode-Tokens und Theme-Slots pro `instance_id` definieren
3. Tailwind- und ggf. Utility-Mapping für semantische Shell-Farben ergänzen
4. Header, Sidebar und AppShell auf semantische Klassen umstellen
5. Mobile-Navigation als `Sheet` integrieren
6. Tests, A11y-Prüfungen und Doku aktualisieren

## Offene Fragen

- Ob shadcn-Komponenten direkt generatorbasiert eingeführt oder zunächst als lokale kompatible Wrapper modelliert werden
- Wie und wo `instance_id` im Frontend sicher und stabil zur Theme-Auflösung bereitgestellt wird
