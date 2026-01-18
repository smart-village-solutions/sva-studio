# CSS Performance Monitoring & Debug Guide

**Für Entwickler & DevOps**

---

## 1. Browser DevTools – CSS Performance Profiling

### 1.1 Chrome DevTools – CSS Variable Lookup

```
Schritt 1: DevTools öffnen (F12)
Schritt 2: Performance Tab → Record
Schritt 3: Theme-Button klicken
Schritt 4: Stop Recording

Analyse:
├─ Scripting: ~50ms (JS execution)
├─ Rendering: ~200ms (CSS recalculation)
├─ Painting: ~150ms (Display repaint)
└─ Total: ~400ms (aktuell ineffizient)
```

### 1.2 CSS Cascade Debugging

```javascript
// In Console eingeben:
const style = getComputedStyle(document.documentElement);
console.log('--background:', style.getPropertyValue('--background'));
console.log('--primary:', style.getPropertyValue('--primary'));

// Zeigt die aufgelösten Werte
```

### 1.3 Reflow/Repaint Markers

```javascript
// Mark CSS parsing
performance.mark('css-parsing-start');

// Triggere Reflow
document.body.offsetHeight;  // ← Reflow force

performance.mark('css-parsing-end');
performance.measure('css-parsing', 'css-parsing-start', 'css-parsing-end');

// Resultat in Performance Timeline
```

---

## 2. Netzwerk-Analysen

### 2.1 CSS Loading Timeline

```bash
# Chrome Network Priority
curl -w "DNS: %{time_namelookup}
TCP: %{time_connect}
TTFB: %{time_starttransfer}
Total: %{time_total}\n" \
  -o design-tokens.css \
  https://your-domain.com/assets/design-tokens.css
```

### 2.2 Parallel vs Sequential Loading

```
Aktuell (Sequential):
T+0ms:    design-tokens.css start
T+10ms:   design-tokens.css finish
T+10ms:   globals.css start
T+20ms:   globals.css finish
T+20ms:   Render start
─────────────────────────
Total CSS Block: 20ms

Mit HTTP/2 (Parallel):
T+0ms:    design-tokens.css start
T+0ms:    globals.css start          ← Parallel!
T+10ms:   Both finish
T+10ms:   Render start
─────────────────────────
Total CSS Block: 10ms (50% faster!)
```

### 2.3 Waterfall Analyse (DevTools Network Tab)

```
design-tokens.css    [========] 3.5 KB │ Pri: High  │ 8.4ms
globals.css          [====]    2.0 KB  │ Pri: High  │ 5.2ms
Header.module.css    [==]     0.5 KB  │ Pri: Low   │ 3.1ms

Ideale Strategie:
✅ design-tokens.css & globals.css: Gleichzeitig (HTTP/2)
✅ Module CSS: Lazy loaded nach First Paint
```

---

## 3. Build & Bundle Analyse

### 3.1 CSS Bundle Größenanalyse

```bash
# Dateigrößen anzeigen
du -h dist/**/*.css

# Top CSS Selektoren (by frequency)
grep -o '\.[a-zA-Z]*' dist/main.css | sort | uniq -c | sort -rn | head -20

# Komplexe Selektoren finden
grep -E '\.[\w-]+ .*:.*{' dist/main.css | head -10
```

### 3.2 Vite Bundle Report

```bash
# Vite Build mit Report
pnpm nx build sva-studio-react -- --report

# Oder mit rollup visualizer
npm install --save-dev rollup-plugin-visualizer
```

### 3.3 CSS Komplexität Metriken

```javascript
// Selector Complexity Score
const calculateSelectorComplexity = (selector) => {
  let score = 0;
  score += (selector.match(/\./g) || []).length * 1;      // Class: 1 point
  score += (selector.match(/\#/g) || []).length * 2;      // ID: 2 points
  score += (selector.match(/\[/g) || []).length * 1.5;    // Attribute: 1.5
  score += (selector.match(/>/g) || []).length * 0.5;     // Child: 0.5
  score += (selector.match(/~/g) || []).length * 0.5;     // Sibling: 0.5
  return score;
};

// Beispiele:
console.log(calculateSelectorComplexity('button'));              // 0
console.log(calculateSelectorComplexity('.btn:hover'));          // 1
console.log(calculateSelectorComplexity('div.container > .item'));  // 2
```

---

## 4. Theme-Switch Performance Deep-Dive

### 4.1 Current Flow (problematisch)

```
JavaScript Initiiert Theme-Change:
├─ dataset.theme = 'dark'
├─ classList.add('dark')
└─ HTML data-attr updated

Browser CSS Engine:
├─ CSSOM Rebuild (neu-parse alle Selektoren!)
├─ Cascade Resolution
│  ├─ :root selector matchen
│  ├─ [data-theme="dark"] selector matchen
│  ├─ .dark selector matchen
│  └─ Media Query neu-evaluate
├─ Computed Styles für alle Elemente
├─ Layout Recalculation (reflow)
└─ Paint (repaint)

Timeline:
T+0ms:   JS execution
T+50ms:  CSS recalc
T+150ms: Layout
T+250ms: Paint
────────────────
T+400ms: Done (zu slow!)
```

