## Context

`CompletePublicWasteApp` verwaltet bisher Kalenderdialog, Fraktionsfilter, Panelumschaltung, Reminder-Slots, E-Mail-Formular und PDF-Aktion gemeinsam. Besonders Standort- und Fraktionswechsel besitzen unterschiedliche Reset-Verträge: Ein Standortwechsel setzt Panel und Formular vollständig zurück, ein Fraktionswechsel entfernt nur Reminder-Feedback.

## Goals / Non-Goals

- Goals:
  - Zustand und konkrete Action-Ansichten fachlich trennen
  - bestehende Reset-, Prioritäts- und Exactly-once-Verträge bewahren
  - Reminder-Auswahl unabhängig von der Darstellung berechnen
  - Tastatur-, ARIA- und Live-Region-Verhalten unverändert lassen
- Non-Goals:
  - sichtbare Texte, Styling oder Basis-UI ändern
  - Loader, API, Token, PDF-Erzeugung oder Kalenderprojektion ändern
  - generische Provider-, Factory- oder Action-Engine einführen

## Decisions

- Decision: `PublicWasteApp` bleibt Eigentümer von Standortkopf, Fraktionsfilter, Kalenderansichten und Termindialog.
- Decision: Ein Public-Waste-spezifischer Action-Hub rendert ausschließlich die bestehenden iCal-, PDF- und E-Mail-Panels.
- Decision: Der lokale Action-Zustand kapselt Panel-, Reminder- und Formularübergänge; die Reminder-Slot-Berechnung bleibt eine kleine I/O-freie Funktion.
- Decision: PDF-Auswahl und Download bleiben im bestehenden `usePublicWastePdfDownload`, damit kein zweiter PDF-Vertrag entsteht.
- Alternatives considered: Ein generischer Action-Provider oder neue Basis-Komponenten hätten ohne weitere Konsumenten zusätzliche Ownership geschaffen.

## Risks / Trade-offs

- Eine andere Effect-Reihenfolge könnte Formularwerte oder Feedback zu früh löschen. Characterization bindet Standort- und Fraktionswechsel getrennt.
- Eine unvollständige Slot-Auswahl könnte iCal oder E-Mail fälschlich freigeben. Vollständige und partielle Fraktionsmatrizen bleiben fail-closed getestet.
- Ein doppelter Submit könnte zwei Pending-Abos erzeugen. Der laufende Zustand und die Aufrufzahl werden explizit getestet.

## Migration Plan

Keine Daten- oder Vertragsmigration. Das Refactoring wird über Characterization, Zieltests, Types, Build, Complexity und New-only-Audits abgesichert und kann als einzelner Merge zurückgenommen werden.
