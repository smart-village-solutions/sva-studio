## Context

Das Studio kombiniert TanStack Router/Start, Zod, Nx und eine pluginfähige React-Host-Anwendung. Für mehrere wiederkehrende Querschnittsprobleme fehlen aber noch verbindliche Foundations:

- formularzentrierte Host- und Plugin-Workflows
- reproduzierbare HTTP-nahe Frontend-Tests
- generative Tests für kritische Kernlogik

Die Einführung neuer npm-Pakete ist in diesem Repository bewusst architekturwirksam und muss daher als normativer Standard beschrieben werden, nicht nur als Implementierungsdetail.

## Goals / Non-Goals

- Goals:
  - Ein einheitlicher Standard für Form-State, `zod`-Resolver und Fehlerrendering
  - Ein HTTP-Level-Mocking-Standard für Frontend-Tests
  - Ein gezielter Property-based-Testing-Standard für kritische Kernlogik
  - Ein risikoarmer Rollout ueber Pilotbereiche, Wrapper und Exit-Kriterien
- Non-Goals:
  - Kein vollstaendiger Umstieg aller bestehenden Komponenten in einem Schritt
  - Keine Einführung zusätzlicher UI- oder DnD-Bibliotheken in diesem Change
  - Kein Ersatz bestehender E2E-Läufe durch Mock-basierte Tests
  - Keine Rueckmigration stabiler Alt-Flows ohne fachlichen Anlass

## ADR Requirements

Dieser Change benoetigt vor oder spaetestens waehrend der Umsetzung zwei Architekturentscheidungen in `docs/architecture/`:

- `ADR: Formular-Foundation mit react-hook-form und zodResolver`
  - dokumentiert Bibliothekswahl, Geltungsbereich, gemeinsame Adapter in `packages/studio-ui-react` und Migrationsregeln fuer Alt-Flows
- `ADR: Frontend-Test-Foundation mit MSW und selektivem fast-check`
  - dokumentiert Bibliothekswahl, Abgrenzung zu Modul-Mocks und Live-E2E sowie die gezielte Nutzung von `fast-check` fuer definierte Hotspots

## Decisions

- Decision: `react-hook-form` mit `@hookform/resolvers` wird der Formularstandard für Host- und Plugin-Views mit `zod`-Validierung.
  - Rationale: Das Repository nutzt bereits `zod` intensiv. Die Kombination minimiert Boilerplate, hält Validierungslogik typnah und verbessert Konsistenz über Account-, Admin- und Content-Formulare.
  - Rollout: Verbindlich fuer neue oder grundlegend ueberarbeitete Formularfluesse. Bestehende stabile Formulare werden nur bei fachlicher Ueberarbeitung oder gezielter Konsolidierung migriert.

- Decision: `msw` wird der Standard für HTTP-nahe Frontend-Tests unterhalb echter E2E-Läufe.
  - Rationale: Netzwerkverhalten soll auf Protokollebene und nicht über clientinterne Stubs geprüft werden. Das passt zu Host/Plugin-Integrationen und reduziert Mock-Kopplung an Implementierungsdetails.
  - Rollout: Zunaechst fuer Tests, die heute `global fetch`, `fetchWithRequestTimeout` oder vergleichbare HTTP-Pfade direkt stubben. Modul-Mocks fuer rein fachliche Kernlogik bleiben zulaessig.

- Decision: `fast-check` wird gezielt für kritische framework-agnostische Logik eingeführt, nicht pauschal für jede Komponente.
  - Rationale: Der höchste Mehrwert liegt in Parsern, Guards, Normalisierern, Query-Key-/Routing-Invarianten und ähnlicher Kernlogik. Für rein visuelle UI-Komponenten wäre der Nutzen meist gering.
  - Rollout: Zunaechst fuer eine kleine, dokumentierte Hotspot-Liste mit hoher Eingabevielfalt oder Invariantenlast.

- Decision: Die Foundations werden ueber gemeinsame Integrationsbausteine eingefuehrt, nicht direkt per verteiltem Ad-hoc-Einsatz.
  - Rationale: Der groesste Einfuehrungsrisiko-Treiber ist uneinheitliche Nutzung. Deshalb braucht der Change kleine gemeinsame Adapter, Test-Helfer und Migrationsregeln, bevor breite Umstellungen stattfinden.

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

- Halb migrierte Foundations koennen zwei konkurrierende Arbeitsweisen erzeugen.
  - Mitigation: Standard gilt nur fuer neue oder grundlegend ueberarbeitete Flows; Pilotbereiche und Exit-Kriterien werden vor breiter Ausweitung dokumentiert.

