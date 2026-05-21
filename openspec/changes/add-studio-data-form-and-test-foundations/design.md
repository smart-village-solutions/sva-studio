## Context

Das Studio kombiniert TanStack Router/Start, Zod, Nx und eine pluginfähige React-Host-Anwendung. Für mehrere wiederkehrende Querschnittsprobleme fehlen aber noch verbindliche Foundations:

- formularzentrierte Host- und Plugin-Workflows
- reproduzierbare HTTP-nahe Frontend-Tests
- generative Tests für kritische Kernlogik

Die Einführung neuer npm-Pakete ist in diesem Repository bewusst architekturwirksam und muss daher als normativer Standard beschrieben werden, nicht nur als Implementierungsdetail.

## Goals / Non-Goals

- Goals:
  - Ein verbindlicher repo-weiter Default-Standard für Form-State, `zod`-Resolver und Fehlerrendering
  - Ein verbindlicher HTTP-Level-Mocking-Standard für neue oder grundlegend überarbeitete Frontend-Tests
  - Ein gezielter Property-based-Testing-Standard für kritische Kernlogik mit dokumentierter Review-Entscheidung
  - Ein risikoarmer Rollout über Referenzimplementierungen, Wrapper, Inventur und Governance-Exit-Kriterien
- Non-Goals:
  - Kein vollständiger Umstieg aller bestehenden Komponenten in einem Schritt
  - Keine Einführung zusätzlicher UI- oder DnD-Bibliotheken in diesem Change
  - Kein Ersatz bestehender E2E-Läufe durch Mock-basierte Tests
  - Keine Rückmigration stabiler Alt-Flows ohne fachlichen Anlass

## ADR Requirements

Dieser Change benötigt zwei Architekturentscheidungen in `docs/adr/`, die spätestens vor Beginn der Referenzimplementierungen vorliegen:

- `ADR: Formular-Foundation mit react-hook-form und zodResolver`
  - dokumentiert Bibliothekswahl, Geltungsbereich, gemeinsame Adapter in `packages/studio-ui-react`, Ausnahmen und Migrationsregeln für Alt-Flows
- `ADR: Frontend-Test-Foundation mit MSW und selektivem fast-check`
  - dokumentiert Bibliothekswahl, Abgrenzung zu Modul-Mocks und Live-E2E sowie die gezielte Nutzung von `fast-check` für definierte Hotspots

## Decisions

- Decision: `react-hook-form` mit `@hookform/resolvers` wird der Formularstandard für Host- und Plugin-Views mit `zod`-Validierung.
  - Rationale: Das Repository nutzt bereits `zod` intensiv. Die Kombination minimiert Boilerplate, hält Validierungslogik typnah und verbessert Konsistenz über Account-, Admin- und Content-Formulare.
  - Rollout: Verbindlich für neue oder grundlegend überarbeitete Formular-Flows in Host und Plugins. Bestehende stabile Formulare werden nur bei fachlicher Überarbeitung oder gezielter Konsolidierung migriert.
  - Exceptions: Nur rein lokale Fachlogik ohne HTTP-Bezug, unveränderte Legacy-Flows und dokumentierte Spezialfälle dürfen abweichen.

- Decision: `msw` wird der Standard für HTTP-nahe Frontend-Tests unterhalb echter E2E-Läufe.
  - Rationale: Netzwerkverhalten soll auf Protokollebene und nicht über clientinterne Stubs geprüft werden. Das passt zu Host/Plugin-Integrationen und reduziert Mock-Kopplung an Implementierungsdetails.
  - Rollout: Verbindlich für neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests. Referenzpiloten validieren den Standardpfad, begrenzen aber nicht seine Geltung.
  - Exceptions: Modul-Mocks für rein lokale Fachlogik ohne HTTP-Bezug bleiben zulässig; dokumentierte Spezialfälle müssen im Review begründet werden.

- Decision: `fast-check` wird gezielt für kritische framework-agnostische Logik eingeführt, nicht pauschal für jede Komponente.
  - Rationale: Der höchste Mehrwert liegt in Parsern, Guards, Normalisierern, Query-Key-/Routing-Invarianten und ähnlicher Kernlogik. Für rein visuelle UI-Komponenten wäre der Nutzen meist gering.
  - Rollout: Gezielt für eine kleine, dokumentierte Hotspot-Liste mit hoher Eingabevielfalt oder Invariantenlast; jede Änderung an kritischen Hotspots verlangt eine dokumentierte Entscheidung pro oder contra `fast-check`.

- Decision: Die Foundations werden über gemeinsame Integrationsbausteine, eine vollständige Formularinventur und prüfbare Governance eingeführt, nicht per verteiltem Ad-hoc-Einsatz.
  - Rationale: Der größte Einführungsrisiko-Treiber ist uneinheitliche Nutzung. Deshalb braucht der Change kleine gemeinsame Adapter, Test-Helfer, Migrationsregeln und ein Pflichtartefakt zur Bestandsaufnahme, bevor breite Umstellungen stattfinden.

## Alternatives Considered

