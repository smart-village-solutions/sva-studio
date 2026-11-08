## 1. Entwurf

- [x] 1.1 Bestehendes Suchplugin, Header-Vorschau, Mainserver-Indexierung und Suchpfade untersuchen.
- [x] 1.2 Fachlichen Umfang mit Header, Ergebnisseite, drei Filtern und aggregierten Berechtigungsablehnungen bestätigen.
- [x] 1.3 Schriftlichen Entwurf einschließlich Scopegrenze und kritischer Invarianten erstellen.
- [x] 1.4 Schriftlichen Entwurf prüfen lassen und Implementierungszuschnitt bestätigen.

## 2. Implementierung nach Entwurfsprüfung

- [x] 2.1 Unterstützte Index-/Modell-/Fachtyp-/Detailrouten-Zuordnungen und konkrete serverseitige Ziel-/Schlüsselzuführung festlegen; bestehenden XERJ-Referenzpfad und Indexstand vor nichttrivialen Codeänderungen prüfen, soweit verfügbar und autorisiert.
- [x] 2.2 Bestehendes Suchplugin um serverseitige Kandidatensuche, vorhandene Leseprüfung, Filter und vollständigkeitsabhängige Zählung erweitern; unmittelbar das kleinste Unit-/Type-Gate ausführen.
- [x] 2.3 Header-Einstieg und hostmaterialisierte Ergebnisseite mit URL-Zustand, drei Filtern, sicheren Vorschauen und getrennten Statusanzeigen anbinden; vorhandene Vorschau ersetzen.
- [x] 2.4 Plugin-Metadaten, eigene Permission, Modulaktivierung und Host-Wiring im bestehenden Pfad integrieren; keine automatischen externen Schlüssel- oder Aktivierungsänderungen.

## 3. Nachweise und Dokumentation

- [x] 3.1 Negative Autorisierungs-, Kontextwechsel-, GenericItem-, Paging-, Vollständigkeits- und Geheimnisschutzfälle aus `design.md` gezielt prüfen.
- [x] 3.2 Header-/Ergebnisflow auf Desktop und Mobil einschließlich Tastatur, Live-Region, URL-Zustand und Fehlerverhalten prüfen.
- [ ] 3.3 **Offen bis zum autorisierten Live-Test Sandbox / Mainserver Staging mit eingeschränktem Suchschlüssel und Quellenkonfiguration:** Vollständige Zählung mit repräsentativen Suchmengen gegen Request- und Indexlimits messen; keine exakte Zahl bei unvollständigem Lauf zusagen.
- [x] 3.4 Relevante Plugin-/Anwenderdokumentation sowie arc42 03, 05, 06, 07 und 08 aktualisieren; 04 auf unveränderte IAM-Leitentscheidungen prüfen.
- [x] 3.5 Pflicht-Gates proportional zum tatsächlichen Code-Scope ausführen, darunter bei Server-Runtime-Änderungen `pnpm check:server-runtime`; `pnpm check:file-placement` und strikte OpenSpec-Validierung ausführen.
- [x] 3.6 Vor Abschluss hinzugefügte und entfernte Ausführungspfade prüfen; keine parallele Header-Vorschau, neue allgemeine Filterplattform oder zweite Berechtigungslogik zurücklassen.

## Lokaler Prüfstand

- Serverseitige Kandidaten-, Berechtigungs-, GenericItem-, Kontextwechsel- und Eingabeprüfungen sind mit gezielten Vitest-Tests abgedeckt.
- Playwright prüft den Header-Einstieg, URL-Zustand, kombinierte Typfilter, Ergebniszähler und mobile Darstellung mit simulierten Antworten; Axe prüft den Hauptbereich. Die Screenshots wurden visuell kontrolliert. Dies ersetzt keine Prüfung gegen echte Suchdaten.
- Beide Plugin-Kataloge und die vorhandene Distributionsauswahl führen Search für Studio; SSF schließt es aus. Der Header verwendet das bestehende Browser-View-Binding des Plugins, damit ausgeschlossene Distributionen keinen statischen Search-Import erhalten.
- Der reguläre App-Build einschließlich Chunk-Provenienz, Typechecks, i18n, Server-Runtime, Dateiplatzierung und strikte OpenSpec-Validierung sind erfolgreich abgeschlossen.
- Vorhandene, nicht durch die Änderung eingeführte Vite-/Tooling-Hinweise und eine ESLint-Warnung im Distributionsskript bleiben außerhalb dieses Lieferabschnitts. Die geänderte Suchlogik und Oberfläche haben keine ESLint-Befunde.
- Die ursprüngliche `.env.local` und der Master Key wurden nicht übernommen. Kein Push, keine Schlüsselanlage, keine Mandantenaktivierung und kein Deployment.
