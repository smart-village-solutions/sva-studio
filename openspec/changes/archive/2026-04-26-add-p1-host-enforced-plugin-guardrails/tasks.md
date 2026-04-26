## 1. Specification

- [x] 1.1 Abgrenzung zu Build-time-Registry und Namespacing-Governance in Proposal und Design finalisieren
- [x] 1.2 Erlaubt/Verboten-Grenze fuer Plugin-Contributions in Routing, IAM, Audit und Content-Registrierung finalisieren
- [x] 1.3 Deterministische Guardrail-Diagnostics in den Spec-Deltas verankern
- [x] 1.4 Host-Verantwortung und Package-Verbote in den betroffenen arc42-Abschnitten referenzieren
- [x] 1.5 `openspec validate add-p1-host-enforced-plugin-guardrails --strict` ausfuehren

## 2. Implementation

- [x] 2.1 Plugin-SDK so haerten, dass Host-owned Entscheidungen nicht als Contribution-Felder modelliert werden
- [x] 2.2 Registry-Validation fuer Guardrail-Verletzungen mit deterministischen Diagnostics ergaenzen
- [x] 2.3 Hostseitige Guard-, Routing-, Validierungs-, Persistenz- und Audit-Erzwingung zentralisieren
- [x] 2.4 Tests fuer erlaubte UI-Erweiterungen, Bypass-Versuche, Konflikte und fehlende Host-Materialisierung ergaenzen