- Alternative: Formularlogik mit lokaler React-State-Verwaltung oder ad-hoc Hooks.
  - Rejected: Das erhöht Inkonsistenzen bei Fehlerabbildung, Submit-Status, Field Arrays und Resolver-basierter Validierung.

- Alternative: Fetch/Client-Mocks ohne `msw`.
  - Rejected: Diese koppeln Tests stärker an Implementierungsdetails statt an beobachtbares HTTP-Verhalten.

- Alternative: Nur beispielbasierte Tests ohne `fast-check`.
  - Rejected: Für Hotspots mit vielen Eingabekombinationen bleiben Randfälle leichter unentdeckt.

## Risks / Trade-offs

- Mehr Tooling erhöht kurzfristig die Einstiegskomplexität.
  - Mitigation: gemeinsame Patterns, Doku und Wrapper-Utilities bereitstellen.

- Halb migrierte Foundations können zwei konkurrierende Arbeitsweisen erzeugen.
  - Mitigation: Standard gilt repo-weit als Default für neue oder grundlegend überarbeitete Flows; Referenzpiloten, Ausnahmen und Exit-Kriterien werden explizit dokumentiert.

- `msw` kann falsch eingesetzt echte Integrationslücken verdecken.
  - Mitigation: Abgrenzung zu Live-E2E und infra-abhängigen Tests explizit dokumentieren.

- `fast-check` kann bei ungezieltem Einsatz Testlaufzeiten erhöhen.
  - Mitigation: nur für kritische Kernlogik und definierte Hotspots einsetzen.

## Rollout Plan

### Phase 0: Foundations bereitstellen

- `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check` werden eingeführt.
- Die beiden ADRs zur Formular- und Test-Foundation werden erstellt oder aktualisiert, bevor Referenzimplementierungen beginnen.
- Für Formulare entsteht ein kleiner gemeinsamer Integrationspfad in `packages/studio-ui-react`, damit Feld-, Fehler- und Summary-Mapping nicht pro View neu erfunden wird.
- Für `msw` entsteht ein gemeinsames Test-Setup mit wiederverwendbaren Handlern und klarer Trennung zwischen Node- und Browser-nahen Testläufen.
- Für `fast-check` wird eine kleine Hotspot-Liste definiert, bevor erste Properties geschrieben werden.
- Eine vollständige Formular-Migrationsinventur für Host und Plugins wird als Pflichtartefakt erstellt.

### Phase 1: Referenzimplementierungen

- Formular-Piloten: `/admin/users` Create/Edit, `/admin/roles` Create und der Host-Content-Editor.
- MSW-Piloten: Frontend-Tests mit direkten `fetch`-/`fetchWithRequestTimeout`-Stubs, insbesondere IAM-nahe Seiten-/Hook-Tests und content-nahe HTTP-Tests.
- `fast-check`-Piloten: Guard-, Parser-, Normalisierungs- oder Routing-nahe Kernlogik mit klaren Invarianten.
- Zweck: Referenzimplementierungen validieren den verbindlichen Standardpfad, ohne die repo-weite Default-Geltung einzuschränken.
- `/account`-Flows fallen bereits unter die repo-weite Default-Regel für neue oder grundlegend überarbeitete Formulare, sind in diesem Change aber keine initialen Referenzimplementierungen.

### Phase 2: Auswertung und Ausweitung

- Weitere Migrationen erfolgen erst, wenn die Referenzimplementierungen ohne zusätzliche Sonderadapter tragfähig sind.
- Der Standard gilt bereits zuvor repo-weit für neue oder grundlegend überarbeitete Flows; Phase 2 schärft nur die operative Rollout-Reife.

## Shared Integration Contract

### Formular-Integration

- `react-hook-form` wird nicht direkt als lose Einzelpraxis ausgerollt, sondern über dokumentierte Studio-Patterns:
  - Feldanbindung für `Input`, `Textarea`, `Select`, `Checkbox`
  - konsistentes Fehler-Mapping auf `StudioField` und `StudioFormSummary`
  - Fokusführung für Error-Summary und erstes fehlerhaftes Feld
  - klare Regel, wann `register` reicht und wann `Controller` genutzt wird

### Test-Integration

- `msw`-Tests beschreiben beobachtbares HTTP-Verhalten und nicht interne Implementierungsdetails.
- Modul-Mocks bleiben für rein lokale Fachlogik zulässig; `msw` ist kein Zwang für jeden Test.
- Gemeinsame Handler-Factories und Reset-Regeln müssen dokumentiert und wiederverwendbar sein.

### Property-based Testing

- `fast-check` wird nur dort verpflichtend geprüft, wo Invarianten oder große Eingaberäume vorliegen.
- Jede neue Property braucht eine knappe Aussage darüber, welche Invariante abgesichert wird.

### Initiale `fast-check`-Startmenge

Der Change definiert bereits für Phase 0/1 eine kleine konkrete Startmenge, damit Umsetzung und Review nicht auf abstrakte Kategorien ausweichen:

- `packages/routing/src/route-search.ts`
  - Invarianten: unbekannte Tabs fallen deterministisch auf die erlaubten Defaults zurück; erlaubte Tabs bleiben unverändert erhalten.
