# KERN-2 Phase 1 Foundations and Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Light-Theme von `apps/sva-studio-react` soll visuell auf KERN 2 umgestellt werden, indem Foundations und App-Shell reskinnt werden, ohne Routing, Seitenstruktur oder Fachlogik umzubauen.

**Architecture:** Die bestehende Theme-Architektur mit `data-theme` und `data-theme-mode` bleibt erhalten. KERN-2-Werte werden auf die vorhandenen semantischen CSS-Tokens des Studios gemappt; Header, Sidebar, Root-Dokument und Shell-Flächen konsumieren weiter diese Tokens. `@kern-ux/native` wird in Phase 1 höchstens für Fonts oder Referenzabgleich genutzt, nicht als globaler CSS-Reset.

**Tech Stack:** Nx, pnpm, TypeScript strict mode, React 19, TanStack Router, Tailwind CSS v4, Vitest, shadcn/Radix-Primitives, optional `@kern-ux/native`

---

## File Structure Map

### Referenzen und Scope

- Reference: `docs/superpowers/specs/2026-06-01-kern2-phase1-foundations-shell-design.md`
- Reference: `docs/development/ui-shell-theming.md`
- Reference: `apps/sva-studio-react/src/styles.css`

### Theme-Vertrag und Foundations

- Modify: `apps/sva-studio-react/src/lib/theme.ts`
- Modify: `apps/sva-studio-react/src/lib/theme.test.ts`
- Modify: `apps/sva-studio-react/src/providers/theme-provider.tsx`
- Modify: `apps/sva-studio-react/src/providers/theme-provider.test.tsx`
- Modify: `apps/sva-studio-react/src/styles.css`
- Optional Modify: `apps/sva-studio-react/package.json`

### Root-Dokument und Shell

- Modify: `apps/sva-studio-react/src/routes/__root.tsx`
- Modify: `apps/sva-studio-react/src/routes/-__root.test.tsx`
- Modify: `apps/sva-studio-react/src/components/AppShell.tsx`
- Modify: `apps/sva-studio-react/src/components/AppShell.test.tsx`

### Header und Sidebar

- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Modify: `apps/sva-studio-react/src/components/Header.test.tsx`
- Modify: `apps/sva-studio-react/src/components/Sidebar.tsx`
- Modify: `apps/sva-studio-react/src/components/Sidebar.test.tsx`
- Optional Modify: `apps/sva-studio-react/src/routes/-home-page.tsx`

### Dokumentation

- Modify: `docs/development/ui-shell-theming.md`
- Optional Modify: `docs/superpowers/specs/2026-06-01-kern2-phase1-foundations-shell-design.md` only if implementation uncovers a design correction

## Task 1: Theme-Vertrag für KERN-2-Phase-1 stabilisieren

**Files:**
- Modify: `apps/sva-studio-react/src/lib/theme.ts`
- Modify: `apps/sva-studio-react/src/lib/theme.test.ts`
- Modify: `apps/sva-studio-react/src/providers/theme-provider.tsx`
- Modify: `apps/sva-studio-react/src/providers/theme-provider.test.tsx`

- [ ] **Step 1: Keep internal theme IDs stable and document the rule**

Capture the migration rule before code changes:

```ts
// Phase 1 keeps the existing runtime theme ids to avoid wide churn.
export type AppThemeName = 'sva-default' | 'sva-forest';

// Visual payload changes to KERN-derived tokens, not the public runtime contract.
```

- [ ] **Step 2: Add the failing helper expectations**

Extend `apps/sva-studio-react/src/lib/theme.test.ts` with assertions that lock the intended Phase-1 behavior:

```ts
it('keeps stable internal theme ids during the KERN phase-1 reskin', () => {
  expect(DEFAULT_THEME_NAME).toBe('sva-default');
  expect(resolveThemeName('11111111-1111-1111-8111-111111111111')).toBe('sva-forest');
});

it('uses KERN-facing display names for the shell toggle and metadata', () => {
  expect(getThemeDisplayName('sva-default')).toBe('KERN Studio');
  expect(getThemeDisplayName('sva-forest')).toBe('KERN Studio Wald');
});
```

