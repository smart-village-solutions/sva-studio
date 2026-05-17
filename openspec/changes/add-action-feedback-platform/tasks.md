## 1. Spezifikation und Architektur
- [ ] 1.1 Neue Capability-Deltas für `action-feedback-platform` erstellen und mit dem abgestimmten Design konsistent halten
- [ ] 1.2 Deltas für `plugin-platform`, `plugin-operations-platform` und `ui-layout-shell` ergänzen
- [ ] 1.3 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08` und `10` aktualisieren oder eine begründete Abweichung dokumentieren

## 2. Core- und SDK-Vertrag
- [ ] 2.1 Stabile Typen für `ActionFeedbackOutcome`, kanonische Grundtypen, Folgeaktionen und A11y-Policies in `@sva/core` einführen
- [ ] 2.2 Generische Registrierungs- und Emissions-Helper in `@sva/plugin-sdk` ergänzen, inklusive Namespace- und Pflichtfeldvalidierung
- [ ] 2.3 Sichere Host-Fallback-Logik für unregistrierte oder inkompatible Feedback-Klassen festlegen

## 3. Host-UI und Shell
- [ ] 3.1 Host-Renderer für globale Feedback-Surfaces und Live-Region-Management einführen
- [ ] 3.2 Layout-Shell um die erforderlichen globalen Feedback-Anker erweitern
- [ ] 3.3 Feste Regeln für Save-, Delete-, Error- und Progress-/Job-Rückmeldungen in den Host-Renderer übernehmen

## 4. Plugin-Operations und Migration
- [ ] 4.1 Start-, Progress- und Ergebnisrückmeldungen generischer Plugin-Operations-Jobs an das neue Outcome-Modell anbinden
- [ ] 4.2 Bestehende Save/Delete/Error-Flows in ausgewählten Core- oder Plugin-Screens auf die Plattform migrieren
- [ ] 4.3 Plugin-Authoring-Guidelines für eigene Feedback-Klassen dokumentieren

## 5. Tests und Verifikation
- [ ] 5.1 Unit-Tests für Registry-Validierung, Namespace-Checks und Host-Fallbacks ergänzen
- [ ] 5.2 Komponenten- oder Integrationstests für Shell-Feedback-Surfaces, Live-Region-Semantik und Priorisierung ergänzen
- [ ] 5.3 Relevante Gates ausführen: `pnpm nx affected --target=test:unit --base=origin/main`, bei Typänderungen zusätzlich `pnpm nx affected --target=test:types --base=origin/main`
- [ ] 5.4 `openspec validate add-action-feedback-platform --strict` ausführen
