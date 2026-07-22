## 1. Vertrag und Host-Anbindung

- [x] 1.1 `faq.faq` als namespaceten Content-Type, FAQ-Admin-Ressource und Plugin-Registry-Beitrag nach dem bestehenden Standard-Content-Plugin-Muster registrieren; direkte FAQ-Navigation zugunsten der gemeinsamen Inhaltsübersicht ausblenden.
- [x] 1.2 Modul-IAM-Vertrag und Instanz-Bootstrap für `faq.read`, `faq.create`, `faq.update` und `faq.delete` ergänzen.
- [x] 1.3 Host-Fassade für FAQ implementieren, die Authentisierung, CSRF, Berechtigung und Mainserver-Credentials durchsetzt sowie Nicht-FAQ-IDs vor Detail, Update und Delete als nicht gefunden abgrenzt.
- [x] 1.4 Alle GenericItem-Upstream-Seiten lesen, nach `genericType: "FAQ"` filtern, vollständig sortieren und erst danach FAQ-Pagination und Gesamtzahl erzeugen; gelesene Seitenzahl, Datensatzanzahl und Laufzeit ohne Inhaltsdaten beobachten.
- [x] 1.5 GenericItem-Reads, Detail- und Delete-Pfade sowie die Inhaltsprojektion nach `genericType: "FAQ"` klassifizieren; Doppelanzeigen verhindern.

## 2. Fachplugin

- [x] 2.1 `@sva/plugin-faq` mit Manifest, Projektkonfiguration, Übersetzungen und öffentlichem API-Vertrag erstellen.
- [x] 2.2 Fachmodell, Zod-Validierung und Mapper für Frage, Nur-Text-Antwort, BCP-47-Sprachcode, `sortWeight`, Sichtbarkeit und Veröffentlichungszeitpunkt implementieren; HTML in der Antwort abweisen.
- [x] 2.3 Den FAQ-Payload mit den kontrollierten Schlüsseln `languageCode` und `sortWeight` schreiben, unbekannte historische Payload-Schlüssel erhalten und `contentBlocks` beim Speichern auf genau einen Antwortblock normieren.
- [x] 2.4 Fachliste mit Sprachfilter, Sprachcode-Anzeige und vollständiger deterministischer Sortierung sowie Create-/Edit-Seiten mit bestehenden Studio-UI-Bausteinen umsetzen.
- [x] 2.5 Zugänglichkeit, Fehlerzustände und Lade-/Empty-States nach bestehendem Plugin-Muster absichern.

## 3. Qualität und Dokumentation

- [x] 3.1 Unit-, Komponenten- und Host-Tests für Mapper, BCP-47-/HTML-Validierung, Payload- und ContentBlock-Normalisierung, Berechtigungen, Fremdtyp-Abgrenzung, Klassifikation, vollständiges Paging, Sortierung, Auffindbarkeit in der Inhaltsübersicht, ausgeblendete direkte FAQ-Navigation sowie CRUD ergänzen.
- [x] 3.2 Nach jedem abgeschlossenen Änderungsblock die kleinsten relevanten Nx-Unit- und Type-Gates ausführen; für die Host-/Serveränderung früh `pnpm check:server-runtime` ausführen. Auf bekannt rotem Teststand nicht weiterimplementieren.
- [x] 3.3 Vor der PR-Erstellung `pnpm test:pr` erfolgreich ausführen. Falls der Lauf nachweislich nicht möglich ist, den kleinsten relevanten Gate-Pfad einschließlich `pnpm test:coverage`, `pnpm coverage-gate` und `pnpm complexity-gate` erfolgreich ausführen und die Abweichung im PR begründen.
- [x] 3.4 Sicherstellen, dass neue produktive Dateien die Coverage-Floors erfüllen und `pnpm complexity-gate` keine neue Überschreitung meldet. Eine unvermeidbare neue Überschreitung nur mit dokumentiertem Refactoring-Ticket gemäß `tooling/quality/complexity-policy.json` und Team-Freigabe zulassen.
- [ ] 3.5 Sonar- und Codecov-PR-Checks bewerten; rote Checks oder genehmigte Ausnahmen mit Ursache, Risiko und Folgemaßnahme im PR dokumentieren.
- [x] 3.6 [arc42 Abschnitte 05, 06 und 08](../../../docs/architecture/README.md) sowie die Package-Gesamtübersicht aktualisieren und bei einer neuen ADR Abschnitt 09 nachziehen.
- [x] 3.7 Den OpenSpec-Change mit `openspec validate add-faq-generic-item-plugin --strict` validieren.
