# Interoperability & Data Review – Template

Nutze dieses Template für Interop-/Daten-Reviews. Fokus: Versionierung, Migration, Standards.

## Entscheidung
- Bewertung: [hoch | mittel | niedrig]
- Begründung (1–2 Sätze):

## Executive Summary (3–5 Punkte)
- Punkt 1
- Punkt 2
- Punkt 3

## Befundübersicht
| ID | Thema | Schwere | Bereich | Evidenz |
|---:|-------|---------|---------|---------|
| I1 | …     | 🔴/🟡/🟢 | API/Schema | Link/Zitat |

## Detail-Findings
### I1 – Kurztitel
- Beschreibung: …
- Impact/Risiko (Vendor-Wechsel, Datenverlust): …
- Evidenz/Quelle: (OpenAPI/Schema/Dumps)
- Referenzen: FIT, Interoperabilität-Specs
- Empfehlung/Abhilfe: …

## Checkliste (Status)
- [ ] API-Versionierung + Deprecation-Policy dokumentiert
- [ ] Backward-Compatibility nachgewiesen (Contract-/Consumer-Tests)
- [ ] Vollständiger Import/Export (inkl. Assets/Metadaten)
- [ ] Offene Standards (JSON Schema, OpenAPI, DCAT, o.ä.)
- [ ] Exit-Plan (vollständiger Dump + Wiederherstellung)
- [ ] Schema-Evolution/Migrationen dokumentiert

## Anhänge
- Eingesetzte Inputs: (OpenAPI, Schemas, Export-Dumps)