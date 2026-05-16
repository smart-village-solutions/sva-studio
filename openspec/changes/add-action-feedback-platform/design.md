## Context

Das Studio benötigt eine einheitliche Antwort auf die Frage, wie Aktionen fachlich und zugänglich rückgemeldet werden. Heute können Save-, Delete-, Error- und Job-Meldungen kontextarm, flüchtig oder pluginlokal divergent ausfallen. Das ist sowohl ein UX- als auch ein Plattformproblem.

Die Lösung muss zwei Ziele gleichzeitig erfüllen:
- starke globale Governance für UX, Accessibility und Fallbacks
- ausreichend fachliche Freiheit für Plugins

## Goals / Non-Goals

- Goals:
  - ein strukturiertes Outcome-Modell für Core und Plugins
  - ein kleiner Satz kanonischer Host-Grundtypen
  - registrierte Plugin-Erweiterungen mit Namespace- und A11y-Validierung
  - hostgeführte globale Feedback-Surfaces und Live-Region-Semantik
  - ein gemeinsamer Vertrag für Job-Feedback statt ad-hoc Toast-Ketten
- Non-Goals:
  - kein finales visuellen Feindesign einzelner Komponenten
  - keine freie pluginseitige Kontrolle über globale Feedback-Renderer
  - keine allgemeine Inbox- oder Prozessplattform

## Decisions

### Decision: Strukturierte Action-Feedback-Outcomes statt impliziter Meldungen

Aktionen liefern ein strukturiertes Outcome-Objekt oder werden server- bzw. UI-seitig in ein solches abgebildet. Das Outcome beschreibt mindestens Ergebnisart, referenzierte Feedback-Klasse, betroffenen Fachkontext und optionale Folgeaktionen wie `undo`, `retry` oder `openDetails`.

Dadurch wird aus einer bloßen UI-Meldung ein stabiler Plattformvertrag, der von Core-UI, Plugin-SDK, Shell, Tests und Telemetrie gemeinsam verstanden werden kann.

### Decision: Kleiner kanonischer Host-Kern plus registrierte Plugin-Erweiterungen

Der Host definiert einen kleinen Satz von Grundtypen wie `inline-success`, `undoable-delete`, `persistent-error`, `form-validation-error`, `background-job-progress`, `background-job-result`, `blocking-confirmation` und `non-blocking-warning`.

Plugins dürfen eigene Klassen definieren, müssen diese aber namespaced registrieren und an genau einen Host-Grundtyp anbinden. Nicht registrierte oder ungültige Klassen werden nicht nativ vertraut.

### Decision: Host besitzt Rendering, Priorisierung und Accessibility

Nur der Host rendert globale Feedback-Surfaces, wählt Ankündigungskanäle, priorisiert konkurrierende Rückmeldungen und steuert Fokus- sowie Dismiss-Verhalten. Plugins liefern Semantik, aber keine eigene globale Feedback-Infrastruktur.

Das verhindert konkurrierende Toast-Stacks, uneinheitliche Live-Regionen und schwer testbare Accessibility-Abweichungen.

### Decision: Save, Delete, Error und Job-Rückmeldungen folgen festen Standardmustern

Der Vertrag erzwingt keine starre Einzelkomponente, aber feste Verhaltensklassen:
- Save-Erfolg ist standardmäßig inline oder regionsnah, global nur ergänzend
- Delete ist standardmäßig undo-fähig
- Fehler sind persistent und kontextbezogen
- Langläufer werden als Progress-/Job-Zustände statt Toast-Ketten modelliert

Damit ist das System fachlich präzise genug, ohne UI-Design unnötig früh zu betonieren.

## Risks / Trade-offs

- Risiko: zu viele kanonische Klassen machen den Vertrag schwer verständlich.
  - Mitigation: kleiner Host-Kern, Erweiterungen nur für echte Fachsemantik.
- Risiko: zu viel Plugin-Freiheit untergräbt Konsistenz.
  - Mitigation: Registrierungspflicht, Namespace-Checks, A11y-Validierung, Host-Fallbacks.
- Risiko: globale Shell-Verantwortung kann bestehende UI-Muster verdrängen.
  - Mitigation: Shell regelt nur globale Surfaces und Live-Regionen; inline- oder regionsnahe Verankerung bleibt weiterhin möglich.

## Migration Plan

1. Neue Capability `action-feedback-platform` mit Outcome-, Registry- und Accessibility-Vertrag spezifizieren.
2. Plugin-Plattform- und Plugin-Operations-Specs an den neuen Vertrag anbinden.
3. Shell-Spec um globale Feedback-Surfaces und Live-Region-Verantwortung erweitern.
4. Core-Typen, SDK-Registry und Host-Renderer in der Implementierung einführen.
5. Bestehende Save/Delete/Error- und Job-Flows schrittweise auf das Outcome-Modell migrieren.

## Open Questions

- Welche bestehenden Screens bilden die erste Migrationswelle?
- Welche Folgeaktionen wie `undo`, `retry` oder `openJob` werden in Phase 1 bereits streng typisiert?
- Ob zusätzlich eine ADR für das plattformweite Feedback-Modell benötigt wird, falls während der Umsetzung neue Querschnittsrisiken sichtbar werden
