## 1. Entscheidungs- und Vertragsprüfung

- [ ] 1.1 Alle relevanten Delete-, Archive-, Restore-, Tombstone- und Hard-Delete-Flows in Host und Plugins inventarisieren
- [ ] 1.2 Pro Aktion Wiederherstellbarkeit, Zeitfenster, Berechtigung, Idempotenz, Konflikte und Auditvertrag belegen
- [ ] 1.3 Einen reversiblen und einen irreversiblen Referenzfluss auswählen und den Change vor Implementierung separat freigeben lassen

## 2. Gemeinsame Primitives und Referenzflüsse

- [ ] 2.1 Kontextbezogene Ergebnis-, Undo-, Bestätigungs- und persistente Fehlerprimitives in `@sva/studio-ui-react` implementieren
- [ ] 2.2 Reversiblen Referenzfluss mit serverautoritativen Undo- und Ablauf-/Konfliktverträgen migrieren
- [ ] 2.3 Irreversiblen Referenzfluss mit eindeutiger Bestätigung und sicherem Fokusverhalten migrieren
- [ ] 2.4 Plugin-Nutzung ohne eigene Basisprimitives oder Toast-Infrastruktur dokumentieren

## 3. Tests, Dokumentation und Exit

- [ ] 3.1 Tests für Bestätigung, Abbruch, Fokus, Undo, Ablauf, Idempotenz, Konflikte, Rechtefehler und technische Fehler ergänzen
- [ ] 3.2 Betroffene arc42- und Entwicklerdokumentation aktualisieren
- [ ] 3.3 Kleinste relevante Unit-, Type-, ESLint-, Accessibility- und Plugin-UI-Boundary-Gates ausführen
- [ ] 3.4 `openspec validate standardize-destructive-action-feedback --strict` ausführen
