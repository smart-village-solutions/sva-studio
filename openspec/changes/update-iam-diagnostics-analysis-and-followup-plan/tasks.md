## 1. Analysevorbereitung

- [x] 1.1 Bestehende IAM- und Auth-Flows in `packages/auth`, `packages/data`, `packages/core` und `apps/sva-studio-react` systematisch erfassen
- [x] 1.2 Bestehende Specs, ADRs und Architekturstellen zu IAM, Session, Registry und Keycloak gegeneinander abgleichen
- [x] 1.3 Aktive Recovery-, Fallback- und Drift-Pfade dokumentieren und als bewusste Mechanismen oder Risiken klassifizieren
- [x] 1.4 Historische Sonderpfade, Workarounds und potenziell verschlimmbesserte IAM-Fixes als eigener Analysebestand erfassen

## 2. End-to-End-Analyse

- [x] 2.1 Den Runtime-Pfad Host/Registry -> Auth-Config -> OIDC -> Session -> Actor-Auflösung -> IAM-API -> Keycloak/DB als zusammenhängenden Ablauf dokumentieren
- [x] 2.2 Fehlerklassen für Auth-Auflösung, Session, Actor-/Membership-Auflösung, Keycloak, DB/Schema, Registry/Provisioning und Frontend-State definieren
- [x] 2.3 Vorhandene Logs, Error-Codes, sichere Diagnosedetails und UI-Verwendungsstellen je Fehlerklasse inventarisieren
- [x] 2.4 Identifizieren, wo Fehler aktuell still geheilt, verschleiert oder unnötig generisch dargestellt werden
- [x] 2.5 Falsche, veraltete oder widersprüchliche IAM-, Mapping- und Membership-Daten in der Datenhaltung als eigene Fehlerquelle untersuchen
- [x] 2.6 Prüfen, welche Altlasten oder frühere Fixes heutige Fehlerbilder erzeugen, verschärfen oder verschleiern

## 3. Diagnose- und UX-Zielbild

- [x] 3.1 Einen UI-tauglichen IAM-Diagnosevertrag mit allowlist-basierten Details, Request-ID und handlungsleitenden Statusbildern definieren
- [x] 3.2 Bestehende Instanz-/Keycloak-Preflight- und Provisioning-Diagnosen mit Runtime-IAM-Fehlerpfaden abgleichen
- [x] 3.3 Entscheiden, welche Recovery-Pfade sichtbar gemacht, eingeschränkt oder im Folgechange refaktoriert werden sollen
- [x] 3.4 Ein explizites Zielbild für bessere Frontend-Statusanzeigen bei degradierter IAM-Lage, Recovery-Zwischenzuständen und manuellen Prüfbedarfen formulieren

## 4. Hybrid-Live-Triage

- [x] 4.1 Eine verbindliche Szenario-Matrix und Befundstruktur für den Live-Triage-Block in `docs/reports/iam-diagnostics-analysis-2026-04-19.md` festhalten
- [x] 4.2 Den Live-Triage-Block gegen eine reale Dev-/Staging-Umgebung durchführen und reale Befunde erfassen
- [x] 4.3 Kollisionen zwischen Repo-Analyse und Live-Befunden konsolidieren und den Bericht entsprechend fortschreiben

## 5. Architektur- und Dokumentationspflege

- [x] 5.1 Betroffene arc42-Abschnitte unter `docs/architecture/04-solution-strategy.md`, `05-building-block-view.md`, `06-runtime-view.md`, `08-cross-cutting-concepts.md`, `10-quality-requirements.md` und `11-risks-and-technical-debt.md` aktualisieren oder begründete Abweichung dokumentieren
- [x] 5.2 Falls neue oder geänderte IAM-Patterns verbindlich werden, ADR-Bedarf explizit festhalten

## 6. Folgechange als Abschlussbedingung

- [x] 6.1 Einen separaten Folgechange anlegen, der die Ergebnisse der Analysephase konserviert
- [x] 6.2 Im Folgechange Proposal, Design, Tasks und die betroffenen Spec-Deltas für Refactoring, UX-Verbesserungen und Tests ausformulieren
- [x] 6.3 Diesen Change erst dann als abgeschlossen markieren, wenn der Folgechange vorhanden und gegen den Analysebefund abgegrenzt ist
