# i18n & Content Review – Template

Nutze dieses Template für Reviews zu Übersetzungsdisziplin, Content-Klarheit und Text-Governance.

## Entscheidung

- i18n-Reifegrad: [Low | Medium | High]
- Empfehlung: [direkt im PR fixen | Follow-up Issue]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)

- Punkt 1
- Punkt 2
- Punkt 3

## Befundübersicht

| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|

## Detail-Findings

### I18N1 – Kurztitel

- Beschreibung: …
- Impact/Risiko (Inkonsistenz, fehlende Übersetzung, unklare Sprache): …
- Evidenz/Quelle: (Komponente, Key-Datei, Doku)
- Empfehlung/Abhilfe: …

## Checkliste (Status)

- [ ] Keine harten UI-Strings ohne `t('key')`
- [ ] Keine gemischte Nutzung von harten Strings und i18n-Keys
- [ ] de/en-Abdeckung ist plausibel dokumentiert
- [ ] Key-Namensgebung ist konsistent
- [ ] CTA-/Label-Texte sind verständlich und eindeutig
- [ ] Trennung zu Accessibility-Themen bleibt klar

## Anhänge

- Eingesetzte Inputs: (Komponenten, Guides, Translation-Keys, PR-Diff)
