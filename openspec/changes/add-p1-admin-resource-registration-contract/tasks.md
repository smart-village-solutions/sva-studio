## 1. Spezifikation

- [ ] 1.1 `account-ui` um einen deklarativen Vertrag fuer Admin-Ressourcen erweitern, der Listen-, Erstellungs-, Detail- und optional Historienbeitraege aus Workspace-Packages beschreibt
- [ ] 1.2 `routing` um die hostseitige Materialisierung kanonischer Admin-Routen aus registrierten Admin-Ressourcen erweitern
- [ ] 1.3 `content-management` auf den Admin-Ressourcenvertrag ausrichten, sodass Content-Admin-Flaechen nicht mehr als isolierte Sonderverdrahtung modelliert werden
- [ ] 1.4 Betroffene arc42-Abschnitte 04, 05, 06 und 08 als Update-Bedarf im Change festhalten

## 2. Design

- [ ] 2.1 Minimalen Registrierungsvertrag fuer Admin-Ressourcen in `design.md` festhalten: Ressourcen-ID, Basispfad, Titel-Key, Guard-Anforderung, Listen-/Create-/Detail-/History-Bindings
- [ ] 2.2 Abgrenzen, welche Teile Packages deklarieren duerfen und welche Route- und Guard-Entscheidungen ausschliesslich der Host materialisiert
- [ ] 2.3 Benennung und kanonische Routenform fuer Admin-Ressourcen festlegen (`/admin/<resource>`, `/admin/<resource>/new`, `/admin/<resource>/$id`)

## 3. Umsetzung

- [ ] 3.1 SDK- oder Routing-nahe Typen fuer `AdminResourceDefinition` und zugehoerige UI-Beitraege einfuehren
- [ ] 3.2 Hostseitige Registry/Merge-Logik fuer Admin-Ressourcen implementieren
- [ ] 3.3 Admin-Routen im Host aus registrierten Ressourcen statt aus verteilter Sonderverdrahtung materialisieren
- [ ] 3.4 Mindestens eine bestehende Admin-Ressource als Referenz auf den neuen Vertrag umstellen

## 4. Qualitaet und Dokumentation

- [ ] 4.1 Unit- und Type-Tests fuer Registrierungsvertrag, Konflikte und kanonische Routenbildung ergaenzen
- [ ] 4.2 Relevante Architektur- und Entwicklerdokumentation aktualisieren
- [ ] 4.3 `openspec validate add-p1-admin-resource-registration-contract --strict` ausfuehren
