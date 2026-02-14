# 01 Einfuehrung und Ziele

## Zweck

SVA Studio ist eine TanStack-Start-basierte Webanwendung im Nx-Monorepo, die
als modulares Studio fuer Content- und Systemfunktionen aufgebaut wird.
Der aktuelle Repo-Stand fokussiert auf:

- Typsicheres Routing mit Core- und Plugin-Route-Factories
- Demo-Routen mit TanStack Start Server Functions
- Grundlagenpakete fuer Core, Data, SDK und Plugin-Integration
- Monorepo-Governance fuer Build/Test/Qualitaet

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/-core-routes.tsx`
- `packages/core/src/routing/registry.ts`
- `packages/data/src/index.ts`

## Mindestinhalte

Mindestinhalte fuer diesen Abschnitt:

- Systemkontext in 3-5 Saetzen
- Primaere Stakeholder und deren wichtigste Beduerfnisse
- Top-3 Architekturziele mit Prioritaet

## Aktueller Stand

### Produkt- und Problemkontext (ohne Feature-Commitment)

SVA Studio ist das technische Fundament fuer ein Redaktions- und Verwaltungsstudio im Smart-Village-Umfeld.
Der fachliche Hintergrund (Warum/wer/Rahmenbedingungen) ist im Konzept unter `concepts/konzeption-cms-v2/` beschrieben.
Dieses Repository implementiert aktuell vor allem technische Enabler fuer Routing, UI-Demos und Paketstruktur.

Wichtig: Das Konzept enthaelt auch Roadmap-/Milestone-Inhalte; diese gelten nicht als dokumentierter Ist-Stand dieses Repos.

### Stakeholder (technisch)

- Produkt-/Architektur-Team: stabile Zielarchitektur und nachvollziehbare Entscheidungen
- Entwickler:innen: hohe Typsicherheit, klare Modulgrenzen, reproduzierbare Workflows
- Betrieb/SRE: standardisierte Build-/Test-Pipelines

### Stakeholder (fachlich / Nutzerrollen)

Die folgenden Rollen stammen aus dem Konzept und dienen hier als Kontext fuer Architekturentscheidungen.
Sie sind nicht als bereits umgesetzte Feature-Liste zu verstehen.

- System-Administrator:innen
- App-Manager:innen
- Feature-Manager:innen
- Designer:innen
- Schnittstellen-Manager:innen
- Redakteur:innen/Inhaltsersteller:innen

### Top-3 Architekturziele (priorisiert)

1. Typsichere, erweiterbare Routing-Architektur (Core + Plugins)
2. Klare Paketgrenzen mit framework-agnostischer Kernlogik
3. Nachvollziehbare Qualitaets-Governance ueber Nx-/CI-Workflows und Doku

### Systemgrenze (Kurzfassung)

In diesem Repo liegen die Web-App, gemeinsame Pakete (`core`, `data`, `sdk`, `plugin-example`)
und die Doku-/Governance-Artefakte.
Externe Fachsysteme werden konzeptionell adressiert, sind aber nicht Teil des aktuellen Codes.

Konzept-Referenz (Kontext): `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md`
