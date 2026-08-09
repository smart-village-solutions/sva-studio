## 1. PR 1 – Foundation und Referenzmigration

- [x] 1.1 `StudioSaveButton` in `@sva/studio-ui-react` mit den kontrollierten Zuständen `idle`, `saving` und `saved`, stabiler Breite sowie übersetzbaren Labels implementieren
- [x] 1.2 Den zentralen Zwei-Sekunden-Erfolgszeitraum, sofortigen Dirty-Reset, Timer-Cleanup und Schutz vor veralteten Submit-Abschlüssen implementieren
- [x] 1.3 Eine höfliche Save-Live-Region ohne Fokusverschiebung und mit dekorativ verborgenem Check-Icon integrieren
- [x] 1.4 Eine persistente technische Formular-/Bereichsfehlermeldung mit optionaler konkreter Retry-Aktion in `@sva/studio-ui-react` bereitstellen
- [x] 1.5 Bestehende Feldfehler- und Summary-Primitives für feldnahe Validierung und verlinkte Mehrfehler-Zusammenfassungen wiederverwenden oder gezielt schärfen
- [x] 1.6 `/interfaces` als Host-Referenzfluss auf die gemeinsamen Save- und Fehler-Primitives migrieren und vorhandenes Save-Statusfeedback ablösen
- [x] 1.7 Den News-Editor als Plugin-Referenzfluss migrieren und pluginlokale Save-Zustandsdarstellung durch die gemeinsamen Primitives ersetzen
- [x] 1.8 Erfolgreiche News-Create-Flows auf die erzeugte Detailroute führen und den an die Datensatz-ID gebundenen `saved`-Zustand transient, typsicher und einmalig übergeben
- [x] 1.9 Partielle Medienreferenzfehler im News-Flow ohne vollständigen `saved`-Zustand persistent darstellen und nur den fehlgeschlagenen Teilschritt wiederholbar machen

## 2. PR 1 – Tests, Dokumentation und Gates

- [x] 2.1 Unit- und Komponententests für Zustandsübergänge, Zwei-Sekunden-Timer, Dirty-Reset, Timer-Cleanup, Doppel-Submit und veraltete Request-Abschlüsse ergänzen
- [x] 2.2 Accessibility-Tests für Live-Region, Fokusverhalten, `role="alert"`, Feldverknüpfungen und dekoratives Check-Icon ergänzen
- [x] 2.3 Integrations- beziehungsweise Routentests für `/interfaces`, News-Update und den einmaligen Create-zu-Detail-Erfolg ergänzen
- [x] 2.4 Tests für Validierungsfehler, persistente technische Fehler, erfolgreichen und fehlgeschlagenen Retry sowie partielle Medienreferenzfehler ergänzen
- [x] 2.5 Entwicklerdokumentation für Save-Feedback, Toast-Abgrenzung, Plugin-Nutzung und sichere Retry-Semantik ergänzen
- [x] 2.6 Betroffene arc42-Abschnitte `04`, `05`, `06`, `08` und `10` aktualisieren und den PR-1-Schnitt dokumentieren
- [x] 2.7 Kleinste relevante Unit-, Type-, ESLint-, Accessibility- und Plugin-UI-Boundary-Gates ausführen; affected Scope vor breiten Runs messen
- [x] 2.8 `openspec validate standardize-save-action-feedback --strict` ausführen

## 3. Spätere Save-Migrations-PRs in diesem Change

- [ ] 3.1 Vollständige Host-/Plugin-Formularinventur mit dem Save-Feedback-Zielzustand abgleichen und fachlich zusammenhängende Migrations-PRs festlegen
- [ ] 3.2 Weitere Host-Formulare auf die gemeinsamen Save- und Fehler-Primitives migrieren
- [ ] 3.3 Weitere Plugin-Editoren auf die gemeinsamen Save- und Fehler-Primitives migrieren
- [ ] 3.4 Pro Migrations-PR ersetzte Save-Erfolgsmeldungen und Save-Toasts entfernen sowie Zustands-, Fehler- und Accessibility-Tests nachziehen
- [ ] 3.5 Vor Abschluss des Changes nachweisen, dass verbleibende Toasts ausschließlich einen dokumentierten kontextlosen Anwendungsfall besitzen

## 4. Explizit separate Folge-Changes

Die folgenden Themen sind keine Aufgaben dieses Changes und dürfen nicht im Rahmen der Save-Migration beiläufig eingeführt werden:

- `standardize-destructive-action-feedback`: Delete/Undo und destruktive Bestätigungen
- `add-contextless-action-feedback`: globale Rückmeldungen für kontextlose Aktionen
- `standardize-plugin-operation-feedback`: Progress- und Job-Feedback

Allgemeine Action-Outcomes in `@sva/core`, Feedback-Klassen oder Feedback-Registries in `@sva/plugin-sdk` sowie eine universelle globale Feedback-Surface sind keine eigenen Backlog-Aufgaben. Sie bleiben verworfene Lösungsansätze und dürfen nur innerhalb eines konkreten Folge-Changes mit neuer Evidenz erneut bewertet werden.
