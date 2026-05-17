# Change: Hostgeführte Action-Feedback-Plattform für Studio und Plugins

## Why
Das Studio liefert nach Aktionen wie Speichern, Löschen, Validieren oder Starten von Langläufern bislang keine ausreichend einheitlichen Rückmeldemuster. Besonders rein toast-basierte oder flüchtige Meldungen sind fachlich zu schwach verankert, für Accessibility schwer kontrollierbar und zwischen Core-UI und Plugins inkonsistent.

Für eine erweiterbare Plugin-Plattform reicht weder ein starres, rein hostdefiniertes Notification-System noch ein freies, pluginseitiges Event-Modell. Benötigt wird ein hostgeführter Plattformvertrag, der konsistente UX- und A11y-Regeln erzwingt und zugleich registrierte fachliche Erweiterungen durch Plugins erlaubt.

## What Changes
- Einführung einer neuen Capability `action-feedback-platform` für strukturierte Action-Feedback-Outcomes, kanonische Host-Grundtypen und hostgeführte Accessibility-Regeln
- Deklarativer Registry-Vertrag für plugin-eigene Feedback-Klassen als validierte Erweiterungen eines kanonischen Host-Kerns
- Verankerung globaler Feedback-Surfaces und Live-Region-Verantwortung in der Layout-Shell
- Anbindung generischer Plugin-Operations-Jobs an dieselbe Feedback-Plattform für Start-, Progress- und Abschlussrückmeldungen
- Präzisierung des Plugin-Plattformvertrags, damit `@sva/plugin-sdk` generische Feedback-Class- und Outcome-Helfer bereitstellen darf, ohne fachlich zu werden

## Scope Clarification
- Muss:
  - strukturierte, hostgeführte Feedback-Outcomes statt rein impliziter Save/Delete-Meldungen
  - kanonische Host-Grundtypen mit festen UX- und A11y-Regeln
  - registrierte, namespaced Plugin-Erweiterungen mit Host-Validierung und Fallback
  - Shell-Vertrag für globale Feedback-Ausgabe und Screenreader-Ankündigungen
- Bewusste Abgrenzung:
  - kein vollständiges Visual-Design einzelner Banner/Toasts/Dialoge in diesem Change
  - keine eigenständige Inbox- oder Workflow-Plattform
  - keine Festlegung, dass jede Rückmeldung als Toast gerendert werden muss

## Success Metrics
- Save-, Delete-, Error- und Job-Feedback werden über ein gemeinsames Outcome-Modell beschrieben.
- Nicht registrierte oder ungültige plugin-eigene Feedback-Klassen werden deterministisch auf sichere Host-Klassen zurückgeführt.
- Globale Feedback-Ausgabe und Live-Region-Semantik bleiben hostgeführt und werden nicht von Plugins dupliziert.
- Langlaufende Aktionen können Start-, Progress- und Ergebnisrückmeldungen ohne ad-hoc Toast-Ketten ausdrücken.

## Impact
- Affected specs:
  - `action-feedback-platform`
  - `plugin-platform`
  - `plugin-operations-platform`
  - `ui-layout-shell`
- Affected code:
  - `packages/core/`
  - `packages/plugin-sdk/`
  - `packages/studio-ui-react/`
  - `apps/sva-studio-react/`
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
