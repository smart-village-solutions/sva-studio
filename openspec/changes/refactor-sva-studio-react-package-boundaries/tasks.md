## 1. Schritt 1: Legal-Text-Sanitizer und Boundary-Fundament

- [x] 1.1 OpenSpec-Deltas für `monorepo-structure`, `ui-layout-shell` und `sva-mainserver-integration` auf die tatsächliche Drei-Schritt-Migration zuschneiden und dokumentieren, welche App-Bereiche bewusst im App-Layer bleiben
- [x] 1.2 die Ziel-Ownership für die aktuell klar belegten Kandidaten festschreiben: `sanitizeLegalTextHtml` nach `@sva/iam-governance`, wiederverwendbare Tabellen-/Listen-UI nach `@sva/studio-ui-react`, Mainserver-Host-Parsing nach `@sva/sva-mainserver/server`
- [x] 1.3 `apps/sva-studio-react/src/lib/legal-text-html.ts` gegen den kanonischen Helper aus `packages/iam-governance/src/legal-text-html.ts` zurückführen und nur dann einen Kompatibilitäts-Wrapper stehen lassen, wenn die Umstellung nicht atomar möglich ist
- [x] 1.4 die direkten App-Consumer des Sanitizers auf die kanonische Ownership umstellen, aktuell mindestens `src/components/RichTextEditor.tsx` und `src/components/LegalTextAcceptanceDialog.tsx`
- [x] 1.5 App- und Package-Tests für Legal-Text-Sanitizing so anpassen, dass die kanonische Implementierung abgesichert ist und das app-lokale Duplikat danach entfernt werden kann

## 2. Schritt 2: Studio-UI aus der App in `@sva/studio-ui-react` zurückführen

- [x] 2.1 das aktuelle Delta zwischen `apps/sva-studio-react/src/components/StudioDataTable.tsx` und `packages/studio-ui-react/src/studio-data-table.tsx` inventarisieren und die fehlenden Package-API-Teile benennen, insbesondere Bulk-Action-Typen und eventuelle App-spezifische Komfortprops; das Label-/i18n-Modell wird dabei explizit als Consumer-Verantwortung der App festgeschrieben
- [x] 2.2 `@sva/studio-ui-react` so erweitern oder anpassen, dass die App ihren lokalen `StudioDataTable` ohne Funktionsverlust ersetzen kann, ohne die i18n-neutrale Package-API aufzugeben oder eine zweite App-Fassade als neue Owner-Schicht einzufuehren
- [x] 2.3 in `apps/sva-studio-react` einen kleinen Label-Helper oder aequivalenten Consumer-Code schaffen, der die benoetigten Tabellen-Labels explizit an `@sva/studio-ui-react` liefert, ohne Tabellenlogik oder Prop-Umbauten in einem dauerhaften Wrapper zu verstecken
- [x] 2.4 die bekannten App-Consumer schrittweise auf Package-Imports umstellen, aktuell mindestens `src/routes/content/-content-list-page.tsx`, `src/routes/admin/roles/-roles-page.tsx`, `src/routes/admin/media/-media-page.tsx`, `src/routes/admin/instances/-instances-page.tsx` und `src/routes/admin/users/-user-list-page.tsx`
- [x] 2.5 den app-lokalen `StudioDataTable` und zugehörige Duplikat-Tests erst entfernen, wenn die Package-Variante alle benötigten App-Fälle abdeckt und die Route-Tests grün sind
- [x] 2.6 betroffene Unit-Tests in App und Package so ergänzen, dass die gemeinsame Tabellen-API als Boundary-Vertrag nachvollziehbar abgesichert ist

## 3. Schritt 3: Mainserver-Host-Adapter aus der App herauslösen und Rest-Audits abschließen

- [x] 3.1 News-, Events- und POI-spezifische Request-Parser, Validierung und Host-Mutationslogik aus `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts` sowie `apps/sva-studio-react/src/lib/mainserver-events-poi-api.server.ts` in paketseitige Server-Verträge überführen und drei getrennte oeffentliche Adapter fuer `news`, `events` und `poi` schaffen
- [x] 3.2 gemeinsame technische Hilfen fuer Auth, CSRF, Pagination, Fehler-Mapping und identische Feldparser nur dort paketseitig teilen, wo die Regeln wirklich identisch sind; Events und POI duerfen kein neuer monolithischer Sammel-Handler bleiben
- [x] 3.3 `apps/sva-studio-react/src/server.ts` und verbleibende App-Einstiege auf dünne Delegation reduzieren, sodass die App Requests annimmt und an Package-Handler weiterreicht, aber keine kanonische Inhalts-Parsing-Logik mehr besitzt
- [x] 3.4 `interfaces-api` als Mainserver-bezogenen Serververtrag nach `@sva/sva-mainserver/server` überführen; `apps/sva-studio-react/src/lib/interfaces-api.ts` behaelt nur dünne TanStack-`createServerFn`-Adapter und unmittelbaren Request-/Session-Kontext
- [x] 3.5 die Package-Tests so ergänzen, dass Parsing-, Validierungs- und Fehler-Mapping außerhalb der App direkt abgesichert bleiben; app-seitige Tests werden auf das Delegationsmodell umgestellt
- [x] 3.6 explizit verifizieren, dass keine bloße app-interne Helper-Extraktion als Abschluss gewertet wird: News-, Events- und POI-Parsing sowie die Mainserver-Interfaces-Regeln muessen danach nachweisbar über paketseitige Verträge laufen
- [x] 3.7 betroffene arc42-Abschnitte und Entwicklerdokumentation auf die finalen Boundaries aktualisieren
- [x] 3.8 relevante Nx-Targets für Unit-, Types- und Boundary-Checks grün ausführen, einschließlich `pnpm check:server-runtime` für die betroffenen Server-Packages
- [x] 3.9 `openspec validate refactor-sva-studio-react-package-boundaries --strict` ausführen
