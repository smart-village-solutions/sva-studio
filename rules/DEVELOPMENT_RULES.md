# Development Rules

Development Regeln

**Tags:** rules

---

# Development Rules - Non-Negotiable

## 🚨 Critical Project Guidelines

These rules are **NON-NEGOTIABLE** and must be followed in all development work.

---

## 1. Text & Data Management

### ✅ REQUIRED
- **All UI texts** must be loaded from the database via the translation system
- **All data** must be fetched from the database
- Use language keys (e.g., `t('navigation.dashboard')`) for all displayed text
- **ALWAYS use translation keys** - no exceptions for "quick fixes" or "temporary solutions"
- Translation keys must exist in **both German (de) and English (en)** in `src/lib/i18n.ts`

### ❌ FORBIDDEN - ZERO TOLERANCE
- **Hardcoded text strings in components** (absolutely forbidden)
- Inline text that is not using the translation system
- Any user-facing text without proper translation
- "Temporary" hardcoded strings (they become permanent)
- Mixing hardcoded text with translation keys

**Why this is critical:**
- Breaks internationalization for all users
- Creates maintenance nightmares
- Violates accessibility standards
- Makes the app unprofessional

**Example:**
```tsx
// ❌ ABSOLUTELY WRONG - FORBIDDEN
<h1>Dashboard</h1>
<Button>Speichern</Button>
<p>Willkommen zurück!</p>

// ❌ ALSO WRONG - Mixed approach
<h1>{t('navigation.dashboard')}</h1>
<Button>Speichern</Button>  // Hardcoded!

// ✅ CORRECT - Translation keys everywhere
<h1>{t('navigation.dashboard')}</h1>
<Button>{t('common.save')}</Button>
<p>{t('common.welcomeBack')}</p>
```

**Enforcement:**
- All PRs with hardcoded strings will be **rejected immediately**
- AI assistants are instructed to **refuse** adding hardcoded strings
- Code reviews must check for hardcoded text
- If you find hardcoded text, create a ticket and fix it **immediately**

---

## 2. Translation System

### Process for UI Texts
1. Define language key in consistent format (e.g., `admin.users.title`)
2. Add translations to database via `translations` table
3. Load translations using `useTranslation()` hook from `react-i18next`
4. Use `t()` function with the language key

### Translation Key Format
- Use dot notation: `section.subsection.key`
- Be descriptive and hierarchical
- Example: `admin.dashboard.welcome`, `common.save`, `auth.login`

**Where translations are stored:**
- Database table: `translations`
- Workspace-specific translations override global ones
- Fallback language: German (de)

---

## 3. CSS & Styling

### ✅ REQUIRED
- All styles must use the centralized design system
- Use semantic tokens from `index.css` and `tailwind.config.ts`
- Use Tailwind CSS classes with design system colors (HSL format)
- Use component variants defined in shadcn components

### ❌ FORBIDDEN
- Inline styles (e.g., `style={{ color: '#fff' }}`)
- Direct color values (e.g., `text-white`, `bg-black`)
- Custom CSS without design system tokens

### ⚠️ APPROVED EXCEPTIONS

**Dynamic Data-Driven Styles:**
Inline styles are permitted ONLY when styling depends on dynamic data from the database (e.g., user-defined colors, positions).

**Requirements for exceptions:**
1. ✅ Must be for truly dynamic data that cannot be predefined
2. ✅ Must be encapsulated in a reusable component
3. ✅ Must be documented in the component
4. ✅ Must use utility functions for color manipulation

**Approved Use Case - Dynamic Label Colors:**
```tsx
// ✅ CORRECT - Encapsulated in reusable component
// See: src/components/ui/issue-label.tsx
<IssueLabel color={label.color} name={label.name} />

// ❌ WRONG - Inline styles scattered across components
<span style={{ backgroundColor: label.color + '20', color: label.color }}>
  {label.name}
</span>
```

**Other Approved Exceptions:**
- Drag-and-drop positioning (transform coordinates)
- Dynamic animations calculated at runtime
- Canvas/SVG positioning from database
- User-customizable theme colors (must be encapsulated)

**Example:**
```tsx
// ❌ WRONG - Static styling with inline styles
<div style={{ backgroundColor: '#2563eb' }}>Content</div>
<div className="bg-blue-600">Content</div>

// ✅ CORRECT - Use design system
<div className="bg-primary">Content</div>

// ✅ ALSO CORRECT - Dynamic data, encapsulated
<IssueLabel color={dynamicColorFromDB} name={label.name} />
```

