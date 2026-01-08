# SVA Studio

Wir modernisieren das Redaktionssystem der Smart Village App zu einer integrierten Plattform für Content-Management, Benutzerverwaltung, App-Design, Module und Schnittstellen. Fokus: nutzerfreundlich, sicher, erweiterbar.

## Einleitung
SVA Studio soll als Headless- und API-first-System sowohl die App versorgen als auch als Stadt-CMS bzw. Content-Hub für externe Kanäle dienen (Websites, Stelen, Fachsoftware). Schwerpunkt liegt auf strukturierten Inhalten (Presse, Events, POI, Verwaltungsleistungen, Baustellen, Stellenanzeigen), aber auch Sensordaten und anderen typischen Smart City Daten. Ziel ist ein flexibles System, das Inhalte auch in externen Systemen pflegen lässt.

## Hintergrund und Zielsetzung
Das bestehende Redaktionssystem ist umständlich, schwer erweiterbar und limitiert in Konfiguration und UX. SVA Studio adressiert das durch:
- Einfachere tägliche Abläufe für Verwaltung und Engagierte
- Individuelle Gestaltungsmöglichkeiten (Design, Module)
- Modulare Architektur für Erweiterungen
- DSGVO-konforme Datenspeicherung
- Bessere Integration in kommunale Systeme

## Erfolgskriterien
1. Anwender:innen erledigen ihre Arbeit deutlich einfacher, mit verständlicher Doku/Schulungen.
2. Technisch entsteht eine stabile, sichere, erweiterbare Architektur für Module, Schnittstellen, Drittanbieter.
3. Community/Kommunen sind eingebunden und identifizieren sich mit dem Ergebnis.

## Zielgruppen (Auswahl)
- System-Administrator:innen: Stabilität, Sicherheit, Rollen/Rechte, Logging/Monitoring.
- App-Manager:innen: Dashboard, Freigaben, Nutzungsberichte, Rollenvergabe.
- Feature-Manager:innen: Konfigurierbare Module, flexible Schnittstellen, einfache Konfig-UI.
- Designer:innen: Layout/Navigation/Farben anpassen, CD-Support, Vorschau/Test.
- Schnittstellen-Manager:innen: Offene APIs/Standards, Doku, Monitoring der Datenflüsse.
- Redakteur:innen: Einfache Text/Bild-Bearbeitung, Workflows, Versionierung/Archiv.
- Moderator:innen/Support: Nutzerbetreuung, Feedback-Kanäle, einfache Hilfen.
- Inhaltsersteller:innen: Sehr einfache Bedienung, klare Struktur, eingeschränkte Rechte.
- Entscheider:innen: KPI-Dashboards, Kampagnensteuerung, Ressourcen/Budget-Planung.

## Open Source First

**SVA Studio versteht sich als echtes Open-Source-Projekt.** Das bedeutet für uns:

- **Offene Governance:** Transparente Entscheidungsprozesse, Community-Beteiligung bei der Weiterentwicklung
- **Klare Lizenzstrategie:** Favorit ist die [EUPL](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12) (European Union Public License) – die finale Entscheidung wird in [Issue #2](https://github.com/smart-village-solutions/sva-studio/issues/2) dokumentiert
- **Community-Contributions:** Aktive Einbindung von Entwickler:innen, Designer:innen und Anwender:innen
- **Nachhaltiger Betrieb:** Organisation und Finanzierung über die Förderphase hinaus sicherstellen
- **Standards & Compliance:** IT-Sicherheits-Leitlinie, BSI-Grundschutz, BITV, Föderale IT-Architekturrichtlinien, DSGVO, Open-Source-Vorgaben (MPSC), relevante Datenstandards (xZuFi, OParl, Open311, schema.org, ...)

## Nx Workspace Überblick

Dieses Repository ist ein integrierter Nx-Workspace (nicht Standalone) mit einer klaren Trennung zwischen Apps und Kernpaketen. Nx unterstützt uns beim Entwickeln, Testen, Bauen und bei der Durchsetzung von Architektur-Grenzen.

### Struktur

```
apps/
	studio/               # Vite + React Admin-UI

packages/
	sdk/                  # Öffentliche SDK/API-Helfer
	core/                 # Domänenkern und gemeinsame Logik
	data/                 # Datenzugriff, Gateways, Adapter
	auth/                 # Authentifizierung/Autorisierung
	ui-contracts/         # UI-Verträge (Typen, Schnittstellen)
	runtime-react/        # Laufzeit-Helfer für React
	theme-engine/         # Themen-/Design-Engine
	app-config/           # Konfigurationen und Schemas
```

Pfad-Aliasse sind zentral in der tsconfig.base.json definiert. Alle Kernpakete erhalten ein Alias unter `@cms/*`, z. B.:

```
@cms/sdk            -> packages/sdk/src/index.ts
@cms/core           -> packages/core/src/index.ts
@cms/data           -> packages/data/src/index.ts
@cms/auth           -> packages/auth/src/index.ts
@cms/ui-contracts   -> packages/ui-contracts/src/index.ts
@cms/runtime-react  -> packages/runtime-react/src/index.ts
@cms/theme-engine   -> packages/theme-engine/src/index.ts
@cms/app-config     -> packages/app-config/src/index.ts
```

### Häufige Nx-Befehle

Lokale Entwicklung (Vite Dev-Server):

```bash
npx nx run studio:serve
```

Bauen, Testen und Linten einzelner Projekte:

```bash
npx nx run studio:build
npx nx run studio:test
npx nx run studio:lint
```

Gleichzeitig mehrere Ziele ausführen:

```bash
npx nx run-many -t lint test build
```

Nur betroffene Projekte (CI-typisch):

```bash
npx nx affected -t lint test build
```

Projektgraph visualisieren:

```bash
npx nx graph
```

### Module Boundaries & Tags

Wir nutzen die ESLint-Regel `enforce-module-boundaries`, um Abhängigkeitsgrenzen zu prüfen. Tags in project.json helfen dabei, die Architektur zu beschreiben und Regeln zu formulieren (z. B. `type:ui`, `type:data`, `type:core`).

Empfohlene Tag-Zuordnung:
- studio: `type:ui`
- sdk: `type:sdk`
- core: `type:core`
- data: `type:data`
- auth: `type:security`
- ui-contracts: `type:contracts`
- runtime-react: `type:runtime`
- theme-engine: `type:theme`
- app-config: `type:config`

Hinweis: Die Regeln sind vorbereitet; die Tag-Feinjustierung folgt schrittweise, sobald die Abhängigkeitsrichtung stabil ist.

### Generatoren (Apps & Pakete)

Neue Build-fähige JS/TS-Bibliothek (im integrierten Layout; legt unter packages/ ab):

```bash
npx nx g @nx/js:lib my-lib --importPath=@cms/my-lib --projectRoot=packages/my-lib
```

Neue React-App mit Vite:

```bash
npx nx g @nx/react:app studio --bundler=vite --projectRoot=apps/studio
```

### Build- und Output-Pfade

- Apps: Artefakte unter `dist/apps/<app>` (z. B. `dist/apps/studio`)
- Pakete: Artefakte unter `dist/packages/<pkg>`
- Vite/Vitest-Caches und Coverage liegen zentral unter `node_modules/.vite/*` und `coverage/*`

### Weitere Hinweise

- Für größere Architektur-Änderungen und Planungen siehe AGENTS.md (OpenSpec-Hinweise)
- Bevorzugt Nx-Tasks (`nx run`, `nx run-many`, `nx affected`) statt direkter Tooling-CLI