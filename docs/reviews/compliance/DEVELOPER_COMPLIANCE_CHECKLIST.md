# 🔒 Design System – Security & Architecture Compliance Checklist

**For**: All Developers & Plugin Developers
**Status**: ✅ Phase 1 Implemented
**Review**: [SECURITY_ARCHITECTURE_REVIEW.md](SECURITY_ARCHITECTURE_REVIEW.md)

---

## ✅ Before Creating New Components

Use this checklist to ensure your component is compliant:

### 1. CSS & Styling
- [ ] ✅ I am using **CSS Modules** (not inline styles)
- [ ] ✅ I import `'@sva-studio/ui-contracts/design-tokens.css'`
- [ ] ✅ All colors use `var(--*)` tokens
- [ ] ✅ No hardcoded colors (`#FFFFFF`, `rgb()`, `hsl()`)
- [ ] ✅ No inline styles (`style={{}}`)
- [ ] ✅ I have CSS Fallbacks for old browsers

```tsx
/* ❌ WRONG */
<div style={{ backgroundColor: '#4ebc41', padding: '1rem' }}>
  Content
</div>

/* ✅ CORRECT */
<div className={styles.container}>
  Content
</div>
```

```css
/* ✅ styles.module.css */
.container {
  background-color: #4ebc41; /* Fallback */
  background-color: var(--primary);
  padding: 1rem;
}
```

### 2. Dark Mode Support
- [ ] ✅ I use semantic tokens that support dark mode automatically
- [ ] ✅ I tested my component in **Light Mode** & **Dark Mode**
- [ ] ✅ Focus states are visible in both modes
- [ ] ✅ I use `var(--focus-shadow)` for focus box-shadows

```css
/* ❌ WRONG - Hardcoded shadow */
input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1); /* Always green! */
}

/* ✅ CORRECT - Uses Theme-aware variable */
input:focus {
  box-shadow: var(--focus-shadow); /* Dark mode: 0.05 opacity */
}
```

### 3. Accessibility (WCAG 2.1 AA)
- [ ] ✅ All interactive elements have **:focus-visible** styles
- [ ] ✅ Focus outline is 2px solid with `var(--ring)`
- [ ] ✅ I use semantic HTML (`<button>`, `<input>`, `<label>`)
- [ ] ✅ Form labels are associated with inputs (`<label htmlFor="...">`)
- [ ] ✅ Focus order is logical (Tab key navigation works)

```tsx
/* ❌ WRONG */
<div onClick={handleClick}>Click me</div>

/* ✅ CORRECT */
<button onClick={handleClick}>Click me</button>
```

```css
/* ✅ Focus visible is mandatory */
button:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  box-shadow: var(--focus-shadow);
}
```

### 4. Internationalization (i18n)
- [ ] ✅ No hardcoded text in components (use `t('key')`)
- [ ] ✅ Translation keys exist in `de.json` AND `en.json`
- [ ] ✅ Translation keys are semantic (not `label_xyz`)

```tsx
/* ❌ WRONG - Hardcoded text */
<button>Klicken Sie hier</button>

/* ✅ CORRECT - Uses i18n */
<button>{t('common.submit')}</button>
```

### 5. Browser Compatibility
- [ ] ✅ My component works in **Chrome 49+**
- [ ] ✅ My component works in **Firefox 31+**
- [ ] ✅ My component works in **Safari 9.1+**
- [ ] ✅ My component degrades gracefully in old browsers

### 6. Performance
- [ ] ✅ No inline styles (creates unnecessary re-renders on theme change)
- [ ] ✅ I use CSS Modules (scoped, no conflicts)
- [ ] ✅ No duplicate CSS (reuse existing components)

### 7. Documentation
- [ ] ✅ My component is documented (README or Storybook)
- [ ] ✅ Usage examples show correct patterns
- [ ] ✅ Dark mode is mentioned in documentation

---

## 📊 Design Tokens Reference

### Colors (Auto Dark-Mode)
```css
--background      /* Page background */
--foreground      /* Primary text */
--primary         /* Main brand color */
--secondary       /* Secondary actions */
--accent          /* Accent elements */
--destructive     /* Dangerous actions */
--ring            /* Focus outline */
--border          /* Borders & dividers */
--sidebar         /* Sidebar background */
```

