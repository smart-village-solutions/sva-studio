# ADR-008: Codecov für Coverage-Reporting und PR-Transparenz

**Datum:** 18. Februar 2026
**Status:** 📋 Offen
**Kontext:** Test-Coverage Governance (CI-Gates, Reporting, Pull-Request-Feedback)
**Entscheider:** Philipp & Daniel

---

## Entscheidung

Wir nutzen **Codecov** als zusätzliche Sicht auf unsere Testqualität.
Die verbindliche Freigabe bleibt aber weiterhin intern.

Konkret:

- **Test-Coverage** (Anteil des Codes, der durch automatisierte Tests ausgeführt wird) wird weiterhin in der **CI** (Continuous Integration, automatische Prüfung bei jedem Code-Update) erzeugt.
- Das verbindliche **Quality Gate** (Regel, die vor Freigabe zwingend erfüllt sein muss) bleibt `pnpm coverage-gate` im **Repository** (zentraler Speicherort für den Quellcode).
- Ergebnisse werden zusätzlich an Codecov gesendet, damit Änderungen in einem **Pull Request** (Vorschlag, Änderungen in den Hauptzweig zu übernehmen) schneller sichtbar sind.
- Wenn Codecov kurzfristig nicht verfügbar ist, bleibt die Freigabelogik stabil (`fail_ci_if_error: false`), weil die interne Bewertung weiterläuft.

---

## Kontext und Problem

Unser **Monorepo** hat bereits eine interne **Governance** für Coverage.
Diese Regeln sind für Freigaben verlässlich, aber in Reviews oder für Externe nicht immer nachvollziehbar.

Insbesondere fehlte eine durchgängige Sicht auf:

- Coverage-Trends über Zeit
- schnelle Rückmeldung direkt im Pull Request
- zentrale Vergleichbarkeit über mehrere Packages

Die internen Regeln nutzen bereits eine **Baseline** (Referenzwert als Ausgangspunkt) und **Floors** (Mindestwerte, die nicht unterschritten werden dürfen).
Ohne zusätzliche Visualisierung bleiben diese Werte korrekt, aber für nicht primär technische Stakeholder schwerer einzuordnen.

---

## Was ist Codecov?

Codecov ist ein externer Dienst, der Coverage-Ergebnisse aus CI-Läufen aufbereitet und visuell darstellt.
Im Projekt ist Codecov damit ein Transparenz- und Analysewerkzeug, nicht die Instanz für finale Freigaben.

Funktional bedeutet das:

- Anzeige von Coverage-Änderungen pro Pull Request.
- Historische Trends und Vergleichbarkeit über mehrere Ausführungen hinweg.
- Zentrale Darstellung aggregierter **LCOV**-Reports (Standard-Dateiformat für Coverage-Ergebnisse) aus App- und Package-Targets.

Die bindende Qualitätsentscheidung bleibt weiterhin bei der internen Governance (`coverage-gate`), damit Freigaberegeln unabhängig von externer Verfügbarkeit bleiben.

---

## Betrachtete Optionen

| Option | Kriterien | Bewertung | Kommentar |
|---|---|---|---|
| **A: Interne Gates + Codecov (empfohlen)** | Verbindlichkeit, Transparenz, Integrationsaufwand | 9/10 | Klare Trennung von Freigaberegeln und Reporting, gute PR-Sichtbarkeit |
| B: Nur interne Gates und Artefakte | Robustheit, Einfachheit | 7/10 | Weniger externer Aufwand, aber schwache Trend-/PR-Visualisierung |
| C: Externe Plattform als alleiniges Gate | Zentralisierung | 5/10 | Höhere Abhängigkeit von einem einzelnen Anbieter, weniger Kontrolle im Repo |

### Warum Option A?

- ✅ **Verlässliche Entscheidungshoheit im Repo:** Baselines/Floors bleiben in Versionierung und Review.
- ✅ **Bessere Nachvollziehbarkeit im Review:** Pull Requests erhalten zusätzliche Coverage-Transparenz.
- ✅ **Niedriges Ausfallrisiko:** Externer Upload ist hilfreich, aber nicht kritisch für Gate-Entscheidungen.
- ✅ **Skalierbar für Monorepo:** Mehrere LCOV-Quellen können konsistent aggregiert werden.

---

## Trade-offs & Limitierungen

### Pros
- ✅ Bessere Sichtbarkeit auf Coverage-Trends und Auswirkungen einzelner Pull Requests.
- ✅ Klare Trennung zwischen internen Freigaberegeln und externer Visualisierung.
- ✅ Geringe Umstellung, da bestehende Coverage-Targets unverändert bleiben.

### Cons
- ❌ Zusätzliche externe Abhängigkeit (Service + Zugangsverwaltung).
- ❌ Potentielle Verwirrung, wenn Codecov-Darstellung und interne Gate-Werte unterschiedlich wirken.
- ❌ Wartungsaufwand für Workflow-/Codecov-Konfiguration.

**Mitigation:** In Doku und CI bleibt klar dokumentiert, dass `pnpm coverage-gate` das bindende Merge-Kriterium ist.

---

## Implementierung / Ausblick

- [x] CI erzeugt Coverage-Reports via `test:coverage`/`nx affected --target=test:coverage`.
- [x] Upload zu Codecov erfolgt in `.github/workflows/test-coverage.yml`.
- [x] Grundkonfiguration liegt in `codecov.yml`.
- [ ] Reviewer-Leitfaden um explizite Codecov-Interpretation ergänzen (Änderung je Pull Request vs. Gesamtwert).
- [ ] Halbjährliche Evaluation: Nutzen, Fehlalarme, Lock-in-Risiken.

---

## Migration / Exit-Strategie

Bei Abkehr von Codecov bleibt die Kern-Governance unverändert:

1. Codecov-Upload-Step aus Workflow entfernen.
2. Optional alternative Reporting-Plattform anbinden.
3. Interne Gates (`coverage-gate`, Policy/Baseline) unverändert weiter nutzen.

Damit ist ein Exit ohne Änderungen an den Test-Targets oder den Governance-Regeln möglich.

---

**Links:**
- [Coverage Workflow](../../../.github/workflows/test-coverage.yml)
- [Codecov Konfiguration](../../../codecov.yml)
- [Testing & Coverage Governance](../../development/testing-coverage.md)
- [OpenSpec: Enhance Test Coverage Tooling](../../../openspec/changes/enhance-test-coverage-tooling/proposal.md)
