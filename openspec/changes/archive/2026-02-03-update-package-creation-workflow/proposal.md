# Proposal: Update Package Creation Workflow

## Problem
Die aktuelle Dokumentation in `docs/monorepo.md` beschreibt einen manuellen Prozess zum Erstellen neuer Packages (Ordner anlegen, Configs selbst erstellen). Dieser Ansatz:
- Widerspricht dem Nx-Standard, Generatoren für konsistentes Setup zu nutzen
- Steht im Widerspruch zur Design-Entscheidung in `openspec/specs/monorepo-structure/design.md`, die Nx-Generatoren als Hauptvorteil hervorhebt
- Führt potenziell zu inkonsistenten Setups (Projekt-Graph, Targets, Caching)
- Erhöht den manuellen Aufwand und die Fehleranfälligkeit

## Proposed Change
Aktualisiere die Package-Erstellungsanleitung so, dass sie **primär Nx-Generatoren** empfiehlt und den manuellen Ansatz nur als Sonderfall für publishable npm-Packages dokumentiert.

Konkret:
1. **Standard-Workflow:** Nx-Generatoren (`nx g @nx/js:lib`, `@nx/node:lib`, etc.)
2. **Alternativer Workflow:** Manuelles Setup nur wenn bewusst "package-first" für publishable npm-Packages
3. **Klarstellung:** Dokumentiere Vor-/Nachteile beider Ansätze

## Impact
- **Documentation:** `docs/monorepo.md` wird aktualisiert
- **Developer Experience:** Konsistenterer, wartbarerer Workflow
- **Architecture:** Keine Breaking Changes, aber klarere Guidance
- **Specs:** `openspec/specs/monorepo-structure/spec.md` bekommt Requirements für Package-Erstellung

## Alternatives Considered
1. **Status Quo:** Manueller Workflow als Standard
   - ❌ Nutzt Nx-Vorteile nicht aus
   - ❌ Inkonsistenz zwischen Dokumentation und Tool-Entscheidung

2. **Nur Generatoren, kein manueller Weg:**
   - ❌ Zu restriktiv für publishable packages
   - ❌ Reduziert Flexibilität

3. **Gewählter Ansatz:** Generator als Standard, manuell als dokumentierter Sonderfall
   - ✅ Nutzt Nx optimal
   - ✅ Behält Flexibilität
   - ✅ Macht Trade-offs explizit

## Decisions Made

### 1. Standard-Generator: @nx/js:lib
**Gewählt:** `@nx/js:lib` (bereits installiert, optimal für SVA-Struktur)

**Begründung:**
- ✅ Passt zu rein TypeScript-Libraries ohne spezielle Node.js/React-Requirements
- ✅ Flexible Bundler-Optionen (tsc, swc, rollup, vite, esbuild)
- ✅ `--publishable` Flag für npm-Publishing
- ✅ `--tags` Option für bestehende Tagging-Strategie
- ✅ Automatische tsconfig.base.json Integration via `--importPath`

**Konkrete Verwendung:**
```bash
# Standard-Command mit SVA-Defaults
nx g @nx/js:lib my-package \
  --directory=packages/my-package \
  --importPath=@sva/my-package \
  --tags=scope:shared,type:lib \
  --bundler=tsc \
  --publishable=false

# Oder später per npm-Script: pnpm new:lib my-package
```

### 2. Manuelles Setup nur für Sonderfälle
**Einsatz:** ~10% der Fälle
- Migration bestehender Packages ins Monorepo
- Experimentelle Strukturen
- Extremes Publishing/Build-Setup (sehr selten)

**Dokumentation:** Separate Sektion mit Warnung vor Nachteilen

### 3. Kein Custom Generator (noch nicht)
**Grund:** SVA-Conventions vollständig via Generator-Optionen abdeckbar

**Alternative:** npm-Script in root `package.json` für `pnpm new:lib` Shortcut

**Überdenken bei:** >10 Packages oder wachsendem Team
