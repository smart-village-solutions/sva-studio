# ♿ WCAG 2.1 AA – Quick Reference für Entwickler

**Nutzen Sie diese Checkliste vor Code-Reviews und bei neuen Komponenten**

---

## 🚦 Fünf-Punkt Accessibility Check (2 Min)

### Vor jeder neuen Komponente:

```
[ ] 1. COLOR CONTRAST
   [ ] Text auf Background: Mindestens 4.5:1?
   [ ] Große Text (18pt+): Mindestens 3:1?
   [ ] Mit Farbenblindheits-Simulator getestet?

[ ] 2. FOCUS STATES
   [ ] :focus-visible auf allen interaktiven Elementen?
   [ ] Outline 2px mindestens? (3px noch besser)
   [ ] Outline-Offset: 2px?
   [ ] Focus visible in Light UND Dark Mode?

[ ] 3. DISABLED STATES
   [ ] Visuell KLAR unterscheidbar?
   [ ] Nicht nur opacity: 0.5?
   [ ] Cursor: not-allowed gesetzt?

[ ] 4. KEYBOARD NAVIGATION
   [ ] Tab-Ordnung logisch (oben → unten)?
   [ ] Keine Tab-Fallen (Fokus nicht gefangen)?
   [ ] Alle interaktiven Elemente erreichbar?

[ ] 5. SEMANTIC HTML
   [ ] <button> statt <div onClick>?
   [ ] <a> mit href statt <span onClick>?
   [ ] <label htmlFor="..."> mit <input id="...">?
   [ ] <img alt="..."> mit aussagekräftigem Alt-Text?
```

---

## 🎨 Farb-Kontrast Schnell-Guide

### Diese Farb-Kombinationen sind OK (nach Fix):

```css
✅ APPROVED (nach WCAG Fixes):

Text: #1A5C0D (neues Primär-Grün)
auf Hintergrund: #FAFAF3
Kontrast: 7.31:1 ✅

Text: #FAFAF3
auf Hintergrund: #10100B (Dark Mode)
Kontrast: 19.92:1 ✅

Text: #1C1917 (Yacht Ebony)
auf Hintergrund: #D4AF37 (Yacht Gold)
Kontrast: 8.27:1 ✅
```

### Diese NIEMALS verwenden ohne gutes Fallback:

```css
❌ NICHT OK:
- Hellgrün (#4EBC41) auf Hell-Background
- Text und Background zu ähnliche Farbe
- Nur opacity: 0.5 für Disabled
- Fokus-Outline unter 2px
```

---

## 🎯 Focus State Template

**Für neue CSS-Module kopieren**:

```css
/* ✅ WCAG 2.1 AA Compliant Focus Styles */

button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--focus-shadow);
}

a:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

input:focus,
select:focus,
textarea:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-color: var(--ring);
  box-shadow: var(--focus-shadow, none);
}

/* Disabled State – Klar unterscheidbar */
button:disabled {
  opacity: 1;
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

input:disabled,
select:disabled,
textarea:disabled {
  opacity: 1;
  background-color: var(--muted);
  border-color: var(--border);
  color: var(--muted-foreground);
  cursor: not-allowed;
}
```

---

## 📋 Component Checklist

**Nach Erstellung einer neuen Komponente**:

```tsx
/* Header.tsx */
const MyComponent = () => {
  return (
    <>
      {/* ✅ Semantic HTML */}
      <button onClick={handleClick}>Click me</button>

      {/* ✅ Label + Input verknüpft */}
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        disabled={isLoading}
      />

      {/* ✅ Alt-Text für Bilder */}
      <img
        src="logo.png"
        alt="Company logo"
      />

      {/* ✅ Skip-Links für Screen Reader */}
      <a href="#main-content" className="sr-only">
        Skip to main content
      </a>

      {/* ✅ ARIA-Label für Icon-Only Buttons */}
      <button aria-label="Close menu">✕</button>

      {/* ✅ role + aria-* für Custom Controls */}
      <div
        role="tablist"
        aria-label="Content sections"
      >
        {/* Tabs here */}
      </div>
    </>
  );
};
```

**Entsprechende CSS**:

```css
/* MyComponent.module.css */
@import '@sva-studio/ui-contracts/design-tokens.css';

.button {
  /* ✅ Alle Farben als Variablen */
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all 0.2s;
}

/* ✅ Focus State – MUSS vorhanden sein */
.button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--focus-shadow);
}

/* ✅ Disabled – Sichtbar unterscheidbar */
.button:disabled {
  opacity: 1;
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}

/* ✅ Dark Mode – Automatisch via Design Tokens */
/* Keine zusätzliche Arbeit nötig! */
```

---

## 🧪 Testing Tools (Gratis)

### Browser Extensions:
- **Axe DevTools** (Chrome, Firefox): https://www.deque.com/axe/devtools/
- **WAVE** (Chrome, Firefox): https://wave.webaim.org/
- **Lighthouse** (Chrome DevTools): F12 → Lighthouse

### Online Tools:
- **Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Color Blindness Simulator**: https://www.color-blindness.com/coblis-color-blindness-simulator/
- **WCAG Validator**: https://www.w3.org/WAI/test-evaluate/

