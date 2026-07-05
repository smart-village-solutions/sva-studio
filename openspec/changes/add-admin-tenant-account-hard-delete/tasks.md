## 1. Fachliches Modell und Berechtigungen

- [x] 1.1 Die neue Permission `iam.accounts.delete` für tenantgebundene Account-Löschung spezifizieren
- [x] 1.2 Festlegen, dass `system_admin` die Permission implizit besitzt, aber kein genereller Rollen-Bypass für Tenant-Mutationen bleibt
- [x] 1.3 Festlegen, dass Zielaccounts mit der Rolle `system_admin` nicht löschbar sind und die Rolle vorab entzogen werden muss
- [x] 1.4 Festlegen, dass Self-Delete und Root-/Plattform-Zielaccounts ausgeschlossen bleiben

## 2. Löschorchestrierung und Datenintegrität

- [x] 2.1 Den normativen Ablauf für Session-Widerruf, Keycloak-Delete und Studio-Hard-Delete spezifizieren
- [x] 2.2 Festlegen, dass referenzierende Historie erhalten bleiben darf, wenn Account-Bezüge anonymisiert oder referenzverträglich umgeschrieben wurden
- [x] 2.3 Die Inhaltsbehandlung nach wirksamer Tenant-/Account-Regel für den Admin-Hard-Delete normieren
- [x] 2.4 Den Konflikt zum bestehenden Tombstone-Lifecycle als privilegierte Ausnahme fachlich abgrenzen

## 3. UI und Runtime

- [x] 3.1 Die Admin-Users-UI um eine explizite Löschaktion, Bestätigung und geschützte Disabled-Zustände ergänzen
- [x] 3.2 Einen tenantgebundenen Runtime-Delete-Pfad im User-Management-Vertrag spezifizieren
- [x] 3.3 Fehler- und Konfliktzustände für fehlende Permission, geschützte Zielaccounts und blockierende Referenzen normieren

## 4. Dokumentation und Qualität

- [x] 4.1 Betroffene arc42-Abschnitte `05`, `08`, `10` und `11` für den privilegierten Hard-Delete ergänzen
- [x] 4.2 Testfälle für Permission-Gates, Guard-Prüfungen, Referenzbereinigung, Keycloak-Orchestrierung und UI-Zustände ableiten
- [x] 4.3 `openspec validate add-admin-tenant-account-hard-delete --strict` ausführen
