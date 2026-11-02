# Design: Iterative Studio-UI-Migration

## 1. Referenzstand und Nutzung

Planungsbasis ist Commit `cb7d1d0f3bc065d28e1662a0940a5a2e6f737ef6`
(1. November 2026). Die aufgeführten Quellpfade sind relativ zum Repository-Root.
Figma wurde am 1. November 2026 geprüft; die Datei bezeichnet sich als
**1.0 RC1**. Das Design ist vom Nutzer zur Umsetzung freigegeben; die
Bibliotheksveröffentlichung und Produktabnahme stehen aus. Ein unveränderlicher
Figma-Versionssnapshot liegt diesem Plan nicht bei.

Vor jedem Implementierungsslice den betreffenden Code und Figma-Knoten erneut
lesen. Bei abweichenden Verträgen oder geändertem Design die betroffene
Zuordnung aktualisieren, bevor Produktcode geändert wird. Vor nichttrivialen
Codeänderungen außerdem die XERJ-Referenzsuche gemäß `AGENTS.md` ausführen,
sofern der Dienst verfügbar ist, und Indexstand sowie Lizenz prüfen.

| Referenz                                                                                                                  | Figma-Knoten | Verwendung                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| [Prinzipien und Farben](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=95-1327)      | `95:1327`    | semantische Rollen und Light/Dark                                  |
| [Typografie, Maße und Icons](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=95-1331) | `95:1331`    | Fira Sans, Abstände, Radien, Lucide                                |
| [Responsive Regeln](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=158-12608)        | `158:12608`  | Viewport, Inhaltsbreite, lokale Scrollbereiche                     |
| [Komponentenbibliothek](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=42-1512)      | `42:1512`    | bestehende Komponentenfamilien und Varianten                       |
| [Muster](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=95-1325)                     | `95:1325`    | Seiten, Tabellen, Editor, Medien, Zustände                         |
| [Anwendungsbeispiele](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=54-1683)        | `54:1683`    | repräsentative Fachansichten, keine vollständige Feldspezifikation |
| [Freigabestatus](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=23-30822)            | `23:30822`   | Design freigegeben; Veröffentlichung und Produktabnahme ausstehend |

Figma ist die Gestaltungsquelle. Fachfunktionen, Payloads und Rechte folgen
weiterhin den bestehenden Code-/Spec-Verträgen. Eine fehlende Darstellung im
Design berechtigt nicht zur Entfernung oder Deaktivierung einer Funktion.

## 2. Inventur und Komponenten-Zuordnung

Die Inventur erfasst die am Referenzcommit vorhandenen Plugin-Packages sowie
die relevanten Hostflächen. **B** bedeutet direkt gelesener Bestand für
Foundations/Shell/News, **V** bedeutet vorsortierter Einstieg anhand von
Quellpfaden und Imports, noch kein vollständiger Funktionsaudit, **N** bedeutet
keine eigene registrierte Fachoberfläche. Foundations, Shell und News sind im
ersten Lieferabschnitt lokal umgesetzt; Abschnitt 7 trennt ausgeführte
Nachweise von ausstehenden Produktabnahmen. Der aktuelle Stand der übrigen Plugin-Migrationen steht in Abschnitt 9;
Host-/Adminmigration und Produktabnahme bleiben offen. Testnamen ohne Ordner stehen im benannten Package; die Tabelle
beschreibt den Ausgangsbestand, Abschnitte 7 und 9 den tatsächlich geprüften Stand.

| Bereich / Evidenz                        | Zuständiger Code                                                                              | Gemeinsamer Bestand / lokale Restaufgabe                                                                      | Figma-Zuordnung                                                                      | Tests / Risiko                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Foundations **B**                        | `apps/sva-studio-react/src/styles.css`, `src/components/ui/`; `packages/studio-ui-react/src/` | Tokens, Button, Input, Select, Dialog, Tabs bestehen; app-lokale Input-/Select-/Dialogvarianten mitbetrachten | Grundlagen; Button `23:32366`, Field `23:32495`, Select `23:32588`, Alert `23:32839` | `styles-foundation.test.ts`, `button.test.tsx`, `studio-primitives.test.tsx`; mittel, großer Verbraucherkreis |
| Shell **B**                              | App `src/components/{AppShell,Header,Sidebar,AppBreadcrumbs}.tsx`, `sidebar-*`                | Shared Button/Sheet; Sidebar nutzt Tabler und bisherigen Breakpoint-/Collapse-Zustand                         | Muster `99:3846`, Navigation `90:2904`, Header `99:2621`                             | `Header.test.tsx`, `Sidebar.test.tsx`, `AppShell.test.tsx`; hoch, Kontext/Rechte                              |
| Contentübersicht **B**                   | App `src/routes/admin/content/`                                                               | Gemeinsame Tabelleninteraktionen; News-Liste wird über Hostoberfläche konsumiert                              | Tabellenmuster `95:1341`                                                             | `e2e/news-plugin.spec.ts` sowie Content-Routentests; hoch, URL-/Filtervertrag                                 |
| News **B**                               | `packages/plugin-news/src/news.detail-page*.tsx`, `news.detail-*-tab.tsx`                     | Shared Formular-/Media-/Save-/History-Primitives; lokale Tabs und Card-Reexport bestehen                      | Editor `115:5073`, Medien `115:4451`, Zielgebiete `143:12318`                        | `tests/news.detail-page.test.tsx`, `news.detail-content-tab.test.tsx`, `news.api.test.ts`; hoch               |
| Events **V**                             | `packages/plugin-events/src/events.detail-page*.tsx`, `events.detail-editor-tabs.tsx`         | Shared Medien, Formulare, Tabellen; lokales Tab-/Vorladungsmuster als zweiter realer Vergleich für News       | Editor; Zeitregeln `143:10392`, Standort `117:5032`                                  | `tests/events.detail-page.test.tsx`, `events.location-map.test.tsx`; hoch                                     |
| POI **V**                                | `packages/plugin-poi/src/poi.detail-page*.tsx`, `poi.pages.tsx`                               | Shared Media/Map/Controls; lokale Tab-, Standort- und Betreiberkomposition prüfen                             | Standort `117:5032`, Zeitregeln `143:10392`                                          | `tests/poi.detail-operator-tab.test.tsx`, `poi.location-map.test.tsx`; hoch                                   |
| Projects **V**                           | `packages/plugin-projects/src/projects.{pages,editor-view,editor-form,list-page}.tsx`         | Shared DetailTabs/Card/Media; fachliche Projektfelder erhalten                                                | Editor-/Listen-/Medienmuster                                                         | `tests/projects.pages.test.tsx`; mittel                                                                       |
| Generic Items **V**                      | `packages/plugin-generic-items/src/generic-items.detail-page*.tsx`, `generic-items.pages.tsx` | Shared DetailTabs/Card/Media/Map; technische Restpfade am aktuellen Stand prüfen                              | Editor-, Standort-, Zeitregelmuster                                                  | `tests/generic-items.pages.test.tsx`, `generic-items.detail-content-tab.test.tsx`; hoch                       |
| FAQ **V**                                | `packages/plugin-faq/src/faq*.tsx`                                                            | DetailTabs/Card/History/Pagination bereits gemeinsam; fachlich reduzierte Oberfläche erhalten                 | Editor-, Listen-, Verlaufsmuster                                                     | `tests/faq.pages.test.tsx`, `faq-list-page.test.tsx`; mittel                                                  |
| Kacheln **V**                            | `packages/plugin-cockpit-cards/src/cockpit-cards*.tsx`                                        | Shared Tabs/Card/Media/History; nur tatsächlich übrige Abweichungen bearbeiten                                | Cards, Medien, Listen                                                                | `tests/cockpit-cards.pages.test.tsx`; mittel                                                                  |
| Surveys **V**                            | `packages/plugin-surveys/src/surveys.editor*.tsx`, `surveys.question-*.tsx`                   | Shared Tabs/Fields/History; verschachtelte Fragen, Optionen, Moderation und Ergebnisse bleiben fachlich       | Repeater `113:1200`, Ergebnisse `117:5672`                                           | `tests/surveys.question-list-editor.test.tsx`, `surveys.detail-content-tab.test.tsx`; hoch                    |
| Vouchers **V**                           | `packages/plugin-vouchers/src/vouchers.{editor,list,form,usage-view}.tsx`                     | Shared Tabellen/Detail/Card/Media; Bedingungen und Nutzungsansicht prüfen                                     | Editor-, Medien-, Tabellenmuster; fachspezifische Abdeckung offen                    | `tests/vouchers.editor.test.tsx`, `vouchers.list.test.tsx`; hoch                                              |
| Waste **V**                              | `packages/plugin-waste-management/src/waste-management.*`                                     | Shared DataTable, Formulare, Dialoge; komplexe Tabellen, Kalender und Importoberflächen in eigenen Slices     | Touren `67:1933`, responsive `155:11936`, Jahresplanung `143:10392`                  | bestehende `tests/waste-management.*`; hoch, Daten-/Auswahlumfang                                             |
| Kategorien **V**                         | `packages/plugin-categories/src/categories.{pages,editor,editor-fields}.tsx`                  | Shared DataTable, Forms, Dialoge; Hierarchie und Inhaltskompatibilität erhalten                               | Listen, Repeater, Auswahl                                                            | `tests/categories.pages.test.tsx`; hoch                                                                       |
| App-Übersetzungen **V**                  | `packages/plugin-app-translations/src/catalog.*.tsx`                                          | Shared Overview/Pagination; lokale Katalog-, Entwurfs- und Versionskomposition prüfen                         | Übersetzungen `117:5836`, Versionen `143:12736`                                      | `src/catalog.page.test.tsx`, `catalog.editor.test.tsx`; hoch                                                  |
| SSF **V**                                | `packages/plugin-ssf/src/admin.*page.tsx`                                                     | Shared Forms/Overview/Section; Tenant-/System-/Rechtstextflächen abgleichen                                   | Formulare, Rechte `117:6071`, Kontext                                                | `tests/admin.page.test.tsx`, `admin.content-v2-page.test.tsx`; hoch                                           |
| Cockpit **N**                            | `packages/plugin-cockpit/src/plugin.tsx`                                                      | Externer Navigationslink; keine eigene Route                                                                  | NavigationItem                                                                       | vorhandene Registrierungsnachweise; Linkverhalten erhalten                                                    |
| Assistant / Search / Notifications **N** | jeweiliges `packages/plugin-*/src/plugin.ts`                                                  | Leere `routes` und `navigation`; keine Fachoberfläche hinzufügen                                              | keine Migration eigener Ansichten                                                    | Registrierung prüfen, sobald sich der Stand ändert                                                            |
| Plugin-SDK / Beispiel **N**              | `packages/plugin-sdk`; `packages/plugin-example`                                              | Authoring-Infrastruktur beziehungsweise Beispielbestand; keine produktive Fachseite erfasst                   | keine eigene UI-Migration                                                            | keine SDK-Erweiterung im Pilot                                                                                |
| Admin / Konto / Schnittstellen **V**     | App `src/routes/admin/`, `src/routes/account/`, `src/routes/interfaces/`                      | vorhandene UI-Controls, Seitenvorlagen und Form-Bridge; routeweise prüfen                                     | Verwalten `23:30872`, Konto `23:31148`, Instanz `58:1761`, Rechte `117:6071`         | bestehende Routentests, `e2e/account-admin-ui*.spec.ts`, `admin-roles-ui.spec.ts`; hoch                       |
| Medienverwaltung **V**                   | App `src/routes/admin/media/`, Shared Medienbausteine                                         | Bibliothek, Upload, Metadaten, Bildeditor und Verwendung getrennt erhalten                                    | Medien `115:4451`, WorkspaceDialog `113:1329`                                        | Routentests, `e2e/media-management.spec.ts`; hoch                                                             |
| Übrige Hostflächen **V**                 | App-Routen einschließlich Einstieg/Dashboard, Fehler- und technischer Statusansichten         | Abdeckung vor Abschluss mit aktueller Routenregistrierung abgleichen; kein neuer Funktionsumfang              | QuickAction, StateBlock, Ergebnismuster                                              | vorhandene Routentests, `ErrorFallback.test.tsx`; mittel                                                      |

`apps/public-waste-calendar-web`, `apps/project-report` und externe
Cockpit-Seiten sind außerhalb dieses Changes. Nicht aus der bloßen Existenz
einer TSX-Datei auf eine aktiv registrierte Produktoberfläche schließen.

### Foundations: konkrete Abweichungen und Token-Brücke

