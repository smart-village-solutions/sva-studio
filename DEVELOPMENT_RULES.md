
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

## 1.1 Tooling: LSP Diagnostics

### ✅ REQUIRED
- Install the TypeScript language server globally for LSP diagnostics:
  - `npm install -g typescript-language-server typescript`

**Why this is required:**
- The `lsp_diagnostics` tooling used in this workspace resolves `typescript-language-server` from the global PATH.
- A local devDependency is not sufficient for the diagnostics tool.

---

## 1.2 Repository File Placement (Enforced)

### ✅ REQUIRED
- Run `pnpm check:file-placement` before opening a PR
- Store debug scripts only in:
  - `scripts/debug/auth/`
  - `scripts/debug/otel/`
- Store staging docs only in: `docs/staging/YYYY-MM/`
- Store PR docs only in: `docs/pr/<number>/`
- Store operational reports only in: `docs/reports/`

### ❌ FORBIDDEN
- New markdown files in repository root (except: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `DEBUGGING.md`, `DEVELOPMENT_RULES.md`, `AGENTS.md`)
- Legacy document paths such as:
  - `docs/STAGING-TODOS.md`
  - `docs/SECTION_7_VALIDATION_REPORT.md`
  - `docs/pr45-*.md`
  - `docs/pr-45-*.md`
- Root-level debug scripts like:
  - `debug_test.ts`
  - `test_session_loading.ts`
  - `test-otel-phase1.ts`
  - `test-otel-provider-creation.ts`
  - `test-otlp-direct.ts`

**Enforcement**
- CI workflow `File Placement` blocks non-compliant changes.
- Optional local pre-commit hook:
  1. `pnpm hooks:install`
  2. commit (hook runs `pnpm check:file-placement:staged`)

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

## 5. Test Coverage Requirements

### ✅ REQUIRED
- Neue Features und Verhaltensänderungen müssen Unit-Tests erhalten.
- Coverage darf pro Projekt und global nicht unter die Baseline bzw. definierte Floors fallen.
- Kritische Module müssen ihre definierten Mindest-Floors in `tooling/testing/coverage-policy.json` erfüllen.
- Kritische Hotspots dürfen über `hotspotFloors` feiner granulierte Floors erhalten.
- Für zentrale und kritische Module muss `pnpm complexity-gate` erfolgreich sein.
- Neue Komplexitätsüberschreitungen sind nur mit dokumentiertem Refactoring-Ticket zulässig.
- Coverage-Gate muss vor dem Merge erfolgreich sein.

### ❌ FORBIDDEN
- PRs mit neuer Funktionalität ohne zugehörige Tests.
- Baseline-Updates ohne dokumentierte Team-Freigabe.
- Exemptions als dauerhafte Umgehung des Coverage-Gates.
- Neue Komplexitäts-Findings ohne Ticket-Referenz in `tooling/quality/complexity-policy.json`.
- Absenkung von Coverage-Floors, nur weil ein kritischer Hotspot komplexer geworden ist.

### Process
1. Tests parallel zur Feature-Implementierung schreiben.
2. Lokal Coverage ausführen: `pnpm test:coverage`.
3. Gate vor PR prüfen: `pnpm coverage-gate`.
4. Komplexitäts-Gate prüfen: `pnpm complexity-gate`.
5. Bei Exemption oder Komplexitätsüberschreitung: Ticket erstellen bzw. referenzieren und Team-Genehmigung dokumentieren.

### Enforcement
- PRs ohne angemessene Tests werden in Reviews abgelehnt.
- Baseline- oder Policy-Änderungen brauchen eine explizite Begründung im PR.
- Die PR-Checkliste muss Coverage-Nachweise enthalten: `docs/reports/PR_CHECKLIST.md`.
- Die PR-Checkliste muss auch Komplexitäts-Nachweise und Ticketbezüge enthalten.

**Example:**
```ts
// WRONG: neue Feature-Logik ohne Testabdeckung
export function calculateDiscount(price: number): number {
  return price * 0.9;
}

// CORRECT: Feature + Testdatei
export function calculateDiscount(price: number): number {
  return price * 0.9;
}
// plus tests/calculateDiscount.test.ts
```

Weitere Details und Troubleshooting: `docs/development/testing-coverage.md`.
Komplexitäts-Regeln und Ticket-Workflow: `docs/development/complexity-quality-governance.md`.

## 5.1 Externe Quality Gates (Codecov & Sonar)

### ✅ REQUIRED
- SonarQube/SonarCloud-Analyse muss für PRs und vor Merge berücksichtigt werden; das Quality Gate darf nicht unbeachtet bleiben.
- Codecov-Checks (`project`, `patch`) müssen in jedem PR aktiv geprüft und im Zweifel im PR-Text eingeordnet werden.
- Interne Gates bleiben verbindlich: `pnpm coverage-gate` und `pnpm complexity-gate` sind die Freigabebasis im Repository.
- Bei roten externen Checks (Codecov/Sonar) ist vor Merge eine dokumentierte Entscheidung im PR erforderlich (Ursache, Risiko, Folgemaßnahme).

