# Change: Globale Rückmeldung für kontextlose Aktionen einführen

## Why

Einige Aktionen besitzen nach ihrer Ausführung keinen geeigneten stabilen Bereich, in dem Erfolg oder Status unmittelbar sichtbar werden kann. Beispiele sind das Kopieren eines Links, der Start eines Exports oder eine Duplizieraktion ohne anschließenden Zielscreen. Für diese Fälle ist eine kurze globale Rückmeldung sinnvoll, sie darf aber nicht zum Ausweichpfad für normale Formular-, Fehler- oder Jobzustände werden.

## What Changes

- Das Studio erhält eine überprüfbare Zulässigkeitsregel für kontextlose Rückmeldungen.
- Eine hostverantwortete globale Surface stellt kurze Erfolgs- und Informationsmeldungen konsistent und zugänglich dar.
- Meldungen werden begrenzt, dedupliziert, pausierbar und manuell schließbar behandelt.
- Fehler mit weiterem Handlungsbedarf und Zustände mit einem stabilen Fachkontext werden nicht in flüchtige globale Meldungen verschoben.
- Plugins verwenden einen öffentlichen Hostpfad und bauen keinen eigenen Toast-Stack auf.

## Approval Status

Dieser Change hält den Folgeumfang dauerhaft fest, ist aber noch nicht zur Implementierung freigegeben. Vor der Umsetzung sind die erste Aktionsinventur, die zulässigen Meldungsarten und der öffentliche Emissionspfad zu bestätigen.

Related change: `standardize-save-action-feedback` schließt normale Speicherergebnisse ausdrücklich aus dieser globalen Surface aus.

## Scope Clarification

- Im Scope:
  - kurze Rückmeldung für tatsächlich kontextlose Aktionen
  - Host-Surface, Queueing, Deduplizierung, Dismiss und Accessibility
  - öffentlicher Nutzungsvertrag für Host und Plugins
- Nicht im Scope:
  - Speicher-, Validierungs- oder persistente technische Fehler
  - Delete/Undo und Bestätigungen
  - langlebige Job-/Progress-Zustände
  - allgemeine pluginregistrierte Feedback-Klassen

## Success Metrics

- Jede globale Meldung besitzt einen dokumentierten Grund, warum kein besserer stabiler Kontext existiert.
- Normale Save-, Fehler- und Jobzustände werden nicht als Toast modelliert.
- Parallele Meldungen überfluten die Oberfläche und Live-Region nicht.
- Plugins können die Host-Surface nutzen, ohne einen eigenen globalen Renderer einzuführen.

## Impact

- Affected specs:
  - `action-feedback-platform`
  - `ui-layout-shell`
- Expected affected code:
  - `packages/studio-ui-react/`
  - `apps/sva-studio-react/`
  - öffentlicher Plugin-React-Vertrag nach freigegebener Grenzentscheidung
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