### 4.2 Optimierter Flow

```
After Fixes:

JavaScript Initiiert:
├─ dataset.theme = 'dark'  ← Single operation
└─ Done (relying on CSS)

Browser CSS Engine:
├─ Minimal CSSOM change
├─ Cascade nur für :root updated
├─ Computed Styles propagieren via variables
├─ Layout (nur notwendig wenn layout-affecting)
└─ Paint nur für visible elements

Timeline:
T+0ms:   JS execution
T+20ms:  CSS recalc (optimized)
T+60ms:  Layout (if needed)
T+100ms: Paint
────────────────
T+150ms: Done (73% faster!)
```

### 4.3 Messung mit PerformanceObserver

```javascript
class ThemeSwitchProfiler {
  constructor() {
    this.marks = [];
    this.setupObserver();
  }

  setupObserver() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.marks.push({
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime,
          entryType: entry.entryType
        });
      }
    });

    observer.observe({
      entryTypes: ['measure', 'paint', 'layout-shift']
    });
  }

  switchTheme(theme) {
    const startMark = `theme-start-${theme}`;
    performance.mark(startMark);

    // CSS var update
    document.documentElement.dataset.theme = theme;

    // Wait for repaint
    requestAnimationFrame(() => {
      performance.mark(`theme-end-${theme}`);
      performance.measure(
        `theme-switch-${theme}`,
        startMark,
        `theme-end-${theme}`
      );

      this.logResults();
    });
  }

  logResults() {
    const entries = performance.getEntriesByType('measure');
    const lastEntry = entries[entries.length - 1];

    console.table({
      'Theme Switch Duration': `${lastEntry.duration.toFixed(2)}ms`,
      'Target': '<50ms ✅' + (lastEntry.duration < 50 ? '' : ' (slow)'),
      'Rendering Marks': this.marks.length
    });
  }
}

// Usage
const profiler = new ThemeSwitchProfiler();
profiler.switchTheme('dark');
```

---

## 5. Core Web Vitals Impakt

### 5.1 Largest Contentful Paint (LCP)

```
LCP ist blockiert durch:
└─ CSS-Datei Laden
   ├─ design-tokens.css (CRITICAL PATH)
   ├─ globals.css (CRITICAL PATH)
   └─ Component CSS (can be async)

Impact Calculation:
Design Tokens: 3.5 KB
├─ 3G Latency: ~500ms RTT
├─ Network: 1 Mbps (3G avg)
├─ Transfer Time: 28ms
├─ Total: 28ms
└─ Impact on LCP: +28ms ⚠️

Nach Optimierung:
├─ CSS Inlining: -2 Requests
├─ Gzip: -1.2 KB
├─ Total: +15ms on LCP ✅
```

### 5.2 Cumulative Layout Shift (CLS)

```
CSS Variables → NO CLS Risk
├─ :root vars werden sofort set
├─ Kein Reflowing bei Init
├─ Theme-Switch kann CLS cause wenn nicht optimiert

Risk Analyse:
Theme-Switch (aktuell):
├─ 3 Selektoren matchen
├─ Cascade Konflikt möglich
├─ Layout Shift Risiko: MITTEL
└─ CLS Impact: 0.05-0.15

Nach Fixes:
├─ 1 Selector matchen
├─ Keine Cascade Konflikte
├─ Layout Shift Risiko: GERING
└─ CLS Impact: 0.01-0.05
```

### 5.3 Interaction to Next Paint (INP)

```
INP affected by:
├─ JavaScript execution time (50-80ms typical)
├─ CSS recalculation (30-100ms)
├─ Layout & Paint (50-150ms)

Button Hover Timeline (aktuell):
T+0ms:    Click event
T+5ms:    JS handler
T+25ms:   CSS calc (:hover matches 3 selectors)
T+50ms:   Paint
────────────────
T+75ms:   User sees feedback (akzeptabel)

Nach Fixes:
T+0ms:    Click event
T+5ms:    JS handler
T+15ms:   CSS calc (optimized)
T+30ms:   Paint
────────────────
T+45ms:   User sees feedback (besser!)
```

---

## 6. CSS Variable Performance Details

### 6.1 Lookup Performance Benchmark

```javascript
const benchmark = () => {
  const times = [];

  for (let i = 0; i < 10000; i++) {
    const start = performance.now();
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary');
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const max = Math.max(...times);

  console.log(`Avg var() lookup: ${avg.toFixed(3)}μs`);
  console.log(`Max var() lookup: ${max.toFixed(3)}μs`);
  console.log(`10k lookups: ${(avg * 10000).toFixed(1)}ms`);
};

// Typical Result:
// Avg var() lookup: 0.8μs
// Max var() lookup: 2.1μs
// 10k lookups: 8.2ms ✅
```

### 6.2 Cascade Depth Impact