- `msw` kann falsch eingesetzt echte Integrationslücken verdecken.
  - Mitigation: Abgrenzung zu Live-E2E und infra-abhängigen Tests explizit dokumentieren.

- `fast-check` kann bei ungezieltem Einsatz Testlaufzeiten erhöhen.
  - Mitigation: nur für kritische Kernlogik und definierte Hotspots einsetzen.

## Rollout Plan

### Phase 0: Foundations bereitstellen

- `react-hook-form`, `@hookform/resolvers`, `msw` und `fast-check` werden eingefuehrt.
- Fuer Formulare entsteht ein kleiner gemeinsamer Integrationspfad in `packages/studio-ui-react`, damit Feld-, Fehler- und Summary-Mapping nicht pro View neu erfunden wird.
- Fuer `msw` entsteht ein gemeinsames Test-Setup mit wiederverwendbaren Handlern und klarer Trennung zwischen Node- und Browser-nahen Testlaeufen.
- Fuer `fast-check` wird eine kleine Hotspot-Liste definiert, bevor erste Properties geschrieben werden.

### Phase 1: Pilotbereiche

- Formular-Piloten: `/admin/users` Create/Edit, `/admin/roles` Create und der Host-Content-Editor.
- MSW-Piloten: Frontend-Tests mit direkten `fetch`-/`fetchWithRequestTimeout`-Stubs, insbesondere IAM-nahe Seiten-/Hook-Tests und content-nahe HTTP-Tests.
- `fast-check`-Piloten: Guard-, Parser-, Normalisierungs- oder Routing-nahe Kernlogik mit klaren Invarianten.

### Phase 2: Auswertung und Ausweitung

- Weitere Migrationen erfolgen erst, wenn die Piloten ohne zusaetzliche Sonderadapter tragfaehig sind.
- Danach gilt der Standard fuer neue oder grundlegend ueberarbeitete Flows repo-weit.

## Shared Integration Contract

### Formular-Integration

- `react-hook-form` wird nicht direkt als lose Einzelpraxis ausgerollt, sondern ueber dokumentierte Studio-Patterns:
  - Feldanbindung fuer `Input`, `Textarea`, `Select`, `Checkbox`
  - konsistentes Fehler-Mapping auf `StudioField` und `StudioFormSummary`
  - Fokusfuehrung fuer Error-Summary und erstes fehlerhaftes Feld
  - klare Regel, wann `register` reicht und wann `Controller` genutzt wird

### Test-Integration

- `msw`-Tests beschreiben beobachtbares HTTP-Verhalten und nicht interne Implementierungsdetails.
- Modul-Mocks bleiben fuer rein lokale Fachlogik zulaessig; `msw` ist kein Zwang fuer jeden Test.
- Gemeinsame Handler-Factories und Reset-Regeln muessen dokumentiert und wiederverwendbar sein.

### Property-based Testing

- `fast-check` wird nur dort verpflichtend geprueft, wo Invarianten oder grosse Eingaberaeume vorliegen.
- Jede neue Property braucht eine knappe Aussage darueber, welche Invariante abgesichert wird.

## Exit Criteria

- Formular-Piloten verwenden dieselben dokumentierten RHF-Patterns ohne view-spezifische Sonderverdrahtung.
- Pilot-Formulare bilden Feldfehler, Summary-Fehler und Fokusfuehrung konsistent ueber gemeinsame Studio-Primitiven ab.
- Pilot-HTTP-Tests verwenden `msw` statt direkter `fetch`-Stubs, ohne bestehende Live-E2E-Anforderungen zu ersetzen.
- Fuer `fast-check` existiert eine kleine dokumentierte Erstmenge an Hotspots mit nachvollziehbaren Invarianten und akzeptabler Laufzeit.
- Die Entwicklerdokumentation beschreibt Entscheidungskriterien dafuer, wann Migration verpflichtend, optional oder unnoetig ist.

## Migration Plan

1. Foundations als Dependencies und Workspace-Standards einführen.
2. Gemeinsame Adapter, Test-Helfer und Hotspot-Definitionen bereitstellen.
3. Pilot-Flows in Account/Admin/Content sowie erste HTTP-nahe Tests schrittweise umstellen.
4. Nach erfolgreicher Pilotphase weitere neue oder grundlegend ueberarbeitete Flows an dieselben Standards binden.
5. Kritische Kernmodule selektiv mit `fast-check` absichern.

## Open Questions

- Welche exakten RHF-Adapter oder Wrapper werden in `packages/studio-ui-react` benoetigt, bevor Pilotmigrationen starten?
- Welche Kernmodule werden initial als `fast-check`-Hotspots gefuehrt?
