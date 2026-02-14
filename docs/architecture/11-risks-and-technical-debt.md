# 11 Risiken und technische Schulden

## Zweck

Dieser Abschnitt dokumentiert bekannte Architektur-Risiken und technische
Schulden auf IST-Basis.

## Mindestinhalte

- Priorisierte Risiko-/Schuldenliste
- Auswirkungen, Eintrittswahrscheinlichkeit, Gegenmassnahmen
- Verantwortliche und Zieltermine

## Aktueller Stand

### Priorisierte Risiken

1. Geheimnisse in lokalen Env-Dateien
   - Impact: hoch (Credential Leak Risiko)
   - Wahrscheinlichkeit: mittel
   - Massnahme: Secrets rotieren, lokale Env-Dateien strikt aus VCS halten, Secret-Scan in CI

2. Uneinheitliche Testabdeckung
   - Impact: mittel bis hoch (Regressionen spaet erkannt)
   - Wahrscheinlichkeit: hoch
   - Massnahme: Exempt-Projekte schrittweise abbauen, Coverage-Floors erhoehen

3. Routing-Komplexitaet durch dualen Ansatz (file-based + code-based)
   - Impact: mittel (Fehlkonfiguration/Bundling-Fehler)
   - Wahrscheinlichkeit: mittel
   - Massnahme: klare Source-of-Truth Regeln und mehr Routing-Tests

4. Observability-Abhaengigkeit von korrekter Initialisierung
   - Impact: mittel (blinde Flecken im Betrieb)
   - Wahrscheinlichkeit: mittel
   - Massnahme: robuste Startup-Checks und automatische Verifikation der OTEL-Pipeline

5. Dokumentationsdrift bei schnell wandelnden Architekturteilen
   - Impact: mittel
   - Wahrscheinlichkeit: hoch
   - Massnahme: Doku-Agent Reviews bei Proposal/PR verpflichtend nutzen

### Technische Schulden (Auswahl)

- Teilweise No-Op Testtargets in Libraries
- Historisch gewachsene Doku mit gemischter Tiefe
- Offene Produktionsentscheidungen fuer Deployment/HA

### Nachverfolgung

- Risiken in OpenSpec-Changes und PR-Checklisten referenzieren
- Architekturrelevante Risiken in diesem Abschnitt laufend aktualisieren

Referenzen:

- `docs/reports/PR_CHECKLIST.md`
- `openspec/AGENTS.md`
- `docs/development/testing-coverage.md`
