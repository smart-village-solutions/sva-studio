# ADR-003: Design Token Architecture

**Datum:** 18. Januar 2026
**Status:** ✅ Accepted
**Kontext:** UI Design System & Theming
**Entscheider:** SVA Studio Team

---

## Entscheidung

Wir implementieren ein **CSS Custom Properties Design Token System** mit **semantischen Token-Layern** und **Theme-Switching Support** für konsistente UI-Gestaltung.

## Kontext und Problem

SVA Studio benötigt ein skalierbares Design System für:
- **Multiple Themes** (Standard, Dark Mode, Yacht Theme)
- **Consistent Branding** für verschiedene Kommunen
- **Accessibility Compliance** (WCAG 2.1 AAA)
- **Developer Experience** mit Type Safety
- **Runtime Theme Switching** ohne Page Reload
- **Plugin Theme Integration** für Community Extensions

**Technische Anforderungen:**
- Framework-agnostisches Token System
- Optimale Bundle-Size (< 5 KB CSS)
- Hot Module Replacement Support
- IE11 Fallback Support (öffentliche Verwaltung)

## Betrachtete Ansätze

| Ansatz | Pros | Cons | Bewertung |
|--------|------|------|-----------|
| **CSS Custom Properties** | Native, Runtime-änderbar, performant | IE11 Fallbacks nötig | 9/10 ✅ |
| **CSS-in-JS (Styled Components)** | Type Safety, Dynamic | Runtime-Overhead, SSR-komplex | 6/10 |
| **SASS Variables** | Etabliert, Build-Zeit | Nicht runtime-änderbar | 5/10 |
| **Design Token Build Tools** | Standards-konform, Multi-Platform | Komplexe Toolchain | 7/10 |

## Entscheidung: CSS Custom Properties + Token Layers

### Architektur-Overview:

```css
/* Layer 1: Primitive Tokens */
:root {
  --color-green-50: #f0fdf4;
  --color-green-500: #22c55e;
  --color-green-900: #14532d;
  --spacing-1: 4px;
  --spacing-4: 16px;
}

/* Layer 2: Semantic Tokens */
:root {
  --color-primary: var(--color-green-500);
  --color-success: var(--color-green-500);
  --spacing-sm: var(--spacing-1);
  --spacing-md: var(--spacing-4);
}

/* Layer 3: Component Tokens */
:root {
  --button-primary-bg: var(--color-primary);
  --sidebar-padding: var(--spacing-md);
  --focus-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}
```

### Token-Kategorien:

#### **1. Color Tokens:**
```css
/* Light Theme */
:root {
  --color-primary: rgba(26, 92, 13, 1);     /* WCAG AAA (7.31:1) */
  --color-background: rgba(250, 250, 243, 1);
  --color-text-primary: rgba(16, 16, 11, 1);

  /* RGB Variants für Alpha-Composite */
  --color-primary-rgb: 26, 92, 13;
}

/* Dark Theme */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-background: rgba(16, 16, 11, 1);
    --color-text-primary: rgba(250, 250, 243, 1);
  }
}

/* Explicit Theme Override */
[data-theme="dark"] {
  --color-background: rgba(16, 16, 11, 1);
  --color-text-primary: rgba(250, 250, 243, 1);
}
```

#### **2. Typography Tokens:**
```css
:root {
  /* Scale: Major Third (1.25) */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 20px;
  --font-size-xl: 25px;

  /* Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;
  --line-height-loose: 1.8;
}
```

#### **3. Spacing & Layout:**
```css
:root {
  /* 8px Base Grid */
  --spacing-0: 0px;
  --spacing-1: 4px;    /* 0.5 * base */
  --spacing-2: 8px;    /* 1 * base */
  --spacing-3: 12px;   /* 1.5 * base */
  --spacing-4: 16px;   /* 2 * base */
  --spacing-6: 24px;   /* 3 * base */
  --spacing-8: 32px;   /* 4 * base */

  /* Semantic Spacing */
  --spacing-xs: var(--spacing-1);
  --spacing-sm: var(--spacing-2);
  --spacing-md: var(--spacing-4);
  --spacing-lg: var(--spacing-6);
  --spacing-xl: var(--spacing-8);

  /* Component-specific */
  --sidebar-width: 256px;
  --sidebar-collapsed: 64px;
  --header-height: 64px;
}
```

## Theme-Switching Implementation

### **1. Theme Provider (React Context):**
```typescript
interface ThemeContextType {
  theme: 'light' | 'dark' | 'yacht';
  setTheme: (theme: string) => void;
  toggleTheme: () => void;
}

const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<string>(() =>
    localStorage.getItem('sva-theme') || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sva-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### **2. CSS Theme Definitions:**
```css
/* Yacht Theme (Kommune-spezifisch) */
.theme-yacht {
  --color-primary: rgba(28, 25, 23, 1);    /* Nautical Dark */
  --color-accent: rgba(212, 175, 55, 1);   /* Gold Highlights */
  --color-background: rgba(255, 255, 255, 1);

  /* Theme-specific Focus */
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);
}