**Design System Files:**
- `src/index.css` - CSS variables and global styles
- `tailwind.config.ts` - Tailwind configuration with semantic tokens
- Component variants in shadcn UI components
- `src/components/ui/issue-label.tsx` - Encapsulated dynamic label component

---

## 4. Accessibility (WCAG 2.1 AA)

### Requirements
- All UI must be WCAG 2.1 Level AA compliant
- Proper semantic HTML structure
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast ratios
- Focus indicators
- Alt text for images
- Proper ARIA labels where needed

**Key Points:**
- Color contrast: minimum 4.5:1 for normal text, 3:1 for large text
- All interactive elements must be keyboard accessible
- Form inputs must have associated labels
- Use semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)

---

## 5. Security & Input Validation

### 🚨 MANDATORY SECURITY REQUIREMENTS

**All implementations must pass security tests before deployment.**

#### Input Validation Rules

### ✅ REQUIRED
- **All user inputs** must be validated client-side AND server-side
- Use schema validation libraries (e.g., `zod`) for TypeScript
- Implement length limits and character restrictions
- Proper encoding for external API calls (use `encodeURIComponent`)
- Sanitize all HTML content (use DOMPurify if HTML rendering required)
- RLS policies must be in place for all Supabase tables

### ❌ FORBIDDEN
- Passing unvalidated user input to external URLs
- Using `dangerouslySetInnerHTML` with user-provided content
- Logging sensitive data to console
- Direct database queries without parameterization
- Missing input validation on server-side

**Example - Form Validation:**
```tsx
import { z } from 'zod';

// ✅ CORRECT - Define validation schema
const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Name cannot be empty" })
    .max(100, { message: "Name must be less than 100 characters" }),
  email: z.string()
    .trim()
    .email({ message: "Invalid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  message: z.string()
    .trim()
    .min(1, { message: "Message cannot be empty" })
    .max(1000, { message: "Message must be less than 1000 characters" })
});

// Validate before processing
const result = contactSchema.safeParse(formData);
if (!result.success) {
  // Handle validation errors
  return;
}
```

#### Security Test Checklist

Before any implementation goes live, verify:

- ✅ **Input Validation**: All forms have client-side and server-side validation
- ✅ **SQL Injection Prevention**: Parameterized queries, RLS policies active
- ✅ **XSS Prevention**: No unescaped user content in HTML
- ✅ **Authentication**: Protected routes check user permissions
- ✅ **Authorization**: RLS policies enforce workspace isolation
- ✅ **Data Exposure**: No sensitive data in console logs or error messages
- ✅ **API Security**: External API calls use proper encoding
- ✅ **File Uploads**: Size limits, type validation, secure storage
- ✅ **CSRF Protection**: Supabase handles this automatically
- ✅ **Rate Limiting**: Consider for public-facing endpoints

#### Common Security Vulnerabilities to Prevent

1. **SQL Injection**
   - Use Supabase client properly (auto-parameterized)
   - Never concatenate user input into queries
   - RLS policies as defense in depth

2. **Cross-Site Scripting (XSS)**
   - Never use `dangerouslySetInnerHTML` with user content
   - React escapes by default - keep it that way
   - Validate and sanitize all user input

3. **Broken Authentication**
   - Use Supabase Auth (already secure)
   - Implement proper session management
   - Verify user identity on all protected operations

4. **Sensitive Data Exposure**
   - No API keys or secrets in frontend code
   - Use environment variables for sensitive config
   - RLS policies prevent unauthorized data access

5. **Broken Access Control**
   - Check permissions on every operation
   - Workspace isolation via RLS
   - Role-based access control (RBAC)

#### Security Testing Process

1. **Before Development**: Review security requirements
2. **During Development**: Follow secure coding practices
3. **Before PR**: Run security checklist
4. **Code Review**: Security-focused review by team
5. **Before Deployment**: Final security verification

---

## 6. Documentation

### Required Documentation

#### A. Central Documentation
- **This file** (`DEVELOPMENT_RULES.md`) - Non-negotiable rules
- `README.md` - Project overview and setup
- `IMPLEMENTATION.md` - Implementation details and architecture
- `ICON_SYSTEM.md` - Icon usage guidelines

#### B. File-Level Documentation
Every file must include:
1. **Header comment** with overview of file purpose
2. **Function/Component descriptions** for complex logic
3. **Type definitions** with clear descriptions
4. **Usage examples** where helpful

