
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
- Translation keys must exist in **both German (de) and English (en)** in the active app translation resources

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
- Code reviews must check for hardcoded text
- If you find hardcoded text, create a ticket and fix it **immediately**

---

## 1.1 Repository File Placement (Enforced)

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

## 1.2 Server-Package-Runtime und Node-ESM

### ✅ REQUIRED
- Für Workspace-Packages, deren `dist/*.js` direkt von Node geladen wird, müssen relative Runtime-Imports und Re-Exports explizite Laufzeitendungen tragen, in der Regel `.js`.
- Runtime-Imports auf andere Workspace-Packages müssen im jeweiligen `package.json` unter `dependencies` deklariert sein.
- Vor PR und Push für Änderungen an serverseitigen Packages `pnpm check:server-runtime` ausführen; das Gate läuft zusätzlich in `pnpm test:types`.
- Bei neuen Server-Packages denselben Guard früh mitdenken und als Nx-Target `check:runtime` integrieren.
- Bei Änderungen an CI-/Workspace-Skripten unter `scripts/ci/` oder Root-TS-Skripten muss zusätzlich der Skript-Typecheck laufen: `pnpm exec tsc -p tsconfig.scripts.json --noEmit` oder ein Wrapper, der ihn sicher einschließt.

### ❌ FORBIDDEN
- Relative Runtime-Imports wie `./server`, `../types` oder `export * from './foo'` in Node-ESM-relevanten Packages ohne Endung.
- Verlassen auf transitive, Root- oder Alias-Auflösung für echte Runtime-Dependencies.
- Annahme, dass `moduleResolution: "Bundler"` oder Vite/`tsx` automatisch garantiert, dass gebautes `dist/*.js` in Node korrekt läuft.

**Warum diese Regel kritisch ist:**
- TypeScript ist hier die Quellsprache, die Laufzeit ist dennoch Node mit ESM-Regeln.
- `moduleResolution: "Bundler"` verdeckt Fehler, die erst in gebauten Packages auftreten.
- Ohne Guard fallen Probleme oft erst spät im Dev-Server oder im produktionsnahen Laufzeitpfad auf.

**Pflicht-Checks:**
```bash
pnpm check:server-runtime
pnpm test:types
```

**Referenzdoku:**
- `docs/development/server-package-runtime-guards.md`

---

## 1.2a Datenbankschema-Snapshot und Pflegepflicht

### ✅ REQUIRED
- Das kanonische Soll-Datenbankschema des Repositories ist als Snapshot unter `docs/development/studio-db-schema-final.sql` präsent zu halten.
- Die begleitende Übersicht und Einordnung liegt unter `docs/development/studio-db-schema.md`.
- Vor Änderungen an Migrationen, DB-Strukturen, Tabellen, Constraints, Indizes, RLS-Policies, Triggern oder DB-Funktionen muss der bestehende Snapshot konsultiert werden.
- Nach jeder Schemaänderung muss der Snapshot `docs/development/studio-db-schema-final.sql` fortgeschrieben werden.
- Wenn sich der Live-Stand relevant vom Repo-Soll unterscheidet, muss der Drift in `docs/development/studio-db-schema.md` dokumentiert oder aktualisiert werden.
- PRs mit Datenbankschemaänderungen müssen explizit prüfen, ob die Schema-Dokumentation und der Snapshot mitgeändert wurden.

### ❌ FORBIDDEN
- Datenbankschemaänderungen nur in Migrationen umzusetzen, ohne den Snapshot zu aktualisieren.
- Neue Tabellen, Spalten, Constraints, RLS-Regeln, Trigger oder Funktionen einzuführen, ohne das bestehende Schema als Referenz zu prüfen.
- Das DB-Schema ausschließlich implizit aus verstreuten Migrationsdateien ableiten zu müssen, obwohl der Snapshot angepasst werden müsste.

**Warum diese Regel kritisch ist:**
- Sie macht das vorhandene Schema an einer zentralen Stelle sichtbar.
- Sie reduziert Fehlannahmen bei Erweiterungen und Refactorings.
- Sie verhindert, dass das tatsächliche Soll-Schema mit jeder Migration schwerer rekonstruierbar wird.

