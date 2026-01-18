# 📚 Dokumentation – Übersicht

Zentrale Navigation durch alle Dokumentation des SVA Studio Projekts.

## 📁 Hauptkategorien

### 🎯 **Project Setup & Architecture**
- [README.md](../README.md) – Projekt-Übersicht
- [CONTRIBUTING.md](../CONTRIBUTING.md) – Contribution Guide
- [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md) – **[BINDEND]** Entwicklungs-Standards
- [specs/](../specs/) – Capability Specifications

### 🔍 **Review & Audit Reports**
📌 **[Zentrale Review-Navigation →](./reviews/README.md)**

Alle Audit-Ergebnisse von Agenten:
- [Compliance Reviews](./reviews/compliance/)
- [Security & Architecture](./reviews/security/)
- [Accessibility (WCAG 2.1)](./reviews/accessibility/)
- [Performance Analysis](./reviews/performance/)
- [Internationalization (i18n)](./reviews/i18n/)

### 📖 **Architecture & Design**
- [monorepo.md](./monorepo.md) – Monorepo-Struktur
- [routing.md](./routing.md) – TanStack Router Configuration
- [openspec/AGENTS.md](../openspec/AGENTS.md) – AI Agent Guidelines

### 🛠️ **Development Guides**
- [Design System](./DESIGN_TOKENS.md) – Design System Reference
- [i18n Setup](../apps/sva-studio-react/README.md#internationalization) – Translation Guide
- [Component Development](../apps/sva-studio-react/README.md#component-development) – Component Patterns

---

## ⚡ **Quick Navigation by Role**

### 👨‍💻 **Developers**
1. **Start here:** [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md)
2. **Setup:** [README.md](../README.md)
3. **Components:** [apps/sva-studio-react/README.md](../apps/sva-studio-react/README.md)
4. **Reviews:** [docs/reviews/](./reviews/README.md)

### 🏗️ **Architects**
1. **Architecture:** [monorepo.md](./monorepo.md)
2. **Specs:** [specs/](../specs/)
3. **Reviews:** [Security](./reviews/security/), [Performance](./reviews/performance/)
4. **Governance:** [specs/Governance-Nachhaltigkeit.md](../specs/Governance-Nachhaltigkeit.md)

### 📊 **Project Managers**
1. **Status:** [reviews/compliance/PHASE_1_IMPLEMENTATION_SUMMARY.md](./reviews/compliance/PHASE_1_IMPLEMENTATION_SUMMARY.md)
2. **Roadmap:** [openspec/](../openspec/)
3. **Audits:** [reviews/](./reviews/README.md)

### 🔒 **Security/Compliance Officer**
1. **DEVELOPMENT_RULES:** [rules/DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md)
2. **Security Review:** [reviews/security/](./reviews/security/)
3. **Accessibility:** [reviews/accessibility/](./reviews/accessibility/)

### 🚀 **DevOps/Deployment**
1. **Setup:** [README.md](../README.md)
2. **Performance:** [reviews/performance/](./reviews/performance/)
3. **Monorepo:** [monorepo.md](./monorepo.md)

---

## 📋 **Documentation Structure**

```
sva-studio/
├── docs/
│   ├── README.md                    ← Du bist hier
│   ├── monorepo.md                  ← Monorepo-Struktur
│   ├── routing.md                   ← Router-Config
│   ├── reviews/                     ← 📌 ALL AUDIT REPORTS
│   │   ├── README.md                ← Review Navigation
│   │   ├── compliance/              ← DEVELOPMENT_RULES, Phase Status
│   │   ├── security/                ← Security & Architecture
│   │   ├── accessibility/           ← WCAG 2.1 Audits
│   │   ├── performance/             ← Bundle Size, Speed
│   │   └── i18n/                    ← Internationalization
│   └── images/                      ← Screenshots, Diagrams
├── rules/
│   └── DEVELOPMENT_RULES.md         ← 🔴 BINDEND
├── specs/
│   ├── Governance-Nachhaltigkeit.md
│   ├── Nutzerfreundlichkeit.md
│   └── .../
├── openspec/
│   ├── AGENTS.md                    ← AI Guidelines
│   └── changes/
├── apps/
│   └── sva-studio-react/
│       └── README.md                ← App-spezifische Doku
├── README.md                        ← Projekt-Start
└── CONTRIBUTING.md                  ← Contribution Guide
```

---

## 🔄 **How to Add New Documentation**

### **Rule 1: Categorize Correctly**
```
Architecture decision? → docs/
Audit/Review output?  → docs/reviews/{category}/
Development guide?    → docs/ or app-specific README.md
```

### **Rule 2: Follow Naming**
```
✅ WCAG_IMPLEMENTATION_GUIDE.md
✅ PERFORMANCE_QUICK_START.md
✅ monorepo.md
❌ some_doc.md
❌ 2026-01-18_review.md (use in reviews/ category)
```

### **Rule 3: Update This Index**
After adding docs, add a link here and in relevant category README.

---

## 📚 **Key Documents You Must Know**

### 🔴 **Non-Negotiable**
1. [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md) – Absolute, enforced standards
2. [CONTRIBUTING.md](../CONTRIBUTING.md) – How to contribute

### 🟡 **Important References**
1. [monorepo.md](./monorepo.md) – Package structure
2. [specs/](../specs/) – What we're building
3. [openspec/AGENTS.md](../openspec/AGENTS.md) – AI instructions

### 🟢 **Reviews & Audits**
See [docs/reviews/README.md](./reviews/README.md) for complete index

---

## 🎯 **Common Tasks**

### "I want to start development"
1. Read: [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md)
2. Setup: [README.md](../README.md)
3. Code: [apps/sva-studio-react/README.md](../apps/sva-studio-react/README.md)

### "I need to understand the architecture"
1. [monorepo.md](./monorepo.md) – Overall structure
2. [specs/](../specs/) – Capabilities
3. [apps/sva-studio-react/README.md](../apps/sva-studio-react/README.md) – App-specific

### "Show me the audit results"
→ [docs/reviews/](./reviews/README.md)

### "How do I review code?"
1. [DEVELOPMENT_RULES.md](../rules/DEVELOPMENT_RULES.md) – Standards
2. [docs/reviews/compliance/](./reviews/compliance/) – Checklist

### "I'm making breaking changes"
1. [openspec/AGENTS.md](../openspec/AGENTS.md) – Create proposal
2. [CONTRIBUTING.md](../CONTRIBUTING.md) – Process

---

## 🔗 **External Links**

- **GitHub:** [smart-village-solutions/sva-studio](https://github.com/smart-village-solutions/sva-studio)
- **Notion/Wiki:** [Project documentation board]
- **Design System:** [Figma link]

---

**Letzte Aktualisierung:** 18. Januar 2026  
**Struktur:** Zentralisiert & navigierbar  
**Status:** ✅ Live