### Keyboard Test:
```
Nur Tastatur verwenden – keine Maus!

Tab     → nächstes Element
Shift+Tab → vorheriges Element
Enter   → Button/Link aktivieren
Space   → Checkbox/Button aktivieren
Arrow   → Select/Menu Navigation
Esc     → Modal/Popup schließen
```

### Screen Reader Test:

**macOS**:
```bash
cmd + F5  # VoiceOver aktivieren
```

**Windows**:
```bash
# NVDA kostenlos herunterladen
https://www.nvaccess.org/
```

---

## 🚫 Häufigste Fehler (VERMEIDEN!)

### ❌ Fehler 1: Inline Styles für Farben

```tsx
// ❌ FALSCH
<button style={{ backgroundColor: '#4ebc41' }}>Click</button>

// ✅ RICHTIG
<button className={styles.button}>Click</button>
```

```css
/* styles.module.css */
.button {
  background-color: var(--primary);
}
```

---

### ❌ Fehler 2: Keine Focus States

```css
/* ❌ FALSCH */
button {
  outline: none;  /* Focus verstecken! */
}

/* ✅ RICHTIG */
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

---

### ❌ Fehler 3: Disabled nur mit opacity

```css
/* ❌ FALSCH */
button:disabled {
  opacity: 0.5;  /* Zu subtil! */
}

/* ✅ RICHTIG */
button:disabled {
  opacity: 1;
  background-color: var(--muted);
  color: var(--muted-foreground);
  cursor: not-allowed;
}
```

---

### ❌ Fehler 4: Div statt Button

```tsx
/* ❌ FALSCH – nicht fokussierbar für Tastatur */
<div onClick={handleClick}>
  Click me
</div>

/* ✅ RICHTIG – semantisch, fokussierbar */
<button onClick={handleClick}>
  Click me
</button>
```

---

### ❌ Fehler 5: Bilder ohne Alt-Text

```tsx
/* ❌ FALSCH */
<img src="logo.png" />

/* ✅ RICHTIG */
<img
  src="logo.png"
  alt="SVA Studio logo"
/>

/* Für dekorative Bilder: */
<img
  src="divider.png"
  alt=""  /* Leer = Screen Reader ignoriert */
/>
```

---

## 🎨 Farb-Kombinationen – Schnell-Referenz

### Light Mode (Standard)

```css
✅ Text-Farben auf #FAFAF3 (Hintergrund):
  - #1A5C0D (Primär Dunkelgrün):  7.31:1 ✅
  - #10100B (Dunkeltext):         19.92:1 ✅
  - #0B5E8D (Sekundär Blau):      5.8:1 ✅

❌ Zu schwach:
  - #4EBC41 (Altes Grün):         2.51:1 ❌
  - #13C296 (Altes Sekundär):     3.12:1 ❌
```

### Dark Mode

```css
✅ Text-Farben auf #10100B (Hintergrund):
  - #FAFAF3 (Hell-Text):          19.92:1 ✅
  - #D4AF37 (Gold für Yacht):     12.1:1 ✅
```

### Yacht Theme

```css
✅ Text-Farben auf #D4AF37 (Gold):
  - #1C1917 (Ebony):              8.27:1 ✅

✅ Focus Shadow:
  - Light: rgba(212, 175, 55, 0.2)
  - Dark: rgba(212, 175, 55, 0.08)
```

---

## 📚 Ressourcen

- [WCAG 2.1 AA Checklist](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [WebAIM: Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [SVA Studio DEVELOPMENT_RULES](./rules/DEVELOPMENT_RULES.md)
- [SVA Studio DESIGN_TOKENS](./packages/ui-contracts/DESIGN_TOKENS.md)

---

## ✅ Vor Code-Review

**Checkliste für Entwickler**:

```
Bevor Sie einen PR erstellen:

[ ] Neuer Code hat Focus States (:focus-visible)
[ ] Alle Text-Farben sind Kontrast-kompatibel
[ ] Disabled-States sind visuell unterscheidbar
[ ] Keyboard Navigation funktioniert (nur Tab testen)
[ ] Keine inline styles für Farben
[ ] Semantic HTML verwendet
[ ] Alt-Text auf allen Bildern
[ ] Keine Hardcoded Farben (#FFFFFF etc)
[ ] Design Tokens aus design-tokens.css importiert
[ ] Axe DevTools: 0 Violations
[ ] Lighthouse Accessibility Audit: 90+
```

---

## 🎯 Priorisierung

**Wenn Zeit limitiert, fokussiere auf diese Reihenfolge**:

1. **Focus States** – Keyboard Navigation ist essentiell
2. **Color Contrast** – Text muss lesbar sein
3. **Semantic HTML** – Screen Reader brauchen richtige Struktur
4. **Disabled States** – Benutzer müssen verstehen, was deaktiviert ist
5. **Alt-Text** – Blinde Benutzer brauchen Bild-Beschreibungen

---

## 💬 Fragen?

Siehe auch:
- [WCAG_ACCESSIBILITY_AUDIT.md](./WCAG_ACCESSIBILITY_AUDIT.md) – Detaillierte Audit
- [WCAG_IMPLEMENTATION_GUIDE.md](./WCAG_IMPLEMENTATION_GUIDE.md) – Code-Fixes
- [DEVELOPER_COMPLIANCE_CHECKLIST.md](./DEVELOPER_COMPLIANCE_CHECKLIST.md) – Design System