- [ ] **Step 3: Run the narrow helper test and verify the expected failure**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/lib/theme.test.ts
```

Expected: FAIL because the current display names still return `SVA Studio` / `SVA Forest`.

- [ ] **Step 4: Update the helper implementation with the minimal contract change**

Change `apps/sva-studio-react/src/lib/theme.ts` along these lines:

```ts
export const getThemeDisplayName = (themeName: AppThemeName): string => {
  switch (themeName) {
    case 'sva-forest':
      return 'KERN Studio Wald';
    case 'sva-default':
    default:
      return 'KERN Studio';
  }
};
```

- [ ] **Step 5: Extend the provider test to protect document-level theming hooks**

Add or tighten assertions in `apps/sva-studio-react/src/providers/theme-provider.test.tsx`:

```ts
expect(document.documentElement.dataset.theme).toBe('sva-forest');
expect(document.documentElement.dataset.themeMode).toBe('dark');
expect(document.documentElement.style.colorScheme).toBe('dark');
expect(screen.getByTestId('theme-label').textContent).toBe('KERN Studio Wald');
```

- [ ] **Step 6: Run the focused provider tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/lib/theme.test.ts --testFiles=src/providers/theme-provider.test.tsx
```

Expected: PASS with updated helper and provider assertions.

- [ ] **Step 7: Commit the theme-contract slice**

```bash
git add apps/sva-studio-react/src/lib/theme.ts apps/sva-studio-react/src/lib/theme.test.ts apps/sva-studio-react/src/providers/theme-provider.test.tsx
git commit -m "feat: stabilize kern phase 1 theme contract"
```

## Task 2: KERN-2 Foundations in `styles.css` umsetzen

**Files:**
- Modify: `apps/sva-studio-react/src/styles.css`
- Optional Modify: `apps/sva-studio-react/package.json`

- [ ] **Step 1: Capture the token groups that must change**

Implement the foundation as these concrete token groups, not ad-hoc values. The snippet below is intentionally only an excerpt: the existing semantic token contract in `styles.css` must stay complete, including tokens such as `--popover`, `--input`, `--secondary`, `--accent`, `--destructive`, `--sidebar-primary`, `--sidebar-accent-foreground`, and `--sidebar-ring`.

```css
:root {
  --background: 248 246 240;
  --foreground: 28 33 41;
  --card: 255 255 255;
  --card-foreground: 28 33 41;
  --primary: 0 102 79;
  --primary-foreground: 255 255 255;
  --muted: 240 237 229;
  --muted-foreground: 83 92 104;
  --border: 214 210 198;
  --ring: 0 102 79;
  --sidebar: 252 250 246;
  --sidebar-foreground: 47 55 66;
  --sidebar-accent: 236 241 234;
  --sidebar-border: 214 210 198;
  --radius: 8px;
  --radius-card: 12px;
  --radius-modal: 24px;
  --elevation-sm: 0px 6px 18px 0px rgba(38, 47, 56, 0.08);
}
```

- [ ] **Step 2: Add the KERN font package only if the build needs an explicit source**

If local inspection shows that the KERN font CSS is required, add the dependency in the app package:

```bash
pnpm --filter sva-studio-react add @kern-ux/native
```

Then import fonts only, not the full component CSS:

```css
@import "@kern-ux/native/dist/fonts/fira-sans.css";
@import "tailwindcss";
```

- [ ] **Step 3: Replace the current light-mode token payload with KERN-derived values**

Edit `apps/sva-studio-react/src/styles.css` so the light theme is driven by KERN-like foundations instead of the current SVA palette. Update the values inside the existing `:root` contract; do not shrink the token set or drop semantically exposed variables that the app already consumes.

```css
:root {
  --background: 248 246 240;
  --foreground: 28 33 41;
  --card: 255 255 255;
  --card-foreground: 28 33 41;
  --primary: 0 102 79;
  --primary-foreground: 255 255 255;
  --muted: 240 237 229;
  --muted-foreground: 83 92 104;
  --border: 214 210 198;
  --ring: 0 102 79;
  --sidebar: 252 250 246;
  --sidebar-foreground: 47 55 66;
  --sidebar-accent: 236 241 234;
  --sidebar-border: 214 210 198;
  --radius: 8px;
  --radius-card: 12px;
  --radius-modal: 24px;
}
```

