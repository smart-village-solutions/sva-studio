# Change: Rückmeldung für Plugin-Operations-Jobs standardisieren

## Why

Die Plugin-Operations-Plattform besitzt bereits persistente Jobdatensätze, stabile Status, Progress-Metadaten sowie Monitoring-Listen und -Details. Ohne einen verbindlichen UI-Vertrag können Start, Fortschritt, Abschluss und Fehler dennoch pluginlokal divergieren oder als kurzlebige Toast-Ketten erscheinen, obwohl ein dauerhafter Jobkontext existiert.

## What Changes

- Jobstart wird im auslösenden Bereich mit Job-ID und Link zum dauerhaften Detailkontext bestätigt.
- Laufende Jobs werden aus dem zentralen Host-Jobdatensatz und nicht aus pluginlokalem UI-Zustand dargestellt.
- Terminalzustände bleiben in Jobdetail, Monitoring oder einem fachlich gebundenen Bereich nachvollziehbar.
- Fehler, Retry und Cancel werden nur angeboten, wenn der Hostvertrag die jeweilige Aktion autorisiert und sicher unterstützt.
- Plugins liefern fachliche Labels und Progress-Metadaten über bestehende Jobtypen; der Host besitzt Statusdarstellung und Accessibility.

## Approval Status

Dieser Change hält den Folgeumfang dauerhaft fest, ist aber noch nicht zur Implementierung freigegeben. Vor der Umsetzung sind Referenzjob, Startkontext, Retry-/Cancel-Capabilities und die Beziehung zwischen Fachbereich und Monitoring zu bestätigen.

Related change: `standardize-save-action-feedback` verantwortet synchrone Formular-Saves und erzeugt keinen konkurrierenden Jobstatusvertrag.

## Scope Clarification

- Im Scope:
  - Start-, Queue-, Lauf-, Retry-, Erfolgs-, Fehler- und Cancel-Rückmeldung generischer Plugin-Operations-Jobs
  - fachlicher Startkontext sowie dauerhafte Monitoring-/Detailkontexte
  - Polling, Progress, Terminalzustände und sichere Folgeaktionen
- Nicht im Scope:
  - normale synchrone Save-Aktionen
  - allgemeine kontextlose Toasts
  - eine neue Jobpersistenz oder ein neuer Runner
  - pluginregistrierbare Feedback-Klassen

## Success Metrics

- Jeder gestartete Job ist über seine stabile Job-ID und einen dauerhaften Hostkontext nachvollziehbar.
- Lauf- und Terminalzustände stammen aus dem zentralen Jobvertrag.
- Fehler verschwinden nicht automatisch und Retry/Cancel erscheinen nur bei belegter Capability.
- Plugins benötigen keine eigene Job-Feedback-Infrastruktur oder Toast-Kette.

## Impact

- Affected specs:
  - `action-feedback-platform`
  - `plugin-operations-platform`
- Expected affected code:
  - `packages/studio-ui-react/`
  - `apps/sva-studio-react/src/routes/monitoring/`
  - Plugin-Operations-React-Anbindungen und ein bestätigter Referenzjob
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
