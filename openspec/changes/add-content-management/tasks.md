## 1. Spezifikation
- [ ] 1.1 Neue Capability `content-management` für Liste, Detail-/Bearbeitung, Statusmodell und Historie spezifizieren
- [ ] 1.2 IAM-Anforderungen für rollenbasierte Inhaltsberechtigungen in `iam-access-control` ergänzen
- [ ] 1.3 Audit- und Historienanforderungen in `iam-auditing` ergänzen
- [ ] 1.4 Technische Entscheidungen zu Core-Modell, SDK-Erweiterungspunkten, Payload-Validierung, Statuswechseln und Rechtekopplung in `design.md` dokumentieren

## 2. Umsetzung
- [ ] 2.1 Core-Inhaltsdatenmodell, API-Verträge und Persistenz für Inhaltsliste, Detailansicht und Historie implementieren
- [ ] 2.1a Up-/Down-Migrationen für das Inhaltsmodell im bestehenden Migrationsschema anlegen
- [ ] 2.1b Lokalen Migrationspfad gegen die Entwicklungsdatenbank reproduzierbar ausführen und verifizieren
- [ ] 2.2 Admin-Route für die Seite `Inhalte` mit Tabellenansicht und CTA `Neuer Inhalt` implementieren
- [ ] 2.3 Erstellungs- und Bearbeitungsansicht mit JSON-Payload-Eingabe, Validierung und Statussteuerung implementieren
- [ ] 2.4 SDK-Erweiterungspunkte für typspezifische Felder, Validierung, Tabellen-Spalten und Editorkomposition implementieren
- [ ] 2.5 Rollen- und Rechteprüfung für Listenansicht, Bearbeitung, Statuswechsel und Historie server- und clientseitig integrieren
- [ ] 2.6 Auditspur und Historienanzeige für Inhaltsänderungen und Statuswechsel implementieren

## 3. Qualität und Dokumentation
- [ ] 3.1 Unit-, Typ- und UI-Tests für Liste, Editor, Statuswechsel, Rechtepfade und Historie ergänzen
- [ ] 3.2 Relevante Dokumentation unter `docs/` sowie betroffene arc42-Abschnitte aktualisieren
- [ ] 3.2a Lokalen Ablauf für Inhalts-Migrationen in der Entwicklerdokumentation beschreiben
- [ ] 3.3 `openspec validate add-content-management --strict` ausführen
