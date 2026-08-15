# Plan 019: Public-Waste-App-Zustand und Actions trennen

> **Executor-Anweisung:** Erst UI- und Zustandsverhalten charakterisieren, dann Controller-/View-Verantwortungen minimal trennen. Accessibility und i18n bleiben verbindlich.

## Status

- **Priorität:** P1
- **Aufwand:** L
- **Risiko:** MITTEL
- **Abhängigkeit:** Plan 018 gemergt
- **Kategorie:** Produktions-UI, CRAP, Testbarkeit
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `CompletePublicWasteApp` in `public-waste-app.tsx:190` — cyclomatic 38, cognitive 79, 387 Zeilen, CRAP 349,9 critical; Datei 577 Zeilen, Fan-out 8, Route `index.tsx` ist produktiver Consumer.

## Warum

Kalenderfilter, PDF, iCal-Erinnerungen, E-Mail-Reminder, Panelzustand, Fehler/Erfolg und Rendering leben in einer Komponente. Das erhöht das Risiko versteckter Reset-, Reihenfolge- und Accessibility-Regressions. Ein fokussierter Controller-Hook plus kleine Views soll Zustandsübergänge isolieren, ohne sichtbares oder URL-Verhalten zu ändern.

## Ist-Zustand

- `apps/public-waste-calendar-web/src/components/public-waste-app.tsx:190-576` hält zahlreiche lokale States/Effects und baut Reminder-/Exportdaten.
- Bestehende Tests decken Auswahl, Panels, Kalenderexport und Reminder teilweise ab.
- Bereits bearbeiteter Kalender-Loader (#994) liegt außerhalb des Scopes; kein erneutes Loader-Refactoring.

## Scope

**In Scope:** `public-waste-app.tsx`, höchstens zwei fachlich benannte Dateien im selben Component-Ordner, bestehender Test, OpenSpec `refactor-public-waste-app-state`, Doku/Changelog.

**Out of Scope:** Loader/Repository, Routen, API-/Tokenvertrag, PDF-/Occurrence-Algorithmen, CSS-Neugestaltung, sichtbare Copy oder neue Features.

## Schritte

1. Baseline: gezielter Public-Waste-App-Test und Types grün.
2. Characterization gegen Altcode: incomplete/complete; Fraction toggle und deferred Filter; Panel öffnen/wechseln/schließen; Location-Wechsel reset; Fraction-Wechsel löscht nur Reminderfeedback; PDF year/run/error; iCal mit vollständigen/unvollständigen Slots; E-Mail validation/success/failure/double-submit; fehlender Service; Keyboard, Fokus, `aria-expanded`/`aria-controls` und Live-Regionen; negative Kombinationen für Consent/E-Mail/Fraction/submit.
3. Characterization auf Altcode grün dokumentieren; OpenSpec strict validieren.
4. Frameworkfreie Reminder-Auswahlberechnung beibehalten/extrahieren und einen eng begrenzten Hook für Zustand/Actions schaffen. Views erhalten explizite Props; keine Provider/Factory und keine neue Basis-UI.
5. Keine hardcodierte neue Copy. Bestehende Texte nur dann anfassen, wenn planintern mit vorhandenen Translation-/Config-Verträgen ohne sichtbare Änderung möglich; sonst STOP statt Scope-Ausweitung.
6. Unit/Types/Lint/Build, Complexity, OpenSpec strict, File Placement, Changelog, `git diff --check` und falls sinnvoll WCAG-fokussierter Test.
7. New-only Audit für `public-waste-calendar-web`: PASS, Complexity/Dead Code/Duplication/Styling introduced jeweils 0; bei CRAP echte Coverage und Audit-Wiederholung.

## Fertig

- `CompletePublicWasteApp` ist kein Finding mehr; Zustandsübergänge sind explizit charakterisiert.
- Sichtbare UI, URLs, Resetreihenfolge, Accessibility und Reminder-/PDF-Verträge sind unverändert.
- Root- und unabhängiges UX/A11y-/Semantikreview freigegeben.

## STOP

- STOP bei notwendiger Loader-, API-, CSS- oder Copy-Vertragsänderung.
- STOP, wenn Plan 018 noch nicht gemergt oder derselbe Server-/Testscope driftet.
- STOP, wenn die Extraktion mehr als zwei neue Ownership-Dateien oder eine generische UI-Abstraktion verlangt.