### ❌ FORBIDDEN
- Merge ohne Sichtung der Sonar- oder Codecov-Ergebnisse.
- Ignorieren roter Quality-Gate-Checks ohne dokumentierte Begründung.

### Process
1. Lokal die internen Gates ausführen (`pnpm test:coverage`, `pnpm coverage-gate`, `pnpm complexity-gate`).
2. PR-Pipeline abwarten und Sonar- sowie Codecov-Status prüfen.
3. Bei Befunden: Fix priorisieren oder begründete Ausnahme inkl. Ticket im PR dokumentieren.
4. Merge erst nach nachvollziehbarer Bewertung aller Quality-Gates.

### Enforcement
- PRs ohne dokumentierte Bewertung von Sonar/Codecov werden im Review zurückgestellt.
- Wiederholte Verstöße gelten als Prozessabweichung und müssen in der Retro adressiert werden.

---

## 6. Security & Input Validation

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

#### D. Architektur-Dokumentationssynchronität (arc42 / ADR)

### ✅ REQUIRED
- Architekturrelevante Änderungen im Bereich IAM, Rollen-Sync, ABAC/RBAC oder Data-Subject-Rights MÜSSEN in den betroffenen arc42-Abschnitten dokumentiert werden, insbesondere in Abschnitt 04, 05, 06 und 08.
- Jede Änderung an sicherheitskritischer oder domänenkritischer Logik MUSS mindestens eine Aktualisierung in `docs/architecture/05-building-block-view.md` oder `docs/architecture/08-cross-cutting-concepts.md` nach sich ziehen.
- Neue oder geänderte IAM-Patterns MÜSSEN als ADR unter `docs/adr/` dokumentiert und in `docs/architecture/09-architecture-decisions.md` referenziert werden.
- PRs mit Architektur- oder Systemwirkung MÜSSEN im PR-Text die betroffenen arc42-Abschnitte nennen oder eine begründete Abweichung dokumentieren.
- OpenSpec-Changes mit Architekturwirkung MÜSSEN die betroffenen arc42-Abschnitte in `proposal.md` und `tasks.md` referenzieren.

### ❌ FORBIDDEN
- Änderungen an IAM-, Rollen-, Policy- oder Data-Subject-Rights-Logik ohne passende Aktualisierung der Architektur-Doku.
- Sicherheitskritische Logikänderungen nur im Code nachzuziehen und die Querschnitts- oder Bausteinsicht unverändert zu lassen.
- Neue IAM-Patterns implizit im Code einzuführen, ohne ADR und ohne Referenz in Abschnitt 09.

### Enforcement
- Reviews müssen PRs ablehnen, wenn architekturrelevante Änderungen nicht in arc42 und ADRs nachvollziehbar dokumentiert sind.
- Die PR-Checkliste unter `docs/reports/PR_CHECKLIST.md` ist für diese Nachweise verbindlich.
- Der `documentation.agent.md` und der `architecture.agent.md` prüfen diese Synchronität explizit.

---

## 7. Branching & PR Workflow

### ✅ REQUIRED
- Create a dedicated branch for every change; never commit directly to main
- Use branch prefixes that describe the change: `feature/`, `fix/`, `chore/`, `docs/`, `setup/`, `adr/`
- Keep one topic per branch and keep branches/PRs small and focused
- Rebase (or merge) main into your branch before opening a PR to resolve drift early
- Require green CI and at least one review before merge; prefer squash merges to keep history clean

### Base Branch Decision Tree
- Frage 1: Ist die geplante Änderung unabhängig von ungemergten Änderungen?
  - Ja -> neuen Branch von `main` erstellen
  - Nein -> neuen Branch von dem Branch erstellen, von dem die Änderung fachlich/technisch abhängt
- Frage 2: Würde der neue Branch ohne den bestehenden Branch nicht sinnvoll builden oder reviewbar sein?
  - Ja -> vom bestehenden Branch starten (Stack)
  - Nein -> von `main` starten

### PR Target Rule (Invariant)
- Invariante: Ein PR zeigt immer auf den Branch, von dem der eigene Branch abgeschnitten wurde.
- Beispiele:
  - Basisbranch `main` -> PR-Target `main`
  - Basisbranch `feature/A` -> PR-Target `feature/A`
  - Basisbranch `fix/session-timeout` -> PR-Target `fix/session-timeout`

### Stacked Branch Workflow
- Beispiel-Kette:
  - `feature/A` basiert auf `main`
  - `feature/B` basiert auf `feature/A`
  - `feature/C` basiert auf `feature/B`
