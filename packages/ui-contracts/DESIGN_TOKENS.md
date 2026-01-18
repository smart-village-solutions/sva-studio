# Design Tokens – Dokumentation für Plugin-Entwickler & Komponenten

**Version**: 1.1 (✅ PHASE 1 - Updated)
**Status**: ✅ Live
**Last Updated**: 18. Januar 2026

---

## 📋 Übersicht

Diese Dokumentation beschreibt alle verfügbaren Design Tokens im SVA Studio Design System:
- **Light Mode** (Standard)
- **Dark Mode** (System Preference / Explizit)
- **Luxury Yacht Theme** (Alternativer Theme mit Light & Dark Support)

Das System unterstützt **automatisches Dark Mode Switching** ohne zusätzliche Arbeit!

---

## Light Mode (Standard)

Das Standard-Theme basiert auf warmen, natürlichen Farben mit Grün als Primärfarbe.

### Background & Foreground
```css
--background: rgba(250, 250, 243, 1);  /* #FAFAF3 - Helles Beige */
--foreground: rgba(16, 16, 11, 1);     /* #10100B - Fast Schwarz */
```

### Primary & Secondary
```css
--primary: rgba(78, 188, 65, 1);        /* #4EBC41 - Grün */
--primary-foreground: rgba(255, 255, 255, 1);
--secondary: rgba(19, 194, 150, 1);     /* #13C296 - Türkis */
--secondary-foreground: rgba(255, 255, 255, 1);
```

### Cards & Container
```css
--card: rgba(255, 255, 255, 1);         /* Weiß */
--card-dark: rgba(232, 232, 216, 1);    /* Dunkleres Beige */
--card-foreground: rgba(16, 16, 11, 1);
```

### Sidebar Colors
```css
--sidebar: rgba(255, 255, 255, 1);
--sidebar-foreground: rgba(99, 115, 129, 1);
--sidebar-primary: rgba(78, 188, 65, 1);
--sidebar-accent: rgba(247, 251, 246, 1);
--sidebar-border: rgba(230, 230, 223, 1);
```

### Borders & Inputs
```css
--border: rgba(230, 230, 223, 1);
--input: rgba(230, 230, 223, 1);
--input-background: rgba(255, 255, 255, 1);
--ring: rgba(78, 188, 65, 1);
```

---

## Dark Mode

Wird automatisch aktiviert über:
- System-Einstellung: `@media (prefers-color-scheme: dark)`
- HTML-Attribut: `<html data-theme="dark">`
- CSS-Klasse: `<html class="dark">`

### Wichtig
Im Dark Mode werden Bereiche durch Borders statt unterschiedliche Hintergründe abgegrenzt. `--card` und `--card-dark` sind identisch.

---

## Luxury Yacht Theme

Zugriff via CSS-Klasse: `<html class="theme-yacht">`

### Primäre Farben
```css
--primary: rgba(28, 25, 23, 1);         /* Ebony - Dunkelbraun */
--accent: rgba(212, 175, 55, 1);        /* Gold */
--ring: rgba(212, 175, 55, 1);
```

### Sidebar (Yacht Theme)
```css
--sidebar: rgba(28, 25, 23, 1);         /* Ebony */
--sidebar-primary: rgba(212, 175, 55, 1); /* Gold */
--sidebar-accent: rgba(48, 45, 43, 1);
```

---

## Typography

### Font Family
**Inter** wird automatisch über `globals.css` für alle Elemente gesetzt.

### Font Sizes
```css
--text-h1: 60px;    /* Hauptüberschriften */
--text-h2: 48px;    /* Seitenüberschriften */
--text-h3: 40px;    /* Sektionen */
--text-h4: 24px;    /* Card-Titel */
--text-base: 16px;  /* Normaler Text */
--text-sm: 14px;    /* Beschreibungen */
--text-xs: 12px;    /* Meta-Informationen */
```

### Font Weights
```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### Line Heights
```css
h1, h2:        1.2
h3:            1.3
h4:            1.4
p, span, etc.: 1.5
```

---

## Border Radius

```css
--radius: 6px;           /* Buttons */
--radius-sm: 4px;
--radius-card: 8px;      /* Cards */
--radius-lg: 8px;
--radius-modal: 20px;    /* Modals */
```

---

## Spacing & Layout

Spacing nutzt Tailwind's Standard-System:
- `gap-2` = 0.5rem = 8px
- `gap-4` = 1rem = 16px
- `gap-6` = 1.5rem = 24px
- `p-4`, `p-6`, `px-6`, `py-3`, etc.

---

## Verwendung in Komponenten

### CSS Variables
```tsx
<div style={{ color: 'var(--foreground)' }}>
  Text mit Primary-Farbe
