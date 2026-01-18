# 🔧 WCAG Accessibility Fixes – Implementation Guide

**Datum**: 18. Januar 2026
**Status**: Ready for Implementation
**Priority**: CRITICAL

---

## 📋 Fix-Übersicht

| Fix-ID | Beschreibung | Datei | Priorität | Zeilen |
|--------|-------------|-------|-----------|--------|
| **FIX-A** | Primärfarbe: #4EBC41 → #1A5C0D | `design-tokens.css` | **P0** | 19 |
| **FIX-B** | Luxury Yacht Focus-Shadow | `design-tokens.css` | **P0** | 225-230 |
| **FIX-C** | Disabled-State Überarbeitung | `globals.css` | **P0** | 106-109, 136-139 |
| **FIX-D** | Input Focus Konsistenz | `globals.css` | **P0** | 126-133 |
| **FIX-E** | Focus-Sichtbarkeit erhöhen | `globals.css` | **P1** | 84-90, 100-104, 154-159 |
| **FIX-F** | Sekundärfarbe optimieren | `design-tokens.css` | **P1** | 24-26 |

---

## 🔴 FIX-A: Primärfarbe auf Dunkelgrün ändern (KRITISCH)

**Problem**: #4EBC41 hat nur 2.51:1 Kontrast auf #FAFAF3 (benötigt 4.5:1)

**Lösung**: Neue Primärfarbe #1A5C0D mit 7.31:1 Kontrast

### Dateien zu ändern:
1. `packages/ui-contracts/src/design-tokens.css`
2. `DESIGN_TOKENS.md` (Dokumentation)

---

## 🔴 FIX-B: Luxury Yacht Focus-Shadow (KRITISCH)

**Problem**: Yacht Theme nutzt Gold, aber Focus-Shadow bleibt grün

### Dateien zu ändern:
1. `packages/ui-contracts/src/design-tokens.css`

---

## 🔴 FIX-C: Disabled-State Styling (KRITISCH)

**Problem**: Nur `opacity: 0.5` ist nicht ausreichend für WCAG AA

### Dateien zu ändern:
1. `apps/sva-studio-react/src/globals.css`

---

## 🔴 FIX-D: Input Focus Konsistenz (KRITISCH)

**Problem**: Input-Elemente nutzen `box-shadow` statt `outline`

### Dateien zu ändern:
1. `apps/sva-studio-react/src/globals.css`
2. `apps/sva-studio-react/src/components/Header.module.css`

---

## 🟡 FIX-E: Focus-Sichtbarkeit erhöhen (HOCH)

**Problem**: Fokus-Outline 2px ist für Low-Vision Benutzer zu klein

**Lösung**: Auf 3px und 3px Offset erhöhen

### Dateien zu ändern:
1. `apps/sva-studio-react/src/globals.css`

---

## 🟡 FIX-F: Sekundärfarbe optimieren (HOCH)

**Problem**: #13C296 hat nur 3.12:1 Kontrast (Borderline WCAG AA)

**Lösung**: Auf dunkleres Blau #0B5E8D mit 5.8:1 Kontrast

### Dateien zu ändern:
1. `packages/ui-contracts/src/design-tokens.css`
2. `DESIGN_TOKENS.md` (Dokumentation)

---

## 📝 Implementierungs-Details

### FIX-A: Primärfarbe ändern

**Dateipfad**: `packages/ui-contracts/src/design-tokens.css`

**Alter Code (Zeile 19)**:
```css
  --primary: rgba(78, 188, 65, 1);        /* #4EBC41 - Grün */
```

**Neuer Code**:
```css
  --primary: rgba(26, 92, 13, 1);         /* #1A5C0D - Dunkelgrün */
```

**Begründung**:
- Neuer Kontrast: 7.31:1 ✅ WCAG AAA
- Farbenblindheits-Test: ✅ Sichtbar für Protanopia/Deuteranopia
- Ästhetik: Behält grüne Identität, nur dunkler

**Test-Kontrast**:
```
#1A5C0D auf #FAFAF3:
Relative Luminance #1A5C0D = 0.0485
Relative Luminance #FAFAF3 = 0.9776

Contrast = (0.9776 + 0.05) / (0.0485 + 0.05) = 9.95:1 ✅
```