**Kanonische Referenzen:**
- `docs/development/studio-db-schema-final.sql`
- `docs/development/studio-db-schema.md`
- `packages/data/migrations/*.sql`

---

## 1.3 Action-ID-Namensmodell und Namespace-Ownership

### ✅ REQUIRED
- Alle autorisierbaren Action-IDs müssen langfristig das fully-qualified Format `<namespace>.<action>` verwenden.
- Das gilt sowohl für Core-/interne Actions als auch für Plugin-Actions.
- Neue Actions dürfen nicht als unqualifizierte Kurzformen wie `read`, `write`, `create`, `update` oder ähnliche freie Strings eingeführt werden.
- Plugin-Actions dürfen ausschließlich im eigenen Plugin-Namespace definiert werden.
- Reservierte Core-Namespaces dürfen nicht von Plugins verwendet werden.
- Cross-Namespace-Verwendung darf nur über einen expliziten Bridge-, Alias- oder Migrationsvertrag eingeführt werden.

### ❌ FORBIDDEN
- Neue autorisierbare Actions ohne Namespace einführen.
- Kurzformen implizit auf einen Namespace umdeuten, z. B. `read -> content.read` oder `create -> news.create`.
- Plugin-Actions in reservierten Core-Namespaces deklarieren.
- Core- und Plugin-Actions mit unterschiedlichen Namenskonventionen weiterentwickeln.

**Warum diese Regel kritisch ist:**
- Sie verhindert Namespace-Kollisionen und implizite Sicherheitsannahmen.
- Sie macht IAM-, Audit- und Routing-Entscheidungen deterministisch nachvollziehbar.
- Sie hält das Modell für Core und Plugins konsistent, statt zwei konkurrierende Action-Systeme zu pflegen.

**Zielbeispiele:**
```ts
// ✅ Core / intern
const readAction = 'content.read';
const manageUsersAction = 'iam.users.manage';

// ✅ Plugin
const createNewsAction = 'news.create';
const updateNewsAction = 'news.update';

// ❌ Verbotene Kurzformen für neue autorisierbare Actions
const invalidReadAction = 'read';
const invalidCreateAction = 'create';
```

---

## 1.4 Server-Orchestrierung und Routing-Verantwortung

### ✅ REQUIRED
- Das aktuelle Architekturmodell darf beibehalten werden:
  - `@sva/routing` bleibt das kanonische Modell für UI-/TanStack-Routing.
  - Der App-Entry `apps/sva-studio-react/src/server.ts` darf app-spezifische Server-Orchestrierung, Vorab-Dispatch und Transport-Diagnostik bündeln.
- `server.ts` ist als Composition Root zu behandeln:
  - neue Fachlogik, Validierung oder domänenspezifische Entscheidungslogik sollen nicht dort anwachsen
  - stattdessen in dedizierte Module oder Packages verschieben, sobald sie nicht mehr nur reines Wiring sind
- Strukturrefactorings wie ein aggregierter Package-Dispatcher oder das Herausziehen der Orchestrierung sind nur dann zu priorisieren, wenn konkrete Reibung vorliegt, zum Beispiel:
  - hohe Änderungsfrequenz im Entry-Point
  - sinkende Testbarkeit
  - Wiederverwendungsbedarf über mehrere Apps
  - wachsender Aufwand beim Ergänzen neuer Spezialrouten oder Bypass-Pfade
- `createServerFn`-Wrapper bleiben grundsätzlich App-Adapter. Framework-agnostische Geschäftslogik gehört in Packages; die TanStack-Start-Bindung wird nur mit klarer Begründung in ein Package verschoben.

### ❌ FORBIDDEN
- UI-Routing und HTTP-Dispatch begrifflich oder architektonisch unklar zu einem einzigen "kanonischen Routing-Modell" zu vermischen.
- `server.ts` schrittweise zu einem Sammelpunkt für fachliche Sonderlogik auszubauen.
- Framework-Kopplung in Domänenpackages einzuführen, nur um dünne App-Adapter-Dateien zu vermeiden.
- Architektur-Refactorings ohne klaren Nutzen, messbare Reibung oder dokumentierte Zielsetzung anzustoßen.

