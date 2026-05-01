# Change: App-Grenzen von `sva-studio-react` auf Zielpackages zurückführen

## Why

`apps/sva-studio-react` enthält derzeit mehrere Verantwortungen, die bereits fachlich passenden Workspace-Packages gehören oder dort in abgeschwächter Form schon existieren. Dazu zählen insbesondere duplizierte Studio-UI-Bausteine, ein eigener Legal-Text-HTML-Sanitizer sowie umfangreiche Mainserver-Request-Parser und Host-Handler für News, Events und POI.

Diese Drift verwischt Ownership, erschwert Reviews, erhöht die Gefahr funktionaler Abweichungen zwischen App und Package und unterläuft die bestehende Zielarchitektur aus `@sva/studio-ui-react`, `@sva/iam-governance` und `@sva/sva-mainserver/server`.

Die Review des laufenden Changes hat zusätzlich gezeigt, dass ein reiner Zuschnitt innerhalb von `apps/sva-studio-react` die Boundary-Ziele nicht erfüllt. App-interne Helper-Extraktionen ohne echte Package-Verlagerung würden dieselbe Ownership weiter im App-Layer belassen und die in Proposal und Specs versprochene Zielarchitektur nur scheinbar erreichen.

## What Changes

- führt die wiederverwendbare Studio-Listen- und Tabellen-UI aus `apps/sva-studio-react` in `@sva/studio-ui-react` zusammen
- reduziert app-lokale Basis-UI-Primitives auf echte App-Spezialfälle und ersetzt Duplikate durch Package-Imports
- deklariert `@sva/iam-governance` als kanonische Ownership für Legal-Text-HTML-Sanitizing auch für die React-App
- verlagert host-owned Mainserver-Request-Parsing und inhaltsbezogene Server-Handler aus der App in paketseitige Server-Verträge
- begrenzt `apps/sva-studio-react` auf App-Komposition, Routing-Bindings, Shell-Zusammensetzung und framework-spezifische Server-Einstiege
- konsolidiert app-lokale Zugriffs- und Kontextregeln in Schnittstellen-Serverfunktionen, damit dieselben Fachentscheidungen nicht mehrfach im App-Layer gepflegt werden
- aktualisiert Architektur- und Entwicklerdokumentation an den betroffenen Boundary-Stellen

## Out of Scope

- keine funktionale Neugestaltung der Studio-Shell oder der Content-Workflows
- keine Neuverteilung plugin-spezifischer Fachlogik aus `@sva/plugin-news`, `@sva/plugin-events` oder `@sva/plugin-poi`
- keine erzwungene Verschiebung host-spezifischer Routing-Konfiguration wie `appRouteBindings` oder `appAdminResources`, solange diese App-Komposition bleiben
- kein Breaking Redesign der öffentlichen Package-APIs über das für die Boundary-Konsolidierung notwendige Maß hinaus
- kein bloßes app-internes Umorganisieren von Parse- oder Validierungslogik als Ersatz für die geforderte Package-Ownership

## Impact

- Affected specs:
  - `monorepo-structure`
  - `ui-layout-shell`
  - `sva-mainserver-integration`
- Affected code:
  - `apps/sva-studio-react/src/components/**`
  - `apps/sva-studio-react/src/components/ui/**`
  - `apps/sva-studio-react/src/components/RichTextEditor.tsx`
  - `apps/sva-studio-react/src/components/LegalTextAcceptanceDialog.tsx`
  - `apps/sva-studio-react/src/lib/interfaces-api.ts`
  - `apps/sva-studio-react/src/lib/legal-text-html.ts`
  - `apps/sva-studio-react/src/lib/mainserver-news-api.server.ts`
  - `apps/sva-studio-react/src/lib/mainserver-events-poi-api.server.ts`
  - `apps/sva-studio-react/src/routes/**`
  - `packages/studio-ui-react/src/**`
  - `packages/iam-governance/src/**`
  - `packages/sva-mainserver/src/**`
  - `docs/architecture/**`
  - relevante Entwicklerdokumentation unter `docs/development/**` und `docs/guides/**`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Success Criteria

- wiederverwendbare Studio-Listen- und Tabellenbausteine werden nur noch aus `@sva/studio-ui-react` konsumiert
- die React-App verwendet keinen eigenen kanonischen Legal-Text-Sanitizer mehr neben `@sva/iam-governance`
- host-owned Mainserver-Inhaltsrouten für News, Events und POI enthalten in der App nur noch dünne Entry-Point-Logik
- app-seitige Schnittstellenfunktionen pflegen keine doppelten Regeln für Instanzkontext und Zugriffsentscheidungen, wenn dieselbe Fachentscheidung lokal bereits zentralisiert werden kann
- Mainserver-spezifische Parse-, Validierungs- und Fehler-Mappings sind in Package-Tests absicherbar und nicht nur über App-Tests indirekt nachweisbar
- neue oder bestehende Package-Boundaries sind durch Tests, Imports und Doku konsistent nachvollziehbar
