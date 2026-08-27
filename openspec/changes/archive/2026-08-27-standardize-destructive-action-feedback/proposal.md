# Change: Rückmeldung für destruktive Aktionen ohne Undo standardisieren

## Why

Lösch-, Archivierungs- und vergleichbare destruktive Aktionen werden heute über unterschiedliche Dialoge, browsernative Bestätigungen und Rückmeldungen ausgeführt. Dadurch bleiben Ziel, Konsequenz, laufender Zustand und Fehler nicht überall gleich verständlich oder zugänglich.

Das Studio benötigt deshalb einen gemeinsamen, kontextbezogenen UX- und Accessibility-Vertrag. Dieser Change führt bewusst kein Undo ein: Eine spätere Wiederherstellung bleibt eine eigenständige fachliche Aktion und wird nicht als kurzfristige Rücknahme der gerade ausgeführten Mutation dargestellt.

## What Changes

- Destruktive Aktionen verwenden eine echte Bestätigung mit klar benanntem Ziel und konkreter Konsequenz.
- Der Bestätigungsdialog bildet den laufenden Mutationszustand ab und verhindert unbeabsichtigte Mehrfachausführung.
- Erfolgreiche Ergebnisse bleiben im nächstgelegenen stabilen Detail-, Listen- oder Bereichskontext nachvollziehbar.
- Fehler bleiben persistent am betroffenen Dialog- oder Seitenkontext sichtbar.
- Host und Plugins verwenden gemeinsame UI-Primitives, ohne eigene Bestätigungs-, Undo- oder Toast-Infrastrukturen aufzubauen.
- Alle bestehenden destruktiven Plugin-Flows werden auf diesen Vertrag migriert; die Einführung beschränkt sich nicht auf Referenzflüsse.

## Approval Status

Der Change wurde am 25. August 2026 gemeinsam mit `standardize-plugin-operation-feedback` zur Umsetzung freigegeben. Undo ist ausdrücklich nicht Bestandteil des freigegebenen Produktumfangs.

Related change: `standardize-save-action-feedback` verantwortet ausschließlich normales Create-/Update-Speicherfeedback.

## Scope Clarification

- Im Scope:
  - Delete, Archive und vergleichbare destruktive Aktionen
  - persistierte Einzel- und Bulk-Löschungen, hochwirksame Resets sowie lokale Entwurfsentfernungen in Plugins
  - Bestätigung, laufender Zustand, stabile Ergebnisrückmeldung, persistente Fehler und Accessibility
- Nicht im Scope:
  - Undo, zeitlich begrenzte Rücknahme oder clientseitige Scheinwiederherstellung
  - fachliche Restore-Flows; diese bleiben eigenständige Aktionen
  - normales Create-/Update-Speicherfeedback
  - Job-/Progress-Rückmeldungen
  - allgemeine kontextlose Toasts
  - eine generische Feedback-Klassen-Registry
  - nicht-destruktive Sicherheitsabfragen für Push-Versand, degradierte Feldkorrekturen oder Holiday-Overwrite

## Success Metrics

- Destruktive Aktionen benennen Ziel, Konsequenz und Abbruchmöglichkeit vor der Ausführung eindeutig.
- Eine laufende destruktive Mutation kann nicht versehentlich mehrfach ausgelöst oder durch Schließen des Dialogs verdeckt werden.
- Erfolgreiche Ergebnisse sind im nächstgelegenen stabilen Kontext sichtbar und nicht von einem globalen Toast abhängig.
- Technische und fachliche Fehler verschwinden nicht automatisch.
- Host- und Plugin-Flows verwenden dieselben Basisprimitives und Accessibility-Regeln.
- Kein bestehender destruktiver Plugin-Flow verwendet danach browsernative Bestätigungen oder `StudioConfirmDialog` als Löschdialog.

## Impact

- Affected specs:
  - `action-feedback-platform`
- Expected affected code:
  - `packages/studio-ui-react/`
  - destruktive Host- und Plugin-Flows nach bestätigter Inventur
- Affected arc42 sections:
  - `docs/architecture/04-solution-strategy.md`
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