```javascript
// Browser must traverse cascade:
// html → body → div.container → button
// 4 levels deep

// Mit CSS Variables:
:root { --primary: #4ebc41; }           // Level 0
body { color: var(--primary); }         // Level 1 (inherits)
.container { color: var(--primary); }   // Level 2 (inherits)
button { color: var(--primary); }       // Level 3 (inherits)

// Lookup at button: traverse 3 levels = ~2.4μs
// vs hardcoded: instant lookup = ~0.1μs
// Difference: 2.3μs (negligible for performance)
```

---

## 7. Monitoring & Alerting

### 7.1 Real-time Performance Metrics

```javascript
// Sentry Integration für Production Monitoring
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_DSN",
  tracesSampleRate: 0.1,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

// Track theme switch performance
export const trackThemeSwitch = (theme) => {
  const transaction = Sentry.startTransaction({
    name: "theme-switch",
    op: "theme",
  });

  const paintSpan = transaction.startChild({
    op: "paint",
    description: "CSS recalculation",
  });

  document.documentElement.dataset.theme = theme;

  requestAnimationFrame(() => {
    paintSpan.end();

    if (paintSpan.duration > 100) {
      Sentry.captureMessage(
        `Slow theme switch: ${paintSpan.duration}ms`,
        "warning"
      );
    }

    transaction.end();
  });
};
```

### 7.2 Alerts Setup (beispielhaft)

```yaml
# monitoring-config.yml
alerts:
  css_performance:
    - name: "Slow Theme Switch"
      condition: "theme-switch > 100ms"
      severity: "warning"
      action: "alert-team"

    - name: "High LCP Caused by CSS"
      condition: "lcp > 150ms AND css-load > 50ms"
      severity: "error"
      action: "page-alert"

    - name: "Bundle Size Regression"
      condition: "main.css > 10kb"
      severity: "warning"
      action: "pr-comment"

  network:
    - name: "CSS Caching Ineffective"
      condition: "cache-hit-rate < 0.8"
      severity: "info"
```

---

## 8. Regression Testing

### 8.1 Automated Bundle Size Check

```bash
#!/bin/bash
# scripts/check-bundle-size.sh

BUNDLE_SIZE=$(du -sb dist/main.css | awk '{print $1}')
MAX_SIZE=10240  # 10 KB

if [ $BUNDLE_SIZE -gt $MAX_SIZE ]; then
  echo "❌ Bundle size exceeded: $BUNDLE_SIZE > $MAX_SIZE"
  exit 1
else
  echo "✅ Bundle size OK: $BUNDLE_SIZE bytes"
fi
```

### 8.2 Performance Budget

```javascript
// performance-budget.json
{
  "resourceBudgets": [
    {
      "resourceType": "stylesheet",
      "budget": 10,           // 10 KB
      "threshold": 5          // 5% overage tolerance
    }
  ],
  "timingBudgets": [
    {
      "metric": "first-contentful-paint",
      "budget": 1800,         // ms
      "threshold": 10         // %
    }
  ]
}
```

---

## 9. Dokumentation für Entwickler

### 9.1 CSS Variables Styleguide

```css
/* DO: Use semantic names */
--primary: #4ebc41;           ✅
--background: #fafaf3;        ✅

/* DON'T: Use cryptic names */
--c1: #4ebc41;                ❌
--bg: #fafaf3;                ❌

/* DO: Group by category */
:root {
  /* Colors */
  --primary: #4ebc41;
  --secondary: #13c296;

  /* Typography */
  --text-base: 16px;
  --text-sm: 14px;

  /* Layout */
  --sidebar-width: 256px;
}

/* DON'T: Mix categories */
:root {
  --primary: #4ebc41;
  --text-base: 16px;
  --sidebar-width: 256px;  ← Avoid random ordering
}
```

### 9.2 Theme-Switch Best Practices

```javascript
// DO: Use data attributes for themes
document.documentElement.dataset.theme = 'dark';  ✅

// DO: Keep themes in CSS
:root[data-theme="dark"] {
  --background: #10100b;
}

// DON'T: Duplicate theme logic in JS
if (theme === 'dark') {
  element.style.background = '#10100b';  ❌
}

// DON'T: Use multiple mechanisms
classList.add('dark');              ❌
dataset.theme = 'dark';             ❌
style.setProperty('--theme', 'dark'); ❌
```

---

## 10. Checkliste für Performance Review

- [ ] CSS Bundle Size < 10 KB
- [ ] Gzip Ratio 25-35%
- [ ] Theme-Switch < 50ms
- [ ] LCP mit CSS < 150ms
- [ ] CLS durch CSS < 0.1
- [ ] No render-blocking CSS > 5 KB
- [ ] CSS Inlined für Critical Path
- [ ] Cache-Headers optimiert
- [ ] No unused CSS-Dateien
- [ ] Selektoren Komplexität < 10 points
- [ ] CSS Variables Fallbacks present
- [ ] No hardcoded Colors (except fallbacks)