- [ ] **Step 4: Neutralize shell-specific leftovers that would fight the new foundation**

Update the shell-only derived tokens and animation colors:

```css
:root {
  --waste-panel-surface: 242 239 232;
  --waste-panel-overlay: 255 255 255;
  --elevation-sm: 0px 6px 18px 0px rgba(38, 47, 56, 0.08);
}

@keyframes input-glow {
  from {
    box-shadow: 0 0 0 0 rgba(0, 102, 79, 0.14);
  }
  to {
    box-shadow: 0 0 0 3px rgba(0, 102, 79, 0.12);
  }
}
```

- [ ] **Step 5: Run the UI test slice to catch class-level regressions early**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/providers/theme-provider.test.tsx --testFiles=src/components/AppShell.test.tsx --testFiles=src/components/Header.test.tsx --testFiles=src/components/Sidebar.test.tsx
```

Expected: PASS. Failures here likely mean a shell test assumed old labels or theme metadata.

- [ ] **Step 6: Manually start the app and verify the global foundation loads**

Run:

```bash
pnpm nx run sva-studio-react:serve
```

Expected: the app starts on `http://localhost:3000`, uses the new font stack, and the light shell surfaces reflect the new tokens before component-level reskin tweaks.

- [ ] **Step 7: Commit the foundation slice**

```bash
git add apps/sva-studio-react/src/styles.css apps/sva-studio-react/package.json pnpm-lock.yaml
git commit -m "feat: add kern phase 1 shell foundations"
```

If `@kern-ux/native` was not added, omit `package.json` and `pnpm-lock.yaml` from the commit.

## Task 3: Root-Dokument und AppShell auf die neuen Foundations ausrichten

**Files:**
- Modify: `apps/sva-studio-react/src/routes/__root.tsx`
- Modify: `apps/sva-studio-react/src/routes/-__root.test.tsx`
- Modify: `apps/sva-studio-react/src/components/AppShell.tsx`
- Modify: `apps/sva-studio-react/src/components/AppShell.test.tsx`

- [ ] **Step 1: Add the failing shell-level expectations**

Extend `apps/sva-studio-react/src/components/AppShell.test.tsx` with assertions that lock the shell landmarks and token-driven wrappers instead of specific colors:

```ts
expect(screen.getByRole('main').className).toContain('bg-background');
expect(screen.getByRole('main').className).toContain('px-4');
expect(screen.getByText('Inhalt').closest('div')?.className).toContain('space-y-4');
```

- [ ] **Step 2: Run the AppShell test in isolation**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/AppShell.test.tsx
```

Expected: FAIL if the planned structural classes are not yet present or have drifted.

- [ ] **Step 3: Update the root document shell framing**

Adjust `apps/sva-studio-react/src/routes/__root.tsx` around the body and skip link to align with the new shell foundation:

```tsx
<body className="flex min-h-screen flex-col bg-background text-foreground antialiased" suppressHydrationWarning>
  <a
    href="#main-content"
    className="sr-only left-3 top-3 z-50 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-shell focus:not-sr-only focus:absolute"
  >
```

- [ ] **Step 4: Update AppShell spacing and surface framing**

Refine `apps/sva-studio-react/src/components/AppShell.tsx` to make the content area feel like a KERN shell without changing structure:

```tsx
<div className="isolate flex min-h-screen w-full flex-1 flex-col bg-background lg:flex-row">
  <div className="relative z-0 flex min-h-screen min-w-0 flex-1 flex-col">
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col bg-background px-4 pb-6 pt-4 sm:px-6 sm:pb-8 sm:pt-5 lg:px-8 lg:pt-6"
      aria-busy={isLoading}
    >
```

- [ ] **Step 5: Protect the root route test against regressions**

Add exact assertions to `apps/sva-studio-react/src/routes/-__root.test.tsx` for the new shell framing:

```ts
expect(document.body.className).toContain('bg-background');
expect(document.body.className).toContain('text-foreground');

const skipLink = screen.getByRole('link', { name: 'shell.skipToContent' });
expect(skipLink.className).toContain('bg-card');
expect(skipLink.className).toContain('border-border');
```

- [ ] **Step 6: Run the root and shell test slice**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/AppShell.test.tsx
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/-__root.test.tsx
```