**Example:**
```tsx
/**
 * AdminLayout Component
 *
 * Provides the layout structure for all admin pages.
 * Includes sidebar navigation, header with user menu, and main content area.
 *
 * @component
 * @example
 * <AdminLayout>
 *   <YourAdminPage />
 * </AdminLayout>
 */
export const AdminLayout = ({ children }: AdminLayoutProps) => {
  // Component implementation
}
```

#### C. Continuous Documentation Updates
- Update documentation when making changes to architecture
- Keep implementation details current
- Document breaking changes
- Add migration guides when needed

---

## 6.5 Review & Audit Report Organization

### ✅ REQUIRED - Storage Location

All audit, review, and report outputs from AI agents or automated tools MUST be stored in organized category folders, **NEVER in the root directory**:

```
✅ CORRECT LOCATIONS:
docs/reviews/compliance/          → DEVELOPMENT_RULES compliance, Phase status
docs/reviews/security/            → Security audits, architecture reviews
docs/reviews/accessibility/       → WCAG compliance, accessibility audits
docs/reviews/performance/         → Bundle size, performance analysis
docs/reviews/i18n/               → Internationalization audits

❌ FORBIDDEN:
Root directory (/)
src/
apps/
packages/
Any other location without category structure
```

### Naming Convention for Reports

Follow this format for consistency:

```
{CATEGORY}_{TYPE}_{FILENAME}.md

Examples:
✅ docs/reviews/compliance/DEVELOPER_COMPLIANCE_CHECKLIST.md
✅ docs/reviews/accessibility/WCAG_IMPLEMENTATION_GUIDE.md
✅ docs/reviews/performance/PERFORMANCE_QUICK_START.md
✅ docs/reviews/security/SECURITY_ARCHITECTURE_REVIEW.md

❌ WRONG:
WCAG_ACCESSIBILITY_AUDIT.md (in root)
Review_2026_01_18.md (vague naming)
some_review.md (unorganized)
```

### Version Control for Report Iterations

When creating follow-up reviews or updates:

```
First review:   docs/reviews/{category}/FILENAME.md
Follow-up:      docs/reviews/{category}/2026-01-25_FILENAME.md
Later update:   docs/reviews/{category}/2026-02-15_FILENAME.md
```

All versions stay in the **same category folder** for easy history tracking.

### Index Maintenance

After creating a new report, **MUST update** the navigation index:

1. Add link to `docs/reviews/README.md` with brief description
2. Add link to `docs/README.md` master index if relevant
3. Follow existing index format and organization

**Example entry for docs/reviews/README.md:**
```markdown
- [Your_Review_Name.md](category/Your_Review_Name.md) – Brief description of findings
```

### Why This Rule Exists

- 📁 **Prevents Root Clutter**: Root directory stays clean and readable
- 🔍 **Findability**: Reviews are organized by category for quick navigation
- 📊 **Discoverability**: Central index makes all audits visible
- 🔄 **Traceability**: Dated files show review history over time
- ♻️ **Reusability**: Previous reviews are easily accessible for comparison
- 🤖 **AI Compliance**: Agents are instructed to follow this structure

### ❌ FORBIDDEN

- Storing review outputs in root directory
- Creating new documentation folders outside `docs/`
- Inconsistent or vague filenames
- Skipping index updates
- Breaking the category structure

---

## 7. Branching & PR Workflow

### ✅ REQUIRED
- Create a dedicated branch for every change; never commit directly to main
- Use branch prefixes that describe the change: `feature/`, `fix/`, `chore/`, `docs/`, `setup/`, `adr/`
- Keep one topic per branch and keep branches/PRs small and focused
- Rebase (or merge) main into your branch before opening a PR to resolve drift early
- Require green CI and at least one review before merge; prefer squash merges to keep history clean

### ❌ FORBIDDEN
- Mixing unrelated changes in one branch or PR
- Force-pushing after review without explicit reviewer consent (except to fix CI/rebase conflicts)

---

## 9. Common Pitfalls & Lessons Learned

Lessons from Phase 1 reviews to prevent repeated mistakes.

### 🚨 i18n Pitfalls

#### Pitfall #1: Hardcoded Strings in Key Components
**What went wrong**: Component titles, buttons, and descriptions were hardcoded instead of using `t()` keys.

