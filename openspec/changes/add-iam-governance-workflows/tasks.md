# Tasks: add-iam-governance-workflows

## 1. Workflow-Modelle

- [ ] 1.1 `permission_change_requests` modellieren
- [ ] 1.2 `delegations` inkl. Validitätslogik modellieren
- [ ] 1.3 Impersonation-Sitzungen inkl. Ablaufmodell definieren

## 2. Umsetzungslogik

- [ ] 2.1 Approval-Flow (Vier-Augen) implementieren
- [ ] 2.2 Delegationsauflösung in Permission-Berechnung integrieren
- [ ] 2.3 Impersonation mit Sicherheitsgrenzen und Sichtbarkeit implementieren

## 3. Audit & Compliance

- [ ] 3.1 Unveränderbare Audit-Events je Workflow-Aktion schreiben
- [ ] 3.2 Legal-Text-Versionierung und Akzeptanznachweise integrieren
- [ ] 3.3 Export-/Nachweisfähigkeit für Compliance sicherstellen

## 4. Tests

- [ ] 4.1 Negativtests für Missbrauchsszenarien ergänzen
- [ ] 4.2 Integrationstests für End-to-End Governance-Flows ergänzen
- [ ] 4.3 Regressionstests für bestehende Authorize-Pfade ergänzen