Expected: PASS for both targets.

- [ ] **Step 7: Commit the root/shell slice**

```bash
git add apps/sva-studio-react/src/routes/__root.tsx apps/sva-studio-react/src/routes/-__root.test.tsx apps/sva-studio-react/src/components/AppShell.tsx apps/sva-studio-react/src/components/AppShell.test.tsx
git commit -m "feat: reskin studio shell foundations"
```

## Task 4: Header visuell auf KERN 2 bringen

**Files:**
- Modify: `apps/sva-studio-react/src/components/Header.tsx`
- Modify: `apps/sva-studio-react/src/components/Header.test.tsx`

- [ ] **Step 1: Add failing class-level assertions for the shell header**

Extend `apps/sva-studio-react/src/components/Header.test.tsx` with assertions around the visible shell controls:

```ts
expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).className).toContain('rounded-full');
expect(screen.getByRole('button', { name: 'Dunklen Modus aktivieren' }).className).toContain('text-muted-foreground');
```

Add one assertion for the prompt-field wrapper if it is rendered:

```ts
expect(screen.getByDisplayValue('Suche').className).toContain('bg-[rgb(var(--waste-panel-surface))]');
```

If the test should stay locale-agnostic, query the field via role/label instead of matching invented prompt text.

- [ ] **Step 2: Run the Header test in isolation**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Header.test.tsx
```

Expected: FAIL if the future class contract is not yet reflected.

- [ ] **Step 3: Update the header shell classes and hierarchy**

Refine `apps/sva-studio-react/src/components/Header.tsx` without changing behavior:

```tsx
const iconButtonClassName =
  'h-10 w-10 rounded-full border border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:border-border hover:bg-card hover:text-foreground';
```

Apply the same visual language to menus and shell wrappers:

```tsx
className="absolute top-full z-50 mt-2 min-w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-md"
```

Keep all auth, locale and theme logic untouched.

- [ ] **Step 4: Normalize the shell prompt field and action surfaces**

Adjust the prompt-like `Input` wrapper in the header to reflect KERN-2 surfaces:

```tsx
className="h-11 rounded-full border-border bg-[rgb(var(--waste-panel-surface))] pl-11 pr-11 text-sm text-muted-foreground disabled:bg-[rgb(var(--waste-panel-surface))] disabled:text-muted-foreground disabled:opacity-100"
```

- [ ] **Step 5: Re-run the Header test slice**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Header.test.tsx
```

Expected: PASS without changing any auth-related expectations.

- [ ] **Step 6: Commit the header slice**

```bash
git add apps/sva-studio-react/src/components/Header.tsx apps/sva-studio-react/src/components/Header.test.tsx
git commit -m "feat: apply kern shell styling to header"
```

## Task 5: Sidebar und shell-nahe Sonderflächen reskinnen

**Files:**
- Modify: `apps/sva-studio-react/src/components/Sidebar.tsx`
- Modify: `apps/sva-studio-react/src/components/Sidebar.test.tsx`
- Optional Modify: `apps/sva-studio-react/src/routes/-home-page.tsx`

- [ ] **Step 1: Add failing expectations for the sidebar shell language**

Extend `apps/sva-studio-react/src/components/Sidebar.test.tsx` with class-oriented checks for active and inactive navigation links:

```ts
expect(screen.getByRole('link', { name: 'Übersicht' }).className).toContain('rounded-xl');
expect(screen.getByRole('link', { name: 'Übersicht' }).className).toContain('text-sidebar-foreground');
```

For an active item:

```ts
expect(screen.getByRole('link', { name: 'Übersicht' }).getAttribute('aria-current')).toBe('page');
```

