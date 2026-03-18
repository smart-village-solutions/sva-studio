# Change: Verbindliche Komplexitäts- und Qualitätskontrolle für zentrale Module

## Why

Bisher bewertet der Workspace Qualität vor allem über Linting, Tests und Coverage. Für zentrale Module wie IAM-Server, Routing und Security fehlt jedoch eine verbindliche, automatisierte Steuerung von struktureller Komplexität.

Dadurch wachsen kritische Hotspots potenziell unbemerkt: Dateien werden größer, Funktionen länger, Cyclomatic Complexity steigt und öffentliche API-Oberflächen fransen aus. Ohne nachvollziehbare Grenzwerte und verpflichtende Folgeaktionen entstehen technische Schulden genau dort, wo Ausfall- und Sicherheitsrisiken am höchsten sind.

## What Changes

- Einführung einer neuen Capability `complexity-quality-governance`
- Automatische Erfassung und Auswertung von Komplexitätsmetriken für zentrale Module:
  - Dateigröße
  - Funktionslänge
  - Cyclomatic Complexity
  - Anzahl öffentlicher Exports
- Verbindliche Einstufung zentraler und kritischer Module mit dokumentierten, versionierten Schwellwerten
- Pflichtprozess für Überschreitungen:
  - Quality-Report benennt Metrik, Ist/Soll-Wert und betroffenes Modul
  - Überschreitungen führen zwingend zu verlinkten Refactoring-Aufgaben/Tickets
- Erweiterung der Coverage-Governance:
  - kritische Module behalten Mindest-Coverage
  - steigende Komplexität darf Coverage-Floors nicht senken
  - Coverage-Regeln sollen bei Bedarf feiner granuliert oder angehoben werden

## Out of Scope

- Keine Einführung eines vollständigen Maintainability-Index oder proprietärer SaaS-Qualitätsplattformen
- Keine sofortige harte Blockade aller historischen Überschreitungen ohne Baseline- und Rollout-Konzept
- Keine Ablösung bestehender Coverage-Gates, sondern gezielte Ergänzung

## Impact

- **Affected specs**:
  - `complexity-quality-governance` (neu)
  - `test-coverage-governance` (MODIFIED)
- **Affected code/config**:
  - Quality-/Policy-Konfiguration für Modulklassen und Schwellwerte
  - CI-/Nx-Targets oder Skripte zur Metrik-Erfassung und Auswertung
  - PR-Reporting und Ticket-/Follow-up-Prozess
  - Dokumentation für Qualitätsregeln und Refactoring-Nachverfolgung
- **Affected arc42 sections**:
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
  - `docs/architecture/11-risks-and-technical-debt.md`

## Success Criteria

- Für definierte zentrale Module wird in CI und lokal ein reproduzierbarer Komplexitätsreport erzeugt.
- Für jede überwachte Metrik existieren dokumentierte, reviewbare Grenzwerte mit Begründung.
- Überschreitungen erzeugen keine stillen Warnungen, sondern einen verpflichtenden Refactoring-Nachweis.
- Kritische Module behalten mindestens ihre bisherigen Coverage-Anforderungen; bei wachsender Komplexität werden Floors nicht abgesenkt.
