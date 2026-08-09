# Change: Rückmeldung für destruktive Aktionen standardisieren

## Why

Lösch-, Archivierungs- und vergleichbare destruktive Aktionen unterscheiden sich fachlich erheblich: Manche Ergebnisse sind innerhalb eines definierten Zeitfensters reversibel, andere sind endgültig oder nur über einen separaten Wiederherstellungspfad korrigierbar. Ein pauschales Toast- oder Undo-Muster würde diese Unterschiede verdecken und könnte eine Wiederherstellbarkeit versprechen, die der Serververtrag nicht besitzt.

Das Studio benötigt deshalb einen gemeinsamen, kontextbezogenen UX- und Accessibility-Vertrag, der vor der Darstellung zwischen reversiblen, irreversiblen und konfliktbehafteten Aktionen unterscheidet.

## What Changes

- Destruktive Aktionen werden anhand ihres serverseitig belegten Wiederherstellungsvertrags klassifiziert.
- Reversible Aktionen erhalten eine kontextbezogene Undo-Möglichkeit mit serverautoritativem Zeitfenster und idempotenter Semantik.
- Irreversible oder hochwirksame Aktionen verwenden eine echte Bestätigung mit klar benanntem Ziel und Konsequenz.
- Fehler und fehlgeschlagene Wiederherstellungen bleiben persistent am betroffenen Kontext sichtbar.
- Host und Plugins verwenden gemeinsame UI-Primitives, ohne eigene Bestätigungs-, Undo- oder Toast-Infrastrukturen aufzubauen.

## Approval Status

Dieser Change hält den Folgeumfang dauerhaft fest, ist aber noch nicht zur Implementierung freigegeben. Vor der Umsetzung müssen die Referenzaktionen und ihre tatsächlichen Restore-/Hard-Delete-Verträge bestätigt werden.

Related change: `standardize-save-action-feedback` verantwortet ausschließlich normales Create-/Update-Speicherfeedback.

## Scope Clarification

- Im Scope:
  - Delete, Archive, Restore und vergleichbare destruktive Aktionen
  - reversible und irreversible Ergebnisrückmeldung
  - Bestätigungen, Undo, Konflikte, persistente Fehler und Accessibility
- Nicht im Scope:
  - normales Create-/Update-Speicherfeedback
  - Job-/Progress-Rückmeldungen
  - allgemeine kontextlose Toasts
  - eine generische Feedback-Klassen-Registry

## Success Metrics

- Keine UI bietet Undo an, wenn der Serververtrag keine belastbare Wiederherstellung unterstützt.
- Irreversible Aktionen benennen Ziel, Konsequenz und Abbruchmöglichkeit vor der Ausführung eindeutig.
- Reversible Aktionen können innerhalb des belegten Zeitfensters serverautoritativ wiederhergestellt werden.
- Fehler, Konflikte und fehlgeschlagene Undo-Versuche verschwinden nicht automatisch.
- Host- und Plugin-Flows verwenden dieselben Basisprimitives und Accessibility-Regeln.

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
