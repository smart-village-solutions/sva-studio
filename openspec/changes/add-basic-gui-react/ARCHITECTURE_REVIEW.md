# Architecture Review: add-basic-gui-react

**Reviewed:** 18. Januar 2026
**Reviewer:** Architecture & FIT Compliance Agent
**Status:** ⚠️ **APPROVED WITH CRITICAL REQUIREMENTS**

---

## Executive Summary

Der Change `add-basic-gui-react` ist architektonisch **konform** mit den Paket-Architektur-Richtlinien und dem Framework-Agnostik-Ziel. Die Spezifikationen sind gut strukturiert und folgen klaren Szenarien.

**Jedoch:** Es gibt **3 kritische Anforderungen**, die OHNE Verhandlung in die Implementierung integriert werden MÜSSEN.

---

## 1. Architektur-Bewertung

### ✅ KONFORM: SDK-First Ansatz
- Layout-Komponenten importieren AUSSCHLIESSLICH aus `@cms/sdk`, `@cms/app-config`, `@cms/ui-contracts`
- Keine direkten Plugin-Importe
- Navigation wird über Registry geladen (registries-driven UI) ✅
- Sidebar und Header sind generisch und framework-agnostisch ✅

**Zitat aus Spec (layout/spec.md):**
> "Layout imports from SDK, not host-specific modules: ...they import only from `@cms/sdk`, `@cms/app-config`, and `@cms/ui-contracts`, never from `apps/sva-studio-react/src/routes` or internal host logic"

**Bewertung:** Korrekt. Das ist der richtige Weg für Framework-Agnostik.

---

### ✅ KONFORM: Modulgrenzen & Entkopplung
- Klarheit: `apps/sva-studio-react/` ist explizit Framework-spezifisch
- Zukünftige `apps/sva-studio-vue/` wird identischen SDK nutzen
- Keine Vermischung von Business Logic und UI-Rendering
- Registry-Pattern ermöglicht Plugin-Isolation

**Bewertung:** Architektur unterstützt cleanly die Trennung.

---

### ⚠️ KRITISCH: Internationalisierung (i18n) – NICHT OPTIONAL
Der Change erwähnt "Language Selector" und "language preference", aber:

- **KEINE Anforderung** für Translation Keys in Specs
- **KEINE Anforderung** für die Nutzung von `t()` Funktion
- **RISIKO:** Hardcoded "Deutsch", "English" im LanguageSelector

**LAUT DEVELOPMENT_RULES (2.1. Text & Data Management):**
> "ALWAYS use translation keys - no exceptions for 'quick fixes' or 'temporary solutions'"
> "All UI texts must be loaded from the database via the translation system"
> "Hardcoded text strings in components: absolutely forbidden"

**Was MUSS hinzugefügt werden:**

```markdown
### Requirement: i18n Integration in Header (ADDED)
All header labels and user-facing text (search placeholder, language names, theme labels)
SHALL use the translation system via i18n keys, not hardcoded strings.

#### Scenario: Header text is translated
- **WHEN** the header renders
- **THEN** all labels (search placeholder, language selector label, theme toggle label)
  use translation keys from the i18n system

#### Scenario: Language names are translatable
- **WHEN** language dropdown displays "Deutsch" and "English"
- **THEN** these are fetched from translations, not hardcoded
```

**Action:** Requirement muss in `specs/header/spec.md` HINZUGEFÜGT werden vor Approval.

---

### ⚠️ KRITISCH: Permissions/RBAC Integration

Der Change erwähnt im Navigation Spec:
> "Navigation items SHALL respect user permissions; menu items for which the user lacks capabilities SHALL be hidden."

Aber:

- **KEINE Anforderung** für Auth-Context Integration
- **KEINE Anforderung** für `@cms/auth` Paket-Nutzung
- **KEINE Szenarien** für RBAC-Enforcement

**Was MUSS hinzugefügt werden:**

```markdown
### Requirement: RBAC-Based Navigation Filtering (MODIFIED in navigation/spec.md)
[Bestehender Text + neuer Absatz:]

The sidebar SHALL integrate with the `@cms/auth` package to enforce permissions
on all navigation items. No menu item SHALL be rendered if the current user lacks
the required capability.

#### Scenario: Navigation items filtered by capability
- **WHEN** the sidebar initializes
- **THEN** it calls `canAccess(user, navigationItem.capability)` for each item
- **AND** only items with `true` return value are rendered

#### Scenario: Auth context provides user capabilities
- **WHEN** sidebar renders
- **THEN** user permissions come from a centralized auth context, not local state
```

**Action:** Requirement muss in `specs/navigation/spec.md` klargestellt werden.

---

### ⚠️ KRITISCH: Design System & Styling (CSS Modules)

Die Spec sagt:
> "Layout uses CSS modules for styling (not Tailwind classes) for easy framework migration"

Aber das steht im Konflikt mit:

1. **Paketarchitektur-Vorgabe:** `packages/ui-contracts` definiert Design Tokens als Zentrale Quelle
2. **DEVELOPMENT_RULES:** Tailwind mit Semantic Tokens ist Standard
3. **Framework-Agnostik:** Reine CSS Modules sind gut, aber brauchen Token-Abstraktion

