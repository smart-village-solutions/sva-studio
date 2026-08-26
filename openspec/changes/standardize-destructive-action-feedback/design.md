## Context

Das Studio besitzt zahlreiche Delete-, Archive- und hochwirksame Administrationspfade. Sie verwenden teilweise gemeinsame Dialoge, teilweise browsernative Bestätigungen und teilweise nur lokale Fehlermeldungen. Die Rückmeldung soll diese Unterschiede auf einen gemeinsamen sicheren Interaktionsvertrag bringen, ohne eine Rücknahmefunktion einzuführen.

## Goals / Non-Goals

- Goals:
  - echte Entscheidungen vor destruktiven oder hochwirksamen Aktionen einholen
  - Ziel, Konsequenz und laufenden Mutationszustand eindeutig darstellen
  - erfolgreiche Ergebnisse im nächsten stabilen Kontext nachvollziehbar machen
  - fachliche und technische Fehler persistent im Handlungskontext darstellen
  - gemeinsame Host-/Plugin-Primitives und Accessibility-Regeln schaffen
- Non-Goals:
  - kein Undo und keine zeitlich begrenzte Rücknahme
  - keine Einführung oder Änderung fachlicher Restore-Verträge
  - keine allgemeine Notification- oder Feedback-Registry
  - keine Standardisierung normaler Save- oder Job-Flows

## Decisions

### Decision: Destruktives Feedback enthält kein Undo

Das Ergebnis einer destruktiven Aktion wird nicht über einen kurzfristigen Undo-Vertrag modelliert. Falls ein Fachbereich einen Restore-Pfad besitzt, bleibt dieser eine separat autorisierte und separat dargestellte Aktion. Die Feedback-Primitives kennen weder Restore-Fristen noch clientseitige Kompensation.

### Decision: Bestätigungen werden nur für echte Entscheidungen verwendet

Destruktive, hochwirksame oder konfliktbehaftete Aktionen verwenden einen modalen Bestätigungsdialog. Er benennt Objekt, Aktion und wesentliche Konsequenz, bietet einen eindeutigen Abbruch und stellt den Fokus nach Abbruch sinnvoll wieder her. Während der Mutation bleiben Bestätigung und Abbruch gesperrt, damit der laufende Zustand nicht verdeckt oder doppelt ausgelöst wird.

### Decision: Ergebnisse bleiben am nächsten stabilen Kontext

Wenn das Zielobjekt nach der Aktion nicht mehr sichtbar ist, erscheint der Erfolg in der nächstgelegenen stabilen Collection-, Listen- oder Bereichsoberfläche. Diese Rückmeldung verschwindet nicht automatisch und ist an genau den abgeschlossenen Navigationsübergang gebunden. Fehler verbleiben im Dialog oder im weiterhin sichtbaren Fachkontext und werden nicht als flüchtige globale Meldung dargestellt.

### Decision: Gemeinsame Primitives statt Feedback-Klassen

`@sva/studio-ui-react` verantwortet Bestätigungs-, Ergebnis- und Fehlerprimitives. Fachliche Berechtigung, Mutation, Zielbezeichnung, Konsequenztext und Fehlerübersetzung verbleiben im jeweiligen Host- oder Plugin-Flow.

Die zuvor erwogene allgemeine `ActionFeedbackOutcome`-/Feedback-Klassen-Registry ist keine Voraussetzung dieses Changes. Sie wird nur erneut bewertet, wenn mehrere umgesetzte Feedbackarten eine identische, nicht durch UI-Primitives abdeckbare Semantik belegen.

### Decision: Vollrollout folgt der Wirkung, nicht dem bisherigen Dialogtyp

Alle persistierten Einzel- und Bulk-Löschungen, hochwirksamen Resets und lokalen Entwurfsentfernungen in Plugins verwenden `StudioDestructiveActionDialog`. Browsernative Bestätigungen und `StudioConfirmDialog` bleiben für diese Wirkungen nicht bestehen.

Nicht-destruktive Sicherheitsentscheidungen werden nicht allein wegen ihres bisherigen Dialogtyps migriert. Dazu zählen die Bestätigung eines globalen Push-Versands, die Korrektur degradierter Felder und das Überschreiben des Feiertagszustands. Sie behalten den allgemeinen Bestätigungsdialog, weil das destruktive Primitive sonst seine fachliche Bedeutung verliert.

### Decision: Ergebnisdarstellung richtet sich nach dem verbleibenden Kontext

- Nach dem Löschen eines Content-Objekts navigiert das Plugin zur Inhaltsliste und übergibt genau einmal ressourcengebundenes Navigationsfeedback.
- Bei einer persistierten Löschung in einer weiterhin sichtbaren Fachliste bleibt der Dialog bis zum bestätigten Servererfolg offen; anschließend wird die Liste aktualisiert und zeigt ein persistentes Ergebnis.
- Bei einer lokalen Entwurfsentfernung ist der sichtbar aktualisierte Entwurf selbst der stabile Ergebniszustand. Es wird kein künstliches serverseitiges Erfolgsbanner erzeugt.
- Fehler asynchroner Mutationen bleiben im Dialog. Pending sperrt Bestätigung und Abbruch; der aufrufende Flow schützt zusätzlich gegen Mehrfachausführung.

## Risks / Trade-offs

- Zu allgemeine Dialogtexte können die konkrete Konsequenz verschleiern. → Referenzflüsse müssen Objekt und Wirkung über fachliche Übersetzungen benennen.
- Ein Navigationserfolg kann beim späteren Zurückkehren erneut erscheinen. → Transienten Navigationszustand nach einmaliger Übernahme entfernen.
- Zu viele Bestätigungen erzeugen Ermüdung. → Nur tatsächlich destruktive oder hochwirksame Aktionen verwenden das Primitive.

## Migration Plan

1. Destruktive Aktionen und vorhandene Bestätigungsmuster inventarisieren.
2. Einen Host- und einen Plugin-Referenzfluss auswählen.
3. Gemeinsame Bestätigungs-, Ergebnis- und Fehlerprimitives implementieren.
4. Referenzflüsse mit Fehler-, Navigation- und Accessibility-Tests migrieren.
5. Content-Plugins mit Detail-Löschung und Navigationsergebnis vollständig migrieren.
6. Persistierte Einzel-, Bulk- und Reset-Flows in Waste vollständig migrieren.
7. Lokale Entwurfsentfernungen in Surveys und Waste auf dieselbe Bestätigungssemantik migrieren.
8. Repositoryweit belegen, dass destruktive Plugin-Flows weder browsernative Bestätigungen noch `StudioConfirmDialog` verwenden.

## Open Questions

- Keine. Der Produktentscheid gegen Undo ist getroffen.
- Die Referenzflüsse bleiben die gemeinsame Basis; die Freigabe vom 25. August 2026 wurde anschließend auf alle bestehenden destruktiven Plugin-Flows erweitert.
