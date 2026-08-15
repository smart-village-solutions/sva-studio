# Plan 020: Event-Detailformular-Serialisierung modularisieren

> **Executor-Anweisung:** Datums-, Medien-, Adress- und Kompatibilitätssemantik zuerst gegen Altcode fixieren. Keine produktive Änderung auf roter Baseline.

## Status

- **Priorität:** P1
- **Aufwand:** L
- **Risiko:** HOCH
- **Abhängigkeit:** keine
- **Kategorie:** Event-Datenintegrität, CRAP, Duplikation
- **Geplant auf:** `067e7a8e6`, 15. August 2026
- **Fallow vorher:** `mapEventsDetailFormValuesToInput` — cyclomatic 42, cognitive 53, 146 Zeilen, CRAP 48 critical bei hoher geschätzter Coverage; fünf weitere Complexity-/CRAP-Findings, Datei 406 Zeilen, MI 75,2, sieben direkte Konsumenten.

## Warum

Der Mapper normalisiert redaktionelle Inhalte, Medien, URLs, Adressen, Geo- und Datumsfelder in einen Mainserver-Vertrag. Viele unabhängige optionale Felder in einer Funktion machen Omit-/Fallback-Drift wahrscheinlich. Fachlich getrennte pure Serializer sollen das exakte Output-Shape erhalten.

## Ist-Zustand

- `packages/plugin-events/src/events.detail-form.ts:260-405` baut den Mutation-Input.
- Direkte Konsumenten sind Basis-, Content-, Settings-Tab und Detailseite.
- Mediennormalisierung dupliziert POI-Code, aber Plan 020 darf POI nicht ändern; ein Cross-Package-Owner ist nur zulässig, wenn bereits vorhanden und ohne neuen öffentlichen Vertrag nutzbar.

## Scope

**In Scope:** Event-Detailform-Modul, wenige interne Event-Serializer, `events.detail-form.test.ts`, bei Bedarf bestehende Event-Tab-Tests, OpenSpec `refactor-events-detail-form-serialization`, Doku/Changelog.

**Out of Scope:** POI-Dateien, Mainserver-Schema, UI-Tabs, sichtbare Texte, neue Shared-Package-API, Datums-/Zeitzonen-Verhaltenskorrekturen.

## Schritte

1. Baseline: gezielter Detailform-Test und relevante Tab-Tests über `plugin-events:test:unit`, danach Types.
2. Characterization gegen Altcode: minimal/vollständig; jedes optionale Feld; empty/undefined/null/false/0; Media mit ungültigen/teilweisen Dimensionen und URLs; Address/Geo; all-day vs. timed, Start/End, lokale Zeit und Offsetgrenzen; Reihenfolge von Arrays; Kompatibilitätswerte; invalid inputs; Output deep-equal.
3. OpenSpec strict validieren.
4. Pure Serializer nach Domäne (Editorial/Media/Address/Date) extrahieren; Hauptmapper assembliert nur. Bestehende Workspace-Helfer bevorzugen, aber POI-Scope nicht anfassen.
5. Unit/Types/Lint/Build, Complexity, OpenSpec strict, File Placement, Changelog, `git diff --check`.
6. Vor dem ersten Draft-Push und nach jeder relevanten Revision: `pnpm exec fallow audit --base origin/main --workspace @sva/plugin-events --explain --format json`; PASS und alle introduced-Zähler inklusive Styling 0; Coverage-Audit falls CRAP attribution coverageabhängig ist.

## Fertig

- Alle Complexity-/CRAP-Zielfindings in `events.detail-form.ts` beseitigt, ohne neuen Moderate-CRAP-Fund.
- Kombinatorische Datums-/Medien-/Adressmatrix und Output-Parität grün.
- Keine neue Cross-Package-Abstraktion ohne belegte Owner; Root- und unabhängiges Datenintegritätsreview freigegeben.
- Der bestehende packageübergreifende Medienclone `dup:714de343` zwischen Events und POI ist ausdrücklich kein Zielfinding dieses Plans; er darf weder ausgeweitet noch durch eine rein metrische Abstraktion verschleiert werden (`duplication_introduced=0`).

## STOP

- STOP bei unklarer all-day/Zeitzonen-Semantik oder widersprüchlichen Alt-Tests.
- STOP, wenn POI- oder Mainserver-Verträge geändert werden müssten.
- STOP, wenn ein aktiver Event-PR dieselben Serializer ändert.