**Was MUSS geklärt werden:**

```markdown
### Requirement: Design System Compliance (MODIFIED)
The layout components SHALL use CSS Modules for styling, but MUST source
all colors, spacing, and typography from `@cms/ui-contracts` design tokens.

#### Scenario: CSS Modules reference design tokens
- **WHEN** RootLayout.module.css is imported
- **THEN** it imports design token variables from @cms/ui-contracts
- **AND** does NOT use hardcoded colors or spacing values

Example:
```css
/* RootLayout.module.css */
@import '@cms/ui-contracts/design-tokens.css';

.sidebar {
  background-color: var(--color-sidebar-bg);  /* From tokens, not hardcoded */
  padding: var(--spacing-md);                 /* From tokens */
}
```
```

**Action:** Clarify in `specs/layout/spec.md` how CSS Modules source design tokens.

---

## 2. Technische Schulden & Langzeitrisiken

### 🔴 **Schuld 1: Fehlende Auth-Context Spezifikation**
- **Problem:** Header user menu braucht auth-Context, aber nicht spezifiziert
- **Risiko:** Implementierung könnte Auth-Logik direkt in Header hardcoden
- **Lösung:** Requirement für Auth-Provider Context ergänzen
- **Timeline:** MUSS vor Implementierung gelöst sein

### 🔴 **Schuld 2: localStorage für State (Theme, Sidebar Collapse)**
- **Problem:** Spec empfiehlt localStorage für User Preferences
- **Risiko:** Multi-Device Support bricht (User kollaboriert auf 2 Geräten)
- **Besser:** Backend-basierte User Preferences via `@cms/data` Paket
- **Lösung:** Requirement anpassen: "...stored in user profile (backend), not localStorage"
- **Timeline:** MUSS vor Implementierung geklärt sein

### 🟡 **Schuld 3: Search-Bar ist Placeholder**
- **Problem:** Search Bar hat keine Implementation Spec
- **Risiko:** Integration mit `@cms/search-client` (MeiliSearch) ist unklar
- **Lösung:** Optional für MVP: Search-Bar nur als UI-Platzhalter (disabled),
  echte Integration in separatem Change
- **Empfehlung:** In `proposal.md` dokumentieren: "Search functionality implemented in Phase 2"

---

## 3. Vendor-Lock-in Analyse

### ✅ KEIN Vendor-Lock-in
- Keine direkten React-Hooks im SDK (nur Registry Pattern)
- CSS Modules sind Framework-agnostisch
- localStorage kann durch Backend-sync ersetzt werden
- Keine Hard-Dependency auf Tailwind (können zu Vue CSS Modules wechseln)

**Fazit:** Architektur ermöglicht saubenen Wechsel zu Vue.

---

## 4. Standards & Offenheit

### ✅ Offene Standards
- Semantic HTML für Accessibility
- CSS Modules (CSS Standard)
- REST/GraphQL für Daten (via `@cms/data`)
- Registry Pattern (nicht proprietär)

**Bewertung:** Gut. Keine proprietären Frameworks.

---

## 5. Skalierbarkeit & Zukunftsfähigkeit

### ✅ Responsive Design
- Spec erwähnt Mobile Collapse (768px breakpoint) ✅
- Keine Hardcoded Viewport Assumptions

### ⚠️ Performance (nicht in Scope, aber beachten)
- Navigation Registry könnte bei 1000+ Menu Items langsam werden
- **Empfehlung für Zukunft:** Lazy Loading / Pagination für tiefe Menüs

### ✅ Multi-Tenancy Ready
- Theme Selector ist Tenant-agnostisch
- Language Selector unterstützt Multiple Sprachen
- Navigation Registry kann per-Tenant konfiguriert werden

---

## 6. DEVELOPMENT_RULES Compliance

| Rule | Compliance | Status |
|------|-----------|--------|
| **Text & Data:** Translation Keys obligatorisch | ❌ **NICHT in Spec** | 🔴 CRITICAL |
| **CSS:** Design System + Tailwind/CSS Modules | ⚠️ **Unklar ob Tokens genutzt** | 🔴 CRITICAL |
| **Accessibility:** WCAG 2.1 AA | ⚠️ **Erwähnt aber nicht spezifiziert** | 🟡 SHOULD |
| **Security:** Auth/Permissions | ❌ **NICHT spezifiziert** | 🔴 CRITICAL |
| **No Hardcoding:** UI-Strings | ❌ **NICHT erwähnt** | 🔴 CRITICAL |

---

## 7. Erforderliche ADRs

Nach Approval muss FOLGENDES dokumentiert werden:

### ADR-001: Theme & Language Persistence Strategy
- **Frage:** localStorage vs. Backend User Profile?
- **Entscheidung:** Backend-Preference (RDB User Settings)
- **Impact:** Alle User-Preferences zentral, Multi-Device Support