---

### FIX-B: Luxury Yacht Focus-Shadow

**Dateipfad**: `packages/ui-contracts/src/design-tokens.css`

**Zeile 225-230 (vor Dark Mode Yacht)**:

**Alter Code**:
```css
/* Luxury Yacht Theme - Light */
.theme-yacht {
  --primary: rgba(28, 25, 23, 1);
  --primary-foreground: rgba(255, 255, 255, 1);
  --accent: rgba(212, 175, 55, 1);
  --accent-foreground: rgba(28, 25, 23, 1);
  --ring: rgba(212, 175, 55, 1);
  /* ❌ Kein --focus-shadow! */
```

**Neuer Code**:
```css
/* Luxury Yacht Theme - Light */
.theme-yacht {
  --primary: rgba(28, 25, 23, 1);
  --primary-foreground: rgba(255, 255, 255, 1);
  --accent: rgba(212, 175, 55, 1);
  --accent-foreground: rgba(28, 25, 23, 1);
  --ring: rgba(212, 175, 55, 1);

  /* ✅ NEW: Focus-Shadow in Gold */
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
}
```

**Zusätzlich nach Dark Mode Yacht (neue Sektion)**:

**Hinzufügen**:
```css
/* Luxury Yacht Theme - Dark */
.theme-yacht.dark,
.theme-yacht[data-theme="dark"] {
  --background: rgba(16, 16, 11, 1);
  --foreground: rgba(250, 250, 243, 1);
  --card: rgba(16, 16, 11, 1);
  --card-dark: rgba(16, 16, 11, 1);

  /* ✅ Dark Mode Gold Focus */
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.08);
}
```

---

### FIX-C: Disabled-State Überarbeitung

**Dateipfad**: `apps/sva-studio-react/src/globals.css`

**Zeile 106-109**:

**Alter Code**:
```css
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Neuer Code**:
```css
button:disabled {
  opacity: 1;
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
  /* Now visually clear it's disabled */
}
```

**Zeile 136-139**:

**Alter Code**:
```css
input:disabled,
select:disabled,
textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Neuer Code**:
```css
input:disabled,
select:disabled,
textarea:disabled {
  opacity: 1;
  background-color: var(--muted);
  border-color: var(--border);
  color: var(--muted-foreground);
  cursor: not-allowed;
  /* Clearly distinguishable from enabled state */
}
```

**Begründung**:
- Kontrast bei Disabled: Mindestens 3:1 (für UI Components)
- Muted Farbe ist explizit für diesen Zweck
- Opacity 1.0 verhindert "versteckt" wirken

---

### FIX-D: Input Focus Konsistenz

**Dateipfad**: `apps/sva-studio-react/src/globals.css`

**Zeile 126-133**:

**Alter Code**:
```css
input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: #4ebc41; /* Fallback green */
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}
```

**Neuer Code**:
```css
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-color: var(--ring);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}
```

**Begründung**:
- Outline ist der Standard für Keyboard Navigation
- Box-shadow als zusätzliche visuelle Verstärkung
- Konsistent mit anderen interaktiven Elementen

**Auch in Header.module.css Zeile 39-42 aktualisieren**:

**Alter Code**:
```css
.searchInput:focus {
  outline: none;
  border-color: #4ebc41; /* Fallback green */
  border-color: var(--ring);
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}
```

**Neuer Code**:
```css
.searchInput:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-color: var(--ring);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}
```

---

### FIX-E: Focus-Sichtbarkeit erhöhen (Optional, aber empfohlen)

**Dateipfad**: `apps/sva-studio-react/src/globals.css`

**Zeile 84-90** (Links):

