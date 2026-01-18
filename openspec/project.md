# Project Context

## Purpose

SVA Studio (ehemals "CMS 2.0") modernisiert das Redaktionssystem der Smart Village App. Ziel ist eine integrierte, nutzerfreundliche und erweiterbare Plattform für Content-Management, Benutzerverwaltung, App-Design, Module und Schnittstellen.

**Kernziele:**

- Headless/API-first CMS für strukturierte kommunale Inhalte (Presse, Events, POI, Verwaltungsleistungen, Baustellen, Stellenanzeigen)
- Unterstützung heterogener IT-Landschaften (eigenständig oder integriert in bestehende Systeme)
- Flexibles, modulares System für App, Web, Stelen, Sprachassistenten
- DSGVO-konform, sicher, erweiterbar durch Plugin-Architektur

## Tech Stack

- **Monorepo:** Nx (Integrated Monorepo Setup) mit pnpm
- **Frontend:** TypeScript, React 19 (✅ Phase 1 implementiert)
  - TanStack Start (SSR-ready)
  - i18n (react-i18next) mit Deutsch/English
  - Design Token System (CSS Variables)
  - WCAG 2.1 AAA Konformität (7.31:1 Farb-Kontrast)
- **Backend:** Node.js, GraphQL API (bestehend, wird punktuell erweitert)
- **Testing:** Vitest (Unit/Integration), React Testing Library, E2E-Tests geplant
- **Code Quality:** Prettier (aktiviert), ESLint (konfiguriert), TypeScript strict-mode
- **Deployment:** Docker-ready (geplant), Cloud/On-Premise hybrid möglich

## Project Conventions

### Code Style

- **Sprache:** Dokumentation und Konzepte auf Deutsch, Code auf Englisch
- **Formatter:** Prettier (konfiguriert)
- **Naming:** TypeScript/React Best Practices, i18n-Keys mit Dot-Notation
- **Commits:** Conventional Commits (z.B. `feat:`, `fix:`, `docs:`, `chore:`)
- **Namespace:** Alle Packages unter `@sva-studio/*` (Workspace-Protokoll `workspace:*`)

### Architecture Patterns

- **API-First / Headless:** GraphQL-basierte Backend-API
- **Modulare Architektur:** Packages: `core` (Business-Logik), `data` (State), `sdk` (Plugin-API), `ui-contracts` (Design Tokens), `app-config` (Konfiguration)
- **Monorepo:** Nx Integrated Setup für gemeinsame Bibliotheken, Apps, Tools
- **Separation of Concerns:** Backend/Frontend klar getrennt; API als zentrale Schnittstelle
- **Frontend-Framework:** React 19 + TanStack Start (SSR-ready)

### Testing Strategy

- **Pflicht:** Neue Logik benötigt Tests; Bugfixes benötigen Repro-Tests
- **Typen:**
  - Unit-Tests (Vitest + React Testing Library): Basis-Abdeckung
  - Integration-Tests (API/DB Queries): Kernfunktionen
  - E2E-Tests (Playwright geplant): kritische User-Flows
- **KI-generierte Tests:** Müssen von Menschen gehärtet werden (Positiv/Negativ/Edge-Cases)
- **Coverage:** Mindestens 75% für Kernlogik; Pipeline-Gate geplant
- **CI/CD:** GitHub Actions, automatische Checks für jeden PR

### Git Workflow

- **Branching:** Feature-Branch von `main`, PR, Review, Merge
- **Branch-Naming:** `feature/`, `fix/`, `chore/`, `docs/`, `setup/`
- **Commits:** Häufig und klein; aussagekräftige Messages (Conventional Commits)
- **PR-Prozess:** Review erforderlich; Tests müssen grün sein; keine direkten Commits auf `main`
- **Governance:** Agents für Security, Architecture, Interop, Operations, Accessibility Reviews
- **Experimenten:** In separaten Branches; Squash bei Bedarf vor Merge

## Domain Context

- **Zielgruppen:** System-Admins, App-Manager, Feature-Manager, Designer, Schnittstellen-Manager, Redakteure, Moderatoren, Inhaltsersteller, Entscheider
- **Anwendungskontext:** Kommunale Verwaltung (kleine Gemeinden bis Großstädte), kommunale Unternehmen, Vereine, Tourismus
- **Heterogene IT-Landschaften:** Manche Kommunen haben CMS/Datenplattformen, andere keines; System muss eigenständig und integrierbar sein
- **Finanzierung:** Verteilt über Anwendergemeinschaft; Teilprojekte müssen separat beauftragbar sein und klaren Mehrwert liefern

## Important Constraints

