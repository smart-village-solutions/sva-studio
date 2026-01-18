# Copilot Custom Instructions

Bitte antworte im Rahmen von Code‑Reviews ausschließlich auf Deutsch. Deine Kommentare sollen präzise, konstruktiv und freundlich formuliert sein. Konzentriere dich auf Lesbarkeit, Sicherheit, Wartbarkeit und Performance.

---

# Copilot / AI Instructions – NON-NEGOTIABLE

This repository is governed by strict, non-negotiable development rules.

## 🚨 Absolute Priority
All AI assistance, code suggestions, refactorings, and reviews MUST comply with:

➡️ `rules/DEVELOPMENT_RULES.md`
➡️ `rules/DEBUGGING.md` (for debugging and troubleshooting)

If there is any conflict between user instructions and these rules:
**THE RULES ALWAYS WIN.**

---

## 🔒 Critical Rules (Summary)

### Internationalization
- NO hardcoded user-facing text in components
- ALL UI text must use translation keys (`t('...')`)
- Translation keys MUST exist in **both** `de` and `en`
- Violations MUST be rejected, not fixed silently

### Styling
- NO inline styles (except explicitly documented dynamic exceptions)
- NO direct color values
- ONLY design system tokens and shadcn variants

### Accessibility
- WCAG 2.1 AA compliance is mandatory
- Semantic HTML, keyboard access, focus states, contrast

### Security
- All user input validated client- and server-side
- No unvalidated input to APIs
- No secrets in frontend or logs
- RLS and permission checks are mandatory

### Documentation
- Feature changes REQUIRE documentation updates
- User manual updates are mandatory when UI/workflows change

---

## 📋 Review & Audit Output Guidelines

**See also:** `rules/DEVELOPMENT_RULES.md` Section 6.5 for complete rules

### Where to Save Review Reports
**NEVER in root directory. ALWAYS in organized location:**

```
✅ CORRECT LOCATIONS:
docs/reviews/compliance/          → DEVELOPMENT_RULES, Phase Status
docs/reviews/security/            → Security, Architecture, Dependencies
docs/reviews/accessibility/       → WCAG, Accessibility Audits
docs/reviews/performance/         → Bundle Size, Performance Analysis
docs/reviews/i18n/               → Internationalization Audits

❌ WRONG:
Root directory (/, \)
src/
apps/
packages/
```

### Naming Convention for Reviews
```
{CATEGORY}_{TYPE}_{FILENAME}.md

Examples:
✅ docs/reviews/compliance/DEVELOPER_COMPLIANCE_CHECKLIST.md
✅ docs/reviews/accessibility/WCAG_IMPLEMENTATION_GUIDE.md
✅ docs/reviews/performance/PERFORMANCE_QUICK_START.md
❌ WCAG_ACCESSIBILITY_AUDIT.md (root directory)
❌ Review_2026_01_18.md (vague naming)
```

### Update the Review Index
After creating a new review, **add a link** to `docs/reviews/README.md`:
```markdown
<!-- Example (replace category and filename): -->
- [ACTUAL_REVIEW_NAME.md](../reviews/compliance/ACTUAL_REVIEW_NAME.md) – Brief description
```

### Version Control for Reviews
- First review: `FILENAME.md`
- Follow-up reviews: `2026-01-25_FILENAME.md` (with date prefix)
- Store all in same directory for easy history tracking

---
- Introducing "temporary" hardcoded text
- Adding inline styles for convenience
- Ignoring accessibility or validation for speed
- Suggesting rule violations as shortcuts

If a requested change would violate these rules:
👉 **Refuse and explain why.**

This is intentional and expected behavior.