/* Performance: Kombinierte Dark Mode Selektoren */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --color-background: rgba(16, 16, 11, 1);
  /* Konsolidiert für bessere Performance */
}
```

## Performance Optimierungen

### **1. Bundle Splitting:**
```typescript
// design-tokens.css: 4.45 kB (Kern-Tokens)
import '@sva-studio/ui-contracts/design-tokens.css';

// theme-yacht.css: 0.8 kB (Yacht-spezifisch, lazy-loaded)
const loadYachtTheme = () => import('./themes/yacht.css');
```

### **2. CSS Optimierungen:**
```css
/* Fallbacks für IE11 */
body {
  background-color: #fafaf3;  /* Fallback */
  background-color: var(--color-background);
}

/* GPU-optimierte Transitions */
.theme-transition {
  transition: background-color 200ms ease-in-out;
  will-change: background-color;
}

/* Reduced Motion Preference */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### **3. Runtime Performance:**
- **CSS Variable Caching:** Browser-native Performance
- **Cascade Optimization:** Konsolidierte Selektoren statt Duplikate
- **Transform vs. Property Changes:** Layout-neutrale Animationen

## Developer Experience

### **1. TypeScript Integration:**
```typescript
// Generated Token Types (Build-Zeit)
type DesignToken =
  | 'color-primary'
  | 'color-background'
  | 'spacing-md'
  | 'font-size-base';

// Type-safe Token Access
const useDesignToken = (token: DesignToken): string => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`).trim();
};

// Usage in Components
const Button = styled.button<{ variant: 'primary' | 'secondary' }>`
  background-color: var(--color-${props => props.variant});
  padding: var(--spacing-md) var(--spacing-lg);
`;
```

### **2. Development Tools:**
```typescript
// Theme Debugging (Development Only)
if (process.env.NODE_ENV === 'development') {
  window.svaThemeDebugger = {
    getAllTokens: () => {
      const styles = getComputedStyle(document.documentElement);
      return Array.from(document.styleSheets)
        .flatMap(sheet => Array.from(sheet.cssRules))
        .filter(rule => rule.cssText.includes('--'))
        .map(rule => rule.cssText);
    },
    setToken: (name: string, value: string) => {
      document.documentElement.style.setProperty(`--${name}`, value);
    }
  };
}
```

### **3. Plugin Integration:**
```typescript
// Plugin Token Registration
interface PluginTokens {
  [key: string]: string;
}

class PluginThemeManager {
  registerPluginTokens(pluginId: string, tokens: PluginTokens): void {
    Object.entries(tokens).forEach(([name, value]) => {
      document.documentElement.style.setProperty(
        `--plugin-${pluginId}-${name}`,
        value
      );
    });
  }
}

// Usage in Plugin
const eventPlugin = {
  init() {
    themeManager.registerPluginTokens('events', {
      'event-primary': 'var(--color-primary)',
      'event-spacing': 'var(--spacing-md)',
    });
  }
};
```

## Accessibility Compliance

### **WCAG 2.1 AAA Konformität:**
```css
:root {
  /* AAA-konforme Kontraste */
  --color-primary: rgba(26, 92, 13, 1);     /* 7.31:1 auf weiß */
  --color-text-secondary: rgba(99, 115, 129, 1); /* 4.78:1 auf weiß */

  /* High-Contrast Overrides */
  --color-focus-outline: var(--color-primary);
  --focus-width: 2px;
  --focus-style: solid;
}

/* Windows High Contrast Mode */
@media (prefers-contrast: high) {
  :root {
    --color-primary: ButtonText;
    --color-background: ButtonFace;
    --color-border: ButtonText;
  }
}

/* Focus Visible (Keyboard-only) */
.focus-visible {
  outline: var(--focus-width) var(--focus-style) var(--color-focus-outline);
  outline-offset: 2px;
}
```

## Community Theme Guidelines

### **Plugin Theme Integration:**
```css
/* Plugin-spezifische Token Namespaces */
:root {
  --plugin-events-primary: var(--color-primary);
  --plugin-events-spacing: var(--spacing-md);
}

/* Community Theme Template */
.theme-community-custom {
  --color-primary: /* Community-Farbe */;
  --color-accent: /* Akzent-Farbe */;

  /* Accessibility-konforme Kontraste erforderlich */
  --color-text-on-primary: /* Min. 4.5:1 Kontrast */;
}
```

### **Theme Validation:**
```bash
# Accessibility Check (CI/CD)
npm run theme:validate
# → Prüft alle Themes auf WCAG-Konformität

# Bundle Size Check
npm run theme:size
# → Warnt bei > 8 KB Theme-Bundle
```

---

**Links:**
- [Design Token Reference](../ui/design-tokens.md)
- [Theme Creation Guide](../guides/custom-themes.md)
- [Accessibility Guidelines](../accessibility/wcag-compliance.md)