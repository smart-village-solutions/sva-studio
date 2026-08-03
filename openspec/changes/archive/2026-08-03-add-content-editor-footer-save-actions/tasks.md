## 1. Gemeinsames Pattern ergänzen

- [x] 1.1 `StudioDetailPageTemplate` um den semantischen `primaryAction`-Vertrag erweitern
- [x] 1.2 Gemeinsame `StudioFormActionBar` für eingebettete lange Bearbeitungsflächen ergänzen
- [x] 1.3 Darstellung, Abwesenheit und gemeinsame Zustände beider Primitives mit Unit-Tests absichern

## 2. Inhaltseditoren migrieren

- [x] 2.1 News, Events und POIs auf dieselbe obere und untere Speichern-Aktion umstellen
- [x] 2.2 FAQs, Umfragen und generische Inhalte auf dieselbe obere und untere Speichern-Aktion umstellen
- [x] 2.3 Kern-Inhaltseditor auf den gemeinsamen Seitenabschluss-Slot vereinheitlichen
- [x] 2.4 Sicherstellen, dass beide Aktionen in jedem Tab einschließlich Historie sichtbar bleiben

## 3. Weitere lange Bearbeitungsflächen migrieren

- [x] 3.1 Benutzerbearbeitung mit identischer Primäraktion oberhalb der Tabs und am Formularende ausstatten
- [x] 3.2 Rollenberechtigungen mit identischer Primäraktion oberhalb und unterhalb der Berechtigungsmatrix ausstatten
- [x] 3.3 Rechtstexterstellung und Rechtstextbearbeitung mit identischer Primäraktion oberhalb und unterhalb der langen Eingabefläche ausstatten
- [x] 3.4 Bestehende Formulargrenzen, Berechtigungen, Loading-Zustände und Unsaved-Changes-Verhalten unverändert erhalten

## 4. Design-Pattern dokumentieren

- [x] 4.1 `docs/guides/plugin-development.md` um das verbindliche Pattern „lange Bearbeitungsfläche“ ergänzen
- [x] 4.2 TypeScript-Golden-Path, Einsatzkriterien, Ausnahmen und Review-Checkliste dokumentieren
- [x] 4.3 `docs/development/studio-uebersichts-und-detailseiten-standard.md` auf denselben Komponentenvertrag aktualisieren

## 5. Qualitätsnachweise

- [x] 5.1 Betroffene Unit-Tests für zwei Aktionen und Submit über die untere Aktion ergänzen beziehungsweise anpassen
- [x] 5.2 Betroffene Unit- und Type-Targets über Nx ausführen
- [x] 5.3 `openspec validate add-content-editor-footer-save-actions --strict` erfolgreich ausführen
