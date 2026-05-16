## Kontext

Für die bestehende Admin-Oberfläche existieren selektorbasierte Playwright-E2E-Tests und ein separater IAM-Acceptance-Runner. Die neue Stagehand-Schicht soll diese Ebenen nicht ersetzen, sondern eine zusätzliche lokale Explorationsschicht für reale Rollen-, Rechte- und Benutzerverwaltungsflüsse bereitstellen.

## Ziele / Nicht-Ziele

- Ziele:
  - lokale agentische Exploration echter Admin-IAM-Pfade
  - saubere Trennung von deterministischen Gates
  - ausbaufähiges Missionsmodell
  - nachvollziehbare Artefakte pro Lauf
- Nicht-Ziele:
  - kein Ersatz der Playwright-Smokes
  - kein CI-blockendes Gate
  - keine aggressive Mutation produktionsnaher IAM-Daten im Pilot

## Entscheidungen

- Decision: Eigenes Nx-Target statt Integration in `test:e2e` oder `test:acceptance`
  - Why: minimiert Flake-Risiko und hält Qualitätsgates stabil
- Decision: Missionsmodell unter `apps/sva-studio-react/stagehand/`
  - Why: klare Trennung zwischen Runtime, Missionen, Assertions und Reporting
- Decision: Pilot mit read-mostly Admin-Missionen
  - Why: reduziert Risiko schwer reproduzierbarer lokaler IAM-Mutationen
- Decision: Wiederverwendung vorhandener lokaler Acceptance-Verträge für Base-URL und Credentials, wo sinnvoll
  - Why: verhindert konkurrierende lokale Konfigurationsmodelle

## Risiken / Trade-offs

- LLM-Varianz führt zu weniger Determinismus
  - Mitigation: nicht CI-blockend, feste Missionen, harte Minimal-Asserts
- Reale lokale IAM-Daten können in unerwartete Zustände geraten
  - Mitigation: dedizierte Testidentitäten, read-mostly Pilot, klare Guardrails
- Neue externe Dependency erhöht Setup-Komplexität
  - Mitigation: enger lokaler Env-Vertrag und fokussierte Dokumentation

## Migration Plan

1. Capability und Dokumentationsgrenzen festlegen
2. Runtime und Reporting einführen
3. Drei Pilot-Missionen ergänzen
4. Lokale Nutzung dokumentieren
5. Später kontrolliert auf Mutationsflüsse und weitere Domänen erweitern

## Open Questions

- Welche Stagehand-API-Oberfläche ist für lokale Exploration im Repo am robustesten?
- Sollen Missionen einzeln per Argument oder gesammelt über eine Registry ausführbar sein?
- Welche Artefakte werden langfristig als Minimum für Team-Reviews benötigt?