**Warum diese Regel wichtig ist:**
- Sie schützt vor unnötigen Architekturumbauten ohne akuten Nutzen.
- Sie hält die Trennung zwischen kanonischem UI-Routing und app-spezifischem Server-Transport klar.
- Sie erlaubt pragmatische Weiterentwicklung, ohne `server.ts` unkontrolliert wachsen zu lassen.

---

## 1.5 Ausnahme: Explizit angeordnete Schnelliterationsphase

### ✅ REQUIRED
- Bei ausdrücklich angeordneter Schnelliterationsphase dürfen betroffene Unit-, Type-, Lint- und E2E-Tests für einzelne kleinteilige Änderungsblöcke vorübergehend zurückgestellt werden.
- Diese Ausnahme gilt nur für schnelle Feedback-Schleifen während der Umsetzung und nicht für Commit, Push, PR oder Release.
- Die ausgesetzten Prüfungen müssen vor Commit, Push oder PR vollständig nachgezogen werden.
- Während einer solchen Phase darf kein grüner Teststand behauptet oder impliziert werden.
- Die Anweisung zur Schnelliterationsphase muss im Arbeitskontext ausdrücklich vorliegen.
- Der Verzicht auf Prüfungen muss im Arbeitskontext transparent benannt werden.
- Pro Änderungsblock ist der Umfang so klein wie möglich zu halten, damit die nachgezogene QS eindeutig bleibt.

### ❌ FORBIDDEN
- Verwendung dieser Ausnahme für Änderungen mit Sicherheitsbezug
- Verwendung dieser Ausnahme für Änderungen an Authentifizierung, Autorisierung oder Validierung
- Verwendung dieser Ausnahme für Änderungen an Datenbank-Schema, Migrationen, RLS, Triggern oder DB-Funktionen
- Verwendung dieser Ausnahme für Änderungen an serverseitigen Runtime-Pfaden oder Node-ESM-kritischen Workspace-Packages
- Verwendung dieser Ausnahme, wenn bereits ein bekannter roter Teststand auf denselben betroffenen Bereich hinweist
- Behauptung oder Implizierung eines grünen Teststands während einer aktiven Schnelliterationsphase

**Weiterhin verbindlich:**
- Vor Commit, Push oder PR gelten wieder alle regulären Gates.
- `pnpm check:server-runtime` bleibt für betroffene serverseitige Packages verpflichtend.
- Dokumentationspflichten, Architekturpflichten und alle übrigen Non-Negotiable-Regeln bleiben unverändert bestehen.

---

## 1.6 Plan-Checkboxen und Umsetzungsstand

### ✅ REQUIRED
- Bei Plan-Dateien unter `docs/superpowers/plans/` müssen Checkboxen während der Umsetzung fortlaufend gepflegt werden.
- Nach jedem abgeschlossenen Änderungsblock sind die zugehörigen Plan-Schritte im selben Arbeitszug auf `- [x]` zu setzen oder bei bewusst verworfenem Scope klar zu bereinigen.
- Vor Commit, Push oder PR ist zu prüfen, ob der tatsächliche Umsetzungsstand und die Checkboxen im betroffenen Plan noch übereinstimmen.
- Wenn eine Umsetzung inhaltlich abgeschlossen ist, darf kein Plan mit offensichtlich veraltetem offenen Checkbox-Stand zurückbleiben.
- Vollständig abgeschlossene Pläne sind aus `docs/superpowers/plans/` nach `docs/superpowers/archived-plans/` zu verschieben.

### ❌ FORBIDDEN
- Plan-Schritte umzusetzen, ohne den Checkbox-Stand im Plan nachzuführen.
- Gemergte oder pushbereite Änderungen mit sichtbar veraltetem Plan-Status als „fertig“ zu behandeln.
- Plan-Checkboxen nachträglich pauschal abzuhaken, wenn der tatsächliche Umsetzungsstand nicht belastbar geprüft wurde.
- Vollständig abgeschlossene Pläne dauerhaft im aktiven Plan-Ordner zu belassen.

**Warum diese Regel wichtig ist:**
- Veraltete Plan-Checkboxen erzeugen falschen Backlog und machen Folgearbeit unnötig teuer.
- Der Plan ist nicht nur Entwurf, sondern auch Ausführungs- und Statusartefakt.
- Dokumentationsdrift bei Plänen ist genauso problematisch wie Drift bei Architektur- oder Schema-Dokumentation.

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
- Host- und Plugin-Keys haben klare Owner: Host-Features verwenden Host-Namespaces
  wie `shell.*`, `admin.*`, `account.*` oder `interfaces.*`; Plugins liefern ihre
  eigenen Namespaces über `@sva/plugin-sdk`.
