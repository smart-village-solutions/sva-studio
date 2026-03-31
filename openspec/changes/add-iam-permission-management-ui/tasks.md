# Tasks

## 1. Spezifikation

- [ ] 1.1 Bestehende Specs `account-ui` und `iam-access-control` auf den heutigen Rollen-, Permissions- und IAM-Cockpit-Stand ausrichten
- [ ] 1.2 In den Delta-Specs festlegen, welche bestehenden Datenfelder und Prüfpfade für Rechteverwaltung, Vorschau und Diagnose wiederverwendet werden
- [ ] 1.3 `shadcn/ui`, lokalisierte UI-Terminologie und Read-only-Regeln für System- und externe Rollen verbindlich im Change verankern

## 2. UX- und Interaktionsdesign

- [ ] 2.1 Einen inkrementellen Rollenarbeitsbereich innerhalb von `/admin/roles` spezifizieren, der auf der vorhandenen Tabellen- und Expand-Struktur aufbaut
- [ ] 2.2 Die Darstellung von Rollen-Berechtigungen als fachlich lesbare Ansicht mit optionaler technischer Detailtiefe spezifizieren
- [ ] 2.3 Den Einstieg von der Rollenansicht in bestehende IAM-Prüf- und Transparenzfunktionen spezifizieren
- [ ] 2.4 Änderungszustände, Read-only-Verhalten, Tastaturbedienung, Screenreader-Semantik und responsive Nutzung für den Rollenarbeitsbereich spezifizieren

## 3. Fach-UI-Integration

- [ ] 3.1 Konsistente Zustände für erlaubte, deaktivierte, read-only und serverseitig verweigerte Aktionen spezifizieren
- [ ] 3.2 Anforderungen an priorisierte Fachseiten wie Content aufnehmen, ohne ein neues Ownership-Modell vorauszusetzen

## 4. Architektur und Dokumentation

- [ ] 4.1 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08` und `10` unter `docs/architecture/` referenzieren
- [ ] 4.2 Terminologie für fachliche Permissions-Anzeige, technische `permissionKey`-Werte und Diagnose-/Reason-Code-Darstellung dokumentieren

## 5. Verifikation

- [ ] 5.1 Negative und Randfälle für read-only-Rollen, fehlende Berechtigungen, serverseitige Konflikte und Prüfdaten in den Delta-Specs ergänzen
- [ ] 5.2 Verifikationsstrategie für Unit-, Integrations-, E2E-, Accessibility-, Responsive- und i18n-Prüfungen für die spätere Umsetzung festhalten
- [ ] 5.3 Proposal mit `openspec validate add-iam-permission-management-ui --strict` validieren
