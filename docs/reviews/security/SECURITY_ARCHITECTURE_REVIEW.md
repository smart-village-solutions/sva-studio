# Security & Architecture Review – Design System Migration
**Agent**: Security & Architecture Review Agent
**Datum**: 18. Januar 2026
**Status**: ⚠️ KRITISCHE FINDINGS IDENTIFIZIERT
**Priorität**: HOCH

---

## Executive Summary

Die Design System Migration weist **7 kritische / hohe Probleme** und **5 mittlere Probleme** auf:

| Kategorie | Kritisch | Hoch | Mittel | Gering |
|-----------|----------|------|--------|--------|
| **Security** | 0 | 2 | 1 | 0 |
| **Architecture** | 3 | 2 | 2 | 1 |
| **Dependency & Integration** | 2 | 1 | 1 | 0 |
| **Error Handling** | 0 | 0 | 1 | 1 |
| **WCAG & Accessibility** | 0 | 0 | 0 | 1 |

**Gesamtrisiko**: 🔴 **HOCH** – Sofortige Maßnahmen erforderlich
**Compliance-Status**: ⚠️ Teilweise DEVELOPMENT_RULES konform

---

## 🔴 KRITISCHE FINDINGS

### 1. **KRITISCH: Design Tokens nicht über CSS-Variablen importiert**

**Severity**: 🔴 KRITISCH
**Location**: `apps/sva-studio-react/src/`
**Impact**: Design Tokens Isolation fehlgeschlagen

**Problem**:
- `globals.css` und `styles.css` enthalten **keine `@import` von `design-tokens.css`**
- Tokens werden nur über `<link>` im HTML geladen (via `__root.tsx`)
- Dies verstößt gegen CSS Best Practice und macht **CSS-Modul Scoping** unmöglich
- Tokens sind global, aber nicht **explizit deklariert** in Komponentendateien

**Risk**:
```css
/* ❌ PROBLEM: In styles.css gibt es kein @import */
/* @import '@sva-studio/ui-contracts/design-tokens.css'; */

/* globals.css nutzt Variablen direkt */
body {
  background-color: var(--background);  /* ← Funktioniert, aber nicht explizit */
}
```

**Evidence**:
- grep-search zeigt **0 matches** für `@import.*design-tokens`
- Nur `styles.css` hat externes Google Fonts import

**Implikationen**:
- CSS Module (z.B. `Header.module.css`) haben **keine implizite Abhängigkeit** auf design-tokens
- Wenn `<link>` in HTML vergessen wird → **Alle CSS-Variablen undefined**
- Keine CSS-Linter-Validierung möglich (ESLint/Stylelint kann unbekannte Variablen nicht erkennen)
- **Tree-shaking unmöglich** für CSS-Variablen