- PR-Reihenfolge:
  - PR A: `feature/A` -> `main`
  - PR B: `feature/B` -> `feature/A`
  - PR C: `feature/C` -> `feature/B`
- Merge-Reihenfolge:
  - Erst A, dann B, dann C
- Retargeting-Regel nach Merge:
  - Nach Merge von A in `main`: PR B auf `main` umstellen, Branch B mit `main` synchronisieren
  - Nach Merge von B: PR C auf `main` umstellen, Branch C mit `main` synchronisieren
  - Wenn ein Vorgänger-PR noch offen ist, bleiben nachfolgende PRs auf den direkten Vorgänger ausgerichtet

### ❌ FORBIDDEN
- Mixing unrelated changes in one branch or PR
- Force-pushing after review without explicit reviewer consent (except to fix CI/rebase conflicts)
- Branch basiert auf `feature/*` oder `fix/*`, PR zeigt aber direkt auf `main` (falsches Review-Diff)
- Gemischte Themen in einer Branch-Kette (erschwert Review, erhöht Merge-Risiko)
- Keine Synchronisierung mit dem Upstream-Branch nach Merge des Vorgängers (veraltete Diffs, unnötige Konflikte)

### Forbidden / Failure Modes (Warum)
- Falsches PR-Target erzeugt verfälschte Diffs und Review-Rauschen.
- Themenmix in Stacks macht Rückverfolgung, Testing und Rollback deutlich schwerer.
- Fehlende Synchronisierung nach Upstream-Merge führt zu vermeidbaren Merge-Konflikten und CI-Instabilität.

### Operational Checklist vor Branch/PR
- [ ] Ist klar, ob die Änderung unabhängig ist (`main`) oder abhängig (bestehender Branch)?
- [ ] Wurde der neue Branch vom fachlich korrekten Basisbranch erstellt?
- [ ] Entspricht das PR-Target exakt dem Basisbranch?
- [ ] Sind Abhängigkeiten zu Vorgänger-Branches im PR-Text dokumentiert?
- [ ] Ist bei Stacks die PR-/Merge-Reihenfolge eindeutig festgelegt?
- [ ] Wurde nach Merge eines Vorgänger-PRs korrekt retargeted und synchronisiert?

---

## 8 Monorepo Module Boundaries (Nx)

### ✅ REQUIRED
- Projektgrenzen und Layering werden über `@nx/enforce-module-boundaries` technisch erzwungen.
- Jede neue Library/App MUSS korrekte Nx-Tags (`scope:*`, `type:*`) im `project.json` haben.
- Architektur-ändernde Imports müssen gegen die definierten `depConstraints` geprüft werden.

### Quelle der Regeln
- Details und aktuelle Scope-Constraints: `docs/monorepo.md` (Abschnitt "Module Boundaries")

---

## 9. Logging & Observability

### ✅ REQUIRED
- **Server-Code**: SDK Logger verwenden (`createSdkLogger` aus `@sva/sdk`)
- **Strukturierte Logs**: Immer mit Context-Feldern (component, operation, error, etc.)
- **PII-Schutz**: Keine Session-IDs, Tokens, Emails direkt loggen
- **Component-Labels**: Jeder Logger braucht eindeutigen `component` (z.B. `auth`, `auth-redis`)
- **Error-Context**: Bei Errors immer `error`, `error_type`, `operation` mitloggen

### ❌ FORBIDDEN
- `console.log/info/warn/error` in Production-Server-Code
- Session-IDs, Access-Tokens, Refresh-Tokens in Klartext
- Unstrukturierte Error-Messages ohne Context
- Logs ohne `component`-Label

### ✅ APPROVED - Frontend Dev-Only Logs
Frontend darf `console.*` nutzen, aber:
- Nur in Development (`if (process.env.NODE_ENV !== 'production')`)
- Mit strukturierten Feldern `{ component, endpoint, status, error }`
- Keine PII (User-Email, Session-IDs)

**Backend-Beispiel:**
```typescript
import { createSdkLogger } from '@sva/sdk';

const logger = createSdkLogger({ component: 'auth' });

logger.info('Session created', {
  operation: 'create_session',
  ttl_seconds: 3600,
  has_refresh_token: true,
});

logger.error('Auth failed', {
  operation: 'login',
  error: err.message,
  error_type: err.constructor.name,
});
```

**Detaillierte Richtlinien:** [observability-best-practices.md](docs/development/observability-best-practices.md)
**Logging-Agent:** [.github/agents/logging.agent.md](.github/agents/logging.agent.md)

---

## 10. Translation System Architecture

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

## 11. Translation Key Management

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

## 12. Design System Architecture

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

## 13. User Manual Maintenance

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
2. Review docs folder for architecture details
3. Consult this document for the rules
4. Ask the team for clarification

---