- Gleiche sichtbare Textwerte in verschiedenen Owner-Namespaces sind erlaubt.
  Identische Übersetzungsschlüssel über Owner-Grenzen hinweg sind verboten und
  müssen als Kollisionsfehler behandelt werden.

**Where translations are stored:**
- Database table: `translations`
- Workspace-specific translations override global ones
- Fallback language: German (de)

---

## 3. CSS & Styling

### ✅ REQUIRED
- All styles must use the centralized design system
- Neue UI-Komponenten und neue UI-Flächen müssen auf `shadcn/ui` basieren
- Bevorzugt bestehende `shadcn/ui`-Primitives und -Patterns wiederverwenden, statt parallele UI-Grundbausteine einzuführen
- Use semantic tokens from `index.css` and `tailwind.config.ts`
- Use Tailwind CSS classes with design system colors (HSL format)
- Use component variants defined in shadcn components

### ❌ FORBIDDEN
- Neue Basis-Komponentenbibliotheken oder konkurrierende UI-Primitives ohne dokumentierte Architekturentscheidung einführen
- Eigenständige UI-Grundbausteine für Buttons, Dialoge, Inputs, Selects, Tabs oder ähnliche Standardmuster bauen, wenn `shadcn/ui` dafür geeignet ist
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

**UI-Standard ab sofort:**
- `shadcn/ui` ist der verbindliche Standard für neue UI-Entwicklung.
- Abweichungen sind nur mit dokumentierter Architekturentscheidung (ADR/gleichwertig) zulässig.

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

## 5.2 Shift-Left Test-Gates (verbindlich)

### ✅ REQUIRED
- Tests müssen während der Implementierung in kleinen Schritten ausgeführt werden, nicht erst kurz vor PR-Erstellung.
- Nach jedem abgeschlossenen Änderungsblock (Feature, Refactoring, Bugfix) sind mindestens die betroffenen Unit-Tests sofort auszuführen.
- Vor jedem Push muss ein schneller lokaler Gate-Lauf für betroffene Projekte erfolgen.
- Vor dem Commit ist sicherzustellen, dass neue oder geänderte Logik durch Tests abgedeckt ist.
- Verifikation muss den kleinsten relevanten echten Gate-Pfad bevorzugen, nicht pauschal den größten Lauf.

### ❌ FORBIDDEN
- „Big-bang“-Validierung erst am Ende der Umsetzung.
- Mehrere inhaltliche Änderungen ohne Zwischenlauf der betroffenen Tests zu stapeln.
- Pushes, bei denen bekannte lokale Testfehler ignoriert werden.

### Process
1. Implementiere eine kleine, in sich geschlossene Änderung.
2. Führe sofort zielgerichtete Tests aus (affected, Projekt oder Datei).
3. Erst bei grünem Zwischenstand mit dem nächsten Änderungsblock weitermachen.
4. Vor Push mindestens den schnellen Gate-Lauf ausführen:
  - `pnpm nx affected --target=test:unit --base=origin/main`
  - zusätzlich bei Bedarf `pnpm nx affected --target=test:types --base=origin/main`
5. Wenn die Änderung Skripte, CI-Wrapper oder Workspace-Tooling betrifft, zusätzlich den Skript-Typecheck ausführen:
  - `pnpm exec tsc -p tsconfig.scripts.json --noEmit`
  - oder den passenden Sammel-Wrapper wie `NX_BASE=origin/main pnpm test:types:affected`
6. Vor PR weiterhin vollständige Qualitätsprüfung gemäß Abschnitt 5 und 5.1.

### Enforcement
- Reviews können zurückgestellt werden, wenn eine Änderung ohne erkennbaren Shift-left-Testnachweis eingereicht wird.
- Wiederholte späte Test-Fails gelten als Prozessabweichung und müssen mit konkreter Gegenmaßnahme im PR dokumentiert werden.

## 5.2a Robuste Handler-Tests für Auth-, Session- und Permission-Logik (verbindlich)

