## Context

Das Studio besitzt Soft-Delete-, Tombstone-, Archive-, Restore- und Hard-Delete-Pfade mit unterschiedlichen fachlichen und technischen Garantien. Die Rückmeldung darf diese Unterschiede nicht auf einen einheitlichen vermeintlichen Undo-Button reduzieren.

## Goals / Non-Goals

- Goals:
  - serverautoritativ zwischen reversibel und irreversibel unterscheiden
  - echte Entscheidungen vor irreversiblen oder hochwirksamen Aktionen einholen
  - Undo nur mit belegtem Restore-Vertrag anbieten
  - Konflikte und technische Fehler persistent im Handlungskontext darstellen
  - gemeinsame Host-/Plugin-Primitives und Accessibility-Regeln schaffen
- Non-Goals:
  - keine clientseitige Scheinwiederherstellung
  - keine allgemeine Notification- oder Feedback-Registry
  - keine Standardisierung normaler Save- oder Job-Flows

## Decisions

### Decision: Wiederherstellbarkeit ist eine Servereigenschaft

Eine Aktion gilt nur dann als reversibel, wenn der zuständige Serververtrag einen autorisierten, getesteten und zeitlich definierten Restore- oder Compensating-Action-Pfad besitzt. Das bloße Wiedereinblenden eines entfernten Listeneintrags ist kein Undo.

### Decision: Bestätigungen werden nur für echte Entscheidungen verwendet

Irreversible, hochwirksame oder konfliktbehaftete Aktionen verwenden einen modalen Bestätigungsdialog. Er benennt Objekt, Aktion und wesentliche Konsequenz, bietet einen eindeutigen Abbruch und stellt den Fokus nach Abbruch sinnvoll wieder her. Routineaktionen mit sicherem Undo benötigen nicht automatisch eine vorgelagerte Bestätigung.

### Decision: Reversible Ergebnisse bleiben am nächsten stabilen Kontext

Wenn das Zielobjekt nach der Aktion nicht mehr sichtbar ist, erscheint das Ergebnis einschließlich Undo in der nächstgelegenen stabilen Collection-, Listen- oder Bereichsoberfläche. Das Undo-Zeitfenster stammt aus dem Serververtrag und wird nicht allein durch einen UI-Timer garantiert.

### Decision: Undo ist idempotent und konfliktfähig

Mehrfache Undo-Auslösung darf nicht zu mehrfacher Wiederherstellung führen. Abgelaufene Zeitfenster, konkurrierende Änderungen oder fehlende Berechtigungen werden als persistente, konkrete Zustände dargestellt. Ein fehlgeschlagenes Undo darf nicht als Erfolg verschwinden.

### Decision: Gemeinsame Primitives statt Feedback-Klassen

`@sva/studio-ui-react` verantwortet Bestätigungs-, Ergebnis- und Fehlerprimitives. Die fachliche Klassifikation, Berechtigung, Mutation und Restore-Semantik verbleiben im jeweiligen Host- oder Plugin-Flow.

Die zuvor erwogene allgemeine `ActionFeedbackOutcome`-/Feedback-Klassen-Registry ist keine Voraussetzung dieses Changes. Sie wird nur erneut bewertet, wenn mehrere umgesetzte Feedbackarten eine identische, nicht durch UI-Primitives abdeckbare Semantik belegen.

## Risks / Trade-offs

- Uneinheitliche Backend-Verträge können eine gemeinsame Undo-UX verhindern. → Zuerst vollständige Aktionsinventur und belegte Capability-Matrix erstellen.
- Ein langes Undo-Zeitfenster erhöht Zustands- und Konfliktkomplexität. → Serververtrag bleibt führend; UI verspricht keine längere Frist.
- Zu viele Bestätigungen erzeugen Ermüdung. → Bestätigungen auf tatsächliche irreversible oder hochwirksame Entscheidungen begrenzen.

## Migration Plan

1. Destruktive Aktionen und Restore-Verträge inventarisieren.
2. Einen reversiblen und einen irreversiblen Referenzfluss auswählen.
3. Gemeinsame Primitives und serverautoritative Zustände implementieren.
4. Referenzflüsse mit Konflikt-, Fehler- und Accessibility-Tests migrieren.
5. Weitere Flows anhand der bestätigten Matrix schrittweise migrieren.

## Open Questions

- Welche bestehende Aktion ist der belastbare reversible Referenzfall?
- Welche Hard-Delete- oder hochwirksame Aktion bildet den irreversiblen Referenzfall?
- Welche Restore-Zeitfenster und Konfliktcodes liefern die jeweiligen Serververträge tatsächlich?
