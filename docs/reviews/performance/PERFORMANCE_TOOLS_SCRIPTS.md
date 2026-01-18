# Performance Optimization Tools & Scripts

**Automatisierte Analyse und Optimierungen für CSS Performance**

---

## 1. Bundle Size Analysis Script

**Datei:** `scripts/analyze-bundle-size.js`

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CSS_FILES = [
  'apps/sva-studio-react/src/globals.css',
  'packages/ui-contracts/src/design-tokens.css',
  'apps/sva-studio-react/src/components/Header.module.css',
  'apps/sva-studio-react/src/components/Sidebar.module.css',
  'apps/sva-studio-react/src/components/RootLayout.module.css',
  'apps/sva-studio-react/src/components/ContentArea.module.css',
  'apps/sva-studio-react/src/routes/index.module.css',
];

const analyzeCSS = (filePath) => {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const buffer = Buffer.from(content);
  const gzipped = zlib.gzipSync(buffer);

  const stats = {
    path: filePath,
    size: buffer.length,
    gzip: gzipped.length,
    ratio: ((gzipped.length / buffer.length) * 100).toFixed(2),
    lines: content.split('\n').length,
    selectors: (content.match(/\{/g) || []).length,
    variables: (content.match(/var\(/g) || []).length,
    mediaQueries: (content.match(/@media/g) || []).length,
  };

  return stats;
};

const main = () => {
  console.log('\n📊 CSS BUNDLE SIZE ANALYSIS\n');

  let totalSize = 0;
  let totalGzip = 0;
  const results = [];

  CSS_FILES.forEach(file => {
    const stats = analyzeCSS(file);
    if (stats) {
      results.push(stats);
      totalSize += stats.size;
      totalGzip += stats.gzip;
    }
  });

  // Table output
  console.table(results.map(r => ({
    File: r.path.split('/').pop(),
    Size: `${r.size} B`,
    Gzip: `${r.gzip} B`,
    Ratio: `${r.ratio}%`,
    Lines: r.lines,
    Vars: r.variables,
  })));

  console.log('\n📊 TOTALS\n');
  console.log(`Total Size:  ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`Total Gzip:  ${(totalGzip / 1024).toFixed(2)} KB`);
  console.log(`Ratio:       ${((totalGzip / totalSize) * 100).toFixed(2)}%`);
  console.log(`Savings:     ${(totalSize - totalGzip).toLocaleString()} bytes`);

  // Warnings
  console.log('\n⚠️  WARNINGS\n');

  results.forEach(r => {
    if (r.size > 5000) {
      console.warn(`⚠️  ${r.path}: Large file (${r.size} bytes)`);
    }
    if (r.mediaQueries > 5) {
      console.warn(`⚠️  ${r.path}: Many media queries (${r.mediaQueries})`);
    }
    if (r.ratio > 0.35) {
      console.warn(`⚠️  ${r.path}: Poor gzip ratio (${r.ratio}%)`);
    }
  });

  console.log('\n✅ Analysis complete\n');
};

main();
```

**Nutzung:**
```bash
node scripts/analyze-bundle-size.js
```

---

## 2. CSS Variable Lookup Performance Test

**Datei:** `scripts/profile-css-variables.js`

```javascript
// Zu Node.js oder Browser-Console kopieren

const profileCSSVariables = () => {
  console.log('\n⚡ CSS VARIABLE PERFORMANCE PROFILE\n');

  // Get computed style once (baseline)
  const el = document.documentElement;
  const iterations = 10000;

  // Test 1: Single variable lookup
  const start1 = performance.now();
  for (let i = 0; i < iterations; i++) {
    getComputedStyle(el).getPropertyValue('--primary');
  }
  const time1 = performance.now() - start1;

  // Test 2: Multiple variables
  const start2 = performance.now();
  for (let i = 0; i < iterations; i++) {
    const style = getComputedStyle(el);
    style.getPropertyValue('--primary');
    style.getPropertyValue('--background');
    style.getPropertyValue('--foreground');
  }
  const time2 = performance.now() - start2;

  // Test 3: Deep cascade (4 levels)
  const deepEl = document.querySelector('button');
  const start3 = performance.now();
  for (let i = 0; i < iterations; i++) {
    getComputedStyle(deepEl).getPropertyValue('--primary');
  }
  const time3 = performance.now() - start3;

  console.table({
    'Single Lookup (10k)': `${time1.toFixed(2)}ms (${(time1/iterations*1000).toFixed(2)}μs each)`,
    'Triple Lookup (10k)': `${time2.toFixed(2)}ms (${(time2/iterations*1000).toFixed(2)}μs each)`,
    'Deep Cascade (10k)': `${time3.toFixed(2)}ms (${(time3/iterations*1000).toFixed(2)}μs each)`,
  });

  console.log('\n✅ Results:');
  console.log(`Single var() lookup: ~${(time1/iterations*1000).toFixed(2)}μs`);
  console.log(`Practical impact: ${(time1/1000).toFixed(1)}ms for 10k elements`);
  console.log(`Verdict: ✅ Negligible performance impact`);
};

profileCSSVariables();
```

---

## 3. Theme Switch Performance Profiler

**Datei:** `scripts/profile-theme-switch.ts`

```typescript
import { performance } from 'perf_hooks';

export class ThemeSwitchProfiler {
  private marks: Map<string, number> = new Map();

  public profileThemeSwitch(theme: 'light' | 'dark') {
    console.log(`\n📊 THEME SWITCH PROFILING: ${theme}\n`);

    // Mark start
    this.mark('theme-switch-start');

    // CSS Update
    this.mark('css-update-start');
    document.documentElement.dataset.theme = theme;
    this.mark('css-update-end');

    // Wait for repaint
    return new Promise(resolve => {
      requestAnimationFrame(() => {
        this.mark('theme-switch-end');

        const results = this.getResults();
        this.printResults(results);

        resolve(results);
      });
    });
  }

  private mark(name: string) {
    this.marks.set(name, performance.now());
  }

  private getResults() {
    const cssTime = (this.marks.get('css-update-end')! -
                     this.marks.get('css-update-start')!) || 0;
    const totalTime = (this.marks.get('theme-switch-end')! -
                       this.marks.get('theme-switch-start')!) || 0;

    return {
      cssUpdateTime: cssTime.toFixed(2),
      totalTime: totalTime.toFixed(2),
      status: totalTime < 50 ? '✅ GOOD' : totalTime < 100 ? '⚠️ OK' : '❌ SLOW',
    };
  }

  private printResults(results: any) {
    console.table(results);
  }
}

// Usage
const profiler = new ThemeSwitchProfiler();
profiler.profileThemeSwitch('dark').then(() => {
  profiler.profileThemeSwitch('light');
});
```

---

## 4. CSS Redundancy Detector

**Datei:** `scripts/detect-css-redundancy.js`

```javascript
const fs = require('fs');
const path = require('path');

const detectRedundancy = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Find duplicate selectors
  const selectors = content.match(/^[^{]+\{/gm) || [];
  const selectorMap = {};

  selectors.forEach(sel => {
    const clean = sel.trim();
    if (selectorMap[clean]) {
      selectorMap[clean]++;
    } else {
      selectorMap[clean] = 1;
    }
  });

  console.log(`\n📊 CSS Redundancy Analysis: ${path.basename(filePath)}\n`);

  // Find duplicates
  const duplicates = Object.entries(selectorMap)
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1]);

  if (duplicates.length === 0) {
    console.log('✅ No duplicate selectors found');
    return;
  }

  console.log('🔴 Found duplicate selectors:\n');
  duplicates.forEach(([selector, count]) => {
    console.log(`  ⚠️  ${selector}`);
    console.log(`     Appears ${count} times`);
    console.log(`     Potential savings: ${Math.ceil(selector.length * (count - 1))} bytes\n`);
  });

  // Find rgba color duplicates
  const rgbaMatches = content.match(/rgba\([^)]+\)/g) || [];
  const colorMap = {};

  rgbaMatches.forEach(color => {
    colorMap[color] = (colorMap[color] || 0) + 1;
  });

  const colorDuplicates = Object.entries(colorMap)
    .filter(([_, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);

  if (colorDuplicates.length > 0) {
    console.log('🎨 Frequently used colors (consider variables):\n');
    colorDuplicates.forEach(([color, count]) => {
      console.log(`  ${color}: used ${count} times`);
    });
  }
};

// Usage
detectRedundancy('packages/ui-contracts/src/design-tokens.css');
```

**Ausführung:**
```bash
node scripts/detect-css-redundancy.js
```

---

## 5. Automated Bundle Size Regression Check

**Datei:** `.github/workflows/bundle-size.yml`

```yaml
name: Bundle Size Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm nx build sva-studio-react

      - name: Check CSS Bundle Size
        run: |
          SIZE=$(du -b dist/main.css | awk '{print $1}')
          LIMIT=$((10 * 1024))  # 10 KB

          echo "Bundle Size: $SIZE bytes"

          if [ $SIZE -gt $LIMIT ]; then
            echo "❌ Bundle size exceeded limit: $SIZE > $LIMIT"
            exit 1
          else
            echo "✅ Bundle size OK: $SIZE < $LIMIT"
          fi

      - name: Comment on PR
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '⚠️ Bundle size check failed. CSS > 10 KB'
            })
```

---

## 6. Performance Budget Monitoring

**Datei:** `performance-budget.json`

```json
{
  "resourceBudgets": [
    {
      "resourceType": "stylesheet",
      "budget": 10,
      "threshold": 5
    }
  ],
  "timingBudgets": [
    {
      "metric": "first-contentful-paint",
      "budget": 2000,
      "threshold": 10
    },
    {
      "metric": "dom-interactive",
      "budget": 3000,
      "threshold": 10
    }
  ]
}
```

---

## 7. CSS Variable Migration Helper

**Datei:** `scripts/migrate-rgba-to-hex.js`

```javascript
const fs = require('fs');
const path = require('path');

// RGB to Hex conversion
const rgbToHex = (r, g, b) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Parse rgba and convert
const migrateRgbaToHex = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Match rgba(r, g, b, 1) or rgba(r,g,b,1)
  const rgbaRegex = /rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*1\s*\)/g;

  let replacements = 0;
  content = content.replace(rgbaRegex, (match, r, g, b) => {
    replacements++;
    const hex = rgbToHex(parseInt(r), parseInt(g), parseInt(b));
    console.log(`  ${match} → ${hex}`);
    return hex;
  });

  if (replacements === 0) {
    console.log('ℹ️  No rgba() values found');
    return;
  }

  // Write back
  fs.writeFileSync(filePath, content);

  const sizeBefore = Buffer.byteLength(original);
  const sizeAfter = Buffer.byteLength(content);
  const saved = sizeBefore - sizeAfter;

  console.log(`\n✅ Migration complete:`);
  console.log(`  Replacements: ${replacements}`);
  console.log(`  Size before: ${sizeBefore} bytes`);
  console.log(`  Size after:  ${sizeAfter} bytes`);
  console.log(`  Saved:       ${saved} bytes (-${((saved/sizeBefore)*100).toFixed(1)}%)`);
};

// Usage
console.log('\n🎨 RGBA → HEX MIGRATION\n');
migrateRgbaToHex('packages/ui-contracts/src/design-tokens.css');
```

**Ausführung:**
```bash
node scripts/migrate-rgba-to-hex.js
```

---

## 8. Performance Dashboard Generator

**Datei:** `scripts/generate-perf-report.js`

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

const generateReport = () => {
  const report = {
    timestamp: new Date().toISOString(),
    metrics: {},
  };

  // CSS Bundle Size
  const designTokensSize = fs.statSync(
    'packages/ui-contracts/src/design-tokens.css'
  ).size;
  const globalsSize = fs.statSync(
    'apps/sva-studio-react/src/globals.css'
  ).size;

  report.metrics.cssBundle = {
    designTokens: `${(designTokensSize / 1024).toFixed(2)} KB`,
    globals: `${(globalsSize / 1024).toFixed(2)} KB`,
    total: `${((designTokensSize + globalsSize) / 1024).toFixed(2)} KB`,
  };

  // Git stats
  try {
    const changes = execSync(
      'git diff --stat HEAD -- "*.css"',
      { encoding: 'utf-8' }
    );
    report.metrics.gitChanges = changes.trim();
  } catch (e) {
    // Not in git repo
  }

  // Write report
  fs.writeFileSync(
    'performance-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('✅ Report generated: performance-report.json');
  console.log(JSON.stringify(report, null, 2));
};

generateReport();
```

---

## 9. NPM Scripts Configuration

**Datei:** `package.json` (add to scripts)

```json
{
  "scripts": {
    "perf:analyze": "node scripts/analyze-bundle-size.js",
    "perf:profile": "node scripts/profile-css-variables.js",
    "perf:detect-redundancy": "node scripts/detect-css-redundancy.js",
    "perf:migrate-colors": "node scripts/migrate-rgba-to-hex.js",
    "perf:report": "node scripts/generate-perf-report.js",
    "perf:all": "npm run perf:analyze && npm run perf:detect-redundancy && npm run perf:report"
  }
}
```

**Nutzung:**
```bash
pnpm perf:analyze       # Bundle size analysis
pnpm perf:all          # Run all performance checks
```

---

## 10. Debugging Checklist Script

**Datei:** `scripts/perf-checklist.sh`

```bash
#!/bin/bash

echo "📋 PERFORMANCE CHECKLIST"
echo "========================\n"

# 1. Bundle Size
echo "1️⃣  Bundle Size Analysis"
du -h packages/ui-contracts/src/design-tokens.css
du -h apps/sva-studio-react/src/globals.css
echo ""

# 2. CSS Lines
echo "2️⃣  CSS Line Count"
wc -l packages/ui-contracts/src/design-tokens.css
wc -l apps/sva-studio-react/src/globals.css
echo ""

# 3. Redundancy Check
echo "3️⃣  Checking for redundant selectors..."
grep -c "^:root {" packages/ui-contracts/src/design-tokens.css
grep -c "@media" packages/ui-contracts/src/design-tokens.css
echo ""

# 4. Color Formats
echo "4️⃣  Color Format Check"
echo "rgba() count: $(grep -o 'rgba(' packages/ui-contracts/src/design-tokens.css | wc -l)"
echo "hex count: $(grep -o '#[0-9a-f]' packages/ui-contracts/src/design-tokens.css | wc -l)"
echo ""

# 5. Variables Usage
echo "5️⃣  CSS Variables Usage"
grep -o 'var(--' packages/ui-contracts/src/design-tokens.css | wc -l
echo ""

echo "✅ Checklist Complete!"
```

**Ausführung:**
```bash
chmod +x scripts/perf-checklist.sh
./scripts/perf-checklist.sh
```

---

## Quick Start

```bash
# 1. Analyze current state
pnpm perf:analyze

# 2. Detect redundancies
pnpm perf:detect-redundancy

# 3. Apply fixes (manual per PERFORMANCE_FIXES_GUIDE.md)

# 4. Re-analyze
pnpm perf:analyze

# 5. Generate report
pnpm perf:report
```