### ✅ REQUIRED
- Handler-Tests in auth-, session- oder permission-kritischen Modulen müssen vollständige, wiederverwendbare Test-Fixtures oder Builder verwenden, wenn dieselben Runtime-Dependencies in mehreren Dateien vorkommen.
- Neue Pflicht-Dependencies in sicherheitsrelevanten Handlern müssen an einer gemeinsamen Test-Factory oder einem gemeinsamen Test-Builder nachgezogen werden, nicht nur in einzelnen Ad-hoc-Testobjekten.
- Guard-Verhalten und Business-Verhalten sind in Tests klar zu trennen:
  - Guard-Tests prüfen fehlende Session, fehlende Permission, CSRF und vergleichbare Fail-Closed-Pfade gezielt.
  - Business-Flow-Tests laufen mit explizit gültigem Auth-/Session-/Permission-Kontext.
- Bei Änderungen an Guard-, Session- oder Permission-Semantik ist vor Push mindestens der kleinste CI-nahe affected-Unit-Lauf für das betroffene Projekt auszuführen.

### ❌ FORBIDDEN
- Wiederholte dateilokale `createDeps()`- oder Inline-Mock-Muster für dieselben sicherheitsrelevanten Handler-Abhängigkeiten, wenn dafür bereits gemeinsame Test-Fixtures existieren oder erforderlich sind.
- Business-Flow-Tests implizit von fehlenden oder nur teilweise gemockten Auth-/Session-/Permission-Dependencies abhängig zu machen.
- Guard-Änderungen ausschließlich mit Einzeldatei-Tests freizugeben, wenn das betroffene Projekt mehrere Handler- oder Branch-Tests über denselben Guard-Pfad besitzt.

### Ziel der Regel
- Wiederkehrende CI-Ausfälle nach Guard- oder Session-Änderungen früh abfangen.
- Fehlende Pflicht-Dependencies in Tests zentral statt verteilt pflegen.
- Fail-Closed-Semantik absichtlich testen, statt sie nur indirekt über unerwartete `503`-Antworten zu entdecken.

## 5.3 Test-Dateiplatzierung und Ownership (verbindlich)

### ✅ REQUIRED
- Neue modulnahe Unit-Tests in Workspace-Packages liegen standardmäßig kolokiert unter `packages/<projekt>/src/**/*.test.ts` oder `*.test.tsx`.
- Neue modulnahe App-Tests liegen standardmäßig kolokiert unter `apps/<app>/src/**/*.test.ts` oder `*.test.tsx`.
- `packages/<projekt>/tests/` ist ausschließlich für paketweite Integrations-, Contract-, Composition- oder Public-API-Tests zu verwenden, die bewusst mehrere Module eines Projekts gemeinsam prüfen.
- `apps/<app>/tests/integration/` ist für appweite Integrations-Tests zu verwenden, zum Beispiel Router-, Provider-, Auth- oder zusammengesetzte Screen-Flows ohne echten Browser.
- `apps/<app>/e2e/` ist ausschließlich für echte Browser-, End-to-End- und Systemtests zu verwenden.
- Ein globaler Ordner wie `testing/` oder `tests/` auf Root-Ebene ist nur für gemeinsame Test-Infrastruktur zulässig, zum Beispiel Fixtures, Mocks, Test-Utils, Performance-Runner oder Smoke-Helfer.
- Neue Tests sind so abzulegen, dass Ownership eindeutig beim betroffenen Nx-Projekt bleibt und projektbezogene Läufe wie `pnpm nx run <projekt>:test:unit` nachvollziehbar bleiben.

### ❌ FORBIDDEN
- Normale Einzelmodul- oder Komponenten-Tests ohne Begründung aus `src/` in separate `tests/`-Ordner auszulagern.
- Fachliche Paket- oder App-Tests in einen globalen Root-Ordner `tests/` zu verschieben.
- Unit-, Integrations- und E2E-Tests innerhalb desselben Ordners semantisch zu vermischen.
- Neue verstreute Top-Level-Testordner pro Fachthema einzuführen, wenn die Tests einem bestehenden Nx-Projekt zugeordnet werden können.