| Figma-Rolle / Familie                                               | Bestehender Codeanker                                                      | Umsetzung                                                                                                                                                                                                                    |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface/canvas`, `surface/base`, `surface/inset`, `surface/nested` | `--background`, `--card`, `--popover`, `--muted`, bisher `--waste-panel-*` | Semantik zuerst zuordnen; unterschiedliche Rollen nicht nur wegen ähnlicher Farben zusammenlegen. Generische neue Tokens nur bei tatsächlich unterschiedlichem Bedarf, dann alle direkten betroffenen Verbraucher umstellen. |
| `text/primary`, `text/secondary`, `text/disabled`                   | `--foreground`, `--muted-foreground`, Action-Disabled                      | Light/Dark getrennt abgleichen; Text nicht durch Opacity unlesbar machen.                                                                                                                                                    |
| `action/*`, `focus/ring`, `selection/*`                             | bestehende `--action-*`, `--ring`, Sidebar-Rollen                          | Bestehende Zustands-Token erweitern; Primär-/Sekundär-/Destruktivhierarchie und Fokus sichern.                                                                                                                               |
| Statusfläche/-text/-kontur                                          | `Alert`, `Badge`, Status-/Fehlerbausteine                                  | Figma-Statusrollen im vorhandenen Pfad ergänzen; Meldungsdringlichkeit nicht pauschal über `role=alert` abbilden. Bestehende kritische Fehlerankündigung erhalten.                                                           |
| Fira Sans, Titel 30/36, Body 14/20 und 16/24                        | Fontimport, `StudioPageTitle`, lokale Typografie                           | Semantische Textrollen verwenden. Display-Größen bleiben für ihren tatsächlichen Bedarf bestehen.                                                                                                                            |
| Input 40 px, Aktion 44 px, Radien 6/8, Card Default/Compact         | vorhandene UI-/Layout-Primitives                                           | Familie und Dichte am Figma-Knoten abgleichen; globale CSS-Ersetzung darf keine Spezialcontrols verkleinern.                                                                                                                 |
| Lucide 16/20 px, 1 px Kontur                                        | Sidebar derzeit Tabler; Shared Tab-Icons bereits Lucide                    | Bestehende Motive semantisch zuordnen und zugängliche Namen erhalten; kein pauschaler Austausch dynamischer Plugin-Icons.                                                                                                    |

Die Farbquelle ist `apps/sva-studio-react/src/styles.css`; der aktuelle Code
nutzt RGB-Kanäle mit `rgb(var(...))`. Die veraltete HSL-Vorgabe in Abschnitt 12 der
Entwicklungsregeln wurde im Foundation-Slice an diese technische Umsetzung
angeglichen. Keine zusätzliche
Token-Datei oder automatische Figma-Codegenerierung einführen.

## 3. Funktionsbestand des ersten Scopes

Diese Liste ist eine Erhaltungsverpflichtung, kein Nachweis bereits bestandener
Tests. Vor einem Slice die konkreten Zustände und Erwartungen in den vorhandenen
Tests charakterisieren, anschließend denselben Bestand erneut prüfen.

### Shell und gemeinsame Interaktionen

| Vertrag                        | Bestand / Nachweisanker                                                                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth- und Organisationskontext | Header, `OrganizationContextSwitcher`, effektive Rechte und aktivierte Module bestimmen sichtbare Navigation; Ein-/Ausloggen, Konto, Deutsch/Englisch und Theme-Umschaltung bleiben erreichbar.                            |
| Navigation                     | Mobile Drawer mit Escape/Fokus-Rückgabe; Sidebar, Gruppen und Flyouts mit aktiver Route; bewusste gespeicherte Collapse-Präferenz bewahren. `Sidebar.test.tsx`, `Header.test.tsx`.                                         |
| Shellzustände                  | Laden, Session-Wiederherstellung, ausstehende Rollenzuordnung, degradierte Rechte, Rechtstextannahme, Breadcrumbs, kontextuelle Hilfe und optionaler Runtime-Status. `AppShell.tsx` und zugehörige Tests.                  |
| Tabellen                       | URL-/serverseitige und lokale Sortierung, Filter, Pagination, Zeilen-/Sammelaktionen, Auswahl nur berechtigter Zeilen, Auswahlbereinigung bei Rechte-/Datensatzänderung, Loading/Empty/Error. Shared `studio-data-table*`. |
| Formulare                      | Label-/Help-/Error-Verknüpfung; Fehlerzusammenfassung öffnet optionale Abschnitte und fokussiert das Feld; keine verschachtelten Formulare. `studio-form-bridge*`.                                                         |
| Speichern / Verlassen          | Idle/Saving/Saved, persistente Fehler, expliziter Retry, sichere Request-Referenz; keine Freigabe des Dirty-Schutzes durch veraltete Save-Antworten. `studio-save-feedback*`, `studio-editor-leave-guard*`.                |
| Destruktive Aktionen           | konkrete Bestätigung, Pending-Sperre, sichtbarer Fehler und definierte Fokus-Rückgabe auch nach Entfernen des Triggers. `studio-action-feedback*`, `studio-primitives.test.tsx`.                                           |

### News-Felder und fachliche Wirkungen

| Bereich                | Erhaltener Umfang                                                                                                                                                                                                       | Zuständiger Code                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Einstieg und Liste     | Host-Contentübersicht, typsichere Search-/Path-Params, Inhalts-/Sichtbarkeits-/Statusfilter, Pagination, Detailnavigation; Create und Edit bleiben separate bestehende Routen                                           | `news.pages.tsx`, Host-Contentrouten, `news.types.ts`                                          |
| Verantwortlichkeit     | Organisation/Benutzer als handelnder Principal; Create-Kontextauswahl, Readiness und Ownership-Darstellung; Create bleibt bei fehlender Anbindung blockiert und erhält den Entwurf                                      | `news.detail-basis-tab.tsx`, `news.detail-page-access.ts`                                      |
| Basis                  | Titel, Autor, Kategorien einschließlich Loading/Error/nicht mehr verfügbarer Auswahl und Metadaten für Erstellung, Publikation und Aktualisierung                                                                       | `news.detail-basis-tab.tsx`, `news.category-multiselect.tsx`                                   |
| Inhalt                 | Einleitung und Volltext mit WYSIWYG/HTML, Formatierung, Listen, Links, Undo/Redo, Fehlermeldung und Zeichenzahl; vorhandene Create-Gliederung und Quellen-URL/-Beschreibung                                             | `news.detail-content-tab.tsx`, `news.detail-content-tab.helpers.ts`                            |
| Medien                 | Bibliothek, Upload, manuelle Referenz, Reihenfolge/Entfernen, Vorschau und vorhandene Bildbearbeitung; Alttext, Caption, Credit und Medientyp; getrennte Asset- und Contentrechte                                       | `news.detail-content-media.tsx`, `news.detail-page-media*`                                     |
| Veröffentlichung       | `draft`, `immediate`, `scheduled`; lokales Datumsfeld samt Validierung und bestehender Zeitzonenbehandlung; Publikationswirkung und Create-Aktion bleiben konsistent                                                    | `news.detail-settings-tab.tsx`, `news.editor-model.ts`                                         |
| Push und Zielgebiete   | Modul-/Action-/Ressourcenrechte; bereits versendeter Push, Einschränkungen bei Entwurf/Terminierung; Zielgebietsentwurf, Filter, seitenübergreifende Auswahl, Übernehmen/Abbrechen, veraltete Ziele, Summary-Pagination | `news.detail-settings-tab.tsx`, `news.detail-targeting-*`, `news.detail-targeting-state.ts`    |
| Historie               | Create-Hinweis sowie Loading/Empty/Forbidden/NotFound/Error; bestehende Studio-seitige Änderungen und Herkunftshinweis, keine neue Mainserver-Historie versprechen                                                      | `news.detail-history-tab.tsx`, `StudioContentHistory`                                          |
| Kompatibilität         | `__legacySnapshot`, `__compatibilityTouched` und bestehende Legacy-Aliase erhalten unbekannte oder nicht sichtbar editierte Werte; keine Payload-Neukonstruktion aus den sichtbaren Feldern                             | `news.types.ts`, `news.detail-form-compatibility*`, `news.editor-model.ts`                     |
| Save/Delete/Navigation | Submit-Deduplizierung, bestätigter Erfolg, partieller Medienreferenzfehler, Reference-Retry ohne zweite Inhaltsmutation, Fehler bei Navigation nach Create/Delete, sichere Rückkehr, Schutz ungespeicherter Änderungen  | `news.detail-page*.ts*`, `news.detail-page-save-status.tsx`, vorhandene Seiten-/API-/E2E-Tests |

Die oben genannten Permissions werden konsumiert, nicht neu modelliert:
`news`-CRUD, Lifecycle-Capabilities, `news.pushNotification`, Medienrechte
und bei Waste-Zielgebieten Modulzuweisung plus `waste-management.read` bleiben
in den bestehenden zuständigen Auflösungspfaden.

## 4. Implementierungsentscheidungen pro Iteration

### 0 — Baseline

Code- und Figma-Zuordnungen aktualisieren, Funktionsliste mit Tests verknüpfen
und im vorhandenen Playwright-Pfad feste Vorher-Aufnahmen für Shell,
Contentliste sowie News-Create/-Edit ergänzen. Vorher-Aufnahmen charakterisieren
den Iststand; spätere Soll-Aufnahmen werden gesondert mit Figma verglichen.
Keine zweite Test-App und kein eigenständiges Screenshot-Framework einführen.

### 1 — Tokens und Controls

Familienweise vorgehen: Farben/Typografie, Buttons, Eingaben/Auswahl,
Labels/Fehler, Status, Dialoge/Tabs. Nach jedem Block das kleinste echte
Unit-/Type-Gate ausführen. App-lokale Controls mit demselben Zweck mitprüfen,
damit Shared- und Hostdarstellung nicht auseinanderlaufen. Bei Ersetzung alle
betroffenen Imports umstellen und Altimplementierung entfernen.

`sva-default` und `sva-forest` sowie Light/Dark und deren Persistenz bleiben
stabil. Solange Forest-Designwerte fehlen, bestehende grüne Farbidentität
beibehalten und gemeinsame Geometrie verwenden; keine unbestätigten Farben
erfinden. Die Designlücke blockiert keine unabhängige Standard-Theme-Arbeit.

### 2 — Shell

Ohne explizite Nutzerpräferenz gelten unter 1024 CSS-px Drawer, ab 1024 Rail
mit 80 px und ab 1280 Sidebar mit 288 px. Responsive Default und bewusste
gespeicherte Collapse-Auswahl getrennt behandeln. Der bisherige Sidebar-Pfad
schreibt auch seinen initialen Standard als `0`/`1`; daraus lässt sich keine
bewusste Auswahl rekonstruieren. Deshalb gültige vorhandene Legacywerte `0`/`1`
zur Kompatibilität als Präferenz übernehmen. Fehlende oder ungültige Werte
verwenden den neuen responsiven Default. Automatische Viewportwechsel und das
initiale Anwenden des Defaults schreiben diesen Schlüssel nicht; nur eine
ausdrückliche Nutzeraktion ändert die Präferenz. Keine neue Persistenzschicht
oder stillschweigende Löschung gültiger Legacywerte einführen.

Seitenkopf nach Inhaltsbreite: schmal unter etwa 640 px, gestapelt ab etwa
640 px, Aktionen rechts ab etwa 880 px, sofern Inhalt passt. Lange Texte dürfen
weiterhin umbrechen; keine künstliche Schriftverkleinerung.

Tabbar und komplexe Tabellen besitzen lokale Scrollbereiche, das Dokument
keinen horizontalen Overflow. Figma fordert für die Tourenreferenz 1100 px
fachliche Spaltenbreite. Das ist keine globale Umstellung aller
`StudioDataTable`-Verbraucher: der vorhandene kompakte Karten-/Sortierpfad
unter 640 px Containerbreite bleibt für seine Verbraucher erhalten. Die
Tourenentscheidung wird erst im Waste-Slice konkret umgesetzt.

Dialoghöhe begrenzen, Abschluss und Schließen erreichbar halten, Inhalt lokal
scrollen. Keine gestapelten Arbeitsdialoge als Ersatz vorhandener Unteransichten.

### 3 — News und gemeinsame Detail-Tabs

1. Bestehende `StudioDetailTabs` anhand von News und Events vergleichen; Events
   besitzt ebenfalls besuchte Bereiche und Fokus-/Hover-Vorladung. Events ist
   Vergleichsverbraucher, nicht zusätzlicher Migrationsscope dieses Slices.
2. `StudioDetailTabsProps<TTabId>` um `preloadOnIntent?: boolean` mit Default
   `false` ergänzen. Fokus und Hover auf sichtbaren, nicht deaktivierten
   Triggern markieren bei `true` den Bereich intern als besucht. Zusammen mit
   `keepMounted` wird er eingebunden und beim Bereichswechsel erhalten.
3. Der zusätzliche Preload-Handler ändert selbst weder aktiven Tab noch Fokus
   oder URL. Die bestehende automatische Radix-Aktivierung bei Fokus und ihre
   Tastaturbedienung bleiben erhalten; keine Umstellung auf manuelle Aktivierung.
   Hover allein aktiviert keinen Tab. Wiederholter Intent ist idempotent;
   deaktivierte/unsichtbare Bereiche werden nicht vorgeladen. Bestehende
   Verbraucher ohne Option behalten ihr Verhalten. Keine zusätzliche API für
   pluginlokale `visitedTabs`, Provider oder Preload-Factory ergänzen.
4. News benutzt `StudioDetailTabs<NewsDetailTabId>` kontrolliert mit aktivem
   Bereich und vorhandener mobiler Beschriftung, `keepMounted` und
   `preloadOnIntent`. Dirty-/Change-Anzeigen, Tabaktionen, Panelüberschriften,
   Fehler und History-Verhalten erhalten; Icons über vorhandene gemeinsame
   Icon-Namen ausdrücken.
5. Lokale Tab-Darstellung samt rein technischer Visit-/Warm-Verwaltung und
   dadurch überflüssigen Props/Inline-SVGs entfernen. Fachliche Dirty-Ermittlung
   und Definition der News-Bereiche bleiben im Plugin. Ein bloßer neuer
   Weiterleitungswrapper ersetzt den Altpfad nicht.
6. `NewsDetailCard`-Importe auf `StudioDetailCard` umstellen und den reinen
   Reexport `news.detail-card.tsx` entfernen. Den Kategorieadapter nur dann
   weiter reduzieren, wenn seine fachliche Übersetzung am Aufrufer klarer
   bleibt; keine Kategorien-Spezial-API im Shared-Package einführen.
7. Ein RHF-Owner und ein zugehöriges natives Formular bleiben bestehen.
   Provider decken alle Context-Verbraucher und ihre Portale ab. Externe
   Save-Buttons behalten `form={formId}`; Dialogaktionen lösen keinen
   unbeabsichtigten Submit aus. Speicher-/Mediencontroller bleiben bestehen.

Neue Komponenten bleiben auf Modulebene. State bleibt beim zuständigen Owner;
Berechnungen nicht in duplizierten State kopieren. Effekte dienen externen
Synchronisationen und Lifecycle-Aufgaben, nicht einer zweiten Datenhaltung.
Bestehende fachliche Container nicht wegen ihrer Zeilenzahl zerlegen. Stabile
Keys schützen Eingaben, Auswahl und Editorinstanzen.

### Weitere Iterationen

Reihenfolge: Events/POI/Projects → Generic Items/FAQ/Kacheln → Surveys/Vouchers
→ Waste-Listen/Touren, danach Kalender/Stammdaten/Importe → übrige Host-,
Admin-, Konto-, Kategorien-, SSF- und Katalogflächen gemäß Inventur.
Unmittelbar vor jedem Slice dessen aktuelle Felder, Zustände, direkten
Verbraucher, Abhängigkeiten und Prüfungen ergänzen; keine vollständige
Vorabimplementierung aller Plugins aus dieser Vorsortierung ableiten.

Pro Slice vor der ersten Codeänderung Ziel in einem Satz, Nicht-Ziele und
maximal betroffene Bereiche festhalten. Eigenständig prüfbare PRs bevorzugen,
aber keine künstlichen Stacks oder neuen Changes für kleine lokale Folgefixes.

## 5. Lücken und Entscheidungen

Prioritäten: **P1** vor Umsetzung des betroffenen Vertrags klären; **P2** vor
dessen Produktabnahme prüfen. „Offen“ bedeutet keine bewiesene Fehlfunktion.

| ID / Art / Priorität                         | Funktion und Iststand                                                                                             | Fehlende Gestaltung oder Entscheidung / Zustände                                                                                  | Evidenz                                                                                                                                                                            | Übergang / Status                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1 zurückgestellt                            | Forest wird später reaktiviert.                                                                                   | Keine aktive Gestaltungs- oder Abnahmeaufgabe in diesem Abschnitt.                                                                | bestehende Theme-IDs und CSS                                                                                                                                                       | vorhandenen Pfad erhalten; erst bei Reaktivierung erneut abgleichen.                                                                                                                                                                                                                            |
| L2 Design freigegeben                        | Gestaltung ist laut Nutzer freigegeben, Bibliothek noch unveröffentlicht.                                         | Bibliothekspflege und Veröffentlichung bleiben nachgelagert.                                                                      | Figma `23:30822`, `23:30848`; Nutzerentscheidung 1.11.2026                                                                                                                         | freigegebenen Stand jetzt verwenden; Produktabnahme separat.                                                                                                                                                                                                                                    |
| L3 Produktvertrag, P1                        | vorhandene Editoren schützen Eingaben; kein globaler Konfliktvergleich im Pilot bestätigt                         | Revision erkennen, vergleichen, erneut speichern                                                                                  | [Konfliktentwurf `164:12747`](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-12747)                                                       | vorhandene Schutz-/Fehlerpfade gestalten; neue Revision-/Mergefunktion separat entscheiden                                                                                                                                                                                                      |
| L4 Wiederaufnahme, P1                        | Offene News-Create-/Edit-Entwürfe bleiben bei Session-Recovery im gemounteten Editor.                             | Browser schließen/neuladen bleibt ohne persistente Entwurfsablage ein Verlustpfad.                                                | `content-editor-leave-boundary.tsx`, `mainserver-resource-principal-boundary.tsx`; Figma `164:12901`                                                                               | Anmeldung in neuem Tab; gleicher Account, Instanz und aktive Organisation, aktuelle Freigaben, explizite Wiederaufnahme; keine lokale Entwurfs-/Sessionkopie.                                                                                                                                   |
| L5 Speicherergebnis, P1                      | News besitzt stabile Operationskennungen, geschützte Journalabfrage und Referenz-Recovery.                        | Verliert bereits der Server die Upstream-Antwort ohne bestätigtes Ergebnis, kann Studio den Ausgang nicht beweisen.               | `news-route-access.ts`, `news.detail-page-recovery.ts`; Figma `164:13034`                                                                                                          | unbekannt bleibt gesperrt; kein blindes Content-Retry. Provider-Abgleich beziehungsweise externe Idempotenz sind gesonderte Folgeschritte.                                                                                                                                                      |
| L6 Produktvertrag, P1                        | News kennt Entwurf/sofort/terminiert                                                                              | revisionsgebundene Vorschau, Freigabe, separater Publikationsabschluss und Rücknahme unterscheiden sich vom belegten Save-Vertrag | [Veröffentlichung `164:13299`](https://www.figma.com/design/TpqaB3bLGPK73ypkj7oE8G/Designsystem-SVA-Studio?node-id=164-13299), `news.editor-model.ts`                              | vorhandene Publikationswirkung erhalten; neue Workflows separat entscheiden                                                                                                                                                                                                                     |
| L7 Nachweis, P1 vor Abnahme                  | statische Responsive-/Dark-Referenzen vorhanden                                                                   | Produktprüfung für Tastatur, Screenreader, Zoom/Textabstände, Forced Colors und geringe Höhe steht aus                            | Figma `23:30822`, `158:12608`                                                                                                                                                      | direkte Browser-/manuelle Nachweise im Slice; kein AA-Nachweis allein aus Figma ableiten                                                                                                                                                                                                        |
| L8 Code-Verifikation, P1                     | `toHaveScreenshot` im geprüften E2E-Verzeichnis nur bei Buttons                                                   | vollständige Shell-/Listen-/Editorreferenzen fehlen                                                                               | App `e2e/button-accessibility.spec.ts:220`                                                                                                                                         | 24 Vorher-Aufnahmen vor dem Reskin erzeugt; Shell/Overview/Create/Edit im bestehenden News-E2E-Pfad, Nachweis in Abschnitt 7                                                                                                                                                                    |
| L9 Implementierungsabweichung, P2            | News besitzt lokale Tabs/Icons und Card-Reexport; Sidebar verwendet Tabler                                        | gemeinsame Komponenten entsprechen noch nicht durchgehend Figma                                                                   | `news.detail-page-tabs.tsx`, `news.detail-tabs.tsx`, `news.detail-card.tsx`, Sidebar                                                                                               | im ersten Lieferabschnitt umgesetzt: drei lokale News-Dateien entfernt, eigene Sidebar-Icons Lucide; Regressionstests in Abschnitt 7                                                                                                                                                            |
| L10 Produktabnahme offen, P2                 | Registrierte Pluginoberflächen sind im Folgeabschnitt technisch auf gemeinsame Darstellung geprüft und angepasst. | Fachliche Feld-/Zustandsabnahme sowie noch nicht migrierte Host-/Adminoberflächen.                                                | Inventur in Abschnitt 2; Implementierungsnachweis in Abschnitt 9                                                                                                                   | Pluginmigration getrennt von Produktabnahme und Hostmigration ausweisen; vorhandene Funktionen erhalten.                                                                                                                                                                                        |
| L11 Abgleich, P1                             | Aktive Texte und Fokus erfüllen die vorhandenen numerischen Codeprüfungen.                                        | Einzelne Figma-Disabled-/Secondary-Rollen weichen vom strengeren bisherigen Studio-Vertrag ab.                                    | `styles-foundation.test.ts`, `e2e/button-accessibility.spec.ts`; Figma `23:29470`, `23:32345`                                                                                      | WCAG-AA hat Vorrang; starke Texte und notwendige Zustandsmerkmale, dezente dekorative Flächen/Linien. Keine pauschale 3:1-Pflicht für dekorative Konturen. Gemeinsame endgültige Rollen vor visueller Abnahme in Code und Figma rückführen; Figma wird in diesem Codeabschnitt nicht verändert. |
| L12 Medienbereinigung, P1 bei Auftreten      | Ein `outcome_unknown`-Medienvorgang bleibt vor destruktiver Bereinigung geschützt.                                | Nach spät bestätigtem `not_applied` kann der bestehende Abandon-Vertrag einen Statuskonflikt liefern.                             | `news.detail-page-recovery.ts`, `media/content-save-finalize-statements.ts`; Figma `164:13034`                                                                                     | Keine Bereinigung erzwingen und keinen neuen Contentwrite freigeben; vorhandene Medienoperation operativ klären. Ein beleggebundener Bereinigungsübergang bleibt Folgearbeit.                                                                                                                   |
| L13 Code geschlossen, manuell P1 vor Abnahme | Waste verwendete eine eigene Standort-Suchauswahl sowie ein lokales Ein-Aktions-Menü.                             | Vollständige manuelle Tastatur-/Screenreader-Abnahme bleibt mit L7 offen.                                                         | `searchable-select.tsx`, `waste-management.tours-custom-dates.location-picker.tsx`, `waste-management.master-data-locations-table.views.toolbar.tsx`; Figma `147:3558`, `148:3546` | Gemeinsame Suchauswahl und direkter Button ersetzen die lokalen Pfade; kein neuer Menü-State. Technische Prüfungen und Browsernachweis stehen in Abschnitt 10.                                                                                                                                  |

Jede neue Lücke benutzt dieselben Spalten: Funktion/Istverhalten, fehlende
Gestaltung, Zustände, Code-/Figma-Verweis, Priorität, Übergang und Status.
Fehlende Designabdeckung wird am betroffenen Baustein dokumentiert und nicht
durch Funktionsentfernung oder erfundene Backendfähigkeit geschlossen.

## 6. Nachweise, Abschluss und Stopps

### Prüfmatrix

| Slice / Risiko        | Pflichtnachweis                                                                                                                                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Planungsunterlagen    | OpenSpec strikt validieren, Dateiplatzierung und Dokumentationsprüfung; interne Links der neuen Dateien prüfen                                                                                                                                                                       |
| Foundations           | passende Primitive-Tests, numerische Kontrastmatrix, betroffene Typen, Button-Axe-/Screenshot-Test für Default/Forest × Light/Dark                                                                                                                                                   |
| Shell                 | Header-/Sidebar-/AppShell-Tests; Navigation/Context/Locale/Theme inklusive Persistenz, Drawer/Flyout/Fokus und Rollen-/Degradationszustände                                                                                                                                          |
| Shared Tabs           | Default bleibt unverändert; Hover ohne Aktivierung; Fokus mit bestehender automatischer Radix-Aktivierung; Preload-Handler aktiviert nicht zusätzlich; Disabled/Hidden; idempotentes Vorladen; `keepMounted`; Tastatur/Mobil/Dirty; keine State-Verluste oder mehrfachen Ladeeffekte |
| News                  | Create/Edit und Read-only, Principal nicht bereit, Kategorienfehler, alle Publikationsmodi, Push-/Targeting-Rechte, Tabwechsel, Rich-Text/HTML, Savefehler, Dirty-Schutz, History, Delete und Navigationsfehler                                                                      |
| Medien                | Asset-/Contentrechte, Auswahl/Upload/manuelle Referenz, Metadaten/Reihenfolge; partieller Reference-Sync-Fehler und Retry mit genau einer ursprünglichen Inhaltsmutation                                                                                                             |
| Gemeinsame Änderungen | gezielte Tests der direkten betroffenen Verbraucher; reale unterschiedliche Feld-/Tabformen vergleichen, nicht nur den News-Aufrufer                                                                                                                                                 |

Für visuelle/Responsive-Nachweise Default/Forest × Light/Dark kombinieren;
die repräsentativen Shell-/Listen-/Editoransichten bei 320, 390, 768, 1024,
1280 und 1728 CSS-px prüfen. Direkt vor/nach Shellgrenzen zusätzlich 1023/1025
und 1279/1281 px prüfen; Headergrenzen an der tatsächlichen Inhaltsbreite
testen. Lange deutsche/englische Texte, Zoom, Tastatur, niedrige Fensterhöhe
und lokale Scrollbereiche einbeziehen. Screenreader und Forced Colors direkt
prüfen; Axe und Screenshots sind jeweils nur Teilnachweise.

Vorher- und Soll-Screenshots unterscheiden. Keine pauschale Snapshotannahme:
Änderung sichtbar prüfen und sowohl Figma-Nähe als auch erhaltene Funktionen
bestätigen. Tests nutzen synthetische Daten und vorhandene Fixtures/MSW- bzw.
Playwright-Routen; keine Produktivkonten, echten Uploads oder Pushzustellung.

### Verifizierte Befehlseinstiege

Die Nx-Targets und E2E-Filter wurden lesend aufgelöst; diese Tests wurden im
Planungsabschnitt nicht ausgeführt. Dateifilter immer als `--testFiles`:

```sh
pnpm exec openspec validate align-studio-ui-design-system --strict
pnpm check:file-placement
pnpm check:docs

pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-detail-tabs.test.tsx
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-form-bridge.test.tsx
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-save-feedback.test.tsx
pnpm nx run studio-ui-react:test:unit --testFiles=src/studio-editor-leave-guard.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Header.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Sidebar.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/AppShell.test.tsx
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/styles-foundation.test.ts
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-page.test.tsx
pnpm nx run plugin-news:test:unit --testFiles=tests/news.detail-content-tab.test.tsx
pnpm nx run studio-ui-react:test:types
pnpm nx run plugin-news:test:types
pnpm nx run sva-studio-react:test:types
pnpm nx run sva-studio-react:test:a11y
pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/news-plugin.spec.ts
pnpm nx run sva-studio-react:test:e2e --testFiles=e2e/button-accessibility.spec.ts
```

Bei den Unit-Targets jeweils einen Dateifilter pro Aufruf verwenden: Der
Vitest-Wrapper teilt kommagetrennte Werte nicht auf. Wegen des vorhandenen
`--passWithNoTests` gilt Exit 0 allein nicht als Nachweis; die erwartete Datei
muss mit tatsächlich gesammelten und ausgeführten Tests im Ergebnis stehen.
Ein leerer Lauf ist ein fehlender Nachweis und vor dem nächsten Block zu beheben.

Lint auf die betroffenen Projekte begrenzen. Neue Browserfälle in den bestehenden
E2E-Pfad aufnehmen und nachprüfbar auswählen. Vor breiten affected-Unit-Läufen
den Scope gemäß `AGENTS.md` messen; rote konkrete Pfade zuerst beheben. In der
PR-Fixphase sind GitHub-Gates am exakten HEAD maßgeblich, keine wiederholten
breiten lokalen Suiten. Spezielle Pflicht-Gates bleiben bei tatsächlicher
Security-/Server-Runtime- oder Datenintegritätsänderung erforderlich; eine
solche Scope-Erweiterung gehört zunächst an die hier definierte Stoppgrenze.

### Abschluss je Slice

- Bestehende Funktionen und Zustände sind dem aktuellen Code und ihren
  Nachweisen zugeordnet; kein Akzeptanzkriterium bleibt durch eine entfernte
  Darstellung unerreichbar.
- Zielgestaltung, direkte Verbraucher und die angemessenen Tests bestehen;
  Ausführung, Commit und Ergebnisse dokumentieren. Technische Prüfung,
  Browserprüfung und fachliche Abnahme ausdrücklich unterscheiden.
- Ersetzte Dateien, Komponenten, Exporte und Ausführungspfade sind entfernt;
  hinzugefügte/entfernte Produktionsoberfläche sowie Tests/Dokumentation
  getrennt bilanzieren. Kein Zielwert erzeugt künstliche Codeverdichtung.
- Lückenstatus und relevante aktuelle UI-/arc42-Dokumentation aktualisieren;
  keine neue Basis-Komponente bei unbelegter Mehrfachnutzung.

Stoppen, wenn ein Slice neue Backend-/Persistenzverträge, geänderte Fachregeln,
neue IAM-Entscheidungen oder Verlust von Bedienmöglichkeiten benötigt. Den
betroffenen funktionierenden Pfad behalten und als Entscheidung ausweisen.
Bei wiederholten Befunden an derselben Grenze den gesamten Zustandsraum und
direkte Verbraucher prüfen, bevor weitere lokale Fixes erfolgen.

Merge und Rollout sind nicht Teil dieses Planungsauftrags. Eine spätere
Bereitstellung folgt ausschließlich dem
[Studio-Rollout-Prozess](../../../docs/guides/studio-rollout-process.md),
ohne zweiten Deploypfad oder neue Rolloutschicht.

## 7. Lokaler Implementierungsnachweis — 1. November 2026

Der Nutzerauftrag „Setze das um“ autorisiert den ersten Code-Lieferabschnitt
(Baseline, Foundations, Shell, News). Basis bleibt der oben benannte Commit;
die Änderungen liegen zum jeweiligen Prüfzeitpunkt uncommitted auf `docs/ui-design-system-migration`.
Kein Merge, Rollout oder fachliches Abnahmeurteil ist Teil dieses Nachweises.

### Geprüfte Quellen und tatsächliche Änderung

Zusätzlich zu den Grundlagen erneut direkt gelesene Figma-Knoten:
Header-/Shellmuster `99:3846`, Light-Rollen `23:29470`, Detail-Tabbar
`115:5079`, Card Default `56:932`, TabPanel `56:943` und Disabled-Button
`23:32345` (Designkontext und Screenshots am 1. November 2026). Größere
Root-Knoten waren teilweise nicht abrufbar; daraus wurden keine weiteren
Designwerte oder fachlichen Anforderungen erfunden.

Die XERJ-Suche in `studio-code` bestätigte gemeinsame Detail-Tabs und deren
Verbraucher. `payload-code` lieferte für den konkreten Tab-Lifecycle keine
passende übertragene Referenz. Ein aktueller Autoindex-Stand war nicht belegt;
deshalb wurden die tatsächlichen lokalen Dateien geprüft. Es wurde kein
fremder Code übernommen. Der zweite reale Vergleich war
`events.detail-editor-tabs.tsx` mit `onMouseEnter`/`onFocus`, `warmTab` und
`visitedTabs`; Events bleibt im Folge-Slice fachlich unverändert.

- Semantische Light-/Dark-Flächen, Text-, Status-, Action- und Fokusrollen
  liegen weiter ausschließlich in `styles.css`. Nur aktuell verwendete neue
  Rollen (`surface-inset`, `border-subtle`, Statusfläche/-text) wurden ergänzt.
  Fira Sans und Theme-IDs bleiben bestehen; Forest behält seine grüne Identität.
- Input, Textarea, Select und Tabs der App sind direkte öffentliche Reexports
  aus `@sva/studio-ui-react`; vier parallele Basisimplementierungen entfallen.
  Checkbox verwendet den nativen Zustand einschließlich `indeterminate`,
  Ref und Formverhalten statt eines zusätzlichen visuellen React-States.
- Cards, Statusfeedback und Dialogflächen sind im bestehenden Pfad angepasst;
  Viewportgrenzen und Scrollbarkeit erhalten die vorhandenen Aktionen.
- Sidebar ohne Präferenz: Drawer unter 1024, Rail 80 px ab 1024 und Sidebar
  288 px ab 1280. Gültige Legacypräferenzen bleiben vorrangig; allein explizites
  Umschalten schreibt den Schlüssel. Eigene Shell-Icons verwenden Lucide.
  Header zeigt den Organisationskontext zusätzlich inline; eindeutige IDs
  erhalten die Labelzuordnung bei gleichzeitiger Menüinstanz.
- `StudioPageHeader` richtet Aktionen nach tatsächlicher Containerbreite aus.
  News verwendet kontrollierte `StudioDetailTabs` mit `keepMounted` und dem
  additiven, sonst standardmäßig deaktivierten `preloadOnIntent`.
  Der redundante Shared-Pfeiltastenhandler wurde nach konkreter
  Fokusregression entfernt; Radix steuert Fokus und Aktivierung gemeinsam.
- Drei Produktionsdateien wurden gelöscht: `news.detail-card.tsx`,
  `news.detail-tabs.tsx`, `news.detail-page-tabs.tsx`. Keine Restimporte,
  keine neue Produktionsdatei, kein Package, Provider, SDK-/Backendvertrag
  oder alternativer Speicherpfad. Der aktive Tab bleibt im Plugin;
  Dirty-Ermittlung bleibt fachlich, Visit-/Mount-Lifecycle ist zentral.
- RHF-Owner, natives Formular, Portale und externe Submit-Zuordnung sowie
  Speicher-/Mediencontroller bleiben erhalten. API-/Modell-/Mutationsdateien
  sind nicht geändert. Bestehende Fehler-, Retry- und Navigationspfade bleiben
  die Nachweisanker des Funktionsbestands.

### Ausgeführte technische Prüfungen

Die folgenden Ergebnisse beziehen sich auf tatsächlich gesammelte Tests;
`passWithNoTests` wurde nicht als Beleg verwendet. Pro Datei wurde der
vorhandene Nx-Target mit `--testFiles=<Datei>` aufgerufen. Beim bestehenden
Generic-Items-Target bleibt zusätzlich der feste Filter `tests` aktiv, daher
lief dort das kleine Package mit 11 Dateien statt nur der angeforderten Datei.

| Zuständiger Target / Dateien                                                                        | Ergebnis                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studio-ui-react:test:unit` — `studio-primitives.test.tsx`                                          | 51 Tests bestanden                                                                                                                                                  |
| derselbe Target — `studio-detail-tabs.test.tsx`                                                     | 23 Tests bestanden, einschließlich wiederholter Pfeile/Fokus, Home/End, Guard-Status, Vorladung und Eingabenerhalt                                                  |
| derselbe Target — `studio-content-editor-primitives.test.tsx`                                       | 2 Tests bestanden                                                                                                                                                   |
| derselbe Target — `studio-save-feedback.test.tsx`                                                   | 9 Tests bestanden; persistente Fehler, expliziter Retry, sichere Request-Referenz                                                                                   |
| `plugin-news:test:unit` — `tests/news.detail-page.test.tsx` und separat `tests/news.pages.test.tsx` | 21 und 42 Tests bestanden; unter anderem Payload-Erhalt, Publikations-/Pushrechte, Löschbestätigung, Speicherfehler und Reference-Retry ohne zweite Inhaltsmutation |
| `plugin-generic-items:test:unit` — bestehende direkte Shared-Verbraucher                            | 48 Tests in 11 Dateien bestanden; Create/Edit, Tab-/Formfelder, Medien und Leave-Guard                                                                              |
| `sva-studio-react:test:unit:ui` — Sidebar, Header, OrganizationContextSwitcher, AppShell            | 53, 20, 12 und 24 Tests bestanden                                                                                                                                   |
| derselbe Target — `styles-foundation.test.ts`                                                       | 17 Tests bestanden; vier Theme-/Moduskombinationen, Action-/Fokus-/Statuskontraste und grüne Sidebar-Kontraste                                                      |
| `sva-studio-react:test:a11y` — `src/components/ui/dialog.a11y.test.tsx`                             | 1 Test bestanden                                                                                                                                                    |

Zusätzlich bestanden der gezielte News-Content-Tab-Test (3 Tests) sowie
FilterSurface und SummaryCard (je 1 Test).

Alle drei Projekt-Targets `lint` und `test:types` bestanden; die Typprüfung
baute ihre 31 benötigten Abhängigkeiten. App-/Plugin-UI-Boundary-Checks
bestanden; der Architekturguard meldete ausschließlich bestehende Signale in
unveränderten App-Translations-/SSF-/Waste-Dateien. OpenSpec strikt,
Dateiplatzierung und Dokumentationsprüfung bestanden. Lint enthielt keine
Fehler; bestehende Warnungen in unveränderten Dateien wurden nicht pauschal
als Teil der Designmigration bereinigt.

Der vollständige bestehende News-E2E-Pfad bestand mit 14 Tests einschließlich
Auth-Setup. Abgedeckt wurden Create, Edit bei stale Context ohne automatische
Mutationswiederholung, Entwurf/Veröffentlichung/Löschen, Medien-Lifecycle,
Tastatur, Push-Rechte, IAM-Pagination, anonymer Zugriff und Axe. Die vier neuen
Referenzfälle prüfen Overview/Create/Edit bei 320, 390, 768, 1023, 1024, 1025,
1279, 1280, 1281 und 1728 px ohne horizontalen Dokumentoverflow und ohne
verschachtelte Formulare/Buttons. Die Sidebarbreiten entsprechen den Grenzen;
News-Edit prüft wiederholte Pfeile und Home mit echter Fokuszuordnung.
24 Vorher-Aufnahmen wurden vor dem Reskin erzeugt (5 grüne Baseline-Tests
inklusive Auth-Setup); die vorhandene Button-Axe-/Kontrastmatrix bestand für
alle vier Theme-/Moduskombinationen (5 Tests einschließlich Setup).

Die Referenztests setzen Deutsch, `Europe/Berlin`, festen Zeitpunkt,
Reduced Motion und den echten Theme-Modus vor dem Appstart. Die älteren
Vorherbilder dienen dem Geometrie-/Flächenvergleich; der danach präzisierte
echte Theme-Modus erzeugt in Dark-Aufnahmen zusätzlich das passende
Schaltersymbol. Dieser Fixture-Unterschied ist keine Produktänderung. Gespeicherte
Sidebarpräferenzen werden ausschließlich im isolierten Testkontext gelöscht;
deren Erhalt wird gesondert durch die Sidebar-Tests geprüft. Forest-Farben
werden für den visuellen Vergleich unabhängig vom synthetischen Tenant
angewendet; die Tenant-Theme-Zuordnung ist kein Teil dieses Farbvergleichs.

Lokale Logs liegen unter dem ignorierten `.nx/ui-*.log`; sie sind keine neue
Testinfrastruktur. Die bestehenden UI-Standards, RGB-Dokumentation und arc42
05/08/10 wurden im selben Lieferabschnitt fortgeschrieben.

### Visuelle Nachweise und Review

Je Plattform werden 24 Overview-/Create-/Edit-Referenzen (vier Kombinationen,
390 und 1280 px) sowie vier bestehende Button-Matrizen geführt. Die bisherigen
Button-Referenzen wurden mit den tatsächlich gerenderten Farben erneuert;
keine Toleranzen wurden erhöht. Vorher-/Nachher-Ansichten, Card-/TabPanel-
Grundlagen sowie beide Themes/Modi wurden sichtbar verglichen. Die letzten
Korrekturen gleichen lokale News-Titel-, Metadaten-, Publikations- und
Zielgebietsflächen an dieselben Radien und semantischen Flächen an.

Linux-Bilder stammen aus Chromium in einem lokalen
`mcr.microsoft.com/playwright:v1.62.1-noble`-Container; App und Test-Runner liefen
auf macOS. Sie wurden nicht aus macOS-Dateien kopiert. Eine kurzlebige,
ignorierte Ausführungskonfiguration änderte Setup-Pfade, Snapshot-Suffixe und
den expliziten Modus zum Erzeugen beziehungsweise Prüfen von Referenzen; die produktive Playwright-Konfiguration bleibt bestehen.
Nach der Fixture-Präzisierung bestanden die vier Referenzfälle jeweils auf
macOS und Linux (je 5 Tests einschließlich Setup). Der abschließende
Linux-Prüflauf bestand erneut mit `updateSnapshots: 'none'` (5 Tests);
zuvor bestanden dort auch alle vier Button-Matrizen ohne Snapshot-Updates.
Temporäre Testkonfigurationen und der Container werden nach den Prüfungen
entfernt. Das ist Browser-/Rendering-Evidenz und kein vollständiger
Linux-Buildnachweis.

Code-/Performance-, UX-/i18n-/Journey- und Test-/Dokumentationsreview wurden
zusammenhängend durchgeführt. Zwei konkrete Befunde wurden im Scope behoben:
Forest-Navigation übernimmt keine blauen Accent-Texte; horizontale Tabs
verwenden Radix-Roving-Focus statt des fehlerhaften eigenen Pfeilhandlers.
Es entstanden dafür keine zusätzlichen Produktionskomponenten oder Kontrollschichten.

### Grenzen der Abnahme

Die vollständige manuelle Prüfung mit Screenreader, Forced Colors, Textabständen,
Zoom, niedriger Fensterhöhe und langen deutschen/englischen Inhalten sowie
die fachliche Produktabnahme bleiben offen (L7). Die späteren Plugins bleiben
vorsortiert (L10). Die Baseline verwendete
synthetische Daten und lokale Route-Fixtures; keine Produktivkonten, echten
Pushzustellungen oder Uploads wurden für diesen Nachweis verwendet.

## 8. Freigegebener Folgeabschnitt: sichere Speicherergebnisse und Wiederaufnahme

Freigabe: Nutzer „Mach das so“, 1. November 2026. Forest wird zurückgestellt;
die Gestaltung ist freigegeben und darf vor Bibliotheksveröffentlichung verwendet
werden. Farben werden semantisch zwischen Figma und Code angeglichen:
Barrierefreiheit hat Vorrang, dekorative Flächen und Linien bleiben dezent.
Produktabnahme und weitere Plugins folgen danach.

Ziel dieses Lieferabschnitts ist der News-Pilot mit eindeutigen Speicherergebnissen
und erhaltener Bearbeitung bei sicherer Kontext-Wiederaufnahme. Zuständige Pfade:
vorhandenes Mutationsjournal in auth-runtime, der bestehende Medienstatusübergang
in data-repositories, News-Fassade, bestehender SDK-HTTP-
und Medienpfad, gemeinsame Save-/Medien-Lifecycles und News-Editor. Die Session-
und Organisationskorrekturen des Resilienz-PR2 sind bereits Vorfahren des
Migrationsstands (74 Commits voraus, kein fehlender Branch-Commit).

Nicht-Ziele: externe Mainserveränderungen, neue Tabellen/Queues/Provider,
automatische Schreibwiederholungen, atomarer Inhaltsversionsschutz und neue
Freigabe-/Publikationsworkflows. Diese bleiben eigenständige nächste Abschnitte.
Keine Entwürfe oder Credentials in localStorage oder Logs schreiben.

| Invariante                                           | Umsetzung und direkter Nachweis                                                                                                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keine zweite Inhaltsmutation nach unklarem Ergebnis  | stabile Operations-/Idempotenzkennung je Versuch; Editor sperrt weitere Saves bis Ergebnisprüfung. HTTP-nahe verlorene Antwort / Timeout / 5xx Tests zählen Content-POST/PATCH-Aufrufe.                                                        |
| Statusprüfung ist rein lesend und geschützt          | vorhandenes Journal nach Instanz, Account, aktiver Organisation und Principal filtern; aktuelle Rechte prüfen. Fremde Kennung/Scope liefert keine Daten; GET erzeugt weder Journal noch Providerwrite.                                         |
| Unklar ist weder Erfolg noch sicherer Fehlschlag     | Erfolgsjournal und explizite Vorab-Ablehnung werden getrennt. Nur nachweislich nicht begonnene Writes erlauben neue Saves; historische unbewiesene Fehler und Idempotenzkonflikte bleiben unklar. Bestätigte Schritte werden monoton erhalten. |
| Bestätigte Medien-/Content-Schritte bleiben erhalten | unbekannter Medien-Save bewahrt aufgelöste lokale Uploads; Recovery synchronisiert ausschließlich Referenzen. Neue Medien und Formeingaben während Save/Prüfung bleiben erhalten.                                                              |
| Wiederaufnahme verleiht keine alten Rechte           | Identität und Kontext erneut prüfen; kein stiller Principalwechsel, keine automatische Mutation. Wiederanmeldung darf den offenen Editor nicht durch einen vollen Seitenwechsel verlieren.                                                     |
| Keine falsche Saved-Anzeige und kein Draftverlust    | spät bestätigtes Ergebnis bestätigt ausschließlich die alte Operation und aktualisiert geladene Metadaten; der aktuelle Formularentwurf wird nicht zurückgesetzt. Gezielte Revision-/Form-/Medientests sichern diesen Übergang.                |

Die Scope-Erweiterung wird zusätzlich im vorhandenen Resilienz-Change im
zuständigen Integrationsvertrag erfasst; es entsteht kein zweites Fehler- oder
Retry-Framework. Nachweis: kleine Unit-/Typgates pro Block, frühes Server-Runtime-
Gate, geschützte Statusroute einschließlich Negativfällen, News-Create/Edit,
verlorene Antworten, partieller Save, Medienreferenz-Retry und Wiederaufnahme.

### Technischer Zuschnitt und verbleibende Grenzen

Der Journal-Lesepfad ist `GET /api/v1/mainserver/news/operations/:operationId`.
Er verwendet bestehende Tenant-RLS sowie zusätzliche Account-, Organisations-
und Principal-Prädikate einschließlich konkreter Principal-ID. Er reserviert
keine Idempotenz und erzeugt weder Journal noch Mainserver-Aufruf. Die Antwort
enthält nur Kennung, Ergebnis und bei Erfolg die Inhalts-ID, keine Preimages,
Credentials oder internen Diagnosefelder. Die aktuelle ursprüngliche
Schreibberechtigung wird vor Offenlegung geprüft; der anschließende Detailread
prüft unabhängig die Ressourcenrechte. Ein fehlender Eintrag ist kein Beweis
für eine unterbliebene Mutation.

`X-SVA-Mutation-Outcome: not_applied` bestätigt ausschließlich einen Fehler vor
Beginn des News-Providerwrites. Derselbe bestehende Header kennzeichnet auch
lokale Eingabe-, CSRF- und Kontextprüfungen sowie vorgelagerte lokale
Autorisierungsablehnungen der übrigen gemeinsamen Medien-Save-Verbraucher
(Events, POI, Generic Items/Kacheln und Projects). Die Kennzeichnung erfolgt
an der geprüften Host-Ablehnung; beliebige 4xx- oder Providerfehler sind kein
Bereinigungsnachweis. Nach begonnenem Write, bei Idempotenzkonflikt,
Transportverlust oder fehlender Evidenz bleibt das Ergebnis unbekannt. Die SDK
kennzeichnet auch einen gescheiterten Context-Binding-GET vor dem PATCH als
nicht begonnen. Ein neuer Save nach bestätigter Ablehnung erhält eine neue
Kennung; die Statusprüfung führt keinen ursprünglichen Write erneut aus.
Die Kennung ist Korrelation und bei Create der vorhandene Idempotenzschlüssel,
keine neue globale Exactly-once-Garantie für Mainserver-Mutationen.

Unklare lokale Uploads behalten ihre Auflösungen und die Medienoperation.
Nach bestätigtem Content-Erfolg läuft nur der vorhandene Referenzabschluss;
der bestehende atomare Medienübergang akzeptiert dafür auch
`outcome_unknown`/`reconciliation_required` unter unveränderter Instanz-, Actor-
und Zielbindung. Begonnene oder abgeschlossene Bereinigungen sind ausgeschlossen;
`committed` bleibt beim erneuten Bestätigen erhalten, sodass ein Referenz-Retry
keine inzwischen neueren Referenzen über den alten Vorgang ersetzt;
ein fehlgeschlagener Abschluss bleibt mit dem bisherigen Referenz-Retry
wiederholbar. Abgeschlossene Inhaltsmutationen werden dabei nicht wiederholt.
Spätere Formular- und Medienänderungen bleiben im aktuellen Entwurf erhalten.
Eine sichere vorgelagerte Ablehnung mit noch ausstehender Uploadbereinigung
wiederholt ausschließlich die Bereinigung, bevor ein neuer Save möglich ist.

Die bestehende Host-Leave-Boundary schützt jetzt auch Plugin-Detaileditoren.
Ein interner abbrechbarer Auth-Navigationshinweis erlaubt ihr, das Dokument
mit ungespeicherten Eingaben zu behalten. Die Authentifizierung wird dabei
weiterhin verworfen; frühere Rechte werden nicht als gültig behandelt. Die
Wiederaufnahme prüft ausdrücklich Session und Kontext einschließlich des
abschließend publizierten Organisationsstands. Lade-/Fehlerzustände der
Ressourcen-Principal-Boundary deaktivieren ein bereits gemountetes Formular,
statt dessen State zu zerstören. Die vorhandene Leave-Guard-Providergrenze gibt die Editorsperre an gemeinsame Dialoge weiter. Dort pausiert React `Activity` die Portal-/Fokuseffekte und bewahrt lokalen Dialogzustand. Der Formular-Owner bleibt durchgehend aktiv; seine Ladeeffekte werden nicht als Mittel zum Verstecken neu gestartet. Noch nicht übernommene Bildeditor-Entwürfe werden beim Pausieren lokal gehalten und nach erneutem autorisiertem Quellenlesen wiederhergestellt. Die bisherige Anmeldung bleibt außerhalb
eines geschützten Entwurfs unverändert. Browserneuladen oder Schließen wird
vom nativen Leave-Guard gewarnt, aber nicht durch eine neue Draft-Persistenz
abgefangen. Andere Plugins erhalten damit keine vollständige fachliche
Migration oder Abnahme; ihre direkte Host-Einbindung wird mitgeprüft.

Hinzugefügt wird ausschließlich `news.detail-page-recovery.ts` als lokaler
Verbraucher des vorhandenen News-, Journal- und Medienvertrags. Keine neue
Tabelle, Provider-, Queue-, Factory- oder Retry-Infrastruktur. Der vorhandene
`StudioEditorLeaveGuardProvider` erhält die additive Option `suspended`; Dialog
und AlertDialog sind die unmittelbaren internen Verbraucher. Bestehende
Speicher-, Autorisierungs- und Medienpfade werden erweitert; es gibt keinen
parallelen Content-Schreibpfad.

### Geplante Konflikt- und Veröffentlichungsabschnitte

Konkurrierende Bearbeitung benötigt einen atomaren Vergleich der geladenen
Revision direkt am tatsächlichen Mainserver-Writer. Ein abweichender Stand
muss ohne Teilwrite zurückgewiesen werden; Studio bewahrt den lokalen Entwurf
und bietet Vergleich sowie ausdrückliches Neuladen/erneutes Speichern. Ein
vorangestellter Frontend-GET ist kein atomarer Schutz. Der konkrete bestehende
Versionsvertrag wird vor diesem Folgeabschnitt geprüft; automatisches
Rich-Text-Merge bleibt ausgeschlossen.

Entwurf, sofortige Veröffentlichung und Terminierung bleiben unverändert.
Revisionsgebundene Vorschau, neue Freigaberollen und Zurücknahme werden erst als
eigener Produktabschnitt mit ihrem tatsächlichen Backendvertrag konkretisiert.
Die Designmigration ergänzt dafür keine scheinbar fertigen Aktionen.

### Nachweise dieses Folgeabschnitts (1. November 2026)

Die gezielten Unit-Läufe dieses Abschnitts enthalten 341 bestandene Tests in
17 einzeln gefilterten Dateien. Diese Zahl ersetzt keine Vollsuite und wird
nicht zu den teilweise überlappenden Baseline-Zahlen aus Abschnitt 7 addiert:

| Bereich                              | Geprüfte Dateien / bestandene Tests                                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Privater Status und Ergebnisvertrag  | Journal 11, News-Route 50, SDK-Request 16, SDK-Client 17                                      |
| News und Medienabschluss             | News-API 12, News-Detail 25, News-Pages 42, SDK-Medienpersistenz 10, Medien-Repository 38     |
| Erhaltene Dialog- und Medienentwürfe | Leave-Guard/Portale 8, Medienreferenz-Sync 3, Picker-Overlay 22, Review-Panel 8, Bildeditor 7 |
| Session und Host-Einbindung          | AuthProvider 26, Leave-Boundary 11, Route-Bindings 35                                         |

Die negativen Fälle umfassen fremde Account-/Organisations-/Principalbindungen,
fehlende Schreibrechte, Idempotenzkonflikte, vorab abgelehnte Requests,
Transportverlust und partiell erfolgreiche Providerwrites. Ein technischer
GraphQL-Fehler ohne sicheren Vorabnachweis bleibt im Editor unbekannt; rohe
Upstreamdetails werden nicht angezeigt. Der Medien-SQL-Vertrag prüft erlaubte
Ausgangszustände, unveränderte Bindungsprädikate, ausgeschlossene Bereinigungen
und den monotonen Zustand `committed`.

Browsernachweise verwenden synthetische Auth-/API-Antworten im bestehenden
lokalen Playwright-Pfad. Elf Fälle des funktionalen News-Laufs bestanden,
einschließlich Setup, Kontextverlust, verlorener Create-Antwort, Publikation,
Löschen, lokalem Medienlebenszyklus, Tab-Tastaturbedienung und automatisierter
Accessibility-Prüfung. Die zwei Wiederaufnahmefälle wurden anschließend mit
korrigierter Medienrechte-Fixture und dem tatsächlich vorhandenen Dialog
separat geprüft: Create/Edit behalten den offenen Dialog, sperren ihn während
der Wiederanmeldung und führen beim ausdrücklichen Wiederaufnehmen keinen
Contentwrite aus. Der Create-Fall hat dabei noch keinen Titelentwurf und
prüft den Schutz durch den geöffneten Medienbereich selbst. Eingabewerte und
Bildeditorzustand innerhalb pausierter Portale sind zusätzlich in den
gezielten Shared-Tests abgesichert.

Die lokalen Typ-, Lint-, Server-Runtime-, i18n-, OpenSpec-, Dokumentations- und
Dateiplatzierungsprüfungen sind Teil des Abschlusses. Es wurden keine
Snapshots dieses Folgeabschnitts pauschal aktualisiert und keine neue
Testinfrastruktur angelegt.

Verbleibende Grenzen: kein echter OIDC-Login im Zweittab, keine vollständige
manuelle Screenreader-/Forced-Colors-Abnahme und kein PostgreSQL-Roundtrip des
Medienübergangs in diesem Lauf. Der Browserfall prüft den internen
Navigationshinweis und die explizite Session-/Kontextprüfung mit Testantworten.
Ein nicht beweisbarer Mainserver-Ausgang bleibt gesperrt; fehlende Journale
werden nicht als sichere Ablehnung behandelt. L12 bleibt bei geschützter
Medienbereinigung offen. Kontrastabgleich mit Figma (L11), atomare
Inhaltsversionen und fachliche Abnahme bleiben gesonderte Folgeschritte.

Oberflächenbilanz: eine lokale Recovery-Datei hinzugefügt, bestehende
Status-, HTTP-, Medien-, Dialog- und Hostgrenzen erweitert; keine zusätzliche
Tabelle, Provider- oder Retry-Schicht und kein paralleler Contentwrite. Die
im ersten UI-Slice entfernten drei lokalen Card-/Tab-Dateien bleiben entfernt.
Kein Merge und kein Rollout wurden ausgeführt.

## 9. Restliche Plugins — freigegebene Designmigration

Auftrag vom 1. November 2026: die restlichen Plugins jetzt umstellen, danach
visuelle/fachliche Abnahme. Ziel ist die Anwendung der vorhandenen freigegebenen
Tokens und Shared-UI auf alle registrierten Pluginoberflächen mit Entfernung
ersetzter lokaler Basisimplementierungen. Maximaler Scope: Plugin-React-UI,
konkret benötigte bestehende Shared-UI, zugehörige Tests und aktuelle Dokumentation.
Nicht-Ziele: neue Backend-/Speicherverträge, Fachregeln, Rechte, Funktionen,
Host-Adminmigration, Forest-Reaktivierung, Merge oder Rollout.

Die XERJ-Referenzsuche bestätigt Shared-Tabs und die realen Verbraucher Generic
Items/FAQ. Der Index zeigt Revision `60059753`, deshalb sind die aktuellen
Dateien im Worktree maßgeblich. Payloads Tabs-Referenz ist kein passender
Lifecycle-Ersatz; es wird kein Fremdcode übernommen. Figma-Tab `115:5079`
wurde erneut als Designkontext samt Screenshot gelesen. Die vorhandenen
Shared-Tabs und -Cards bleiben die zuständigen Implementierungen.

Lieferfolge: Events/POI/Projects, Generic Items/FAQ/Kacheln, Surveys/Vouchers,
Waste einschließlich Kalender/Stammdaten/Importe, Kategorien/Katalog/SSF.
Assistant/Search/Notifications haben keine eigene Fachoberfläche; Cockpit ist
ein externer Link. Pro Block gelten bestehende Formular-Owner, stabile Keys,
Tab- und Medienzustände, Aktionen, Ressourcenrechte und Payloads als
Erhaltungsinvarianten. Fehlerfokus, mobile Auswahl und Tastaturbedienung werden
in vorhandenen Tests geprüft. Lokale Fachadapter bleiben bestehen.

### Tatsächliche Komponenten-Zuordnung des Folgeabschnitts

| Plugins / Oberflächen                        | Gemeinsame Umsetzung und erhaltener fachlicher Umfang                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Events und POI                               | Kontrollierte `StudioDetailTabs` mit `keepMounted`/Intent-Vorladung statt eigener Navigation und Visit-Verwaltung; Create bleibt ein durchgehendes Formular. Kategorien, Medien, Termine/Wiederholung, Standort/Karte, Betreiber/Veranstalter, Kontakt/Links/Preise, Veröffentlichung, Historie und Delete bleiben erhalten. POIs berechtigungsgefilterter Gutscheinlink bleibt als Panelaktion erreichbar.                       |
| Projects, Generic Items, FAQ, Kacheln        | Bereits zentrale Tabs, Cards, Medien und Seitenvorlagen weiterverwenden; lokale Titel-/Principal-/Repeater-/Metadatenflächen an die gemeinsame Geometrie anpassen. Projektbilder/Reihenfolge, generische Fachfelder, FAQ-Sprache/Sortierung und Kachelverknüpfungen bleiben beim jeweiligen Formular-Owner. Generic Items behalten ihren fachlichen `details`-Adapter mit Fehleröffnung.                                          |
| Surveys und Vouchers                         | Survey-Card-Reexport entfernen und Ergebnisse, Zusammenfassung sowie Exportabschnitte mit `StudioDetailCard` komponieren; Fragen/Optionen, Moderation, Freitext, Ergebnisdaten und Exportaktionen bleiben fachlich. Gutschein-Principalauswahl und Nutzungsanzeige behalten Sperren, Kontingente, gemischte Rabatte, Medien, Verlauf und Abgleichaktionen.                                                                        |
| Waste                                        | Zentrale Tabs, Flächen, Controls und Lucide-Motive auf Fraktionen/Touren/Standorte/Stammdaten/Planung/Ausgabe/Datentools/Einstellungen anwenden. Panelaktions-Context bleibt lokal, ebenso URL-Filter, seitenübergreifende Auswahl, Tourenstatus/-gültigkeit, Jahresübernahme, Kalender, Verschiebungen, Zuordnungen, Import/Export und E-Mail-Erinnerungen. Dynamische Fraktionsfarben und Fortschrittswerte bleiben Datenwerte. |
| Kategorien                                   | Vorhandene gemeinsame Tabelle, Fields, Dialoge und Bestätigung übernehmen die zentralen Foundations bereits. Hierarchie, Datentypen, Positionsvalidierung, Rechte und Kaskadenbestätigung werden im bestehenden Seitentest abgesichert; keine zusätzliche lokale Darstellung hinzufügen.                                                                                                                                          |
| App-Übersetzungen und SSF                    | Katalog-/Entwurfs-/Versionsflächen, Warnungen und Editoroberflächen auf semantische Rollen ausrichten; SSF-Retryaktionen verwenden Shared Button. SSFs Sprach-/Versions-Tabs konsumieren das gemeinsame Tab-Control mit 44-px-Ziel. Übersetzungs-/Import-/Freigabeoperationen, Vererbung, Mandanten-/Systemtrennung und Rechtstexte bleiben in bestehenden Zuständigkeiten.                                                       |
| Assistant, Search, Notifications und Cockpit | Header-Präsentationen verwenden die gemeinsamen Input-/Buttonrollen. Keine neue Fachroute hinzufügen; Assistant/Search/Notifications registrieren weiter leere Routen, Cockpit bleibt der externe Link.                                                                                                                                                                                                                           |

Die Shared-Tabs akzeptieren im bereits bestehenden `title: ReactNode` ein
explizites `null`, damit Waste seinen Context-gebundenen Panelkopf selbst
komponiert. Es gibt genau eine zentrale Panel-Fläche und keine doppelte
Überschrift. Fünf tatsächlich benötigte Lucide-Motive ergänzen den vorhandenen
Icon-Satz. Basis-Tabs übernehmen 44 px als Zielgröße. Gemeinsame Sections nutzen
die 16-px-Abschnittsüberschrift; Edit-Surfaces verwenden die dekorative Kontur
und 16/24 px Innenabstand ohne eigene Schattenpflicht.

`StudioSwitch` ist der einzige neue Produktbaustein dieses Abschnitts: ein
nativer Button mit Switch-Semantik, kontrolliertem Zustand, Ref, 44-px-Ziel und
Fokus-/Disabled-Stilen. Er ersetzt den lokalen Waste-Form-Switch und den zweiten
Switch in der Fraktionstabelle. Seine Figma-Referenz `23:32739` wurde samt
Screenshot und Zustandsbeschreibung geprüft; zugängliche Namen bleiben beim
Umschalten stabil. Keine zusätzliche Form-State-, Provider- oder Factory-Schicht.
Die bestehenden Speicherwirkungen der Aufrufer bleiben maßgeblich.

Statische Waste-Icons beziehen Lucide direkt aus der bereits im Workspace
verwendeten Bibliothek. `@tabler/icons-react` entfällt aus diesem Plugin; der
Lockfile-Change betrifft ausschließlich dessen Dependency-Zuordnung. Die
allgemeinen Pluginregistrierungen und dynamischen Inhaltswerte bleiben erhalten.

Die Importauswahl und Wizard-Navigation verwenden zentrale Buttons. Textinhalte
innerhalb der Auswahlbuttons sind semantisch als Text-/Span-Inhalt komponiert;
kein Block-Heading oder zusätzlicher interaktiver Baustein liegt im Button.
Checkbox und Select in Erinnerungsausgabe/Jahresübernahme sind die bestehenden
nativen Shared-Controls. Es entsteht kein alternativer Formularpfad.

### Prüf- und Abnahmestand

Gezielte Unit-Dateien prüfen Events-/POI-Create/Edit, erhaltene Eingaben und
Medien, Projekte, Generic Items, FAQ, Kacheln, Surveys, Gutscheine, Kategorien,
SSF und Katalog. Die Test-Leave-Guard-Registrierung berücksichtigt jetzt mehrere
registrierte Schutzbereiche wie der Host; ein offener Mediendialog ist bereits
vor der Übernahme geschützt. Veraltete Vollmocks wurden in den betroffenen
Waste-Tests durch Teilmocks mit echten neuen Shared-Bausteinen ersetzt.

Der erste Waste-Projektlauf sammelte 561 Tests in 101 Dateien (97 grüne Dateien,
7 rote Assertions und eine durch den entfernten Switch-Pfad blockierte Datei).
Die betroffenen UI-Dateien wurden danach gezielt grün nachgeprüft:
Fraktionsinhalt 5/5, Abholort-Dialoge 4/4, Seite 22/22 und die zuvor durch den
Switch-Import blockierten Low-Coverage-Views 12/12 Tests. Diese späteren
Dateiläufe klären die ursprünglichen roten Pfade; daraus wird kein zweiter
breiter Projektlauf oder pauschales grünes Gesamtetikett abgeleitet. Der alte
Adresswechsel-Test protokolliert außerdem fehlende Setter seiner Test-State-
Fixture; dieser unveränderte fachliche Testpfad wurde nicht als Produktfix in
die Designmigration aufgenommen.

Browserprüfungen erweitern die bestehende Matrix aller neun Inhaltseditoren
auf Light/Dark und 320, 390, 768, 1024, 1280 sowie 1728 px. Bestehende CRUD-Pfade
für Events/POI/Projects/FAQ/Kacheln und Waste werden weiterverwendet. Waste-
Einstellungen und ausgewählte Touren erhalten zusätzliche responsive Aufnahmen
und Axe-Prüfungen. Die mobilen Tabellen-Fußaktionen brechen um. Der
Touren-Scrollcontainer bildet einen eigenen Positionierungsbezug; unsichtbare
Sortierhinweise können dadurch die Seite nicht verbreitern. Der Sortierzustand
liegt semantisch als `aria-sort` am Spaltenkopf statt als unübersetzter Text im
Button. Referenzen werden als Testartefakte geprüft; keine Snapshot-
Toleranz wird erhöht und keine parallele Testinfrastruktur angelegt.

Ausgeführte lokale Nachweise dieses Folgeabschnitts:

- Typprüfungen und Builds für 15 Pluginprojekte samt vorhandenen Abhängigkeiten;
  abschließender Host-Typecheck mit synchronisierten Workspace-Paketen.
- Alle zwölf verfügbaren betroffenen Lint-Targets sowie der bestehende
  i18n-Check; die vier übrigen Pluginprojekte besitzen kein eigenes Lint-Target.
- Shared-Tabs 24, Shared-Primitives einschließlich Switch 52 und Surfaces 2
  Tests; gezielte Plugin-Seitentests für alle migrierten fachlichen Editoren.
  Survey-Ergebnisse zusätzlich 5 Tests. Die abschließende Touren-/ARIA-Prüfung
  umfasst 7 Content- und 11 Header-/Interaktionstests.
- 18 unterschiedliche Browserfälle plus Setup über den Hauptlauf und gezielte
  Nachläufe: CRUD/Medien, Rechte, unveröffentlichte Formularentwürfe, Übersicht,
  responsive Darstellung und automatisierte Accessibility. Die zwei zunächst
  roten Fälle sind abschließend grün: Kacheln warten auf Rechte-/Shell-Readiness;
  die Tourentabelle begrenzt absolute Inhalte auf den lokalen Scrollbereich.
- 120 Aufnahmen der neun Inhaltseditoren einschließlich ausgeklappter Survey-
  Bereiche, je zwölf Waste-Einstellungs- und Tourenauswahl-Aufnahmen. Light/Dark
  und sechs Breiten sind erfasst; repräsentative mobile und Desktop-Aufnahmen
  wurden sichtbar geprüft. Das ersetzt keine vollständige manuelle Abnahme.

Die Unit-Zahlen werden wegen überlappender Läufe nicht zu einer Vollsuite
addiert. Für SSF bestanden alle 15 Content-v2-Tests im isolierten Nachlauf;
vorherige Timeout-Signale unter paralleler Buildlast führten zu keiner
Produktänderung oder erhöhten Unit-Timeouts. Testartefakte bleiben lokal; es
wurden keine neuen versionsgebundenen Snapshot-Baselines angelegt.

Oberflächenbilanz dieses Abschnitts: `studio-switch.tsx` hinzugefügt;
`events.detail-card.tsx`, `surveys.detail-card.tsx` und
`waste-management.form-switch.tsx` entfernt. Eigene Events-SVGs, drei lokale
Tab-Navigationen und technische Visit-/Mount-Verwaltungen entfallen. Fachliche
Abschnittsadapter, bestehende Aktionen und stabile Formular-Owner bleiben.
Aktuelle UI-Standards und arc42 werden im selben Pfad fortgeschrieben.

Produktabnahme, vollständige manuelle Barrierefreiheitsprüfung (L7/L13), finaler
Figma-/Code-Kontrastabgleich (L11) und Host-/Adminmigration bleiben getrennte
Folgeschritte. Forest wird weiterhin nicht reaktiviert. Keine Bereitstellung,
kein Merge und keine Änderung der Figma-Datei sind Teil dieses Abschnitts.

## 10. Verbliebene Elemente und Hostflächen — Fortsetzung

Der Nutzer hat die Fortsetzung nach dem Elementaudit freigegeben. Ziel dieses
Abschnitts sind die verbleibenden Waste-Auswahl-/Kalenderbausteine und die
visuellen Restpfade in Host, Admin, Konto und Medienverwaltung. Backend,
Fachregeln, Rechte und Speicherabläufe bleiben außerhalb des Abschnitts.

Die vorhandene Host-Suchauswahl wird mit ihren bestehenden Tests nach
`@sva/studio-ui-react` verschoben: unmittelbare Verbraucher sind Host-
Organisations-/Instanzauswahl und Waste-Terminzuordnung. Der bisherige lokale
Waste-Comboboxpfad einschließlich Such-/Öffnungs-State entfällt; die vorhandenen
Host-Importpfade bleiben kompatible Reexports. Es entsteht keine zweite
Suchimplementierung. Die vorhandene Radix-Popover-Abhängigkeit positioniert die
Auswahlliste außerhalb abschneidender Tabellen-/Dialogflächen; Escape wird am Radix-Popover behandelt; die Auswahlliste schließt mit Fokus
auf dem ursprünglichen Button. Tab führt aus der Suche in das nächste Formularfeld;
Shift+Tab kehrt zum Button zurück. Die optionale Löschaktion bleibt per Tab erreichbar. Die Termintabelle erhält einen fokussier-
baren lokalen Scrollbereich und das zuständige Grid-Feld `min-width: 0`, damit
320 px keine Bedienelemente abschneiden oder die gesamte Seite verbreitern.
Der Gegenbeispieltest für Suche innerhalb eines Dialogs deckte getrennte Radix-
FocusScope-/DismissableLayer-Instanzen auf: Dialog/AlertDialog 1.1.15 und Popover
1.1.23. Host und gemeinsame UI verwenden deshalb dieselbe kompatible Patch-
Generation 1.1.23. Die vorhandenen React-Komponenten bleiben die Verbraucher;
es entsteht weder eine zweite Fokusverwaltung noch ein zusätzlicher Provider.
Zu prüfen sind Escape, Fokus nach Auswahl/Schließen, Tab nach außen, Kalender-
Popover, bestehende Dialoge und destruktive Bestätigungen. Die bestehende zentrale Calendar-Komponente übernimmt
Datumsgitter, Tastatur und Auswahl; mehrjährige Entwürfe und fachliche
Löschbestätigungen bleiben beim Waste-Formular.

Figma `113:700`, `147:3558` und `148:3546` wurden erneut samt Screenshot gelesen.
Die XERJ-Suche zeigt den vorhandenen Host-Select und Calendar-Pfad, allerdings
mit älterem Indexstand `60059753`; die aktuellen Quellen sind maßgeblich.
Payloads Command-Palette ist nur Referenz, es wird kein Fremdcode übernommen.
Das lokale Waste-Erstellenmenü enthält genau eine Aktion; ein direkter Shared-
Button erhält diese Aktion und entfernt das unvollständige Menü statt einer
neuen Popup-Infrastruktur.

### Neue Lücken und präzisierte Entscheidungen für Figma

Die folgende Liste trennt fehlende Gestaltung von noch ausstehender Code-
Umsetzung. Vorhandene Figma-Vorgaben werden nicht als Designlücke bezeichnet.
Figma selbst wird in diesem Abschnitt nicht verändert.

| ID / Art / Priorität                             | Funktion und Istverhalten                                                                                                                                                                                   | Fehlende Festlegung und Zustände                                                                                                                                                                                                     | Code-/Figma-Bezug                                                                                                                                                                                                                   | Übergang                                                                                                                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L14 Figma-Ergänzung, P2                          | Optionale Abholort-Zuordnung kann wieder geleert werden; auch eine Suche ohne Treffer darf das nicht verhindern.                                                                                            | Sichtbare Löschaktion einer optionalen Suchauswahl: leer/befüllt, Suchtext, keine Treffer, Fokus und Disabled. Die gezeigten SearchableSelect-Varianten enthalten keine explizite Löschaktion.                                       | `searchable-select.tsx` (`clearLabel`), `waste-management.tours-custom-dates.location-picker.tsx`; Figma `147:3558`.                                                                                                                | Bestehender Shared Button im Suchpanel; Name bleibt eindeutig und Fokus kehrt zum Auslöser zurück. Keine fachliche Pflichtregel ändern.                                                                                                              |
| L15 technisch umgesetzt, Produktentscheidung getroffen | Der Einzeltermin-Dialog ändert ausgewählte Tage sofort im übergeordneten Tourenentwurf; dauerhaft gespeichert wird separat. | Nutzerentscheidung vom 1. November 2026: Eine Aktion ohne Rücknahme bereits erfolgter Änderungen muss „Schließen“ heißen. Der bisherige „Abbrechen“-Button wird entsprechend umbenannt; keine rücksetzende Dialogkopie. | `waste-management.tours-custom-dates.calendar.tsx`, `waste-management.tours-custom-dates.tsx`; Figma-Ablauf `193:18269`, Briefing Abschnitt 4. | Figma, Dokumentation und Codebeschriftung sind angepasst; die gezielten Tests der Einzelterminauswahl bestehen. Bestehende Entwurfswirkung, Verlustbestätigungen und separaten Speicherweg erhalten. Behalten verwirft nur eine unbestätigte Entfernung; Schließen setzt bereits erfolgte Änderungen nicht zurück. |
| L16 Codeabweichung, P2                           | `StudioActionMenu` ist öffentlich weiterhin eine Button-Gruppe und erlaubt freie `render`-Inhalte.                                                                                                          | Figma entwirft ein echtes Popup-Menü mit Trigger, Navigation und Fokusübergabe. Der alte öffentliche Vertrag enthält keinen Triggernamen.                                                                                            | `studio-surfaces-actions.tsx`; Figma `148:3546` benennt den Unterschied ausdrücklich.                                                                                                                                               | Aktionsgruppen erhalten. Ein einzelner Waste-Erstellenbefehl wird als direkter Button gezeigt; keine neue Popup-/Provider-Schicht und kein Verlust von freien Aktionen. Mehrere Popup-Aktionen erst mit konkreten Verbrauchern kompatibel migrieren. |
| L17 Figma-Abgleich offen, P2                     | QR-Codes haben einen weißen Inhaltscanvas; übrige Medienflächen folgen den semantischen Hell-/Dunkelrollen.                                                                                                 | Rolle und Abgrenzung von Papier-/QR-Inhalt gegenüber Appfläche im Dark-Modus, Transparenz und fehlender Vorschau bestätigen. Ein weißer Bildinhalt darf nicht automatisch zur dunklen Appfläche umgefärbt werden.                    | `-media-detail-workspace-header.tsx`, `-media-asset-card.tsx`; Figma Card `56:942`, Medienmuster `115:4451`.                                                                                                                        | Weiß im QR-Inhalt erhalten, umgebende Flächen und Zustandsmeldungen auf Tokens umstellen. Dies ist ein offener Abgleich, kein behaupteter Nachweis einer fehlenden Figma-Komponente.                                                                 |
| L18 Nutzerentscheidung, abgeschlossen          | Der Fax-Dialog ist ein funktionsloses Easteregg. Der Nutzer hat am 1. November 2026 ausdrücklich entschieden, ihn exakt wie bisher zu erhalten. | Kein offener Gestaltungsauftrag; Optik, Abmessungen, Animationen, Statusmeldungen und Schließwege bleiben unverändert. | Host `-account-privacy-access-fax-easter-egg-dialog.tsx`; Entscheidung im Figma-Briefing, Abschnitt 7. | Von der Designmigration ausgenommen. Die vorgeschlagene Neugestaltung und eigens dafür angelegte Figma-Bausteine sind zurückgenommen; keine Codeänderung oder neue Fax-Funktion. |
| L19 technisch umgesetzt, Abnahme offen, P2 | Status und nachweisbare Ursachen im bestehenden Jahreskalender anzeigen; vorhandene Termine und Verschiebungen erhalten. | Laden, Fehler, keine berechneten Treffer, nachweislich außerhalb der Gültigkeit sowie unbekannte/eingeschränkte Berechenbarkeit unterscheiden. Keine sichere Terminfreiheit aus einem leeren Array ableiten. | `waste-management.tours-year-calendar.tsx`, `waste-management.tours.presentation.calendar.ts`; Figma `193:18269`; [Entwicklungsbriefing L19](../../../docs/development/abfallkalender-status-entwicklungsbriefing.md). | Bestehende Berechnung lokal um Statusinformationen ergänzen, konkrete Ursachen nur bei belastbarem Nachweis. Briefing mit Akzeptanzfällen und lokalem Umsetzungsnachweis vorhanden; Berechnung, Ladepfad und Anzeige sind umgesetzt und gezielt geprüft. Vollständige manuelle und fachliche Abnahme bleiben offen. Keine neuen Fachregeln oder Backendverträge. |
| L20 Fachlicher Gestaltungsabgleich offen, P2     | Einzeltermine enthalten Kommentare und mehrere Abholort-Zuordnungen. Die Tabelle bleibt auf 320 px lokal horizontal scrollbar; alle Aktionen sind erhalten.                                                 | Kompakte Bearbeitungsdarstellung einschließlich geöffneter Zuordnungen, Suche, Leeren, Duplikatfehler und Löschen. Die gelesene mobile YearCalendar-Referenz beschreibt die Jahresübersicht und klärt diese Eingabeoberfläche nicht. | `waste-management.tours-custom-dates.table.tsx`, `waste-management.tours-custom-dates.assignment-card.tsx`; Figma `113:700`, `147:3558`, `141:4205`.                                                                                | Vorhandene Tabelle mit per Tastatur erreichbarem Scrollbereich und nicht abgeschnittener gemeinsamer Suchauswahl verwenden; keine Fachaktion für schmale Ansichten ausblenden.                                                                       |

L13 wird durch die gemeinsame Suchauswahl und das Entfernen des Ein-Aktions-
Menüs im Code adressiert. Der vollständige manuelle Accessibility-Nachweis aus
L7 bleibt eigenständig offen. Der Jahreskalender ist inzwischen entsprechend
Figma `141:4205` als mobile Terminliste umgesetzt; diese Vorgabe war eine
Codeabweichung, keine fehlende Gestaltung.

### Tatsächliche Zuständigkeit und Nachweisgrenzen

| Bereich                       | Konkret geändert                                                                                                                                                                                                             | Erhalten                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Gemeinsame Controls           | Vorhandene Card-Basis und Suchauswahl aus dem Host verschoben, nativer Radio ergänzt, Input/Select 44 px, Calendar 44 px Höhe und kompakte 36-px-Breite. Lucide-Navigation, deaktivierte Auswahl schließt ohne Wertänderung. | Bestehende Props und App-Importpfade; native Namen, Werte, Formzuordnung und Disabled.                 |
| News und Host-Formulare       | Publication-Radios sowie Instanz-/Schnittstellenradios verwenden dieselbe Basis; Labeltitel und Beschreibung sind getrennt referenziert, keine Blockelemente im News-/Schnittstellen-Label.                                  | Veröffentlichung, Vorbelegung, Erstellungsmodi, Felder, RHF-Owner und Backend-Payloads.                |
| Waste-Auswahl                 | Gemeinsamer Kalender und Suchauswahl; lokaler Menüpfad und verteilte technische Such-/Öffnungsverwaltung entfernt.                                                                                                           | Mehrjährige Auswahl, Beschreibungen, Abholort-Zuordnung, Leeren, Duplikatprüfung und Löschbestätigung. |
| Waste-Jahresübersicht         | Mobile Monatslisten, breite Gitter, 44-px-Aktionen und eindeutige Beschreibungs-IDs; berechnete Termine und Ursprungsdaten in beiden Darstellungen identisch.                                                                | Bedingte Rechte, vorhandener Link in neuem Tab und fachliche Terminberechnung.                         |
| Host / Admin / Konto / Medien | Gemeinsame Card-/Switch-Basis, semantische Warn-/Erfolgsflächen, zentrale Selects/Checkbox und verbleibende Lucide-Motive.                                                                                                   | Rechtefilter, Speichern, Statuswechsel, Profil-/Instanz-/Medienaktionen und weißer QR-Inhalt.          |

Die bisherigen 144 Aufnahmen sind ein Teilnachweis aus Abschnitt 9. Sie werden
nicht als Beweis für jeden Dialog oder jede Kombination ausgegeben. Der jetzige
Browserlauf ergänzt offene Kalender, Suche, Medien und Benutzerliste sowie
aktualisierte Editorreferenzen. Die visuelle Zustandseinrichtung in modalen
Ansichten und offenen Suchlisten ruft den vorhandenen Theme-Handler auf, damit offene Formulare und
Fokus erhalten bleiben; dies ist kein Nachweis der Theme-Bedienung innerhalb
eines Modals. Die Theme-Bedienung selbst bleibt durch die bestehenden Shell-
Tests abgedeckt. Offene Suchlisten werden als tatsächlicher sichtbarer Ausschnitt
aufgenommen; Kalender und Seiten verwenden die vorhandenen Referenzpfade.

Alle Änderungen dieses Abschnitts bleiben in React-UI, Übersetzungen, Tests
und Dokumentation. Es werden weder neue HTTP-/Backend-APIs noch neue Backendwirkungen oder
zusätzliche Dependencies eingeführt. Die vollständige manuelle Abnahme aller
übrigen Hostdialoge wird ausdrücklich nicht als abgeschlossen markiert.

### Technische Nachweise der Fortsetzung (1. November 2026)

Der Nachweis bezieht sich auf den lokalen Arbeitsstand dieses Abschnitts:

- Gemeinsame Suchauswahl: 15 gezielte Tests für Auswahl, kontrollierte Suche,
  Leeren ohne Treffer, Disabled, Fokus, Tab und Escape innerhalb eines echten
  übergeordneten Radix-Dialogs. Shared-Primitives einschließlich nativem Radio:
  53 Tests; DatePicker mit gemeinsamem Kalender: 14 Tests.
- Waste: Einzelterminfeld 5, Jahreskalender 6, Abholort-Werkzeugleiste/Ansicht 8
  und Fraktionsoberfläche 6 Tests. Die Fraktions-Gegenprobe prüft den
  beschrifteten Farbindikator und den davon getrennten Checkboxnamen samt
  unverändertem Auswahl-Payload.
- Host: Card/Hilfe 7, Instanz-/Schnittstellen-Formulare 24, Dialog/Sheet/ModalDialog
  20 Tests und ein zusätzlicher Dialog-Axe-Test. Die vorhandenen gezielten
  Medien-, Konto-, Benutzer-, Rollen-, Organisations- und Schnittstellentests
  wurden ausgeführt. Eine veraltete Grün-Klassenassertion wurde durch die
  semantische Erfolgsrolle ersetzt und unmittelbar gezielt nachgeprüft.
  News-Einstellungen und Formularschutz: 25 Tests. Nach der Medienkorrektur
  bestehen die 27 Create-/Detailtests erneut.
- Builds von gemeinsamer React-UI, News und Waste; abschließender Host-Typecheck
  einschließlich synchronisierter Workspace-Pakete. Gezielte Lint-Targets von
  Shared, News, Waste und Host sowie der bestehende i18n-Check sind grün.

Die Browsermatrix prüft bei 320, 390, 768, 1024, 1280 und 1728 px Seitenbreite,
ungültige Formular-/Control-Verschachtelung und sichtbare Referenzen in Light
und Dark. Bei 1280 px kommen Axe-Prüfungen auf ernste/kritische Befunde hinzu;
bei geöffneter Suche umfasst deren Scope auch das Portal außerhalb von `main`.
Die Portal-Suche muss nach Größenwechseln im sichtbaren Fenster liegen und
hittbar bleiben. Das ersetzt die manuelle Accessibility-Abnahme aus L7 nicht.

Konkret korrigierte Browserbefunde sind der Medien-Badge-Kontrast von 2,18:1
im dunklen Modus, der Seitenüberlauf der Einzeltermintabelle und unzulässig
beschriftete Farbindikatoren. Die Medien-Fixture wartet nun mit dem bestehenden
Helper auf die bestätigte Anmeldung, bevor sie eine geschützte Route öffnet.

Die neun unterschiedlichen ausgewählten Browserfälle sind über Hauptlauf und
gezielte Nachläufe grün: responsive Benutzerverwaltung, neun Inhaltseditoren
in der bestehenden Editor-Matrix, Medien-Upload/Detailaktionen, vier News-
Referenzkombinationen, Jahreskalender mit neuem Verschiebungs-Tab sowie
Einzeltermine/Abholortsuche und der anschließende Turnus-CRUD-Ablauf. Die
Tastatur-Gegenprobe umfasst Auswahl per Leertaste/Pfeiltaste, Ortssuche per
Enter, Tab über die Löschaktion zum Hinweisfeld und Escape mit Fokusrückgabe.

Je 24 News-Referenzen für macOS und Linux wurden sichtbar geprüft und
aktualisiert. Die vier macOS-Referenzfälle bestanden anschließend ohne Updates;
Linux bestand mit `updateSnapshots: 'none'` erneut (5 Tests einschließlich
Setup, keine Bildaktualisierung). Linux-Chromium lief im temporären bestehenden
Playwright-Image `mcr.microsoft.com/playwright:v1.62.1-noble`; die Anwendung und
der Runner liefen auf macOS. Die kurzlebige Konfiguration leitete ausschließlich
Loopback-Verbindungen zum lokalen Testserver weiter. Linux-Bilder wurden nicht
von macOS kopiert und Snapshot-Toleranzen nicht erhöht. Dies ist Rendering-
Evidenz und kein vollständiger Linux-Buildnachweis. Forest bleibt eine
Regressionsreferenz und wird nicht reaktiviert.

Die 320-/1280-px-Ansichten der neuen Kalender, Suchauswahl, Medien und
Benutzerliste sowie die Editor-/Radioansichten wurden visuell kontrolliert.
Vollseitige Bilder fixierter Dialoge/Aktionsleisten können außerhalb des
geprüften Viewports Screenshot-Artefakte zeigen; die geöffnete Suchauswahl wird
daher als tatsächlich sichtbarer Viewport-Ausschnitt geprüft. Lokale Artefakte
und Logs liegen unter `.nx/ui-rest-*`; die Produktions-Playwright-Konfiguration
bleibt unverändert. Temporärer Linux-Container und Ausführungskonfiguration
werden nach der Prüfung entfernt.

Oberflächenbilanz: `card.tsx`, `radio.tsx` und die beiden Suchauswahlmodule
liegen zentral in der React-UI; der bestehende Suchauswahltest ist dorthin
verschoben. Host-Dateien behalten kompatible Reexports. Das lokale Waste-
Ein-Aktions-Menü und seine Datei sowie die verteilte technische Picker-
Öffnungs-/Suchverwaltung sind entfernt. Fachadapter und Datenoperationen
bleiben in ihren bisherigen Pfaden. Es entstehen keine zusätzlichen direkten
Dependencies, globalen Provider, Editor-Factories oder neuen HTTP-Verträge.

Der manuelle Element-/Zustandsabgleich aller übrigen Hostflächen und
Spezialdialoge, Screenreader, Forced Colors, Textabstände/Zoom und die
Produktabnahme bleiben mit Aufgabe 8.8, L7 und L11 offen. Die sieben Einträge
L14–L20 sind Gestaltungsfragen beziehungsweise genau bezeichnete Code-
Abweichungen; sie sind kein pauschaler Befund, dass sieben Figma-Komponenten
fehlen.

Abschlussprüfungen: OpenSpec-Validierung mit `--strict`, Dateiplatzierung,
Dokumentationsprüfung sowie Plugin-UI- und App-Boundaries sind erfolgreich.
Der bestehende Plugin-Architekturguard läuft im Warnmodus und meldet fünf
bereits am Ausgangsstand vorhandene Pfadsignale (`.state.`/`server.ts`) in
App-Translations, SSF und Waste. Die genannten Dateien sind gegenüber HEAD
unverändert; dieser UI-Abschnitt fügt keinen solchen Runtime-Pfad hinzu.

Nachlauf zum gemeldeten Organisationsformular: `space-y-4` am äußeren Formular
erreichte die Felder innerhalb von `fieldset.contents` nicht. Die
Organisationsstammdaten verwenden nun das gemeinsame `StudioFieldGroup`,
einschließlich 16 px Abstand zwischen Typ und Autorenregel auf Mobile. Derselbe
Strukturfehler in Benutzer- und Rechtstextbearbeitung ist am tatsächlichen
Layoutcontainer behoben. Das native Disabled-Verhalten der Fieldsets bleibt
erhalten; ungültiges `aria-readonly` am Formular entfällt.

Die echte Browsermessung deckte zusätzlich eine alte Host-Label-Animation auf,
die Labels dauerhaft um 4 px nach oben verschob. Klasse, Keyframes und die
ungenutzten Aktivierungsregeln sind entfernt. Die Feldabstände werden nun im
bestehenden Account-/Admin-E2E-Pfad bei 320, 390, 768 und 1280 px auf 16 px
(± 0,5 px) geprüft. Zusätzlich bestehen die Light-/Dark-Matrix mit sechs Breiten
und Axe, 70 gezielte Create-/Edit-Tests, deren 64 unmittelbar betroffene
Readonly-/Edit-Tests nach der Semantikkorrektur erneut, ein Label-Axe-Test,
17 Foundation-Tests sowie Typprüfung und Lint. Es handelt sich um einen
Umsetzungsfehler und keine zusätzliche fehlende Figma-Gestaltung.


### PR-Vorbereitung am 1. November 2026

Der Nutzer hat Commit, Branch-Push und Entwurfs-PR nach `main` beauftragt.
Die gesammelte Migration ist in einem integrierten Lieferabschnitt versioniert;
Browser-/Laufzeitartefakte außerhalb der erwarteten Bildreferenzen bleiben lokal.

Vor dem Push bestanden `pnpm check:server-runtime` für 20 Projekte einschließlich
20 Build-Abhängigkeiten (40 erfolgreiche Tasks), die Dokumentations- und
Dateiplatzierungsprüfung, der bestehende Changelog-Katalog sowie die strikte
OpenSpec-Validierung. Die Zusammenführung mit dem zum Prüfzeitpunkt aktuellen
`origin/main` wurde über `git merge-tree` konfliktfrei berechnet; der laufende
lokale Worktree wurde dadurch nicht auf einen anderen Quellstand umgestellt.

Die begrenzten Code-/Security-, Architektur-/Interoperabilitäts-, Assurance-/
Logging-, Dokumentations-/Test- und UI-Fachreviews ergaben keine bestätigten
Blocker für die Entwurfsveröffentlichung. Ein unveränderter Adresswechsel-Test
meldet seine Fälle grün, protokolliert jedoch fehlende Test-State-Setter; dies
ist ein nicht blockierender Testqualitätshinweis und kein belegter Produktfehler.

Diese Nachweise sind keine Merge-Freigabe. GitHub-Gates am endgültigen PR-HEAD,
vollständige manuelle Accessibility-/Sprachprüfung und fachliche Produktabnahme
bleiben vor einer Freigabe gesondert zu beurteilen. Insbesondere ersetzen lokale
Dev-Auth-/Fixture-Browserfälle keinen echten OIDC- oder PostgreSQL-Roundtrip.


### Review-Korrekturen für PR #2034 (1. November 2026)

Der gemeinsame Medien-Save-Vertrag kennzeichnet nachweislich vorgelagerte
Host-Ablehnungen auch für die übrigen Content-Editoren. Request-Validierung,
CSRF, veralteter Kontext und die geprüften lokalen Autorisierungsstellen
liefern `not_applied`; Providerfehler und beliebige 4xx bleiben unbekannt.
Gezielte Server- und SDK-Gegenproben prüfen Bereinigung beziehungsweise Erhalt
der Uploads und den ausbleibenden Provider-Aufruf.

Der Kalender-Browsertest fixiert sein Bezugsjahr. Der A11y-Test der Hilfe
prüft die gemeinsame Radix-Layer-Reihenfolge: Escape schließt zunächst den
autofokussierten Tooltip und anschließend den Dialog mit Fokusrückgabe.
Die Survey-Assertion verwendet den tatsächlichen semantischen Panel-Token.
Die drei SSF-Coverage-Timeouts wurden auf globale Label-Suchen über den großen
Test-DOM zurückgeführt. Sichtbare Labelinteraktion und auf das Label begrenzte
Rollenabfragen erhalten vollständige Fixtures und dieselben Speicher-/Discard-
Assertions. Alle drei Fälle bestehen unter Coverage mit unverändertem
Fünfsekundenlimit (542/332/581 ms im gezielten Lauf).

Die vollständige Complexity-Prüfung über 3.544 Dateien ist lokal grün, ohne
neue Befunde oder Änderungen an Policies und Baselines. Bestehende Funktionen
wurden in ihren zuständigen Dateien beziehungsweise vorhandenen Nachbarpfaden
aufgeteilt. Eine zusätzliche interne Popup-Datei ersetzt den entsprechenden
Code im bisherigen Suchauswahlmodul; die öffentliche API bleibt unverändert.
Die 201 bereits erfassten Befunde werden dadurch nicht als behoben behauptet.

Gezielte Nachweise umfassen News-Detail und -Pages (25/42), SDK-Client und
-Request (17/16), gemeinsame Suche und Medienbausteine (33), POI (148),
Waste-Kalender/-Adressen/-Felder/-Lader sowie Survey-Ergebnisse, Sidebar (53),
Leave-Boundary (11), Principal-Einbindung (6), SSF-Konfiguration (7) und die
Server-/SDK-Medienablehnungen. Wiederholungen und überlappende Läufe werden
nicht zu einer Gesamtzahl addiert. Die App-Typprüfung mit 31 Build-Abhängigkeiten,
die betroffenen Package-Typprüfungen und der Server-Runtime-Guard mit 40 Tasks
sind grün. Dokumentations-, Dateiplatzierungs- und OpenSpec-Prüfung sind grün.
Der lokale Kalender-Browserfall und die Hilfe auf Startseite, Admin-Detail und
Pluginroute sind grün. Die Hilfe prüft Tooltip-/Dialog-Escape und Fokusrückgabe;
die vorhandene serverlesbare Dev-Session wird vor der ersten App-Navigation
aufgebaut. Synthetische Auth-/Fachdaten und fehlende echte IAM-/Fachdatenbanken
begrenzen diese Aussage auf den geprüften UI-Pfad.
Dies bleibt lokaler technischer Nachweis; vollständige fachliche, manuelle
Accessibility- und produktive Integrationsabnahme sind weiterhin getrennt.

Der anschließende CI-Coverage-Lauf bestand sämtliche Tests, meldete jedoch
Regressionsgrenzen für News und gemeinsame UI-Branches. Zusätzliche Tests in
den bestehenden Dateien prüfen unklare beziehungsweise nachweislich nicht
angewendete News-Saves, die zugehörige Medienbereinigung und den Draft-Erhalt
beim Kontextneuladen. Die UI-Gegenproben prüfen abgeschlossene lokale Uploads,
gezielte Preview-Freigabe sowie den Erhalt späterer Ersatz- und
Sortierungsänderungen. Produktcode, Coverage-Grenzen und Baselines bleiben
für diese Korrektur unverändert.
Die Package-Coverage besteht für News mit 233 Tests und für die gemeinsamen
UI-Komponenten mit 322 Tests. News erreicht 94,34 % Lines und 93,83 % Statements;
die UI-Branches erreichen mit 85,99 % wieder die unveränderte Baseline.