- [ ] **Step 2: Run the sidebar test in isolation**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Sidebar.test.tsx
```

Expected: FAIL if the future navigation class contract is not covered yet.

- [ ] **Step 3: Update sidebar surfaces, flyouts and collapse controls**

Refine `apps/sva-studio-react/src/components/Sidebar.tsx` while preserving structure and behaviors:

```ts
const getLinkClasses = (isActive: boolean, isCollapsed: boolean, isChild = false) =>
  [
    'flex items-center rounded-xl border text-sidebar-foreground transition',
    isChild
      ? 'gap-2.5 px-3 py-2 text-xs font-medium'
      : `gap-3 ${isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5 text-sm font-medium'}`,
    isActive
      ? 'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-shell'
      : 'border-transparent bg-sidebar hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  ].join(' ');
```

Keep focus handling, group expansion, flyouts, and permission gating unchanged.

- [ ] **Step 4: Remove shell-breaking hardcoded shadows or old accent values**

Replace leftover shell-only hardcoded values in `Sidebar.tsx` with token-compatible ones, for example:

```tsx
className="absolute left-full top-0 z-[100] w-64 rounded-2xl border border-sidebar-border bg-card p-3 shadow-shell"
```

If the home page top section still clashes heavily with the new shell, tone it down in `apps/sva-studio-react/src/routes/-home-page.tsx` by reusing `bg-background`, `border-border`, and token-based overlays instead of bespoke gradients.

- [ ] **Step 5: Re-run the sidebar and home-adjacent UI tests**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/components/Sidebar.test.tsx --testFiles=src/components/AppShell.test.tsx --testFiles=src/components/Header.test.tsx
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/-__root.test.tsx
```

Expected: PASS across the shell slice.

- [ ] **Step 6: Commit the sidebar slice**

```bash
git add apps/sva-studio-react/src/components/Sidebar.tsx apps/sva-studio-react/src/components/Sidebar.test.tsx apps/sva-studio-react/src/routes/-home-page.tsx
git commit -m "feat: apply kern shell styling to sidebar"
```

If the home page file was not changed, omit it from the commit.

## Task 6: Dokumentation und Gate-Pfad abschließen

**Files:**
- Modify: `docs/development/ui-shell-theming.md`
- Verify: `apps/sva-studio-react/src/**`

- [ ] **Step 1: Update the theming guide to match the new Phase-1 reality**

Document the concrete phase-1 policy in `docs/development/ui-shell-theming.md`:

```md
- KERN 2 ist die visuelle Referenz für die Shell-Foundations im Light-Theme.
- Die bestehenden Theme-IDs bleiben in Phase 1 intern stabil.
- `@kern-ux/native` wird nicht als globaler CSS-Reset geladen.
- Header, Sidebar und Root-Shell konsumieren semantische Tokens statt Direktfarben.
```

- [ ] **Step 2: Run the smallest relevant UI and type gates**

Run:

```bash
pnpm nx run sva-studio-react:test:unit:ui --testFiles=src/lib/theme.test.ts --testFiles=src/providers/theme-provider.test.tsx --testFiles=src/components/AppShell.test.tsx --testFiles=src/components/Header.test.tsx --testFiles=src/components/Sidebar.test.tsx
pnpm nx run sva-studio-react:test:unit:routes --testFiles=src/routes/-__root.test.tsx
pnpm nx run sva-studio-react:test:types
```

Expected: PASS for all three commands.

- [ ] **Step 3: Run the affected unit gate required before commit/push**

Run:

```bash
pnpm nx affected --target=test:unit --base=origin/main
```

Expected: PASS with `sva-studio-react` and any affected dependents green.

- [ ] **Step 4: Optionally run the broader PR-preferred gate if the shell diff is wider than expected**

Run only if the implementation touched more than the planned shell slice:

```bash
pnpm test:pr
```

Expected: PASS. If skipped, record that the smaller relevant gate path was used intentionally.

- [ ] **Step 5: Final commit**

```bash
git add docs/development/ui-shell-theming.md apps/sva-studio-react/src
git commit -m "docs: document kern phase 1 shell theming"
```

## Self-Review Checklist

- Spec coverage check:
  - Theme contract retained: covered in Task 1.
  - KERN-derived token mapping: covered in Task 2.
  - Shell-only reskin without structural rewrite: covered in Tasks 3, 4, and 5.
  - Light-theme-first verification and gate path: covered in Task 6.
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” placeholders remain.
  - Optional steps are explicitly bounded and state when to omit files or commands.
- Type consistency:
  - The plan keeps `AppThemeName` stable as `sva-default | sva-forest`.
  - Theme-facing labels change to KERN-facing names without renaming runtime IDs.
  - Test targets use the repo’s Nx/Vitest `--testFiles` convention.
