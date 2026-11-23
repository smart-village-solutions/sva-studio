## 1. Entwurf und belegter Ausgangspunkt

- [x] 1.1 Produktentscheidungen zum zentralen Abgleich, unveränderten Mainserver, akzeptierten Zwischenwrites, Variantenverwaltung, direktem Speichern, Rechten und Kopieren der Vorlage dokumentieren.
- [x] 1.2 Bestehende Specs und aktive Changes prüfen; Überschneidung mit App-Translations und Waste eingrenzen, ohne deren Scope zu erweitern.
- [x] 1.3 Vorhandene GraphQL-/Admin-REST-/Auth-Pfade im lokalen Mainserver lesen und belegte Fähigkeiten von fehlender Zugriffsfreigabe trennen.
- [x] 1.4 Zwei kleine Feldgruppen anhand tatsächlicher App-Verbraucher auswählen; keine Wirkung allein aus Katalogpfaden ableiten.
- [x] 1.5 Nutzerpräferenz für GraphQL festhalten und den Studio-Schema-Snapshot gegen die lokalen Resolver prüfen: vollständige JSON-Variantenliste und exakter Read nach ID fehlen; Update normalisiert den Namen. Admin-REST ist kein vorgesehener Integrationsweg.
- [ ] 1.6 Die dokumentierte GraphQL-Vertragslücke für vollständige Variantenverwaltung, Namenserhalt und unabhängigen Readback mit unverändertem Mainserver auflösen. Keine zusätzliche Admin-Session, Rollenänderung, Mainserver-Erweiterung oder Reduktion des Produktumfangs stillschweigend einplanen.
- [ ] 1.7 Nach Klärung alle Vorgänge über denselben autorisierten GraphQL-/Principal-Kontext nachweisen. Mutationstest ausschließlich in ausdrücklich freigegebener Testumgebung mit benannten Testeinträgen; keine Produktivkonfiguration dafür ändern.

## 2. Gemeinsamer Host-/Adaptervertrag

- [ ] 2.1.1 Vorhandenen GraphQL-Lesepfad gemeinsam mit dem ersten autorisierten Host-Verbraucher anbinden; tatsächliche Identität, Fallback und Rohtextvertrag prüfen. Keine isolierte öffentliche Lese-API einführen.
- [ ] 2.1.2 Vollständige Varianten-/ID-Abfragen nach bestätigtem Mainserver-Vertrag anbinden, öffentliche Plugin-SDK-Typen und dünne Host-Aufrufe festlegen. Plugin-IDs, konkrete Feldtypen/-grenzen und Owner/Namespace des übergreifenden Variantenrechts am Bestand bestätigen.
- [ ] 2.2 Plugin-Aktivierung, getrennte Konfigurationsrechte, Variantenrecht, Tenant-/Principal-Bindung, serverseitige Feldvalidierung und Pfad-Ownership über bestehende Host-/Registry-Pfade durchsetzen.
- [ ] 2.3 Bestehende Mutation-Lock- und Idempotenz-Primitiven auf Ressourcenscope und Lebenszyklus prüfen; Studio-Operationen je Dokument/Variante gemeinsam koordinieren, ohne neue Lock-Infrastruktur oder externe Konfliktgarantie.
- [ ] 2.4.1 Feldbezogenen Dreiwegeabgleich für die beiden ersten Feldgruppen mit dem Host-Verbraucher implementieren: Identität, Pfad-Ownership, Setzen/Entfernen, Konflikte einschließlich Containerwechsel und Erhalt fremder Rohwerte.
- [ ] 2.4.2 Den Kern nach Klärung der GraphQL-Lücken an den tatsächlich frischen Lesepfad anschließen; Host-/Plugin-Wiring, Session-/Action-/Tenant-Prüfung und Konfliktanzeige nachweisen. Ein synthetisch übergebener Snapshot ist kein Live-Fresh-Read-Nachweis.
- [ ] 2.5.1 Vollständige Versionskopie im tatsächlichen Host-Ablauf vorbereiten; bestätigte Vorlage, vorhandenes Ziel und vollständigen Bestand prüfen. Kein Create aus einem Teilformular.
- [ ] 2.5.2 Versionskopie an tatsächlichen Variantenbestand, übergreifendes Recht und Create anbinden; gezielte Löschung einschließlich Bestätigung und unabhängigem Abwesenheitsnachweis implementieren.
- [x] 2.6.1 Automatischen Transport-Retry für die bestehende Static-Content-Mutation deaktivieren. Mutationsfehler einschließlich fehlender Antwort-ID mit dem bestehenden terminalen Job-Fehlergrund markieren, damit auch der Handler nicht automatisch wiederholt wird. Acht Mutations- und zwei Lookup-Regressionen prüfen beide Grenzen. Keine neue Outcome-Reconciliation.
- [ ] 2.6.2 Unklaren Ausgang vor einer ausdrücklich ausgelösten Wiederholung tatsächlich abgleichen und den Host-/UI-Status ohne falsche Erfolgs-/Nichtgespeichert-Aussage ausgeben. Fehlender exakter GraphQL-Lesepfad bleibt offen.
- [ ] 2.7.1 Readback-Ergebnisvergleich gemeinsam mit dem tatsächlichen unabhängigen Lesepfad implementieren; Mutation-ID und Fallback-Antwort bestätigen keinen Erfolg.
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

## 5. Abgelöster Vorschau-Editor ohne Mainserver-Write

- [x] 5.1 Begrenzten Lese-/Projektionsvertrag im bestehenden Mainserver-Pfad samt Unit-/Transportnachweis anbinden.
- [x] 5.2 Authentifizierten Host-Aufruf mit bestehendem `integration.manage` und Session-/Instanz-/Principal-Bindung anschließen.
- [x] 5.3 Editor auf „Schnittstellen“ mit Versionsanfrage, tatsächlicher Variante, Allgemein/Design, lokaler Validierung, Vorschau, Verwerfen und sicherem Neu-Laden umsetzen.
- [x] 5.4 Deutsche/englische Texte, gezielte UI-/Auth-/Runtime-Nachweise und aktuelle Dokumentation abschließen.


## 6. Erster Schreibpfad im App-Arbeitsbereich

- [x] 6.1 Live geprüften GraphQL-Vertrag aus SVA-1787, SVA-1788, SVA-1789 und SVA-1792 anbinden. Dateiliste und exakte Version im App-Arbeitsbereich anbieten.
- [x] 6.2 Hostrechte, Sessionbindung und CSRF prüfen. Die zwei vereinbarten Felder revisionsgesichert aktualisieren und ein unabhängiges Readback durchführen.
- [x] 6.3 Geänderte Mainserver-Werte anzeigen, Konflikte je Feld entscheiden und nach Bestätigung erneut lesen.
- [ ] 6.4 Browser- und Runtime-Abnahme über die Studio-Sandbox mit einem ausdrücklich freigegebenen Testdatensatz.

## 7. Variantenaktionen im App-Arbeitsbereich

- [x] 7.1 Zielversion aus gewählter Vorlage im aktuellen GraphQL-Vertrag vollständig kopieren, wenn der Name unverändert bleibt. Vorhandenes Ziel prüfen und Kopie unabhängig verifizieren.
- [x] 7.2 Bestätigte JSON-Variante gezielt per ID löschen, nachprüfen und Rechte sowie Studio-Mutationssperre serverseitig durchsetzen.
- [ ] 7.3 Vollständige Neuanlage für Namen mit Mainserver-Normalisierung nachweisen.
- [ ] 7.4 Browser- und Runtime-Abnahme der Variantenaktionen mit freigegebenen Sandbox-Testdatensätzen.
