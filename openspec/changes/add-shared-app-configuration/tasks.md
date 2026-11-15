## 1. Entwurf und belegter Ausgangspunkt

- [x] 1.1 Produktentscheidungen zum zentralen Abgleich, unveränderten Mainserver, akzeptierten Zwischenwrites, Variantenverwaltung, direktem Speichern, Rechten und Kopieren der Vorlage dokumentieren.
- [x] 1.2 Bestehende Specs und aktive Changes prüfen; Überschneidung mit App-Translations und Waste eingrenzen, ohne deren Scope zu erweitern.
- [x] 1.3 Vorhandene GraphQL-/Admin-REST-/Auth-Pfade im lokalen Mainserver lesen und belegte Fähigkeiten von fehlender Zugriffsfreigabe trennen.
- [x] 1.4 Zwei kleine Feldgruppen anhand tatsächlicher App-Verbraucher auswählen; keine Wirkung allein aus Katalogpfaden ableiten.
- [x] 1.5 Nutzerpräferenz für GraphQL festhalten und den Studio-Schema-Snapshot gegen die lokalen Resolver prüfen: vollständige JSON-Variantenliste und exakter Read nach ID fehlen; Update normalisiert den Namen. Admin-REST ist kein vorgesehener Integrationsweg.
- [ ] 1.6 Die dokumentierte GraphQL-Vertragslücke für vollständige Variantenverwaltung, Namenserhalt und unabhängigen Readback mit unverändertem Mainserver auflösen. Keine zusätzliche Admin-Session, Rollenänderung, Mainserver-Erweiterung oder Reduktion des Produktumfangs stillschweigend einplanen.
- [ ] 1.7 Nach Klärung alle Vorgänge über denselben autorisierten GraphQL-/Principal-Kontext nachweisen. Mutationstest ausschließlich in ausdrücklich freigegebener Testumgebung mit benannten Testeinträgen; keine Produktivkonfiguration dafür ändern.

## 2. Gemeinsamer Host-/Adaptervertrag

- [x] 2.1.1 Bestehenden Static-Content-/Service-Pfad um `readSvaMainserverAppConfiguration` mit ausdrücklicher Versionswahl, optionaler erwarteter ID und validierten Metadaten erweitern. Ausschließlich vorhandene GraphQL-Felder verwenden; Fallback, unaufgelöste Variante und fehlenden Rohtext getrennt zurückweisen. Schema-Kompatibilität und Service-Weitergabe an den gemeinsamen Kern sind lokal geprüft.
- [ ] 2.1.2 Vollständige Varianten-/ID-Abfragen nach bestätigtem Mainserver-Vertrag anbinden, öffentliche Plugin-SDK-Typen und dünne Host-Aufrufe festlegen. Plugin-IDs, konkrete Feldtypen/-grenzen und Owner/Namespace des übergreifenden Variantenrechts am Bestand bestätigen.
- [ ] 2.2 Plugin-Aktivierung, getrennte Konfigurationsrechte, Variantenrecht, Tenant-/Principal-Bindung, serverseitige Feldvalidierung und Pfad-Ownership über bestehende Host-/Registry-Pfade durchsetzen.
- [ ] 2.3 Bestehende Mutation-Lock- und Idempotenz-Primitiven auf Ressourcenscope und Lebenszyklus prüfen; Studio-Operationen je Dokument/Variante gemeinsam koordinieren, ohne neue Lock-Infrastruktur oder externe Konfliktgarantie.
- [x] 2.4.1 Reinen serverseitigen Abgleich für die beiden ersten Feldgruppen implementieren: explizite Basis-/Aktuell-Identität, hostseitig gewählter Feldbereich, validierte Set-/Remove-Operationen, Konflikte einschließlich Containerwechsel und textbasierter Erhalt fremder Werte. Gezielte 21 Vitest-Fälle, Package-Typecheck und Server-Runtime-Check bestanden. Noch keine Host-Autorisierung, Mainserver-Aufrufe oder tatsächlichen Plugin-Verbraucher angeschlossen.
- [ ] 2.4.2 Den Kern nach Klärung der GraphQL-Lücken an den tatsächlich frischen Lesepfad anschließen; Host-/Plugin-Wiring, Session-/Action-/Tenant-Prüfung und Konfliktanzeige nachweisen. Ein synthetisch übergebener Snapshot ist kein Live-Fresh-Read-Nachweis.
- [x] 2.5.1 Vollständige Versionskopie im gemeinsamen Vorbereitungskern umsetzen: bestätigte und frisch gelesene Vorlage abgleichen, übergebene Varianten auf Kontext und vorhandenes Ziel prüfen, alle fremden Rohwerte erhalten und zulässige eigene Änderungen anwenden. Dies führt keinen Create-Request aus und belegt weder vollständigen Bestand noch Variantenrecht.
- [ ] 2.5.2 Versionskopie an tatsächlichen Variantenbestand, übergreifendes Recht und Create anbinden; gezielte Löschung einschließlich Bestätigung und unabhängigem Abwesenheitsnachweis implementieren.
- [x] 2.6.1 Automatischen Transport-Retry für die bestehende Static-Content-Mutation deaktivieren. Sechs Regressionsfälle für Create/Update bei HTTP 503, Verbindungsabbruch und Timeout erst rot nachgewiesen und dann grün geprüft; ein weiterer Fall erhält den Retry der vorausgehenden Leseabfrage. Alle 136 Tests in `service.test.ts` bestehen. Dies ist eine Änderung am tatsächlich genutzten Adapter, keine vollständige Outcome-Reconciliation.
- [ ] 2.6.2 Unklaren Ausgang vor einer ausdrücklich ausgelösten Wiederholung tatsächlich abgleichen und den Host-/UI-Status ohne falsche Erfolgs-/Nichtgespeichert-Aussage ausgeben. Fehlender exakter GraphQL-Lesepfad bleibt offen.
- [x] 2.7.1 Zentralen Vergleich eines übergebenen Readback-Ergebnisses mit erwartetem Inhalt und Identität implementieren. Abweichung, fehlender Datensatz und nicht verfügbarer Readback bleiben unbestätigt; Mutation-ID oder leere Fallback-Antwort zählen nicht als Lesenachweis. Insgesamt 39 gezielte Kern-Tests und Package-Typecheck bestanden; kein tatsächlicher Read-Request oder Live-Nachweis.
- [ ] 2.7.2 Tatsächlich unabhängigen exakten Lesepfad, datensparsames Audit und Host-Fehlerabbildung anschließen; Waste-Verbraucher am selben zuständigen Pfad regressionssicher erhalten.

