# Project Context

## Purpose
SVA Studio (ehemals "CMS 2.0") modernisiert das Redaktionssystem der Smart Village App. Ziel ist eine integrierte, nutzerfreundliche und erweiterbare Plattform für Content-Management, Benutzerverwaltung, App-Design, Module und Schnittstellen.

**Kernziele:**
- Headless/API-first CMS für strukturierte kommunale Inhalte (Presse, Events, POI, Verwaltungsleistungen, Baustellen, Stellenanzeigen)
- Unterstützung heterogener IT-Landschaften (eigenständig oder integriert in bestehende Systeme)
- Flexibles, modulares System für App, Web, Stelen, Sprachassistenten
- DSGVO-konform, sicher, erweiterbar durch Plugin-Architektur

## Tech Stack
- **Monorepo:** Nx (Integrated Monorepo Setup) mit npm
- **Frontend:** TypeScript, React (geplant)
- **Backend:** Node.js, GraphQL API (bestehend, wird punktuell erweitert)
- **Testing:** (noch festzulegen; Anforderung: hohe Test-Coverage für neue Logik)
- **Code Quality:** Prettier (aktiviert), Linter/Type-Checks (noch zu konfigurieren)
- **Deployment:** (noch offen; Cloud/On-Premise hybrid möglich)

## Project Conventions

### Code Style
- **Sprache:** Dokumentation und Konzepte auf Deutsch, Code auf Englisch
- **Formatter:** Prettier (konfiguriert)
- **Naming:** (noch zu definieren; TypeScript/React Best Practices)
- **Commits:** Conventional Commits (z.B. `feat:`, `fix:`, `docs:`, `chore:`)

### Architecture Patterns
- **API-First / Headless:** GraphQL-basierte Backend-API
- **Modulare Architektur:** Vorbereitung für Plugin-System; klar abgegrenzte Features
- **Monorepo:** Nx Integrated Setup für gemeinsame Bibliotheken, Apps, Tools
- **Separation of Concerns:** Backend/Frontend klar getrennt; API als zentrale Schnittstelle

### Testing Strategy
- **Pflicht:** Neue Logik benötigt Tests; Bugfixes benötigen Repro-Tests
- **Typen:** Unit-Tests (Basis), Integration-Tests (API/DB), E2E-Tests (kritische User-Flows)
- **KI-generierte Tests:** Müssen von Menschen gehärtet werden (Positiv/Negativ/Edge-Cases)
- **Coverage:** Ziel-Wert noch festzulegen; Pipeline-Gate geplant

### Git Workflow
- **Branching:** Feature-Branch von `main`, PR, Review, Merge
- **Branch-Naming:** `feature/`, `fix/`, `chore/`, `docs/`, `setup/`
- **Commits:** Häufig und klein; aussagekräftige Messages (Conventional Commits)
- **PR-Prozess:** Review erforderlich; Tests müssen grün sein; keine direkte Commits auf `main`
- **Experimenten:** In separaten Branches; Squash bei Bedarf vor Merge

## Domain Context
- **Zielgruppen:** System-Admins, App-Manager, Feature-Manager, Designer, Schnittstellen-Manager, Redakteure, Moderatoren, Inhaltsersteller, Entscheider
- **Anwendungskontext:** Kommunale Verwaltung (kleine Gemeinden bis Großstädte), kommunale Unternehmen, Vereine, Tourismus
- **Heterogene IT-Landschaften:** Manche Kommunen haben CMS/Datenplattformen, andere keines; System muss eigenständig und integrierbar sein
- **Finanzierung:** Verteilt über Anwendergemeinschaft; Teilprojekte müssen separat beauftragbar sein und klaren Mehrwert liefern

## Important Constraints
- **Datenschutz:** DSGVO-konform; keine sensiblen Daten (Passwörter, API-Keys, PII) in öffentliche KI-Modelle
- **IT-Sicherheit:** IT-Sicherheits-Leitlinie, BSI-Grundschutz
- **Barrierefreiheit:** BITV (Barrierefreie-Informationstechnik-Verordnung)
- **Architektur:** Föderale IT-Architekturrichtlinien
- **Standards:** xZuFi, OParl, Open311, schema.org (Kompatibilität erforderlich)
- **Open Source:** Echtes Open-Source-Projekt; offene Governance, Community-Beteiligung; Lizenz EUPL favorisiert (Issue #2)
- **Abhängigkeiten:** Externe Pakete nur nach gründlicher Prüfung (Mehrwert, Qualität, Lizenz, SBOM)

## External Dependencies
- **Bestehende GraphQL-API:** Smart Village App Backend (wird punktuell erweitert, aber nicht komplett neu strukturiert)
- **Mobile App:** Nicht Teil des Projekts; bleibt unverändert; CMS liefert nur Daten
- **Kommunale Fachverfahren:** Perspektivisch anbindbar (z.B. DMS, Tourismus-Hubs), aber nicht im initialen Scope
- **Urbane Datenplattformen:** Optional; System muss auch ohne funktionieren
- **Hosting/Betrieb:** Cloud/On-Premise hybrid; nicht Teil des Projekts (aber mitgedacht)
