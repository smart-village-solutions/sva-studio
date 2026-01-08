# Security & Privacy Review – Template

Nutze dieses Template für jedes Review. Fülle alle relevanten Abschnitte aus und treffe eine klare Merge-Empfehlung.

## Entscheidung
- Entscheidung: [Merge-OK | Merge-Blocker | Merge mit Auflagen]
- Begründung (1-2 Sätze):

## Executive Summary (3–5 Punkte)
- Punkt 1
- Punkt 2
- Punkt 3

## Risikoübersicht
| ID | Titel | Schwere | CVSS (falls zutreffend) | Betroffene Bereiche | Evidenz |
|---:|-------|---------|-------------------------|---------------------|---------|
| R1 | …     | 🔴/🟡/🟢 | 8.1 (High)              | Auth, API           | Link/Zitat |

Legende: 🔴 Kritisch (Merge-Blocker), 🟡 Mittel (mit Auflagen), 🟢 OK

## Detail-Findings
### R1 – Kurztitel
- Beschreibung: …
- Impact/Risiko: …
- Evidenz/Quelle: (z. B. PR-Diff, Scan-Report, Log-Auszug)
- Referenzen/Normen: (z. B. DSGVO Art. 25/32, BSI, OWASP ASVS)
- Empfehlung/Abhilfe: …
- Fix-Aufwand (Schätzung): [niedrig | mittel | hoch]
- Owner & Fälligkeitsdatum: …

### R2 – Kurztitel
- …

## Checkliste (Status)
- [ ] Authentifizierung & Autorisierung (RBAC/ABAC, Session-Handling, MFA)
- [ ] Secrets-Handling (kein Hardcoding, Rotation, Secret-Manager)
- [ ] Kryptografie (TLS-Versionen, at-rest-Encryption, KMS)
- [ ] Logging & Audit (Unveränderlichkeit, PII-Minimierung, Retention)
- [ ] Datenschutz (PbD/Default, Datensparsamkeit, Löschkonzepte)
- [ ] Dependencies & SBOM (CVE-Schwellen, Updates, Policy)
- [ ] SAST/DAST/Container-Scan (Berichte geprüft)
- [ ] Infra/Config (Least Privilege, sichere Defaults)

## Auflagen (falls „Merge mit Auflagen“)
- Maßnahme | Verantwortlich | Frist | Nachweisart
- …

## ADR / Risikoakzeptanz
- ADR erforderlich? [Ja/Nein] – Thema: …
- Risikoakzeptanz notwendig? [Ja/Nein] – Entscheidungsträger: …

## Anhänge
- Eingesetzte Inputs: (PR-Diff, Lockfiles, SBOM, Reports)
- Scope/Out-of-Scope: …
- Änderungen seit letztem Review: …