```tsx
// ❌ WRONG - Found in production code
<h1>Willkommen in SVA Studio</h1>
<p>Die Self-Service Plattform für Inhalte, Module und Erweiterungen.</p>

// ✅ CORRECT
const { t } = useTranslation()
<h1>{t('home.welcome')}</h1>
<p>{t('home.description')}</p>
```

**Prevention Rule**: Every text that users see MUST have a translation key BEFORE writing JSX. Define keys first, then use them.

#### Pitfall #2: Brand Names & Logos
**What went wrong**: "SVA Studio" hardcoded in multiple locations (Sidebar logo, page title).

**Prevention Rule**:
- Create i18n key for brand name: `common.appName` or `layout.brandName`
- Reuse it everywhere instead of hardcoding
- One source of truth for all branding text

#### Pitfall #3: HTML Page Titles
**What went wrong**: `<title>SVA Studio</title>` hardcoded in route component.

**Why it's tricky**: HTML title lives in `<head>`, not accessible to React `useTranslation()` hook during SSR.

**Correct approach for Phase 1.5**:
```tsx
// Option 1: Use i18n hook before render
const DocumentHead = () => {
  const { t } = useTranslation()
  return <title>{t('layout.pageTitle')}</title>
}

// Option 2: Use TanStack Router's meta() function
export const Route = createRootRoute({
  head: () => ({
    meta: [{ title: t('layout.pageTitle') }] // i18n key here
  })
})
```

**Prevention**: Document that page titles need special handling in Phase 1.5; don't hardcode.

---

### ♿ Accessibility Pitfalls

#### Pitfall #1: Primary Color Contrast Too Low
**What went wrong**: Green #4EBC41 on light background #FAFAF3 = 2.51:1 contrast (needs 4.5:1)

**Impact**: Affects ~2% of population (color-blind users), makes links/buttons unreadable.

```css
/* ❌ Discovered in audit */
--primary: rgba(78, 188, 65, 1);    /* 2.51:1 on light background */

/* ✅ Fixed */
--primary: rgba(26, 92, 13, 1);     /* 7.31:1 – WCAG AAA */
```

**Prevention Rule**:
- Test all semantic colors against background colors BEFORE finalizing design tokens
- Use contrast calculator: https://webaim.org/resources/contrastchecker/
- Document contrast ratios in design-tokens.css

