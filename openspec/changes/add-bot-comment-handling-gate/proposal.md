# Change: Bearbeitungsnachweis fuer Bot-PR-Kommentare als Qualitygate einfuehren

## Why

PRs enthalten zunehmend Review-Hinweise von `Copilot` und `chatgpt-codex-connector[bot]`. Diese Hinweise sollen nicht stillschweigend liegen bleiben, sondern vor dem Merge nachvollziehbar bearbeitet werden. "Bearbeitet" bedeutet dabei nicht zwingend, dass das Feedback umgesetzt wird, sondern dass fuer jeden relevanten Bot-Kommentar eine bewusste Entscheidung dokumentiert ist.

## What Changes

- Einfuehrung eines verbindlichen Bearbeitungsnachweises fuer Bot-Kommentare in Pull Requests
- Abdeckung sowohl fuer Review-Threads auf Diffs als auch fuer normale PR-Konversationskommentare
- Festlegung, welche Nachweise als "bearbeitet" gelten:
  - umgesetzt und beantwortet
  - bewusst nicht umgesetzt, aber nachvollziehbar beantwortet
  - bei Review-Threads zusaetzlich als resolved markiert
- Einfuehrung eines blockierenden PR-Qualitygates, das unbearbeitete Bot-Kommentare vor Merge sichtbar macht
- Definition eines minimalen, auditierbaren Statusmodells fuer akzeptierte, abgelehnte oder anderweitig erledigte Bot-Kommentare

## Impact

- Affected specs:
  - `review-governance`
- Affected code:
  - `.github/workflows/`
  - `scripts/ci/`
  - potenziell Hilfscode fuer GitHub-API-Auswertung
- Affected arc42 sections:
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
- Affected docs:
  - `docs/development/review-agent-governance.md`
  - optional `docs/development/testing-strategy.md` fuer das neue PR-Gate