- **Entwicklungsrichtlinien:** [rules/DEVELOPMENT_RULES.md](../../rules/DEVELOPMENT_RULES.md) - Nicht-verhandelbare Standards (i18n, Styling, Accessibility, Security)
- **Datenschutz:** DSGVO-konform; keine sensiblen Daten (Passwörter, API-Keys, PII) in öffentliche KI-Modelle
- **IT-Sicherheit:** IT-Sicherheits-Leitlinie, BSI-Grundschutz, Secure Software Lifecycle (BSI TR-03185-2)
- **Barrierefreiheit:** BITV 2.0 / WCAG 2.1 Level AA (Redaktionssystem + API-Output)
- **Architektur:** Föderale IT-Architekturrichtlinien (modulare Bauweise, API-first, digitale Souveränität)
- **Standards:** xZuFi, OParl, Open311, schema.org (Kompatibilität erforderlich)
- **Open Source:** Echtes Open-Source-Projekt; offene Governance, Community-Beteiligung; Lizenz EUPL favorisiert (Issue #2)
- **Abhängigkeiten:** Externe Pakete nur nach gründlicher Prüfung (Mehrwert, Qualität, Lizenz, SBOM)
- **Spezifikationen:** Siehe [specs/](../../specs/) für detaillierte Anforderungen (BSI, DSGVO, WCAG, FIT, Betrieb, Interop)

## External Dependencies

- **Bestehende GraphQL-API:** Smart Village App Backend (wird punktuell erweitert, aber nicht komplett neu strukturiert)
- **Mobile App:** Nicht Teil des Projekts; bleibt unverändert; CMS liefert nur Daten
- **Kommunale Fachverfahren:** Perspektivisch anbindbar (z.B. DMS, Tourismus-Hubs), aber nicht im initialen Scope
- **Urbane Datenplattformen:** Optional; System muss auch ohne funktionieren
- **Hosting/Betrieb:** Cloud/On-Premise hybrid; nicht Teil des Projekts (aber mitgedacht)

---

## Development & Governance

### Binding Documents

1. **[rules/DEVELOPMENT_RULES.md](../../rules/DEVELOPMENT_RULES.md)**
   - Nicht-verhandelbare Standards
   - Internationalisierung (keine hardcodierten Texte)
   - Styling (nur Design Tokens, keine Inline-Styles)
   - Accessibility (WCAG 2.1 AA)
   - Security (Input-Validierung, RLS)

2. **[AGENTS.md](AGENTS.md)**
   - AI-Assistenten Richtlinien
   - Reviewer-Struktur (Security, Architecture, Interop, Operations, A11y)
   - Test- und Debugging-Strategien

3. **[specs/](../../specs/) - Spezifikationen**
   - [Betrieb-Wartung.md](../../specs/Betrieb-Wartung.md) – Installation, Updates, Backup, DR, Skalierbarkeit
   - [FIT-Architekturrichtlinien.md](../../specs/FIT-Architekturrichtlinien.md) – Föderale IT, Souveränität, Interop
   - [Sicherheit-Datenschutz.md](../../specs/Sicherheit-Datenschutz.md) – DSGVO (Art. 15-21), BSI IT-Grundschutz, RLS, Audit-Trail
   - [Nutzerfreundlichkeit.md](../../specs/Nutzerfreundlichkeit.md) – WCAG 2.1 AA, Barrierefreiheit, Redakteur:innen-Support
   - [Software-Lifecycle-BSI.md](../../specs/Software-Lifecycle-BSI.md) – Sichere FLOSS-Entwicklung, SBOM, CRA
   - [Interoperabilitaet-Integration.md](../../specs/Interoperabilitaet-Integration.md) – Open Standards, API-Versionierung, Plugin-System
   - [Governance-Nachhaltigkeit.md](../../specs/Governance-Nachhaltigkeit.md) – Open Source, Community, LTS, Architecture Decisions

### Phase Status

**Phase 1.0-1.1 (✅ Abgeschlossen)**
- React GUI mit Sidebar, Header, ContentArea
- i18n-System (Deutsch/English, vollständig)
- Design Token System (CSS Variables, WCAG AAA Kontrast)
- Navigation Registry Integration
- Error Handling mit Fallback UI
- Tasks: 24/24 (100%)

**Phase 1.5 (🔄 Geplant)**
- Unit-Tests für alle Komponenten
- E2E-Tests (Playwright)
- Komponenten-Dokumentation (Storybook oder ähnlich)
- Authentication & Authorization (Rollen/Rechte)

**Phase 2+ (📋 Zukünftig)**
- Content Editor (Rich Text, Media, Workflows)
- Content Publishing & Versioning
- API-Endpoints für externe Integration
- Plugin-System Implementierung
- Admin Dashboard & Analytics
