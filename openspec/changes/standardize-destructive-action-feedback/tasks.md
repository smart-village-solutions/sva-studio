## 1. Entscheidung und Inventur

- [x] 1.1 Alle relevanten Delete-, Archive-, Restore-, Tombstone- und Hard-Delete-Flows in Host und Plugins inventarisieren
- [x] 1.2 Pro Aktion Bestätigungsmuster, Berechtigung, Konsequenz, Ergebnisnavigation und Fehlerkontext erfassen
- [x] 1.3 Produktentscheidung dokumentieren: kein Undo; fachliche Restore-Flows bleiben eigenständige Aktionen
- [x] 1.4 Einen Host- und einen Plugin-Referenzfluss auswählen und den gemeinsamen Change freigeben lassen

## 2. Gemeinsame Primitives und Referenzflüsse

- [x] 2.1 Kontextbezogene Ergebnis-, Bestätigungs- und persistente Fehlerprimitives in `@sva/studio-ui-react` implementieren
- [x] 2.2 Host-Referenzfluss mit eindeutiger Bestätigung, stabilem Ergebnis und persistentem Fehler migrieren
- [x] 2.3 Plugin-Referenzfluss ohne browsernative Bestätigung und mit sicherem Fokusverhalten migrieren
- [x] 2.4 Plugin-Nutzung ohne eigene Basisprimitives oder Toast-Infrastruktur dokumentieren

## 3. Tests, Dokumentation und Exit

- [x] 3.1 Tests für Bestätigung, Abbruch, Fokus, Mehrfachausführung, Ergebnisnavigation, Rechtefehler und technische Fehler ergänzen
- [x] 3.2 Betroffene arc42- und Entwicklerdokumentation aktualisieren
- [x] 3.3 Kleinste relevante Unit-, Type-, ESLint-, Accessibility- und Plugin-UI-Boundary-Gates ausführen
- [x] 3.4 `openspec validate standardize-destructive-action-feedback --strict` ausführen

## 4. Vollrollout auf bestehende Plugin-Flows

- [x] 4.1 Content-Löschungen in News, POI, FAQ, Projekte, Cockpit Cards und Generic Items mit gemeinsamem Dialog, Pending-Sperre, persistentem Fehler und stabilem Navigationsergebnis migrieren
- [x] 4.2 Persistierte Einzel-, Bulk- und Reset-Löschungen in Waste mit gemeinsamem Dialog sowie bestehender Server- und Fehlersemantik migrieren
- [x] 4.3 Lokale Entwurfsentfernungen in Surveys und Waste mit gemeinsamem Dialog und unmittelbar aktualisiertem Entwurf migrieren
- [x] 4.4 Nicht-destruktive Sicherheitsabfragen ausdrücklich auf `StudioConfirmDialog` belassen und durch gezielte Inventur von destruktiven Flows unterscheiden
- [x] 4.5 Tests für alle migrierten Plugin-Gruppen ergänzen oder anpassen, insbesondere Pending, Abbruch, Fehlerpersistenz, Navigationsergebnis und Mehrfachausführung
- [x] 4.6 Entwickler- und Architektur-Dokumentation von Referenzmigration auf vollständigen Plugin-Rollout aktualisieren
- [x] 4.7 Repositoryweit prüfen, dass destruktive Plugin-Flows keine browsernative Bestätigung und keinen `StudioConfirmDialog` mehr verwenden
- [x] 4.8 Betroffene Unit-, Type-, ESLint-, Accessibility- und Plugin-UI-Boundary-Gates ausführen
- [x] 4.9 `openspec validate standardize-destructive-action-feedback --strict` ausführen