- `packages/routing/src/admin-resource-search-params.ts`
  - Invarianten: nur deklarierte Sort-/Filterwerte werden übernommen; Pagination bleibt positiv und fällt sonst auf definierte Defaults zurück.
- `packages/core/src/waste-management-location-tour-pickup-date-import.ts`
  - Invarianten: nur kanonische ISO-Datumswerte `YYYY-MM-DD` werden akzeptiert; ungültige oder nicht kalendarisch existente Daten ergeben `null`.
- `packages/core/src/input-readers.ts`
  - Invarianten: Trimming, Typgrenzen und `undefined`-Fallbacks für String-, Number-, Boolean- und Object-Reader bleiben stabil.

Weitere Hotspots dürfen später ergänzt werden, aber diese Startmenge ist Teil des Changes und keine nachgelagerte Option.

## Required Inventory Artifact

Die vollständige Formular-Migrationsinventur ist ein Pflichtartefakt des Changes. Sie muss alle bekannten Host- und Plugin-Formulare erfassen und mindestens Pfad, Zweck, heutiges Muster, Validierung, Submit-Pfad, Primitiven, Teststand, RHF-Bedarf, `msw`-Bedarf, `fast-check`-Eignung, Priorität, Risiko, Legacy-Ausnahme und Zielzustand dokumentieren.

Mindestens folgende Bereiche müssen explizit auftauchen:

- Host: `admin/users`, `admin/groups`, `admin/organizations`, `admin/instances`, `admin/legal-texts`, `admin/roles`, `interfaces`, `content`
- Plugins: `plugin-poi` sowie die relevanten Formulare in `plugin-waste-management`

Unvollständige Inventur blockiert den Exit dieses Changes.

## Governance and Review Rules

- Neue oder grundlegend überarbeitete Formular-Flows dürfen keine konkurrierende formularweite Eigenorchestrierung einführen.
- Neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests dürfen HTTP-Verhalten nicht primär über direkte `fetch`-, Wrapper- oder Client-Stubs abbilden, wenn `msw` den beobachtbaren Netzpfad abdecken kann.
- Für kritische Kernlogik-Hotspots muss im Review eine kurze Entscheidung pro oder contra `fast-check` dokumentiert sein.
- Für die initiale Startmenge in `packages/routing/src/route-search.ts`, `packages/routing/src/admin-resource-search-params.ts`, `packages/core/src/waste-management-location-tour-pickup-date-import.ts` und `packages/core/src/input-readers.ts` muss der Change konkrete Property-basierte Abdeckung oder eine eng begründete Verschiebung dokumentieren.
- Ausnahmen sind nie implizit zulässig; sie müssen als Legacy-Ausnahme oder Spezialfall nachvollziehbar begründet werden.
- Referenzimplementierungen sind Belege für den Standardpfad, keine Sonderzone mit abgeschwächten Regeln.

## Exit Criteria

- Referenzimplementierungen verwenden dieselben dokumentierten RHF-Patterns ohne view-spezifische Sonderverdrahtung.
- Referenzformulare bilden Feldfehler, Summary-Fehler und Fokusführung konsistent über gemeinsame Studio-Primitiven ab.
- HTTP-nahe Referenztests verwenden `msw` statt direkter `fetch`-Stubs, ohne bestehende Live-E2E-Anforderungen zu ersetzen.
- Für `fast-check` existiert eine kleine dokumentierte Erstmenge an Hotspots mit nachvollziehbaren Invarianten und akzeptabler Laufzeit.
- Die initiale `fast-check`-Startmenge für `route-search`, `admin-resource-search-params`, `waste-management-location-tour-pickup-date-import` und `input-readers` ist im Change selbst konkret benannt.
- Die vollständige Formular-Migrationsinventur liegt vollständig für Host und Plugins vor.
- Die Entwicklerdokumentation beschreibt Entscheidungskriterien dafür, wann Migration verpflichtend, optional oder unzulässig abweichend ist.
- Ein Reviewer kann für jeden Referenzbereich schnell erkennen, ob Standardpfad, Ausnahmegrund und Migrationsstatus nachvollziehbar dokumentiert sind.

## Migration Plan

1. Foundations als Dependencies und Workspace-Standards einführen.
2. ADRs zur Formular- und Test-Foundation vor Beginn der Referenzimplementierungen erstellen oder aktualisieren.
3. Vollständige Formular-Migrationsinventur für Host und Plugins erstellen.
4. Gemeinsame Adapter, Test-Helfer und Hotspot-Definitionen bereitstellen.
5. Referenz-Flows in Admin/Content sowie erste HTTP-nahe Tests schrittweise umstellen.
6. Nach erfolgreicher Referenzphase weitere neue oder grundlegend überarbeitete Flows an dieselben Standards binden.
7. Kritische Kernmodule selektiv mit `fast-check` absichern.

## Open Questions

- Welche exakten RHF-Adapter oder Wrapper werden in `packages/studio-ui-react` benötigt, bevor Referenzmigrationen starten?
