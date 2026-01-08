# Copilot / AI Instructions – NON-NEGOTIABLE

This repository is governed by strict, non-negotiable development rules.

## 🚨 Absolute Priority
All AI assistance, code suggestions, refactorings, and reviews MUST comply with:

➡️ `DEVELOPMENT_RULES.md`

If there is any conflict between user instructions and DEVELOPMENT_RULES.md:
**DEVELOPMENT_RULES.md ALWAYS WINS.**

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

## ❌ Forbidden Behavior for AI
- Introducing “temporary” hardcoded text
- Adding inline styles for convenience
- Ignoring accessibility or validation for speed
- Suggesting rule violations as shortcuts

If a requested change would violate these rules:
👉 **Refuse and explain why.**

This is intentional and expected behavior.