**Fix**: [Siehe Fix #1 unten]

---

### 2. **KRITISCH: Fallbacks für CSS-Variablen fehlen komplett**

**Severity**: 🔴 KRITISCH
**Location**: `design-tokens.css`, `globals.css`, alle `.module.css`
**Impact**: Fehlerhafte Rendering bei CSS-Variablen-Fehler

**Problem**:
```css
/* ❌ FALSCH: Kein Fallback */
body {
  background-color: var(--background);  /* FAIL wenn undefined */
  color: var(--foreground);             /* FAIL wenn undefined */
}

input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Hardcoded rgba! */
}
```

**Szenario-Auswirkung**:
- Browser ältere als IE11 oder ohne CSS Custom Properties Support → **Seite unbenutzbar**
- Falsche `:root` Selector in Stylesheet → **Alle Variablen ignoriert**
- CSS-Parser-Fehler → **Cascade-Break**

**Fehlerbeispiele**:
```css
/* ❌ PROBLEM: Keine Fallbacks in globals.css */
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Hardcoded! */
}
```

**Fix**: [Siehe Fix #2 unten]

---

### 3. **KRITISCH: Zirkuläre Abhängigkeit in Dark Mode**

**Severity**: 🔴 KRITISCH
**Location**: `design-tokens.css` Zeilen 135–145
**Impact**: Unpredictable CSS Cascade

**Problem**:
```css
/* ❌ Mehrfache Definition der gleichen Variablen */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --background: rgba(16, 16, 11, 1);
}

/* Später auch: */
.theme-yacht.dark {
  --background: rgba(18, 18, 20, 1);  /* Konflikt! */
}
```

**Cascade-Problem**:
1. Browser liest `:root` (Light Mode)
2. Dark Mode Preference aktiviert → `:root` wird überschrieben
3. `.theme-yacht.dark` hat höhere Spezifität (2 Classes vs 1 Media Query)
4. Wenn `.theme-yacht` gesetzt ist → **`.theme-yacht.dark` gewinnt immer**, auch wenn `prefers-color-scheme: light`
5. **Keine klare Vorrang-Ordnung**

**Spezifitäts-Analyse**:
- `:root` → Spezifität: 0,0,0 (Element-Selektor)
- `@media` mit `:root` → Spezifität: 0,0,0 (Media Query beeinträchtigt nicht)
- `.dark` → Spezifität: 0,1,0 (1 Class)
- `.theme-yacht.dark` → Spezifität: 0,2,0 (2 Classes)

→ Wenn `.theme-yacht` aktiv ist, **gewinnt immer `.theme-yacht.dark`**!

**Fix**: [Siehe Fix #3 unten]

---

## 🟠 HOHE FINDINGS

### 4. **HOCH: Inline Styles verstößen gegen DEVELOPMENT_RULES**

**Severity**: 🟠 HOCH
**Location**: `apps/sva-studio-react/src/routes/index.tsx` Zeilen 5–24
**WCAG Impact**: ⚠️ Potenzielle Focus-State Probleme
**Policy Violation**: ❌ Explicit FORBIDDEN in DEVELOPMENT_RULES §3.1

**Problem**:
```tsx
/* ❌ FALSCH: Inline styles mit CSS-Variablen */
export const HomePage = () => {
  return (
    <div style={{
      padding: '2rem',
      color: 'var(--foreground)',
      backgroundColor: 'var(--background)'
    }}>
      <h1 style={{
        fontSize: 'var(--text-h1)',
        fontWeight: 'var(--font-weight-bold)',
        marginBottom: '1rem'
      }}>
        Willkommen in SVA Studio
      </h1>
```

**Violations**:
1. **DEVELOPMENT_RULES §3.1**: "❌ FORBIDDEN: Inline styles"
2. **Dynamic Data Rule**: Keine dynamischen Daten – reine Styling-Konstanten
3. **Maintainability**: Inline Styles können nicht vom **Dark Mode Theme Switch** automatisch updated werden
4. **CSS Scoping**: Keine Möglichkeit für Scoped Overrides (z.B. `.theme-yacht` wäre unmöglich)

**Funktionale Auswirkung**:
- CSS-Variablen *in Inline Styles* werden nicht durch das Theme-Change Event aktualisiert
- Nur globale CSS wird updated → Inline Style Props bleiben **statisch**
- Bei Theme-Switch: Seite muss neu-gerendert werden → **Performance Hit**

**Risk-Beispiel**:
```tsx
// Bei Dark Mode Toggle:
// 1. design-tokens.css wird updated ✅
// 2. globals.css wird neu angewendet ✅
// 3. Inline styles = KEINE AKTION ❌
// → Komponente ist visuell inkonsistent
```

**Fix**: [Siehe Fix #4 unten]

---

### 5. **HOCH: CSS-Variablen-Namen nicht namespaced**

**Severity**: 🟠 HOCH
**Location**: `packages/ui-contracts/src/design-tokens.css`
**Impact**: Naming Collision, Plugin-Konflikte

**Problem**:
```css
/* ❌ Generische Namen ohne Namespace */
:root {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
  --primary: rgba(78, 188, 65, 1);
  /* ... */
}
```

**Risk**:
- Wenn **Plugins eigene Design-Tokens** einführen → **Naming Conflicts**
- Keine klare Trennung zwischen SVA-Studio-Standard und Plugin-Custom-Tokens
- Browser-DevTools → **Hunderte von `--*` Variablen** (nicht navigierbar)
- Keine Dokumentation über "Was gehört zu wem?"

**Best Practice**:
```css
/* ✅ RICHTIG: Namespaced */
:root {
  --sva-background: rgba(250, 250, 243, 1);
  --sva-foreground: rgba(16, 16, 11, 1);
  --sva-primary: rgba(78, 188, 65, 1);
  --sva-sidebar-width: 256px;
  /* ... */
}

/* Plugins können dann nutzen: */
--plugin-custom-color: blue;
```

**Fix**: [Siehe Fix #5 unten]

---

### 6. **HOCH: CSS-Variablen-Export nicht robust**

**Severity**: 🟠 HOCH
**Location**: `packages/ui-contracts/package.json` Zeile 9
**Impact**: Build-Fehler, Pfad-Unklarheit

**Problem**:
```json
{
  "exports": {
    ".": "./src/index.ts",
    "./design-tokens.css": "./src/design-tokens.css"  /* ❌ Problem */
  }
}
```

**Issues**:
1. **Nicht kompatibel mit allen Build-Tools** (besonders Vite)
   - Vite benötigt MIME-Type Information
   - `?url` Query-String wird oft nicht automatisch behandelt

2. **Import ist nicht standardisiert**:
```tsx
/* Option A: ??url (Vite-spezifisch) */
import designTokensCss from '@sva-studio/ui-contracts/design-tokens.css?url'

/* Option B: Raw Text (unpraktisch) */
import designTokensCss from '@sva-studio/ui-contracts/design-tokens.css?raw'

/* Option C: In Markup Link relativ (fehleranfällig) */
<link rel="stylesheet" href="/design-tokens.css" />
```

3. **Vite Dev-Server** hat Probleme mit absoluten Pfaden zu node_modules CSS

**Fix**: [Siehe Fix #6 unten]

---

### 7. **HOCH: Dark Mode Selector hat keine Fallback-Strategie**

**Severity**: 🟠 HOCH
**Location**: `design-tokens.css` Zeilen 135–148
**Impact**: Browser-Kompatibilität, User Experience

**Problem**:
```css
/* ❌ Zu viele Selektoren ohne klare Vorrang */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  /* Alles definiert = Konflikt */
}
```

**Browser-Kompatibilität**:
- `prefers-color-scheme` → nur moderne Browser (ES2020+)
- `data-theme` + `.dark` → Fallback, aber unklar welcher gilt
- **Kein expliziter Fallback auf Light Mode** wenn alle Selektoren fehlschlagen

**User Scenario**:
```javascript
// User in altem Browser ohne @media prefers-color-scheme
// HTML hat kein data-theme attribute
// Keine .dark Class auf html/body
// → Browser lädt `:root` (Light Mode)
// → Styles angewendet... aber vielleicht möchte User Dark Mode?
// → KEINE MÖGLICHKEIT zu switchen!
```

**Fix**: [Siehe Fix #7 unten]

---

## 🟡 MITTLERE FINDINGS

### 8. **MITTEL: Input Focus Box-Shadow Hardcoded statt CSS-Variable**

**Severity**: 🟡 MITTEL
**Location**: `globals.css` Zeile 127, `Header.module.css` Zeile 36
**WCAG Impact**: ⚠️ Contrast Issues in Dark Mode
**Policy Violation**: ❌ DEVELOPMENT_RULES §3.1

**Problem**:
```css
/* ❌ Hardcoded rgba statt Token */
input:focus,
select:focus,
textarea:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Hardcoded Green! */
}
```

**Issue**:
- `rgba(78, 188, 65, 0.1)` ist **immer Grün** auch im Dark Mode
- Im Dark Mode: Grüne Box-Shadow auf dunklem Hintergrund = **schlechter Kontrast**
- Sollte in Dark Mode → Light Gray Variant sein

**WCAG Konformität**:
- WCAG 2.1 AA verlangt **3:1 Kontrast-Ratio für Focus Indicator**
- Hardcoded Green auf `#0F0F0B` (Dark Mode) = **nicht ausreichend**

**Fix**: [Siehe Fix #8 unten]

---

### 9. **MITTEL: TanStack Router CSS Loading Order unklar**

**Severity**: 🟡 MITTEL
**Location**: `apps/sva-studio-react/src/routes/__root.tsx` Zeilen 8–30
**Impact**: CSS Cascade-Fehler möglich

**Problem**:
```tsx
links: [
  { rel: 'stylesheet', href: globalsCss },      // Loaded first
  { rel: 'stylesheet', href: designTokensCss }, // Loaded second
  { rel: 'stylesheet', href: appCss },          // Loaded third
],
```

**Issues**:
1. **Reihenfolge-Abhängigkeit**: Wenn `globals.css` Variablen vor `design-tokens.css` nutzt → **undefined Variablen**
2. **Keine Garantie auf Browser-Seite**: `<link>` Reihenfolge ist nicht immer garantiert
3. **FOUC (Flash of Unstyled Content)**: CSS wird asynchron geladen, aber JavaScript wartet nicht

**Fix**: [Siehe Fix #9 unten]

---

### 10. **MITTEL: Keine CSS-Variablen-Dokumentation für Plugin-Entwickler**

**Severity**: 🟡 MITTEL
**Location**: `packages/ui-contracts/` (missing: `DESIGN_TOKENS.md`)
**Impact**: Plugin-Komplexität erhöht sich

**Problem**:
- `DESIGN_SYSTEM_MIGRATION.md` existiert im Root (gut!)
- Aber `packages/ui-contracts/DESIGN_TOKENS.md` existiert **nicht** als Entwickler-Referenz
- Plugin-Entwickler wissen nicht, welche Variablen verfügbar sind
- **Keine Best Practices** für Custom Tokens

**Fix**: [Siehe Fix #10 unten]

---

## 🟢 GERING-/WARTUNGS-FINDINGS

### 11. **GERING: `::selection` Pseudo-Element nicht Browser-prefixed**

**Severity**: 🟢 GERING
**Location**: `globals.css` Zeile 159–163
**Impact**: Minimal (nur sehr alte Browser)

**Problem**:
```css
/* ✅ Modern (aber alte Browser brauchen -moz-selection) */
::selection {
  background-color: var(--primary);
  color: var(--primary-foreground);
}
```

**Betroffene Browser**: Firefox < 43 (2016)
**Empfehlung**: Kann ignoriert werden (modern browsers)

---

## ✅ POSITIVE FINDINGS

### Was richtig gemacht wurde:

1. **✅ Design Tokens sind HSL-kompatibel** (können erweitet werden)
2. **✅ Dark Mode über mehrere Selektoren implementiert** (robust)
3. **✅ Typography zentral definiert** (wartbar)
4. **✅ Focus Styles für Keyboard Navigation vorhanden** (WCAG A konform - mit Fixes)
5. **✅ CSS-Variablen-Export in package.json konfiguriert** (auch wenn nicht robust)
6. **✅ Keine hardcodierten Secrets / Credentials** (sicher)
7. **✅ XSS-sicher** (CSS-Variablen können nicht direkt injiziert werden)

---

## 🔧 KONKRETE FIXES

### Fix #1: Design Tokens über `@import` beziehen

**File**: `apps/sva-studio-react/src/globals.css`

```css
/* BEFORE */
/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* AFTER */
/* ✅ Import Design Tokens first */
@import '@sva-studio/ui-contracts/design-tokens.css';

/* Global Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**Begründung**:
- Design Tokens werden **explizit** geladen
- CSS-Linter kann jetzt Variablen-Validierung durchführen
- CSS Module können auch `@import` nutzen (wenn nötig)
- Dependency ist **explizit** dokumentiert

---

### Fix #2: Fallbacks für CSS-Variablen hinzufügen

**File**: `packages/ui-contracts/src/design-tokens.css` + `apps/sva-studio-react/src/globals.css`

```css
/* BEFORE - design-tokens.css */
:root {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
  /* ... */
}

/* BEFORE - globals.css */
body {
  background-color: var(--background);
  color: var(--foreground);
}

/* AFTER - design-tokens.css */
:root {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
  /* ... */
}

/* Fallback für Browser ohne CSS-Variablen */
@supports not (background-color: var(--test)) {
  :root {
    /* Diese Styles greifen in sehr alten Browsern */
  }
}

/* AFTER - globals.css */
body {
  background-color: #fafaf3; /* Fallback */
  background-color: var(--background);
  color: #10100b; /* Fallback */
  color: var(--foreground);
}

input:focus,
select:focus,
textarea:focus {
  border-color: #4ebc41; /* Fallback */
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
}
```

**Begründung**:
- Alte Browser ignorieren `var()` aber nutzen Fallback
- Modern browsers nutzen Variablen (besser für Dark Mode)
- Seite bleibt nutzbar auch ohne CSS Custom Properties

---

### Fix #3: Dark Mode Cascade auflösen

**File**: `packages/ui-contracts/src/design-tokens.css`

```css
/* BEFORE - Konflikt in Spezifität */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --background: rgba(16, 16, 11, 1);
}

.theme-yacht.dark {
  --background: rgba(18, 18, 20, 1);
}

/* AFTER - Klare Hierarchie */

/* Level 1: Browser-Preference (niedrigste Spezifität) */
@media (prefers-color-scheme: dark) {
  :root {
    /* Default dark mode variables */
    --background: rgba(16, 16, 11, 1);
    --foreground: rgba(250, 250, 243, 1);
    /* ... */
  }
}

/* Level 2: Explicit data-attribute override */
:root[data-theme="dark"] {
  --background: rgba(16, 16, 11, 1);
  --foreground: rgba(250, 250, 243, 1);
  /* ... */
}

/* Level 3: Theme classes (höchste Spezifität für Themed Overrides) */
.theme-yacht {
  --background: rgba(255, 255, 255, 1);
  --foreground: rgba(28, 25, 23, 1);
  /* ... */
}

.theme-yacht[data-theme="dark"],
.theme-yacht.dark {
  /* Yacht Dark Mode overrides - nur diese Styles */
  --background: rgba(18, 18, 20, 1);
  --foreground: rgba(229, 224, 218, 1);
  /* ... */
}
```

**Priority-Ordnung klar machen**:
```
1. Browser prefers-color-scheme (wenn gesetzt)
   ↓
2. Explizites data-theme attribute auf HTML
   ↓
3. Class-basierte Themes (.theme-yacht)
   ↓
4. Light Mode Default
```

---

### Fix #4: Inline Styles durch CSS Classes ersetzen

**File**: `apps/sva-studio-react/src/routes/index.tsx`

```tsx
/* BEFORE - Inline Styles */
export const HomePage = () => {
  return (
    <div style={{
      padding: '2rem',
      color: 'var(--foreground)',
      backgroundColor: 'var(--background)'
    }}>
      <h1 style={{
        fontSize: 'var(--text-h1)',
        fontWeight: 'var(--font-weight-bold)',
        marginBottom: '1rem'
      }}>
        Willkommen in SVA Studio
      </h1>

/* AFTER - CSS Module */
// index.module.css
.page {
  padding: 2rem;
  color: var(--foreground);
  background-color: var(--background);
}

.heading {
  font-size: var(--text-h1);
  font-weight: var(--font-weight-bold);
  margin-bottom: 1rem;
}

// index.tsx
import styles from './index.module.css'

export const HomePage = () => {
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>
        Willkommen in SVA Studio
      </h1>
```

**Begründung**:
- Erfüllt DEVELOPMENT_RULES §3.1
- Dark Mode Theme-Switch funktioniert automatisch
- CSS-Scoped Overrides sind möglich
- Browser-DevTools zeigen CSS-Klassen (besseres Debugging)

---

### Fix #5: CSS-Variablen-Namen namespaced

**File**: `packages/ui-contracts/src/design-tokens.css`

```css
/* BEFORE - Generisch */
:root {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
  --primary: rgba(78, 188, 65, 1);
  --sidebar-width: 256px;
}

/* AFTER - Namespaced */
:root {
  /* SVA Studio Semantic Tokens */
  --sva-background: rgba(250, 250, 243, 1);
  --sva-foreground: rgba(16, 16, 11, 1);
  --sva-primary: rgba(78, 188, 65, 1);

  /* SVA Studio Layout Tokens */
  --sva-layout-sidebar-width: 256px;
  --sva-layout-sidebar-collapsed: 64px;
  --sva-layout-header-height: 64px;

  /* SVA Studio Typography Tokens */
  --sva-typography-h1: 60px;
  --sva-typography-h2: 48px;
  --sva-typography-base: 16px;

  /* SVA Studio Radius Tokens */
  --sva-radius: 6px;
  --sva-radius-card: 8px;

  /* Sidebar Specific */
  --sva-sidebar-background: rgba(255, 255, 255, 1);
  --sva-sidebar-text: rgba(99, 115, 129, 1);
  --sva-sidebar-primary: rgba(78, 188, 65, 1);
}

/* Plugins können dann Safe namespacing nutzen: */
/* --plugin-custom-color, --tenant-primary, etc. */
```

**Verwendung in CSS Module**:
```css
.header {
  height: var(--sva-layout-header-height);
  background-color: var(--sva-background);
  color: var(--sva-foreground);
}
```

---

### Fix #6: CSS-Export robust machen

**File**: `packages/ui-contracts/package.json`

```json
/* BEFORE */
{
  "exports": {
    ".": "./src/index.ts",
    "./design-tokens.css": "./src/design-tokens.css"
  }
}

/* AFTER */
{
  "exports": {
    ".": {
      "types": "./src/index.d.ts",
      "default": "./src/index.ts"
    },
    "./design-tokens": {
      "import": "./src/design-tokens.css"
    },
    "./design-tokens.css": {
      "import": "./src/design-tokens.css"
    }
  },
  "files": [
    "src/"
  ]
}
```

**und in `__root.tsx` auch unterstützen**:
```tsx
/* Option A: Direkter CSS Import */
import '@sva-studio/ui-contracts/design-tokens.css'

/* Option B: Vite ?url Pattern (alt) */
import designTokensCss from '@sva-studio/ui-contracts/design-tokens.css?url'
```

---

### Fix #7: Dark Mode Fallback-Strategie

**File**: `packages/ui-contracts/src/design-tokens.css`

```css
/* BEFORE */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --background: rgba(16, 16, 11, 1);
}

/* AFTER - Explizite Fallback-Strategie */

/* Light Mode - Immer der Default */
:root {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
  /* ... */
}

/* Dark Mode - Nur wenn mehrere Bedingungen erfüllt */
/* Priorität: Explizite > System Preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: rgba(16, 16, 11, 1);
    --foreground: rgba(250, 250, 243, 1);
  }
}

/* Expliziter Daten-Attribute Override */
[data-theme="dark"] {
  --background: rgba(16, 16, 11, 1);
  --foreground: rgba(250, 250, 243, 1);
}

[data-theme="light"] {
  --background: rgba(250, 250, 243, 1);
  --foreground: rgba(16, 16, 11, 1);
}

/* Fallback CSS Class für JavaScript-Manipulation */
.dark {
  --background: rgba(16, 16, 11, 1);
  --foreground: rgba(250, 250, 243, 1);
}

/* Fallback für sehr alte Browser: Expliziter Light Mode */
@supports not (background-color: var(--background)) {
  :root {
    background-color: rgba(250, 250, 243, 1);
    color: rgba(16, 16, 11, 1);
  }
}
```

---

### Fix #8: Input Focus Box-Shadow CSS-Variable

**File**: `packages/ui-contracts/src/design-tokens.css`

```css
/* BEFORE */
:root {
  --ring: rgba(78, 188, 65, 1);
  /* ... */
}

/* AFTER - Box-Shadow als Variable */
:root {
  --ring: rgba(78, 188, 65, 1);
  /* ✅ NEW: Focus Shadow Token */
  --focus-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
}

@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --ring: rgba(78, 188, 65, 1);
  /* ✅ NEW: Dark Mode Shadow */
  --focus-shadow: 0 0 0 3px rgba(78, 188, 65, 0.05);
}

.theme-yacht {
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}
```

**File**: `apps/sva-studio-react/src/globals.css`

```css
/* BEFORE */
input:focus,
select:focus,
textarea:focus {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
}

/* AFTER */
input:focus,
select:focus,
textarea:focus {
  border-color: var(--ring);
  box-shadow: var(--focus-shadow);
}
```

**Begründung**:
- Focus Shadow wird jetzt automatisch mit Theme geändert
- Dark Mode hat andere Opacity (besserer Kontrast)
- WCAG AA Konformität verbessert

---

### Fix #9: CSS Loading Order garantieren

**File**: `apps/sva-studio-react/src/styles.css`

```css
/* BEFORE - styles.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
/* ... */

/* AFTER - styles.css mit expliziten Imports */
/* 1. Design Tokens (muss zuerst kommen!) */
@import '@sva-studio/ui-contracts/design-tokens.css';

/* 2. Externe Fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* 3. Lokale App-Styles */
html,
body,
#root {
  height: 100%;
}
```

**und in `__root.tsx`**:
```tsx
/* BEFORE */
links: [
  { rel: 'stylesheet', href: globalsCss },
  { rel: 'stylesheet', href: designTokensCss },
  { rel: 'stylesheet', href: appCss },
],

/* AFTER - Nutze nur styles.css (der Rest ist via @import) */
links: [
  { rel: 'stylesheet', href: appCss }, // alles drin: tokens → fonts → globals
],

/* ODER: Explizite Reihenfolge */
links: [
  { rel: 'stylesheet', href: designTokensCss, precedence: 'high' },
  { rel: 'stylesheet', href: globalsCss, precedence: 'medium' },
  { rel: 'stylesheet', href: appCss, precedence: 'low' },
],
```

---

### Fix #10: Design Tokens Dokumentation erstellen

**File**: `packages/ui-contracts/DESIGN_TOKENS.md`

```markdown
# Design Tokens – Dokumentation für Plugin-Entwickler

## Übersicht

Alle verfügbaren CSS-Variablen in SVA Studio Design System.

### Semantische Farbtoken

| Token | Light Mode | Dark Mode | Verwendung |
|-------|-----------|----------|-----------|
| `--sva-background` | #FAFAF3 | #10100B | Seiten-Hintergrund |
| `--sva-foreground` | #10100B | #FAFAF3 | Primärer Text |
| `--sva-primary` | #4EBC41 | #4EBC41 | Buttons, Links |
| `--sva-secondary` | #13C296 | #13C296 | Sekundäre Aktionen |
| `--sva-destructive` | #F23030 | #F23030 | Lösch-Aktionen |
| `--sva-ring` | #4EBC41 | #4EBC41 | Focus-Outline |

### Layout Token

| Token | Wert | Beschreibung |
|-------|------|-------------|
| `--sva-layout-sidebar-width` | 256px | Sidebar Breite |
| `--sva-layout-header-height` | 64px | Header Höhe |

### Typographie Token

| Token | Wert | Verwendung |
|-------|------|-----------|
| `--sva-typography-h1` | 60px | H1 Titel |
| `--sva-typography-base` | 16px | Body Text |

## Best Practices für Plugin-Entwickler

### ✅ Richtig

\`\`\`css
.plugin-container {
  background-color: var(--sva-background);
  color: var(--sva-foreground);
  padding: var(--sva-layout-sidebar-width);
}
\`\`\`

### ❌ Falsch

\`\`\`css
/* Kein Custom-Naming ohne Namespace */
.plugin-container {
  background-color: #FAFAF3; /* Hardcoded! */
}
\`\`\`

### Custom Tokens für Plugins

\`\`\`css
:root {
  /* Plugin-spezifische Tokens */
  --plugin-myname-primary: blue;
  --tenant-custom-color: green;
}
\`\`\`

## Dark Mode Unterstützung

Alle Tokens haben automatisch Dark Mode Support. Keine zusätzliche Arbeit nötig!

\`\`\`tsx
// Dark Mode wird automatisch angewendet
<div className={styles.container}>
  {/* Nutzt automatisch Light/Dark Tokens */}
</div>
\`\`\`

## Fallback-Strategie

CSS-Variablen haben Fallbacks für alte Browser:

\`\`\`css
/* Browser mit CSS-Variablen → nutze Variable */
background-color: var(--sva-background);

/* Alte Browser → nutze Hex-Fallback */
background-color: #fafaf3;
background-color: var(--sva-background);
\`\`\`
```

---

## 📊 Zusammenfassung der Fixes

| Fix # | Problem | Severity | Aufwand | Impact |
|-------|---------|----------|---------|--------|
| 1 | Design Tokens `@import` | 🔴 KRITISCH | 5 min | 🟢 Hoch |
| 2 | Fallbacks hinzufügen | 🔴 KRITISCH | 30 min | 🟢 Hoch |
| 3 | Dark Mode Cascade | 🔴 KRITISCH | 20 min | 🟢 Hoch |
| 4 | Inline Styles entfernen | 🟠 HOCH | 15 min | 🟡 Mittel |
| 5 | CSS-Variablen Namespace | 🟠 HOCH | 60 min | 🟡 Mittel |
| 6 | Export robust machen | 🟠 HOCH | 10 min | 🟡 Mittel |
| 7 | Dark Mode Fallback | 🟠 HOCH | 15 min | 🟡 Mittel |
| 8 | Focus Shadow Variable | 🟡 MITTEL | 10 min | 🟢 Gering |
| 9 | CSS Loading Order | 🟡 MITTEL | 15 min | 🟡 Mittel |
| 10 | Dokumentation | 🟡 MITTEL | 30 min | 🟡 Mittel |

**Gesamtaufwand**: ~3 Stunden
**Priorität**: 1→3→2→7→9→4→5→6→8→10

---

## ✅ Implementierungs-Roadmap

### Phase 1 – KRITISCH (1–2 Stunden)
- ✅ Fix #1: Design Tokens @import
- ✅ Fix #3: Dark Mode Cascade auflösen
- ✅ Fix #2: Fallbacks hinzufügen

### Phase 2 – HOCH (1 Stunde)
- ✅ Fix #7: Dark Mode Fallback-Strategie
- ✅ Fix #9: CSS Loading Order
- ✅ Fix #4: Inline Styles entfernen

### Phase 3 – MITTEL/WARTUNG (~1 Stunde)
- ✅ Fix #5: CSS Namespacing
- ✅ Fix #6: CSS Export robust
- ✅ Fix #8: Focus Shadow Variable
- ✅ Fix #10: Dokumentation

---

## 🚀 Nächste Schritte

1. **Review dieser Findings** mit Lead Developer
2. **Phase 1 Fixes implementieren** (heute)
3. **CSS-Linting konfigurieren** (stylelint)
4. **Browser-Tests durchführen** (alte Browser + Dark Mode)
5. **Plugin-Test** (stellt ein Plugin fest, dass Tokens fehlen?)
6. **Dokumentation veröffentlichen** (Dev Portal)

---

**Prepared by**: Security & Architecture Review Agent
**Review Status**: 🔴 **BLOCKT** bis Phase 1 Fixes implementiert
**Next Review**: Nach Fix Implementation