#### Pitfall #2: Theme-Specific Focus States
**What went wrong**: Focus-shadow always green (#4EBC41), even on Luxury Yacht theme (gold-based).

```css
/* ❌ WRONG - Same focus color for all themes */
--focus-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Always green */

/* ✅ CORRECT - Theme-aware */
:root {
  --focus-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Light: green */
}

.theme-yacht {
  --focus-shadow: 0 0 0 3px rgba(212, 175, 55, 0.2);  /* Yacht: gold */
}
```

**Prevention Rule**: Every visual token (focus state, hover color, etc.) must be theme-aware.

#### Pitfall #3: Disabled State Unclear
**What went wrong**: Disabled buttons only had `opacity: 0.5`, making them hard to distinguish.

```css
/* ❌ Too subtle – users don't understand why button won't click */
button:disabled {
  opacity: 0.5;
}

/* ✅ Make disabled state obvious */
button:disabled {
  background-color: var(--muted);
  color: var(--muted-foreground);
  opacity: 0.6;
  cursor: not-allowed;
  border: 1px solid var(--border);
}
```

**Prevention Rule**: Disabled states must be visually distinct (color + opacity + cursor, not just one).

---

### ⚡ Performance Pitfalls

#### Pitfall #1: Redundant CSS Selectors for Dark Mode
**What went wrong**: Same CSS rules defined 3 times for dark mode:
```css
@media (prefers-color-scheme: dark) { --color: ... }  /* 50 lines */
[data-theme="dark"] { --color: ... }                  /* 50 lines – IDENTICAL */
.dark { --color: ... }                                /* 50 lines – IDENTICAL */
```

**Impact**: Browser matches all 3 selectors, causing 3x theme-switching performance hit (400ms instead of 150ms).

**Prevention Rule**:
- Choose ONE dark mode strategy, not three
- Recommended: Use CSS class (`.dark`) + `@media (prefers-color-scheme: dark)` as fallback
- Remove redundant selectors before finalizing

```css
/* ✅ CORRECT */
@media (prefers-color-scheme: dark),
[data-theme="dark"],
.dark {
  --primary: #4ebc41;
  /* ... */
}
```

#### Pitfall #2: Fallback Values in CSS Variables
**What went wrong**: Focus-shadow had inline fallback instead of using variable:

```css
/* ❌ Redundant – stores value twice */
box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);

/* ✅ Clean – single source of truth */
box-shadow: var(--focus-shadow);
```

**Prevention Rule**: If you're defining a CSS variable, use it everywhere. Don't maintain duplicate values.

#### Pitfall #3: CSS Byte Waste
**What went wrong**: Unused fallback values and redundant rules increased bundle by ~150 bytes.

**Prevention Rule**:
- Run CSS minifier before shipping
- Audit CSS files monthly for dead code
- Use coverage tools: DevTools > Coverage tab

---

### 🔐 Security Pitfalls

#### Pitfall #1: Disabled Inputs Still Processing
**What went wrong**: Components with `disabled` attribute might still be vulnerable if JavaScript re-enables them.

```tsx
/* ❌ WRONG - Just disabled attribute, no validation */
<button disabled onClick={handleClick}>
  Save
</button>

/* ✅ CORRECT - Validate in handler + disabled attribute */
function handleClick(e) {
  if (isSubmitting) return; // Prevent double-submit
  // ... process
}
```

**Prevention Rule**: Never rely on disabled attribute alone. Validate on the handler too.

#### Pitfall #2: No Validation on Demo Routes
**What went wrong**: Demo/PoC routes had no input validation (TanStack Start examples).

**Prevention Rule**: Even PoC code needs validation. Document what's missing for production.

```tsx
/* ✅ Even in demo code, show best practice */
const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email()
})

const result = formSchema.safeParse(formData)
if (!result.success) return // Validation failed
```

---

### 📝 Documentation Pitfalls

#### Pitfall #1: Missing Phase 1 vs Phase 1.5 Boundaries
**What went wrong**: Unclear which hardcoded strings were intentional Phase 1 shortcuts vs actual violations.

**Prevention Rule**:
- Document intentional Phase 1 limitations explicitly:
  ```tsx
  // Phase 1: Demo content – remove or i18n in Phase 1.5
  <h1>TanStack Start Demos</h1>
  ```
- Use comment pattern: `// Phase 1.5: Add i18n for [feature]`

#### Pitfall #2: No Checklist Before Merging
**What went wrong**: Components merged without checking i18n, accessibility, performance requirements.

**Prevention Rule**: Use checklist before every PR (see section above: "Before Creating New Components").

---

## 10. Architecture & CSS Pitfalls from Design System Migration

These critical lessons emerged from the **Design System Migration Phase 1** across all subsystems.

### 🔴 Critical Architecture Issues

#### Issue #1: CSS Custom Properties Not Explicitly Imported
**What went wrong**: `globals.css` used CSS variables without importing `design-tokens.css`.

```css
/* ❌ WRONG - CSS Module doesn't know variables are available */
/* globals.css */
body {
  background-color: var(--background);  /* Where does --background come from? */
}

/* ✅ CORRECT */
@import '@sva-studio/ui-contracts/design-tokens.css';

body {
  background-color: var(--background);  /* Explicit dependency */
}
```

**Prevention Rule**:
- ALWAYS use `@import` for CSS dependencies, don't rely on HTML `<link>` order
- This allows CSS modules to be self-contained
- Enables CSS linters to validate variable usage

#### Issue #2: No Fallback Values for CSS Variables
**What went wrong**: CSS variables had no fallback, causing rendering failures in older browsers or if variables undefined.

```css
/* ❌ WRONG - Fails silently if --background undefined */
body {
  background-color: var(--background);
  color: var(--foreground);
}

input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Hardcoded! */
}

/* ✅ CORRECT - Fallback to hardcoded value */
body {
  background-color: #fafaf3;  /* Fallback first */
  background-color: var(--background);
  color: #10100b;
  color: var(--foreground);
}

input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));
}
```

**Prevention Rule**:
- For critical properties (background, color, focus-shadow), always provide fallback
- Use duplicate declarations: hardcoded first, variable second
- Browsers ignore fallback if variable exists, use it if variable missing

#### Issue #3: Dark Mode with Conflicting Cascade
**What went wrong**: Dark mode defined in 3 different ways with unclear priority:

```css
/* ❌ PROBLEM - 3 identical definitions, unclear hierarchy */
@media (prefers-color-scheme: dark) {
  :root {
    --background: rgba(16, 16, 11, 1);
  }
}

[data-theme="dark"] {
  --background: rgba(16, 16, 11, 1);  /* Same value! */
}

.dark {
  --background: rgba(16, 16, 11, 1);  /* Same value again! */
}

/* When .theme-yacht active: */
.theme-yacht.dark {
  --background: rgba(18, 18, 20, 1);  /* Conflicts with .dark! */
}
```

**Problem**: Browser specificity conflict:
- `.dark` (specificity 0,1,0) vs
- `.theme-yacht.dark` (specificity 0,2,0)
- → If `.theme-yacht` active, it ALWAYS wins, even if not supposed to be dark

**Prevention Rule**:
```css
/* ✅ CORRECT - Clear cascade hierarchy */
/* 1. Media Query (lowest priority) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: rgba(16, 16, 11, 1);
  }
}

/* 2. Explicit attribute (medium priority) */
[data-theme="dark"] {
  --background: rgba(16, 16, 11, 1);
}

/* 3. CSS class (high priority for JS-based switching) */
.dark {
  --background: rgba(16, 16, 11, 1);
}

/* 4. Theme + Dark combination (highest priority) */
[data-theme="dark"][data-theme-variant="yacht"] {
  --background: rgba(18, 18, 20, 1);  /* Clear override */
}
```

**Rule**: Use specificity levels, NOT duplicate selectors:
- Level 1: `:root` with media query (system preference)
- Level 2: `[data-theme="dark"]` (explicit attribute from server)
- Level 3: `.dark` (CSS class from JavaScript)
- Level 4: Theme-specific (highest specificity for variants)

---

### ⚡ Performance & Bundle Size Pitfalls

#### Pitfall #1: Redundant CSS Definitions (Triple Dark Mode)
**What went wrong**: Dark mode tokens defined 3x identically:

```css
/* ❌ WRONG - 80 lines of duplicate CSS */
@media (prefers-color-scheme: dark) {
  --background: ...;  /* 16 variables */
}

[data-theme="dark"] {
  --background: ...;  /* 16 variables again! */
}

.dark {
  --background: ...;  /* 16 variables again! */
}

/* Impact: 400-500 bytes wasted */
```

**Prevention Rule**:
- Use ONE definition for core tokens
- Use combined selectors if needed:
  ```css
  @media (prefers-color-scheme: dark),
  [data-theme="dark"],
  .dark {
    --background: ...;
  }
  ```
- Better: Use cascade hierarchy (see Issue #3)

#### Pitfall #2: Theme Switching Performance
**What went wrong**: Changing dark mode took 400ms because browser had to match 3x selectors per variable.

```
❌ BEFORE: 400ms theme switch
  └─ Browser matches @media query for EVERY token
  └─ Browser matches [data-theme] for EVERY token
  └─ Browser matches .dark for EVERY token
  └─ REPAINT triggered (not just REFLOW)

✅ AFTER: ~150ms theme switch (60% faster)
  └─ One selector per variable
  └─ Reduced cascade complexity
  └─ Better browser optimization
```

**Prevention Rule**:
- Minimize selector complexity for frequently-switched styles
- Test theme-switch performance: `DevTools > Performance > Record`
- Target < 200ms for theme toggle

#### Pitfall #3: Hardcoded Focus-Shadow Instead of Variable
**What went wrong**: Focus shadow defined as hardcoded value in multiple places:

```css
/* ❌ WRONG - Hardcoded in focus state AND in variable */
input:focus {
  box-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);  /* Hardcoded */
  box-shadow: var(--focus-shadow, 0 0 0 3px rgba(78, 188, 65, 0.1));  /* Variable with same fallback */
}

/* Result: Double declaration + same value in fallback */
```

**Prevention Rule**:
- Define shadow once in variables
- Use variable everywhere
- If needing fallback, make sure values are synced:
  ```css
  /* ✅ CORRECT */
  --focus-shadow: 0 0 0 3px rgba(78, 188, 65, 0.1);

  input:focus {
    box-shadow: var(--focus-shadow);  /* Single source */
  }
  ```

#### Pitfall #4: Empty CSS Files Left in Build
**What went wrong**: `styles.css` was empty but still in bundle (119 bytes wasted).

**Prevention Rule**:
- Audit CSS files before shipping
- Remove empty/redundant stylesheets
- Check build output for dead code

---

### 🔐 Design System & Namespace Pitfalls

#### Pitfall #1: Legacy Namespace References Not Updated
**What went wrong**: Some imports still used old scope instead of `@sva-studio/`.

```ts
/* ❌ WRONG - Old scope */
import tokens from '@svastudio/design-tokens';
import { Button } from '@svastudio/ui-components';

/* ✅ CORRECT - New scope */
import tokens from '@sva-studio/ui-contracts/design-tokens.css';
import { Button } from '@sva-studio/ui-components';
```

**Prevention Rule**:
- Update ALL imports when migrating namespaces
- Use find-and-replace across entire codebase
- Verify with `grep` that old scope is gone

#### Pitfall #2: Design Tokens Not Documented for Usage
**What went wrong**: Developers didn't know which tokens to use where.

**Prevention Rule**: Create clear documentation:
```md
# Design Tokens Reference

## Colors
- `--primary`: Green #4EBC41 (buttons, links)
- `--secondary`: Teal #13C296 (accents)
- `--background`: Light Beige #FAFAF3 (page background)
- etc.

## Usage
- Always use `var(--token)` in CSS
- Never hardcode color values
- For dynamic colors, use encapsulated component (IssueLabel)
```

---

### ✅ How to Use These Learnings

**For Phase 1.5 and beyond:**
1. **Before implementing CSS**: Check sections 10.1-10.4
2. **Before shipping styles**: Run performance audit (10.2)
3. **When refactoring**: Apply cascade hierarchy fixes (10.1.3)
4. **In code review**: Reference specific pitfalls: "See DEVELOPMENT_RULES 10.1.2 – CSS Variable Fallbacks"

**For design system evolution:**
1. Use this as input for token documentation
2. Create automation to detect duplicate CSS definitions
3. Set up CI checks for bundle size

---

### How it works
1. **Database**: `translations` table stores key-value pairs
2. **Workspace-specific**: Each workspace can have custom translations
3. **i18n Integration**: `src/lib/i18n.ts` provides base translations
4. **Runtime Loading**: `useTranslations()` hook loads workspace translations
5. **React Integration**: Use `useTranslation()` hook in components

### File Structure
```
src/
├── lib/
│   └── i18n.ts                    # i18next configuration and base translations
├── hooks/
│   ├── useTranslations.ts         # Hook to load workspace translations
│   └── useWorkspaceTranslations.ts # Legacy hook (being phased out)
└── contexts/
    └── WorkspaceContext.tsx       # Workspace context with language
```

---

## Translation Key Management

### Finding Missing Translation Keys

**Problem**: During development, translation keys may be used in code but not defined in `src/lib/i18n.ts`.

**Solution**: Use the following process to identify and add missing keys:

#### 1. Search for Translation Key Usage
```bash
# Search for all t('...') calls in the codebase
grep -r "t('" src/ --include="*.tsx" --include="*.ts"
```

#### 2. Compare with Defined Keys
Check `src/lib/i18n.ts` to see which keys are defined:
- Look in the `resources` object
- Check both `de` (German) and `en` (English) translations
- Verify the key hierarchy matches usage

#### 3. Add Missing Keys
When adding new translation keys:

```typescript
// In src/lib/i18n.ts
const resources = {
  de: {
    translation: {
      // ... existing keys ...

      // Add new keys with proper hierarchy
      admin: {
        newSection: {
          title: "Neuer Bereich",
          description: "Beschreibung des neuen Bereichs"
        }
      }
    }
  },
  en: {
    translation: {
      // Mirror the German structure
      admin: {
        newSection: {
          title: "New Section",
          description: "Description of the new section"
        }
      }
    }
  }
};
```

#### 4. Translation Key Naming Convention

Follow this hierarchy for consistency:

```
section.subsection.component.element

Examples:
- admin.dashboard.stats.title
- bg.invite.dialog.title
- common.buttons.save
- auth.login.form.email
- navigation.main.cases
```

#### 5. Regular Maintenance

**Recommended**: Check for missing translation keys regularly during development:

1. Before committing new features
2. After adding new UI components
3. When reviewing PRs
4. During sprint reviews

#### 6. Automated Script (Optional)

For large projects, use the extraction script:

```bash
# Run from project root
bun run scripts/extract-translation-keys.ts
```

This script will:
- Scan all TypeScript/TSX files
- Extract all `t('...')` calls
- Compare with defined keys in i18n.ts
- Generate a report of missing keys

### Best Practices

✅ **DO:**
- Add translations immediately when creating new UI text
- Use descriptive key names that reflect the content
- Maintain parallel structure in `de` and `en` translations
- Group related keys under common parent keys

❌ **DON'T:**
- Use generic keys like `text1`, `label2`
- Mix different naming conventions
- Leave placeholder text in translations
- Forget to add both German and English versions

---

## Design System Architecture

### Color System (HSL-based)
All colors must be defined as CSS variables in HSL format:

```css
:root {
  --primary: 221 83% 53%;        /* Main brand color */
  --background: 0 0% 100%;        /* Page background */
  --foreground: 222 47% 11%;      /* Main text color */
  /* ... more semantic tokens */
}

.dark {
  --primary: 210 40% 98%;         /* Inverted for dark mode */
  --background: 222.2 84% 4.9%;   /* Dark background */
  --foreground: 210 40% 98%;      /* Light text */
  /* ... more dark mode tokens */
}
```

### Using Colors in Components
```tsx
// ✅ Use semantic tokens - automatically supports dark mode
className="bg-primary text-primary-foreground"
className="border-border hover:bg-accent"
className="bg-background text-foreground"

// ❌ Never use direct colors - breaks dark mode
className="bg-blue-600 text-white"
className="border-gray-300 hover:bg-gray-100"
```

### Dark Mode Support (Required)

**All new components MUST support dark mode:**

1. **Use Semantic Tokens**: Never hardcode colors
2. **Test Both Modes**: Verify readability in light and dark
3. **Check Contrast**: Ensure WCAG AA compliance in both modes
4. **Theme Aware**: Use `useTheme()` hook for conditional logic if needed

```tsx
import { useTheme } from '@/contexts/ThemeContext'

function MyComponent() {
  const { resolvedTheme } = useTheme()

  // Most components don't need this - semantic tokens handle it
  // Only use for special cases (charts, custom graphics, etc.)
  const isDark = resolvedTheme === 'dark'
}
```

**Theme System Files:**
- `src/contexts/ThemeContext.tsx` - Theme management
- `src/components/ui/theme-toggle.tsx` - Theme selector
- `src/index.css` - Light and dark color definitions
- `tailwind.config.ts` - Theme configuration

---

## 8. User Manual Maintenance

### 🚨 MANDATORY - Keep Documentation Current

**The User Manual must be updated whenever functionality changes.**

#### When to Update the Manual

Update `src/lib/translations/manual.ts` when:
- ✅ Adding new features or functionality
- ✅ Changing existing workflows or UI flows
- ✅ Modifying navigation or menu structures
- ✅ Adding, changing, or removing user-facing settings
- ✅ Updating role-based permissions or access

#### How to Update

1. **Locate the affected category** in `src/lib/translations/manual.ts`
2. **Update both German (manualDE) and English (manualEN)** translations
3. **Update steps** if the workflow changed
4. **Add new sections** for new features
5. **Update keywords** for improved searchability
6. **Verify role-based visibility** (`requiredRoles`) is correct

#### Example - Adding a New Feature

```typescript
// In manualDE.categories, find the relevant category and add:
{
  id: 'new-feature',
  title: 'Neue Funktion',
  description: 'Beschreibung der neuen Funktion',
  icon: 'Sparkles',
  requiredRoles: ['admin', 'project_manager', 'member'],
  keywords: ['neu', 'funktion', 'feature'],
  steps: [
    {
      title: 'Schritt 1',
      description: 'Beschreibung des ersten Schritts',
      tip: 'Optionaler Tipp für Benutzer'
    }
  ]
}

// Mirror the same structure in manualEN
```

#### Checklist for Manual Updates

- ✅ Both DE and EN translations added/updated
- ✅ Steps are clear and actionable
- ✅ Keywords include relevant search terms
- ✅ `requiredRoles` matches actual feature permissions
- ✅ Icon matches the feature's visual style

### ❌ FORBIDDEN

- Deploying feature changes without manual updates
- Leaving outdated steps or descriptions
- Mismatched DE/EN content
- Wrong `requiredRoles` exposing internal features to customers

---

## Enforcement

These rules are enforced through:
1. **Code review** - All PRs must follow these guidelines
2. **AI assistance** - AI tools are instructed to follow these rules
3. **Documentation** - This file serves as the source of truth
4. **Team agreement** - All developers commit to these standards
5. **Manual checks** - Feature PRs must include manual updates

---

## Questions?

If you're unsure about how to implement something following these rules:
1. Check existing implementations in the codebase
2. Review `IMPLEMENTATION.md` for architecture details
3. Consult this document for the rules
4. Ask the team for clarification

---