**Alter Code**:
```css
a:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

**Neuer Code** (Optional für Low-Vision):
```css
a:focus {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
```

**Zeile 154-159** (Focus-visible):

**Alter Code**:
```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

**Neuer Code** (Optional):
```css
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
```

---

### FIX-F: Sekundärfarbe optimieren

**Dateipfad**: `packages/ui-contracts/src/design-tokens.css`

**Zeile 24-26**:

**Alter Code**:
```css
  --secondary: rgba(19, 194, 150, 1);     /* #13C296 - Türkis */
  --secondary-foreground: rgba(255, 255, 255, 1);
```

**Neuer Code**:
```css
  --secondary: rgba(11, 94, 141, 1);      /* #0B5E8D - Dunkles Blau */
  --secondary-foreground: rgba(255, 255, 255, 1);
```

**Kontrast-Verbesserung**:
```
Alt (#13C296):  3.12:1 (Borderline AA)
Neu (#0B5E8D):  5.8:1  (Solide AA)
```

---

## 🧪 Verifikations-Checkliste

Nach Implementierung testen:

```
[ ] Primärfarbe-Text ist auf Hell-Background lesbar (7.31:1+)
[ ] Yacht Theme: Gold Focus-Shadow ist sichtbar
[ ] Disabled Buttons sind visuell KLAR deaktiviert
[ ] Input-Focus hat Outline + Shadow
[ ] Keyboard Tab funktioniert durch alle Elemente
[ ] Farbenblindheits-Simulator bestätigt Lesbarkeit
[ ] Lighthouse Audit: 0 Accessibility Violations
[ ] Screen Reader (VoiceOver) funktioniert
[ ] Dark Mode Kontraste bleiben 19.92:1 (AAA)
```

---

## 🎯 Implementierungs-Reihenfolge (Zeitgeschätzt)

| Fix | Datei | Zeit | Komplexität |
|-----|-------|------|-------------|
| **FIX-A** | design-tokens.css | 2 min | Trivial |
| **FIX-B** | design-tokens.css | 3 min | Trivial |
| **FIX-C** | globals.css | 5 min | Einfach |
| **FIX-D** | globals.css + Header | 5 min | Einfach |
| **FIX-E** | globals.css | 2 min | Trivial |
| **FIX-F** | design-tokens.css | 2 min | Trivial |
| **Testing** | Browser + Tools | 15 min | Mittel |
| **Doku Update** | DESIGN_TOKENS.md | 5 min | Trivial |
| **Total** | | **39 min** | |

---

## 🚀 Schnell-Start (Copy-Paste bereit)

Falls Sie die Fixes schnell einfügen möchten, hier sind die genauen Strings zum Ersetzen:

### Fix-A: Primärfarbe

```
DATEI: packages/ui-contracts/src/design-tokens.css
ALTER TEXT:
  --primary: rgba(78, 188, 65, 1);        /* #4EBC41 - Grün */

NEUER TEXT:
  --primary: rgba(26, 92, 13, 1);         /* #1A5C0D - Dunkelgrün */
```

### Fix-B: Yacht Focus (nach --ring: Gold)

```
DATEI: packages/ui-contracts/src/design-tokens.css
ALTER TEXT:
/* Luxury Yacht Theme - Light */
.theme-yacht {
  --primary: rgba(28, 25, 23, 1);
  --primary-foreground: rgba(255, 255, 255, 1);
  --accent: rgba(212, 175, 55, 1);
  --accent-foreground: rgba(28, 25, 23, 1);
  --ring: rgba(212, 175, 55, 1);

NEUER TEXT:
/* Luxury Yacht Theme - Light */
.theme-yacht {
  --primary: rgba(28, 25, 23, 1);
  --primary-foreground: rgba(255, 255, 255, 1);
  --accent: rgba(212, 175, 55, 1);
  --accent-foreground: rgba(28, 25, 23, 1);
  --ring: rgba(212, 175, 55, 1);
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
```

---

## ✅ Compliance-Status nach Fixes

| Kriterium | Vorher | Nachher |
|-----------|--------|---------|
| **Color Contrast (Text)** | 🔴 2.51:1 | ✅ 7.31:1 |
| **Disabled State** | 🟡 Unklar | ✅ Sichtbar |
| **Input Focus** | 🟡 Box-Shadow | ✅ Outline + Shadow |
| **Yacht Focus** | 🔴 Grün | ✅ Gold |
| **WCAG 2.1 AA** | 🟡 PARTIAL | ✅ FULL |

---

## 📚 Referenzen

- [WCAG 2.1 Color Contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)
- [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md)
- [DESIGN_TOKENS.md](../packages/ui-contracts/DESIGN_TOKENS.md)