</div>
```

### Border Radius
```tsx
<div style={{ borderRadius: 'var(--radius)' }}>Button</div>
<div style={{ borderRadius: 'var(--radius-card)' }}>Card</div>
<div style={{ borderRadius: 'var(--radius-modal)' }}>Modal</div>
```

### Typography
```tsx
<h4 style={{ fontSize: 'var(--text-h4)', fontWeight: 'var(--font-weight-semibold)' }}>
  Überschrift
</h4>
```

---

## Dark Mode Aktivierung

Drei Möglichkeiten zum Wechsel:

**1. System-Einstellung (Standard)**
```css
@media (prefers-color-scheme: dark) { /* wird automatisch angewandt */ }
```

**2. Data-Attribut**
```tsx
<html data-theme="dark">
```

**3. CSS-Klasse**
```tsx
<html className="dark">
```

---

## Theme-Switching Beispiel

```tsx
const toggleDarkMode = () => {
  document.documentElement.classList.toggle('dark')
}

const setYachtTheme = () => {
  document.documentElement.classList.add('theme-yacht')
  // Für Dark Yacht: classList.add('dark')
}
```

---

## Wichtige Regeln

### 1. Nur CSS-Variablen verwenden
❌ FALSCH:
```tsx
<div style={{ color: '#4EBC41' }}>Text</div>
<div className="text-green-500">Text</div>
```

✅ RICHTIG:
```tsx
<div style={{ color: 'var(--primary)' }}>Text</div>
```

### 2. Inter Font ausschließlich
- Automatisch via `globals.css`
- Keine anderen Schriftarten ohne explizite Anforderung

### 3. Dark Mode Besonderheit
- Cards werden durch Borders abgegrenzt (keine unterschiedlichen Hintergründe)
- `--card` und `--card-dark` sind im Dark Mode identisch

### 4. Focus States (✅ WCAG 2.1 AA Konform)
Alle interaktiven Elemente müssen Focus-Zustände haben:
```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--focus-shadow); /* Adaptive für Dark Mode */
}
```

---

## 🎯 Best Practices für Plugin-Entwickler

### ✅ RICHTIG: Tokens verwenden

```css
/* CSS Module */
.button {
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  font-size: var(--text-base);
  font-weight: var(--font-weight-medium);
}

.button:hover {
  background-color: var(--accent);
}

.button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--focus-shadow);
}
```

### ❌ FALSCH: Hardcoded Colors

```css
/* DON'T! */
.button {
  background-color: #4ebc41; /* ❌ Hardcoded! */
  color: white; /* ❌ Hardcoded! */
}
```

---

## 🌙 Dark Mode – Automatisch!

Dark Mode funktioniert automatisch! Keine zusätzliche Arbeit nötig:

```css
.container {
  background-color: var(--background); /* Light/Dark Auto-Switch */
  color: var(--foreground);
}
```

---

## 🔧 Custom Tokens für Plugins

```css
/* ✅ RICHTIG: Namespaced */
:root {
  --plugin-myplugin-primary: blue;
  --tenant-custom-color: green;
}
```

**Naming**: `--plugin-<name>-<token>` oder `--tenant-<name>-<token>`

---

## 🚨 Fallbacks für alte Browser

```css
.element {
  background-color: #fafaf3; /* Fallback */
  background-color: var(--background);
}
```

**Support**: Chrome 49+, Firefox 31+, Safari 9.1+

---

## 📚 Weitere Ressourcen

- **Security & Architecture Review**: `SECURITY_ARCHITECTURE_REVIEW.md`
- **Design System Migration**: `DESIGN_SYSTEM_MIGRATION.md`
- **Development Rules**: `rules/DEVELOPMENT_RULES.md`

---

## 🔄 Phase 1 Updates (18. Januar 2026)

✅ Design Tokens via `@import`
✅ Fallbacks für CSS-Variablen
✅ Dark Mode Cascade korrigiert
✅ Focus Shadow als Variable
✅ Inline Styles entfernt
✅ CSS Loading Order garantiert

---

**Letzte Aktualisierung**: 18. Januar 2026
**Version**: 1.1
