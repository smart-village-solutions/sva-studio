# 11 Risiken und technische Schulden

## Zweck

Dieser Abschnitt dokumentiert bekannte Architektur-Risiken und technische
Schulden auf IST-Basis.

## Mindestinhalte

- Priorisierte Risiko-/Schuldenliste
- Auswirkungen, Eintrittswahrscheinlichkeit, Gegenmaßnahmen
- Verantwortliche und Zieltermine

## Aktueller Stand

### Priorisierte Risiken

1. Geheimnisse in lokalen Env-Dateien
   - Impact: hoch (Credential Leak Risiko)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Secrets rotieren, lokale Env-Dateien strikt aus VCS halten, Secret-Scan in CI

2. Uneinheitliche Testabdeckung
   - Impact: mittel bis hoch (Regressionen spät erkannt)
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Exempt-Projekte schrittweise abbauen, Coverage-Floors erhöhen

3. Routing-Komplexität durch dualen Ansatz (file-based + code-based)
   - Impact: mittel (Fehlkonfiguration/Bundling-Fehler)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: klare Source-of-Truth Regeln und mehr Routing-Tests

4. Observability-Abhängigkeit von korrekter Initialisierung
   - Impact: mittel (blinde Flecken im Betrieb)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: robuste Startup-Checks und automatische Verifikation der OTEL-Pipeline

5. Dokumentationsdrift bei schnell wandelnden Architekturteilen
   - Impact: mittel
   - Wahrscheinlichkeit: hoch
   - Maßnahme: Doku-Agent Reviews bei Proposal/PR verpflichtend nutzen

6. Globaler Pending-basierter Initial-Loading-Zustand in der Root-Shell
   - Impact: mittel (inkonsistente Wahrnehmung bei langsamen/ schnellen Backends)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Loading-Orchestrierung an echte Pending-/Datenzustände koppeln

7. Statisch verdrahtete Shell-Navigation
   - Impact: mittel (höhere Kopplung, schlechtere Erweiterbarkeit)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: Navigationsziele schrittweise über deklarative Route-/Plugin-Metadaten speisen

8. i18n-Schulden in UI-Texten
   - Impact: mittel (A11y-/Lokalisierungsqualität)
   - Wahrscheinlichkeit: mittel
   - Maßnahme: UI-Texte konsistent über Übersetzungsschlüssel (`t('key')`) verwalten

### Technische Schulden (Auswahl)

- Teilweise No-Op Testtargets in Libraries
- Historisch gewachsene Doku mit gemischter Tiefe
- Offene Produktionsentscheidungen für Deployment/HA
- Root-Shell nutzt derzeit einen globalen Router-Pending-Trigger statt datenquellenspezifischer Pending-Orchestrierung
- Shell-Navigation ist aktuell nicht vollständig plugin-/metadatenbasiert

### Nachverfolgung

- Risiken in OpenSpec-Changes und PR-Checklisten referenzieren
- Architekturrelevante Risiken in diesem Abschnitt laufend aktualisieren

Referenzen:

- `docs/reports/PR_CHECKLIST.md`
- `openspec/AGENTS.md`
- `docs/development/testing-coverage.md`