### Process
1. Prüfe zuerst die Testart: modulnaher Unit-Test, paketweite Integration, appweite Integration oder E2E.
2. Lege modulnahe Tests direkt neben dem getesteten Code in `src/` ab.
3. Verwende `packages/<projekt>/tests/` nur dann, wenn der Test bewusst Projektgrenzen innerhalb desselben Pakets zusammensetzt.
4. Verwende `apps/<app>/tests/integration/` für App-Komposition ohne echten Browser.
5. Verwende `apps/<app>/e2e/` nur dann, wenn ein echter Browser, ein echter Laufzeitpfad oder ein vollständiger User-Flow geprüft wird.
6. Bestehende Altstruktur darf vorerst bestehen bleiben; bei neuen Tests gilt diese Regel als Standard.

### Enforcement
- Reviews können neue Tests zurückweisen, wenn deren Ablage die Testart verschleiert oder Ownership zwischen Projekten unklar macht.
- Strukturausnahmen sind im PR kurz zu begründen, insbesondere wenn ein neuer Test nicht dem Standardpfad für seine Testart folgt.

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
- **Server-Code**: Server-Runtime-Logger verwenden (`createSdkLogger` aus `@sva/server-runtime`)
- **Produktiver Browser-App-Code**: Runtime-sicheren Browser-Logger aus dem passenden Zielpackage verwenden; rohe `console.*`-Aufrufe vermeiden
- **Strukturierte Logs**: Immer mit Context-Feldern (component, operation, error, etc.)
- **PII-Schutz**: Keine Session-IDs, Tokens, tokenhaltigen URLs oder Emails direkt loggen
- **Component-Labels**: Jeder Logger braucht eindeutigen `component` (z.B. `auth`, `auth-redis`)
- **Error-Context**: Bei Errors immer `error`, `error_type`, `operation` mitloggen
- **Development-Modell**: Console und lokale Dev-Konsole sind die primären Diagnosekanaele; OTEL ist in Development nur ein zusaetzlicher Kanal bei erfolgreicher Initialisierung
- **Production-Modell**: Console und Dev-Konsole sind aus; produktives Server-Logging laeuft ueber OTEL
- **Privacy-by-Default**: Pseudonyme technische IDs wie `session_user_id`, `db_keycloak_subject` oder `actor_account_id` gelten ebenfalls als personenbeziehbar und dürfen nur bei echter Betriebsnotwendigkeit geloggt werden
- **Auth-Modell**: `/auth/me` liefert nur den minimalen Auth-Kern; Name und E-Mail gehören in dedizierte Profil-/Sync-Flows

### ❌ FORBIDDEN
- `console.log/info/warn/error` in Production-Server-Code
- Session-IDs, Access-Tokens, Refresh-Tokens in Klartext
- Logout- oder Redirect-URLs mit `id_token_hint`, `code`, `access_token` oder vergleichbaren Query-Parametern im Logging
- Unstrukturierte Error-Messages ohne Context
- Logs ohne `component`-Label

### ✅ APPROVED - Frontend Dev-Only Logs
Frontend darf `console.*` nutzen, aber:
- Nur in Development
- Mit strukturierten Feldern `{ component, endpoint, status, error }`
- Keine PII, Tokens oder tokenhaltigen URLs
- Die lokale Dev-Konsole darf Browser- und redaktierte Server-Logs anzeigen, aber nie als produktiver Monitoring-Ersatz behandelt werden
- Tests, Dev-Capture-Implementierungen und Einweg-Skripte dürfen `console.*` weiterhin direkt nutzen

**Backend-Beispiel:**
```typescript
import { createSdkLogger } from '@sva/server-runtime';

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

## 10. Translation Key Management

### Required Outcome
- Neue Übersetzungsschlüssel müssen in den tatsächlich verwendeten Übersetzungsressourcen des betroffenen Apps oder Pakets ergänzt werden.
- Für neue UI-Texte sind immer beide Zielsprachen zu pflegen.
- Veraltete oder ungenutzte Schlüssel sollen bei passenden Änderungen mit bereinigt werden.

### Recommended Process
1. Suche die tatsächliche Übersetzungsquelle des betroffenen Apps oder Pakets.
2. Ergänze neue Schlüssel dort in `de` und `en`.
3. Prüfe die Verwendung mit den betroffenen Unit- oder UI-Tests statt mit einem separaten Legacy-Skript.

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