### ADR-002: CSS Module Design System Integration
- **Frage:** Wie sourced CSS Modules die Design Tokens?
- **Entscheidung:** @cms/ui-contracts exportiert CSS Variable Sheets
- **Impact:** Framework-unabhängige Token, Vue-kompatibel

### ADR-003: Auth Context Architecture
- **Frage:** Wo lives der Auth-Context? Welche Package?
- **Entscheidung:** Neuer `@cms/auth-context` Package mit React Hooks + Vue Composables
- **Impact:** Plugins können Auth auch nutzen

---

## 8. Empfehlung: AKZEPTIEREN mit Bedingungen

### ✅ APPROVE mit REQUIREMENTS:

**Vor Implementierung MÜSSEN folgende Requirements hinzugefügt/geklärt werden:**

1. **i18n Integration (CRITICAL):**
   - Header labels MÜSSEN Translation Keys nutzen
   - Language Names MÜSSEN aus Translations kommen
   - Hinzufügen: `specs/header/spec.md` → "i18n Integration in Header" Requirement

2. **RBAC/Auth Integration (CRITICAL):**
   - Navigation Items MÜSSEN gegen User Capabilities gefiltert werden
   - Auth-Context MUSS spezifiziert sein
   - Hinzufügen: `specs/navigation/spec.md` → "Auth-Based Navigation Filtering" Requirement

3. **Design System Sourcing (CRITICAL):**
   - CSS Modules MÜSSEN Design Tokens aus `@cms/ui-contracts` nutzen
   - KEINE hardcoded Farben/Spacing
   - Clarify: `specs/layout/spec.md` → "Framework-Agnostic Layout Structure" erweitern

4. **User Preferences Storage (HIGH):**
   - Theme Preference → Backend User Settings (nicht localStorage)
   - Sidebar State → Backend User Settings (nicht localStorage)
   - Modify: `specs/header/spec.md` + `specs/layout/spec.md` → "Theme/Sidebar preference" Requirement aktualisieren

5. **Auth Context Documentation (MEDIUM):**
   - Wo liegt der Auth-Context?
   - Welche Signale / Hooks sind verfügbar?
   - Hinzufügen: neuer `specs/auth-context/spec.md` oder im proposal.md dokumentieren

6. **Search Bar Scope (MEDIUM):**
   - Ist Search-Bar ein MVP Feature oder Placeholder?
   - Wenn Placeholder: markieren als "Phase 2: Full-Text Search Integration"
   - Clarify: `proposal.md` → Implementation Order erweitern

---

## 9. Abweichungen dokumentieren

### Akzeptierte Abweichungen (mit Begründung):

**Keine Abweichungen, die ich akzeptieren würde ohne Klarstellung.**

Alle 3 kritischen Punkte (i18n, RBAC, Design System) sind **NICHT optional** per DEVELOPMENT_RULES.

---

## Checkliste für Implementierung

- [ ] i18n Requirements hinzufügen (specs/header/spec.md)
- [ ] Auth/RBAC Requirements klarstellen (specs/navigation/spec.md)
- [ ] Design Token Sourcing dokumentieren (specs/layout/spec.md)
- [ ] Preference Storage Strategy aktualisieren (Backend statt localStorage)
- [ ] Auth-Context Spezifikation (separater Spec oder in proposal.md)
- [ ] Search Bar Scope klären (MVP vs. Phase 2)
- [ ] Validation durchführen: `openspec validate add-basic-gui-react --strict`
- [ ] ADRs schreiben nach Approval
- [ ] Code-Review Checklist für Implementier:
  - [ ] Keine hardcoded Text Strings
  - [ ] Alle Labels nutzen `t()` Function
  - [ ] Alle Colors/Spacing aus Design Tokens
  - [ ] Auth Context wird genutzt für Permissions
  - [ ] WCAG 2.1 AA Compliance (semantic HTML, keyboard nav, focus management)

---

## Fazit

**Architekturbewertung:** ✅ **KONFORM** (mit Bedingungen)

Der Change ist strategisch richtig (SDK-First, Framework-Agnostik, Modulgrenzen).

**JEDOCH:** Es gibt **3 NICHT VERHANDELBARE Lücken**, die gegen DEVELOPMENT_RULES verstoßen:

1. ❌ Keine i18n-Spezifikation (violiert Rule 2.1)
2. ❌ Keine Auth-Integration (violiert Rule für Security)
3. ❌ Design System Sourcing unklar (violiert Rule 3)

**Empfehlung:**

**👉 APPROVE mit der Bedingung, dass diese 3 Punkte geklärt werden BEVOR Implementierung startet.**

**Status:** 🟡 **PENDING CLARIFICATION** → (nach Fixes) ✅ **READY TO IMPLEMENT**

---

**Nächste Schritte:**

1. Mit Change-Owner Review durchführen (diese Punkte besprechen)
2. Requirements updaten
3. `openspec validate --strict` erneut laufen
4. Review-Approval einholen
5. Implementierung starten

---

Erstellt: 18. Januar 2026
Architektur-Reviewer: AI Agent (Mode: Architecture & FIT Compliance)
