## 1. Verträge und aktive Changes konsolidieren

- [x] 1.1 Überlappungen mit `add-p3-plugin-extension-tier-governance` und `refactor-cross-cutting-runtime-guardrails` auflösen
- [x] 1.2 Versionierte Manifestverträge für Scope und Aktivierungsrichtlinie definieren
- [x] 1.3 Stabile Scope-, Policy- und Conflict-Fehlercodes festlegen

## 2. Plattform-Scope implementieren

- [x] 2.1 Plugin-SDK um freigegebene Plattformbeiträge für Route, Navigation, Action und Server-Handler erweitern
- [x] 2.2 Extension-Tier-, Namespace-, Scope- und Cross-Contribution-Validierung fail-closed implementieren
- [x] 2.3 Snapshot-Materialisierung und Routing für getrennte Root-/Tenant-Bäume erweitern
- [x] 2.4 Unit- und Integrationstests für erlaubte und abgelehnte Scope-Kombinationen ergänzen
- [x] 2.5 Serverseitige Handler-Bindung mit exaktem Pfad-/Methoden-Dispatch und hosteigener Autorisierung implementieren
- [x] 2.6 Vollständige Handler-Abdeckung beim Bootstrap fail-closed validieren

## 3. Aktivierungsrichtlinien implementieren

- [x] 3.1 Manifest und Katalog um `optional`, `automatic` und `required` erweitern
- [x] 3.2 Studio-Migrationen für Richtlinie, effektiven Zustand, Herkunft, Revision und Override erstellen
- [x] 3.3 Richtlinien-Reconcile für neue und bestehende Instanzen concurrency-sicher implementieren
- [x] 3.4 Persistente Deaktivierung von `automatic` und Deaktivierungsverbot für `required` umsetzen
- [x] 3.5 Migration bestehender Plugins und Erhalt vorhandener Modulzuweisungen testen
- [x] 3.6 Berechtigungen inaktiver oder entfernter Module zentral aus der effektiven Permission-Auflösung filtern

## 4. UI, Audit und Dokumentation

- [x] 4.1 Modulübersicht um Richtlinie, Herkunft und effektiven Zustand ergänzen
- [x] 4.2 Aktivierungsänderungen und Reconcile-Ereignisse auditieren
- [x] 4.3 Studio-Schema-Snapshot und Schema-Dokumentation fortschreiben
- [x] 4.4 Betroffene arc42-Abschnitte und ADR für Plattformbeiträge/Aktivierungsmodell aktualisieren
- [x] 4.5 Relevante Unit-, Type-, Server-Runtime-, Migrations- und E2E-Gates ausführen
- [x] 4.6 `openspec validate extend-plugin-platform-scopes-and-activation --strict`, Dokumentations- und Platzierungschecks ausführen
