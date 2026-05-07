## 1. Abhängigkeiten und Runtime-Foundation

- [ ] 1.1 `@tanstack/react-query` und `@tanstack/react-query-devtools` für `apps/sva-studio-react` einführen und den hostweiten `QueryClient` verdrahten
- [ ] 1.2 `react-hook-form` und `@hookform/resolvers` für formularintensive Host- und Plugin-Views einführen
- [ ] 1.3 `msw` als gemeinsames Frontend-Test-Mocking-Setup für Browser- und Node-Testläufe verdrahten
- [ ] 1.4 `fast-check` als Dev-Dependency für kritische Kern- und Routing-Pakete einführen

## 2. Daten- und Formularstandards umsetzen

- [ ] 2.1 Host-weit einen Standard für Query-Keys, Invalidation und Mutations-Feedback dokumentieren und implementieren
- [ ] 2.2 Account- und Admin-Formulare auf `react-hook-form` plus `zodResolver` standardisieren
- [ ] 2.3 Content-Editoren und pluginseitige Formularflüsse auf dieselben Formularprimitiven und Validierungsmuster ausrichten
- [ ] 2.4 Datenlade- und Mutationsflüsse mit `react-query` so umstellen, dass Listen-, Detail- und Session-nahe States konsistent invalidiert werden

## 3. Test-Governance und Verifikation

- [ ] 3.1 Frontend-Tests, die HTTP-Verhalten prüfen, auf `msw` umstellen oder neu darauf aufbauen
- [ ] 3.2 Für kritische Kernlogik gezielte `fast-check`-Properties ergänzen, insbesondere für Guards, Parser, Normalisierung und Routing-nahe Invarianten
- [ ] 3.3 Betroffene Unit-, Type- und Frontend-Tests nach jedem Umstellungsblock ausführen
- [ ] 3.4 Validierungs- und Test-Dokumentation für die neuen Foundations ergänzen

## 4. Dokumentation

- [ ] 4.1 Betroffene arc42-Abschnitte `05`, `08`, `09` und `10` zur Daten-, Formular- und Test-Foundation aktualisieren
- [ ] 4.2 Entwicklerdokumentation für Query-Patterns, Formularmuster, MSW-Setup und Property-based Testing ergänzen