### Typography
```css
--text-h1         /* 60px */
--text-h2         /* 48px */
--text-h3         /* 40px */
--text-h4         /* 24px */
--text-base       /* 16px */
--text-sm         /* 14px */
--text-xs         /* 12px */

--font-weight-normal       /* 400 */
--font-weight-medium       /* 500 */
--font-weight-semibold     /* 600 */
--font-weight-bold         /* 700 */
```

### Spacing & Radius
```css
--radius          /* 6px - default */
--radius-sm       /* 4px - small */
--radius-card     /* 8px - cards */
--radius-lg       /* 8px - large */

--sidebar-width   /* 256px */
--header-height   /* 64px */
```

### Focus & Shadows
```css
--ring            /* Focus color */
--focus-shadow    /* Focus shadow (dark-mode aware!) */
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake #1: Hardcoded Colors
```css
/* WRONG */
.button {
  background-color: #4ebc41;
  color: white;
  border: 1px solid #e6e6df;
}
```

### ❌ Mistake #2: Inline Styles
```tsx
/* WRONG */
<div style={{ color: 'var(--foreground)', padding: '1rem' }}>
  Content
</div>
```

### ❌ Mistake #3: No Focus Styles
```css
/* WRONG - No focus! */
button {
  background-color: var(--primary);
  cursor: pointer;
}
```

### ❌ Mistake #4: Hardcoded Focus Shadow
```css
/* WRONG - Invisible in dark mode! */
input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
}
```

### ❌ Mistake #5: No Translation Keys
```tsx
/* WRONG */
<label>Name:</label>

/* CORRECT */
<label>{t('form.name')}:</label>
```

---

## ✅ Component Template

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styles from './MyComponent.module.css'

export function MyComponent() {
  const { t } = useTranslation()
  const [value, setValue] = useState('')

  return (
    <div className={styles.container}>
      <label htmlFor="input" className={styles.label}>
        {t('form.label')}
      </label>
      <input
        id="input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={styles.input}
        placeholder={t('form.placeholder')}
      />
    </div>
  )
}
```

```css
/* MyComponent.module.css */

.container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-medium);
  color: var(--foreground);
}

.input {
  padding: 0.75rem 1rem;
  background-color: var(--input-background);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: var(--text-base);
  transition: all 0.2s;
}

/* Fallback for old browsers */
.input {
  background-color: #ffffff;
  border: 1px solid #e6e6df;
}

/* Modern browsers */
.input {
  background-color: var(--input-background);
  border: 1px solid var(--border);
}

.input:focus-visible {
  outline: none;
  border-color: #4ebc41; /* Fallback */
  border-color: var(--ring);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}

.input:disabled {
  background-color: var(--muted);
  opacity: 0.6;
  cursor: not-allowed;
}
```

```json
/* en.json */
{
  "form": {
    "label": "Name",
    "placeholder": "Enter your name"
  }
}

/* de.json */
{
  "form": {
    "label": "Name",
    "placeholder": "Geben Sie Ihren Namen ein"
  }
}
```

---

## 🔗 Related Documentation

- [SECURITY_ARCHITECTURE_REVIEW.md](SECURITY_ARCHITECTURE_REVIEW.md) – Detailed security findings
- [DESIGN_TOKENS.md](packages/ui-contracts/DESIGN_TOKENS.md) – Design tokens reference
- [DEVELOPMENT_RULES.md](rules/DEVELOPMENT_RULES.md) – All development rules
- [DESIGN_SYSTEM_MIGRATION.md](DESIGN_SYSTEM_MIGRATION.md) – Design system status

---

## ❓ Questions?

1. **Can I use inline styles?** → ❌ NO (unless dynamic data from DB)
2. **Can I use hardcoded colors?** → ❌ NO (use tokens)
3. **Do I need to support dark mode?** → ✅ YES (automatic with tokens)
4. **Do I need fallbacks for old browsers?** → ✅ YES (IE11)
5. **Do I need focus states?** → ✅ YES (keyboard navigation)

---

**Last Updated**: 18. Januar 2026
**Version**: 1.0
**Compliance**: ✅ DEVELOPMENT_RULES