## 3. Allgemein und Design

- [ ] 3.1 Die beiden zuständigen Plugin-Beiträge in die vorhandene Plugin-/Anwendungen-Struktur einordnen. Bestehende Komponenten und SDK-Verträge verwenden; falls ein Plugin tatsächlich fehlt, den konkreten Bedarf und Verbraucher vor dem notwendigen Artefakt benennen und Nx-Generierung verwenden.
- [ ] 3.2 Standortwahl-Schalter und Kacheltitel-Zeilenzahl mit getrennten Feldzuständigkeiten, identischem gemeinsamen API-Pfad und ausdrücklich sichtbarer Version umsetzen. Fehlend und Defaultwert unterscheiden, inkompatible Container nicht automatisch konvertieren.
- [ ] 3.3 Gemeinsame Variantenbedienung und Änderungsvorschau anschließen; direktes Speichern, Konflikte und ungeklärte Ergebnisse darstellen. Keine dauerhafte Entwurfspersistenz oder Veröffentlichungsaktion.
- [ ] 3.4 Deutsche/englische Texte und betroffene Benutzerhilfe aktualisieren; Fokus, Tastatur, Statusmeldungen und erforderliche Kontraste prüfen.

## 4. Zusammenhängender Nachweis und Dokumentation

- [ ] 4.1 Beide tatsächlichen Plugin-Verbraucher mit demselben Dokument prüfen: disjunkte und konfliktbehaftete Edits, konkurrierende Studio-Ausführungen, unknown/null/false/Arrays und explizite Grenze externer Zwischenwrites.
- [ ] 4.2 Varianten-/Tenant-/Rechtematrix einschließlich direkter API-Aufrufe, vollständiger Kopie, bestehendem Ziel, gezieltem Delete, Timeout und unabhängigem Readback nachweisen; keine bloß synthetischen Callback-Tests als Host-Wiring-Beweis ausgeben.
- [ ] 4.3 Gezielte Waste-Regression und erforderliche Unit-/Type-/Auth-/Server-Runtime-Gates für den tatsächlich geänderten Scope ausführen; keine Mainserver-/App- oder Live-Abnahme behaupten.
- [ ] 4.4 Autorisierten Test-Roundtrip und tatsächliche App-Wirkung getrennt dokumentieren, offene Umgebungsevidenz offen lassen.
- [ ] 4.5 arc42-Abschnitte 05/08, Static-JSON-Referenz und tatsächlich betroffene Sicherheits-/Laufzeitdokumentation vom Zielbild auf belegten Implementierungsstand fortschreiben; `pnpm check:file-placement` und OpenSpec-Validierung ausführen.
