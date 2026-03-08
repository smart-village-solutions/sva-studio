# Code Quality Review – Template

Nutze dieses Template fuer risikobasierte Code-Quality-Reviews in diesem Nx/TanStack/TypeScript-Workspace.

## 1) Quality Summary

- Punkt 1
- Punkt 2
- Punkt 3

## 2) Findings (priorisiert)

### P0 – Kurztitel

- Impact: …
- Root Cause: …
- Fix Strategy: …

### P1 – Kurztitel

- Impact: …
- Root Cause: …
- Fix Strategy: …

### P2 – Kurztitel

- Impact: …
- Root Cause: …
- Fix Strategy: …

## 3) Concrete Actions (Checklist)

- [ ] Schritt 1 (klein, sicher, zuerst)
- [ ] Schritt 2
- [ ] Schritt 3

## 4) Patch

- Minimaler Diff
- TypeScript-strict kompatibel
- Keine unnoetigen Umformatierungen

## 5) Nx + TanStack Notes

- Betroffene Targets: `pnpm nx affected -t lint,test:unit,test:types,build`
- Bei kritischen Flows zusaetzlich: `pnpm nx affected -t test:e2e`
- Boundary/Tag-Hinweise:
- TanStack Query/Router Pattern-Hinweise:

## 6) Long-term Impact Assessment

- Erwarteter Einfluss auf Build-Zeit in 12 Monaten:
- Erwarteter Einfluss auf Wartbarkeit/Kopplung:
- Neue Abhaengigkeiten oder strukturelle Last:

## Anhaenge

- Eingesetzte Inputs (Dateien, PR-Links, Commands)
