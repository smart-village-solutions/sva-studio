## 1. Serverseitige Reconcile- und Sync-Remediation

- [x] 1.1 Reale Fehlerpfade für User- und Rollen-Reconcile erfassen und in technische (`IDP_UNAVAILABLE`), Berechtigungs- (`IDP_FORBIDDEN`) und fachliche `manual_review`-Pfade aufteilen
- [x] 1.2 Serverpfade für User-Sync und Rollen-Reconcile so stabilisieren, dass gestartete Operationen nicht hängen bleiben und deterministische Ergebnisse liefern
- [x] 1.3 Gemeinsame fachliche Auflösung für Keycloak-Identität, IAM-User, Membership und Rollenprojektion implementieren oder konsolidieren
- [x] 1.4 Repro-Tests für Reconcile-/Sync-Ergebnisse, Drift-Blocker und Mapping-Inkonsistenzen ergänzen

## 2. Provisioning- und Drift-Remediation

- [x] 2.1 Aktive Drift-Pfade für Tenant-Admin-Client, Secret-Ausrichtung und Reconcile-Voraussetzungen reparieren oder fail-closed blockieren
- [x] 2.2 Sicherstellen, dass Reconcile-/Sync-Pfade blockerrelevante Drift nicht übergehen
- [x] 2.3 Idempotente Reparatur- und Wiederholpfade für Provisioning-nahe IAM-Abhängigkeiten absichern
- [x] 2.4 Tests für Drift-Erkennung, Drift-Blockierung und erfolgreiche Wiederholung ergänzen

## 3. UI-Konsistenz in Self-Service und Admin

- [x] 3.1 `/account`, `/admin/users` und `/admin/roles` auf denselben fachlichen Projektionskern ausrichten
- [x] 3.2 Leere Rollen-, Pending- oder UUID-Ersatzbilder nur dann anzeigen, wenn der fachliche Zustand sie tatsächlich rechtfertigt
- [x] 3.3 User-Sync- und Rollen-Reconcile-Aktionen mit belastbaren Abschlusszuständen und Retry-Verhalten ausstatten
- [x] 3.4 UI-Tests für die Referenzfälle `de-musterhausen`, `bb-guben` und `hb-meinquartier` ergänzen oder als reproduzierbare Szenario-Matrix dokumentieren

## 4. Dokumentation und Validierung

- [x] 4.1 Relevante arc42-Abschnitte für die nun fachlich behobenen Problemklassen aktualisieren
- [x] 4.2 Analysebericht um den Umsetzungs- und Restbefund ergänzen, falls sich die Problemklassenzuordnung ändert
- [x] 4.3 `openspec validate refactor-iam-runtime-consistency-remediation --strict` ausführen
- [x] 4.4 Betroffene Tests und Mindest-Gates ausführen
