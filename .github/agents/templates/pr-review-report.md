# PR Review – Konsolidierter Report

## Meta

| Feld | Wert |
|------|------|
| Branch / PR | … |
| Review-Datum | … |
| Geänderte Bereiche | Frontend / Backend / Docs / Infra / Tests / … |
| Aufgerufene Reviewer | 🧭 PR Orchestrator, 📝 Documentation, … |
| Übersprungene Reviewer | … (mit Begründung) |

## Gesamtbewertung

**Empfehlung:** [Merge-OK | Merge mit Auflagen | Merge-Blocker]

## Erkannte Änderungsbereiche

- Bereich 1
- Bereich 2
- Bereich 3

## Findings (konsolidiert und priorisiert)

### 🔴 Blocker

| ID | Thema | Reviewer | Betroffene Datei | Empfehlung |
|---:|-------|----------|------------------|------------|
| B1 | … | … | … | … |

### 🟡 Wichtig

| ID | Thema | Reviewer | Betroffene Datei | Empfehlung |
|---:|-------|----------|------------------|------------|
| W1 | … | … | … | … |

### 🟢 Hinweise

| ID | Thema | Reviewer | Empfehlung |
|---:|-------|----------|------------|
| H1 | … | … | … |

### ℹ️ Info

- …

## Konflikte zwischen Reviewern

> Wenn keine Konflikte: „Keine Konflikte zwischen Reviewern festgestellt."

## Empfohlene Tests / Validierung

- `pnpm nx affected -t lint,test:unit,test:types,build`
- `pnpm nx affected -t test:e2e`
- Projekt- oder dateispezifische Zusatzchecks:

## Offene Fragen

1. …
2. …

## Nächste Schritte

1. …
2. …
