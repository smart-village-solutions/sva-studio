# Architecture Review – Template

Nutze dieses Template für Architektur-Reviews. Triff eine klare Entscheidung und belege Abweichungen.

## Entscheidung
- Entscheidung: [konform | kritisch | Abweichung]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)
- Punkt 1
- Punkt 2
- Punkt 3

## Befundübersicht
| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|
| A1 | …     | 🔴/🟡/🟢 | Modul/API | Link/Zitat |

## Detail-Findings
### A1 – Kurztitel
- Beschreibung: …
- Impact/Risiko (Lock-in, Komplexität, Wartbarkeit): …
- Evidenz/Quelle: (Diagramm/ADR/Code/Stubs)
- Referenzen: FIT, Governance-Nachhaltigkeit, ADRs
- Empfehlung/Abhilfe: …
- ADR nötig? [Ja/Nein] – Thema: …

## Checkliste (Status)
- [ ] API-first/Headless eingehalten
- [ ] Klare Modulgrenzen/Entkopplung
- [ ] Offene Standards bevorzugt
- [ ] Cloud-Portabilität (kein Hard-Lock-in)
- [ ] Skalierbarkeit/Zukunftsfähigkeit
- [ ] Relevante arc42-Abschnitte unter `docs/architecture/` aktualisiert/verlinkt (oder Abweichung begründet)
- [ ] Bei IAM-, Rollen-Sync-, ABAC/RBAC- oder Data-Subject-Rights-Änderungen sind Abschnitt 04, 05, 06 und 08 geprüft und konsistent
- [ ] Neue oder geänderte IAM-Patterns haben eine ADR und einen Verweis in Abschnitt 09

## Anhänge
- Eingesetzte Inputs: (Diagramme, ADRs, Specs)
- Abweichungen von FIT (Liste)
