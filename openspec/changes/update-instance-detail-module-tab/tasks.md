## 1. Specification and Planning

- [ ] 1.1 `account-ui`-Delta für den neuen Root-Admin-Modul-Tab, die fortbestehende Sammelseite und die Confirm-Semantik vervollständigen
- [ ] 1.2 Implementierungsplan für die UI-Extraktion und Wiederverwendung des Modul-Workspaces nach `docs/superpowers/plans/` schreiben
- [ ] 1.3 `openspec validate update-instance-detail-module-tab --strict` ausführen

## 2. Shared Module Workspace

- [ ] 2.1 Die bestehende Modulverwaltung aus `/admin/modules` in eine gemeinsame instanzgebundene Workspace-Komponente extrahieren
- [ ] 2.2 Den Workspace so schneiden, dass er wahlweise mit Instanz-Select (Sammelseite) oder mit festem `instanceId`-Kontext (Detail-Tab) gerendert werden kann
- [ ] 2.3 Confirm-Dialoge für `Entziehen` und `Admin-Struktur initialisieren` im gemeinsamen Workspace führend verankern

## 3. Instance Detail Integration

- [ ] 3.1 Den Instanz-Detail-Tab-Satz um `Module` erweitern
- [ ] 3.2 Die bisherige lesende Modulsektion aus dem Überblick in den neuen Tab überführen
- [ ] 3.3 Den neuen Tab an dieselben `useInstances`-Mutationen für Assign/Revoke/Seed/Bootstrap anbinden

## 4. Tests and Documentation

- [ ] 4.1 Unit-Tests für den neuen Tab und die gemeinsamen Modul-Workspace-Flows ergänzen oder anpassen
- [ ] 4.2 Betroffene bestehende Tests für `/admin/modules` auf die extrahierte Komponente umstellen
- [ ] 4.3 Betriebsdoku in `docs/guides/instance-module-management.md` um den neuen Detail-Tab als alternativen Root-Admin-Einstieg erweitern
- [ ] 4.4 Kleinsten relevanten Gate-Pfad für die betroffenen UI-Änderungen ausführen
