# Test Quality Review – Template

Nutze dieses Template für Reviews zu Tests, Coverage und Verifikationsstrategie.

## Entscheidung

- Test-Reifegrad: [Low | Medium | High]
- Empfehlung: [Merge-OK | Merge mit Auflagen | Merge-Blocker]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)

- Punkt 1
- Punkt 2
- Punkt 3

## Shift-Left Bewertung

- Reifegrad: [Früh validiert | Teilweise spät validiert | Überwiegend spät validiert]
- Evidenz (kurz):

## Befundübersicht

| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|

## Detail-Findings

### T1 – Kurztitel

- Beschreibung: …
- Impact/Risiko (Regression, Flake, Scheinsicherheit): …
- Evidenz/Quelle: (Tests, Targets, Coverage-Gate, CI)
- Empfehlung/Abhilfe: …
- Direkt im PR fixbar? [Ja/Nein]

## Checkliste (Status)

- [ ] Passende Testebene gewählt (unit / integration / e2e)
- [ ] Verhaltensänderungen haben passende Tests
- [ ] Coverage-Risiko gegen Baseline / Floors bewertet
- [ ] Kritische Pfade haben Repro- oder Negativtests
- [ ] Empfohlene Nx-Targets sind konkret benannt
- [ ] Shift-left-Nachweise vorhanden (Zwischenläufe pro Änderungsblock, nicht nur Endlauf)
- [ ] Exemptions / `passWithNoTests` sind bewusst bewertet

## Empfohlene Commands

- `pnpm nx affected -t test:unit,test:types`
- `pnpm nx affected -t test:coverage`
- `pnpm nx affected -t test:e2e`

## Anhänge

- Eingesetzte Inputs: (Workflows, Coverage-Baseline, Targets, Tests)
