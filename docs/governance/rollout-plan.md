# Rollout-Plan: Branching & Preview Governance

Dieser Plan beschreibt die schrittweise Einführung der neuen Branching-Strategie und Preview-Governance für das SVA Studio Projekt. Ziel ist eine risikoarme Umstellung, die die Entwicklungsgeschwindigkeit erhöht, ohne die Stabilität des Hauptzweigs (`main`) zu gefährden.

## Übersicht der Phasen

| Phase | Fokus | Dauer (geschätzt) | Status |
| :--- | :--- | :--- | :--- |
| **1. Pilot** | Validierung mit Kern-Teams | 14 Tage | Ausstehend |
| **2. Transition** | Onboarding aller internen Teams | 30 Tage | Ausstehend |
| **3. Enforcement** | Verbindliche Durchsetzung (Gates) | Kontinuierlich | Ausstehend |
| **4. Standard** | Operative Exzellenz & Optimierung | Kontinuierlich | Ausstehend |

---

## Phase 1: Pilot (Validierung)

In dieser Phase testen ausgewählte Teams (z. B. Core- und Plattform-Team) die neuen Prozesse unter realen Bedingungen.

- **Verantwortlich**: Platform Team / Tech Lead
- **Eintrittskriterien**:
  - Dokumente T1 bis T10 sind finalisiert und abgenommen.
  - Preview-Infrastruktur ist bereitgestellt (gemäß T6/T7).
  - Monitoring-Dashboards für Kosten und Kapazität sind aktiv (gemäß T8).
- **Exit-Kriterien**:
  - Mindestens 10 PRs wurden erfolgreich über die Merge-Queue verarbeitet.
  - Keine kritischen Fehler in den Preview-Lifecycle-Automatisierungen.
- **KPIs**:
  - **PR Cycle Time**: Durchschnittlich < 48 Stunden.
  - **Queue Eject Rate**: < 10 % (PRs, die die Queue wegen Testfehlern verlassen).
- **Rollback-Trigger**:
  - `broken-main` Vorfälle > 3 innerhalb von 7 Tagen.
  - Kostenüberschreitung der Preview-Budgets um > 50 % in der ersten Woche.

---

## Phase 2: Transition (Onboarding)

Ausweitung auf alle internen Entwicklungsteams. Fokus liegt auf Schulung und Feedback-Integration.

- **Verantwortlich**: Maintainer-Gruppe
- **Eintrittskriterien**:
  - Erfolgreicher Abschluss der Pilotphase.
  - Durchführung eines Onboarding-Workshops für alle Entwickler.
  - `CODEOWNERS` (T5) sind aktiv hinterlegt.
- **Exit-Kriterien**:
  - 100 % der internen PRs nutzen die neue Branch-Taxonomie (T2).
  - Feedback-Loop etabliert (wöchentliches Sync-Meeting).
- **KPIs**:
  - **Preview-Adoption**: 100 % der PRs verfügen über eine aktive Preview-Umgebung.
  - **Security-Compliance**: 0 PII-Leaks oder Secret-Exposures in Previews (T9).
- **Rollback-Trigger**:
  - Queue Eject Rate > 20 % über einen Zeitraum von 3 aufeinanderfolgenden Tagen.
  - Systemweite Ablehnung durch die Entwickler aufgrund von Performance-Einbußen.

---

## Phase 3: Enforcement (Durchsetzung)

Die Regeln werden technisch über Branch-Protection-Regeln und automatisierte Hooks erzwungen.

- **Verantwortlich**: GitHub Organization Admins
- **Eintrittskriterien**:
  - Stabiler Betrieb in der Transition-Phase (mind. 14 Tage ohne Rollback-Trigger).
  - Dokumentation in `DEVELOPMENT_RULES.md` aktualisiert.
- **Exit-Kriterien**:
  - Branch-Protection ist für `main` und `develop` scharf geschaltet.
  - Manuelle Bypasses sind auf P0-Notfälle begrenzt (T10).
- **KPIs**:
  - **CI Green Rate**: > 95 % (Erfolgsquote der Pipeline-Checks).
  - **Unused Previews**: < 5 % (Effektives Cleanup gemäß T7).
- **Rollback-Trigger**:
  - Blockade des Release-Zyklus durch fehlerhafte Governance-Automatisierung für > 4 Stunden.
  - Kritische Sicherheitslücke, die direkt auf die Preview-Isolierung zurückzuführen ist.

---

## Phase 4: Standard (Optimierung)

Ziel ist die kontinuierliche Verbesserung der Prozesse und Werkzeuge.

- **Verantwortlich**: Alle Teams (Community-Modell)
- **KPIs**:
  - **MTTR (Mean Time To Recovery)**: < 30 Minuten bei `broken-main`.
  - **Kosten-Effizienz**: Stetige Reduktion der Preview-Kosten pro PR durch optimiertes Sizing.

---

## Fallback-Strategie

Sollte eine Phase aufgrund der definierten Rollback-Trigger abgebrochen werden müssen, tritt folgender Plan in Kraft:

1.  **Deaktivierung der Merge-Queue**: Rückkehr zum klassischen "Merge nach Review"-Modell.
2.  **Lockerung der Branch-Naming-Hooks**: Umstellung der Hooks auf Warnungen statt harter Ablehnung.
3.  **Preview-Pause**: Automatisches Erstellen von Previews wird deaktiviert; nur manuelles Triggern ist erlaubt.
4.  **Kommunikation**: Sofortige Benachrichtigung aller Teams über den Rollback-Status via Slack/GitHub-Discussions.
5.  **Re-Entry**: Ein erneuter Versuch des Rollouts erfolgt erst nach Behebung der Ursache und erneuter Freigabe durch das Platform-Team.

## Risiko-Minimierung

- **Training**: Vor Phase 2 müssen alle Beteiligten die neuen `Stacked PR` Regeln (T3) und `Security Guidelines` (T9) verstanden haben.
- **Monitoring**: Real-time Monitoring der GitHub Actions Kontingente und Preview-Ressourcen.
- **Escape Hatches**: Administratoren behalten das Recht, die Policy bei kritischen Bugfixes (Hotfixes) zu umgehen, wobei jeder Bypass dokumentiert werden muss.
