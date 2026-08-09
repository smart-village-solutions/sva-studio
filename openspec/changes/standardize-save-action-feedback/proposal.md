# Change: Kontextgebundenes Speicherfeedback für Studio und Plugins

## Why

Speicheraktionen werden im Studio heute je nach Host- oder Plugin-Formular unterschiedlich rückgemeldet. Erfolg erscheint teilweise als separate Statusmeldung, teilweise fehlt ein eigener Pending-Zustand, und technische Fehler sind nicht durchgehend persistent und mit einer konkreten Wiederholungsaktion verbunden.

Für normale Speicheraktionen existiert mit dem Formular und seinem Speichern-Button bereits ein eindeutiger sichtbarer Kontext. Eine globale Toast-, Modal- oder Feedback-Registry würde diesen Kontext schwächen und zusätzliche Ownership erzeugen. Benötigt wird stattdessen ein kleiner, hostverantworteter UI-Standard, den Host- und Plugin-Formulare über `@sva/studio-ui-react` gemeinsam verwenden.

## What Changes

- `@sva/studio-ui-react` erhält einen kanonischen Save-Button mit den Zuständen `Speichern`, `Wird gespeichert…` und `✓ Gespeichert`.
- Der Erfolgszustand bleibt zwei Sekunden sichtbar und kehrt bei einer neuen Formulareingabe sofort zum Standardzustand zurück.
- Validierungsfehler bleiben feldnah; bei mehreren Fehlern kann zusätzlich eine verlinkte Zusammenfassung oberhalb des Formulars erscheinen.
- Technische sowie API-/Serverfehler werden persistent im Formular oder betroffenen Bereich dargestellt und können eine konkrete Aktion wie `Erneut versuchen` anbieten.
- Erfolgreiche Create-Flows wechseln auf die neu erzeugte Detailroute und übergeben den einmaligen Erfolgszustand transient und typsicher.
- Normale Speicherergebnisse verwenden weder Toasts noch Modals oder Overlays.
- Der erste Implementierungs-PR liefert die gemeinsamen UI-Primitives und migriert mit `/interfaces` und dem News-Editor je einen Host- und Plugin-Referenzfluss.

## PR-Schnitt

### PR 1: Foundation und Referenzmigration

- gemeinsame Save- und persistente Fehler-Primitives in `@sva/studio-ui-react`
- Host-Referenzmigration `/interfaces`
- Plugin-Referenzmigration News einschließlich Create-zu-Detail-Übergang
- Komponenten-, Integrations- und Accessibility-Tests
- zugehörige Architektur- und Entwicklerdokumentation

### Spätere PRs in diesem Change

- inventarbasierte Migration weiterer Host-Formulare
- inventarbasierte Migration weiterer Plugin-Editoren
- Entfernung abgelöster Save-Erfolgsmeldungen und Save-Toasts

## Scope Clarification

- Im Scope:
  - normale Create- und Update-Speicheraktionen mit sichtbarem Formular- oder Bereichskontext
  - Buttonstatus, feldnahe Validierung, optionale Fehlerzusammenfassung und persistente technische Fehler
  - sichere Behandlung partieller Speicherergebnisse
  - einheitliche Accessibility- und Timing-Regeln
- Nicht im Scope:
  - allgemeine Action-Feedback-Outcomes in `@sva/core`
  - pluginseitig registrierbare Feedback-Klassen oder eine Feedback-Registry in `@sva/plugin-sdk`
  - globale Feedback-Surfaces in der Layout-Shell
  - Delete/Undo, blockierende Bestätigungen sowie Progress- oder Job-Feedback
  - eine allgemeine Inbox- oder Workflow-Plattform

Diese ausgeschlossenen Bereiche benötigen bei nachgewiesenem Bedarf einen eigenen OpenSpec-Change. Sie werden nicht vorsorglich als Erweiterungspunkte in den Save-Vertrag eingebaut.

## Related Follow-up Changes

- `standardize-destructive-action-feedback`: Delete/Undo, irreversible Aktionen, Bestätigungen und Restore-Konflikte
- `add-contextless-action-feedback`: globale Kurzrückmeldungen für Aktionen ohne geeigneten stabilen Kontext
- `standardize-plugin-operation-feedback`: Start-, Progress-, Terminal- und Fehlerfeedback generischer Plugin-Operations-Jobs

Diese Changes halten den Restumfang dauerhaft fest, besitzen aber jeweils eine eigene Design- und Implementierungsfreigabe.

## Success Metrics

- Der Speichern-Button zeigt in den Referenzflüssen zuverlässig `Speichern`, `Wird gespeichert…` und für zwei Sekunden `✓ Gespeichert`.
- Eine neue Eingabe beendet einen sichtbaren Erfolgszustand unmittelbar.
- Create-Flows zeigen den einmaligen Erfolgszustand auf der neu erzeugten Detailseite, ohne ihn in Search-Params oder dauerhaftem Zustand abzulegen.
- Validierungsfehler sind mit den betroffenen Feldern verknüpft; technische Fehler bleiben bis zu einer fachlich begründeten Zustandsänderung sichtbar.
- Partielle Fehler werden nicht als vollständig gespeichert dargestellt und bieten, soweit sicher möglich, eine spezifische Wiederholungsaktion.
- Normale Speicherergebnisse erzeugen keinen Toast und öffnen kein Modal oder Overlay.
- Host- und Plugin-Referenzfluss verwenden dieselben Primitives und Verhaltensregeln.

## Impact

- Affected specs:
  - `action-feedback-platform`
- Affected code in PR 1:
  - `packages/studio-ui-react/`
  - `apps/sva-studio-react/src/routes/interfaces/`
  - `packages/plugin-news/`
- Affected code in later migration PRs:
  - weitere formularführende Host- und Plugin-Pakete gemäß Migrationsinventur
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
