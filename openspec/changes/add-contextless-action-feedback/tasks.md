## 1. Entscheidung und Inventur

- [ ] 1.1 Bestehende globale Meldungen und Kandidaten wie Kopieren, Exportstart und Duplizieren inventarisieren
- [ ] 1.2 Pro Kandidat begründen, warum kein stabiler Button-, Formular-, Detail-, Listen-, Job- oder Bereichskontext geeignet ist
- [ ] 1.3 Meldungsarten, Anzeigedauer, Queue-Limit, Deduplizierung und öffentlichen Emissionsport entscheiden
- [ ] 1.4 Referenzaktionen auswählen und den Change vor Implementierung separat freigeben lassen

## 2. Host-Surface und Referenzaktionen

- [ ] 2.1 Globale Surface und Accessibility-Primitives in Shell und `@sva/studio-ui-react` implementieren
- [ ] 2.2 Minimalen öffentlichen Emissionsvertrag ohne freie Renderer oder Fachpayloads bereitstellen
- [ ] 2.3 Referenzaktionen migrieren und unzulässige globale Rückmeldungen in ihren stabilen Kontext zurückführen
- [ ] 2.4 Plugin-Authoring- und Review-Regeln dokumentieren

## 3. Tests, Dokumentation und Exit

- [ ] 3.1 Tests für Zulässigkeit, Queue-Limit, Deduplizierung, Dismiss, Hover-/Fokus-Pause und Live-Region ergänzen
- [ ] 3.2 Tests ergänzen, die Save-, persistente Fehler- und Jobzustände von der globalen Surface fernhalten
- [ ] 3.3 Betroffene arc42- und Entwicklerdokumentation aktualisieren
- [ ] 3.4 Kleinste relevante Unit-, Type-, ESLint-, Accessibility- und Plugin-UI-Boundary-Gates ausführen
- [ ] 3.5 `openspec validate add-contextless-action-feedback --strict` ausführen
