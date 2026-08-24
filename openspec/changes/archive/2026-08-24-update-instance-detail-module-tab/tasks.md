## 1. Specification and Planning

- [x] 1.1 `account-ui`-Delta für den Root-Admin-Modul-Workspace in der Betriebsansicht, die fortbestehende Sammelseite und die Confirm-Semantik vervollständigen
- [x] 1.2 Implementierungsplan für die UI-Extraktion und Wiederverwendung des Modul-Workspaces nach `docs/superpowers/plans/` schreiben
- [x] 1.3 `openspec validate update-instance-detail-module-tab --strict` ausführen

## 2. Shared Module Workspace

- [x] 2.1 Die bestehende Modulverwaltung aus `/admin/modules` in eine gemeinsame instanzgebundene Workspace-Komponente extrahieren
- [x] 2.2 Den Workspace so schneiden, dass er wahlweise mit Instanz-Select (Sammelseite) oder mit festem `instanceId`-Kontext (Betriebsansicht) gerendert werden kann
- [x] 2.3 Confirm-Dialoge für `Entziehen` und `Admin-Struktur initialisieren` im gemeinsamen Workspace führend verankern

## 3. Instance Detail Integration

- [x] 3.1 Den gemeinsamen Modul-Workspace in den bestehenden Tab `Betrieb` integrieren
- [x] 3.2 Die bisherige lesende Modulsektion durch den operativen Workspace in der Betriebsansicht ersetzen
- [x] 3.3 Die Betriebsansicht an dieselben `useInstances`-Mutationen für Assign/Revoke/Seed/Bootstrap anbinden

## 4. Tests and Documentation

- [x] 4.1 Unit-Tests für die Betriebsansicht und die gemeinsamen Modul-Workspace-Flows ergänzen oder anpassen
- [x] 4.2 Betroffene bestehende Tests für `/admin/modules` auf die extrahierte Komponente umstellen
- [x] 4.3 Betriebsdoku in `docs/guides/instance-module-management.md` um die Betriebsansicht als alternativen Root-Admin-Einstieg erweitern
- [x] 4.4 Kleinsten relevanten Gate-Pfad für die betroffenen UI-Änderungen ausführen
