## 0. Vertrags- und Scope-Preflight

- [ ] 0.1 Den GraphQL-Vertrag aus Jira `SVA-1753` und Mainserver-Commit `b01aead122485848cd03ea774c12eb9fc3efdd28` gegen eine vorgesehene Dev-Zielumgebung verifizieren.
- [ ] 0.2 Den Studio-Schema-Snapshot ausschließlich aus dem verifizierten Ziel-Schema aktualisieren und `includeInactive`, `SaveCategoryInput`, `saveCategory`, `deleteCategory`, Payloadfehler, `affectedDescendantIds` und Usage-Felder bestätigen.
- [ ] 0.3 Nachweisen, dass die effektiv verwendeten persönlichen und organisatorischen Mainserver-Credentials die erforderliche Management-Rolle besitzen; fehlende Readiness als eigenen Fehler behandeln.
- [x] 0.4 Überschneidungen mit laufenden Changes an Mainserver-Credentials, Plugin-Aktivierung und Admin-Ressourcen prüfen; keine konkurrierende Kategorienroute oder Registry einführen.

## 1. Typisierter Mainserver-Vertrag

- [x] 1.1 Die bestehende Active-only-Kategorienquery kompatibel erhalten und eine getrennte schema-gestützte Management-Query mit vollständigem Kategorienmodell ergänzen.
- [x] 1.2 Typisierte Inputs und GraphQL-Dokumente für `saveCategory` und `deleteCategory` ergänzen.
- [x] 1.3 Runtime-Parser für Kategorie, Parent/Children, Kontakt-E-Mail, Datentypen, Save-Payload, Delete-Payload, Usage und strukturierte Fehler implementieren.
- [x] 1.4 Fachlichen Mutationserfolg nur bei erwarteter Resultat-ID beziehungsweise Kategorie und leerer Upstream-Fehlerliste akzeptieren.
- [ ] 1.5 Service-Tests für Active-only/Management-Read, Create, Update, Reparenting, Statuskaskade, unbekannte Datentypen, Safe-Delete und fehlerhafte Responses ergänzen.

## 2. Host-Route und Autorisierung

- [x] 2.1 Die bestehende Kategorienroute um die explizite Management-Sicht erweitern, ohne den parameterlosen Active-only-Vertrag zu verändern.
- [x] 2.2 `POST` für Create, `PUT /:id` für vollständiges Update und `DELETE /:id` für Safe-Delete an den bestehenden Dispatcher anbinden.
- [x] 2.3 Für Create den vorhandenen Host-Idempotenzpfad mit einem pro Anlegeversuch stabilen `Idempotency-Key` wiederverwenden; Reservation, terminales Replay, nichtterminalen Ausgang ohne automatischen zweiten Upstream-Aufruf, Payload-Konflikt und Ausfall vor dem Upstream-Aufruf testen, ohne neue Persistenz einzuführen.
- [x] 2.4 Request-Bodies und Pfadparameter vor GraphQL validieren; insbesondere Create-IDs, widersprüchliche Update-IDs, leere Namen, negative oder nicht ganzzahlige Positionen, ungültige E-Mail-Adressen und ungültige Datentyp-Identifier ablehnen.
- [x] 2.5 `categories.read`, `categories.create`, `categories.update` und `categories.delete` je Operation unmittelbar vor dem Upstream-Aufruf prüfen.
- [x] 2.6 Credential-, Vertrags-, Validierungs-, Payload- und Transportfehler auf stabile PII-arme Studio-Fehlercodes abbilden.
- [ ] 2.7 Route-Tests für die vollständige Permission-Matrix, Organisationskontext, fremde IDs, Methoden, Logging und Nichtaufruf des Upstreams bei Denial ergänzen.

## 3. Kategorienmodell und Plugin-API

- [x] 3.1 Die Plugin-Typen vom bisherigen `tagList`-Read-Modell auf das vollständige Management-Modell erweitern; der Active-only-Auswahlvertrag bleibt separat kompatibel.
- [x] 3.2 Clientfunktionen für Management-Read, Create, Update und Delete mit strikter Response-Normalisierung ergänzen.
- [x] 3.3 Im bestehenden App-Routenadapter `studioBuildTimeRegistry.mainserverGenericTypeRegistry` in lokalisierte `{ value, label }`-Optionen projizieren und an `CategoriesPage` übergeben; bestätigte Legacy-Mainserver-Typen pluginintern übersetzt ergänzen, ohne Host-Import, zweite Registry oder neuen SDK-Beitragstyp.
- [x] 3.4 Bereits gespeicherte, aktuell nicht auswählbare Datentypen sichtbar und roundtrip-sicher erhalten; keine freie Texteingabe zulassen.
- [ ] 3.5 API-Tests für Normalisierung, Leerwerte, unbekannte Werte, Feldfehler, Usage und fehlerhafte Payloads ergänzen.

## 4. Management-Oberfläche

- [x] 4.1 Die bestehende Tabelle um Aktivstatus, verständliche Hierarchie, Position und Datentypen ergänzen; ID und technische Daten nur soweit für Administration nötig anzeigen.
- [x] 4.2 Create, Edit und „Neue Unterkategorie“ mit einem gemeinsamen zugänglichen Formular für Name, Status, Parent, Position, Icon, E-Mail und Datentypen umsetzen; Create startet aktiv und gleiche Positionen werden stabil nach Name und ID dargestellt.
- [x] 4.3 Parent-Auswahl clientseitig um aktuelle Kategorie und bekannte Nachfahren bereinigen; Root-Zuordnung explizit unterstützen und Serverfehler am Parent-Feld darstellen.
- [x] 4.4 Vor kaskadierendem Statuswechsel die Wirkung auf Nachfahren bestätigen und nach Erfolg die tatsächlichen `affectedDescendantIds` auswerten.
- [x] 4.5 Safe-Delete mit konkreter Bestätigung, Erfolgsauswertung und strukturierter Darstellung aller Usage-Zahlen umsetzen.
- [x] 4.6 Create-, Update- und Delete-Aktionen unabhängig anhand der effektiven Actions anzeigen beziehungsweise deaktivieren; Server-Denials weiterhin verständlich behandeln.
- [x] 4.7 Lade-, Leer-, Mutation-, Erfolgs-, Feldfehler-, Vertrags-, Credential- und unbekannte Fehlerzustände vollständig für Deutsch und Englisch lokalisieren.
- [x] 4.8 Fokusführung, Tastaturbedienung, Screenreader-Beschriftung, Statusankündigungen und Touch-Zielgrößen mit vorhandenen Studio-/shadcn-Primitives umsetzen.

## 5. Tests und direkte Evidenz

- [ ] 5.1 Unit- und Komponententests für Create einschließlich terminalem Replay und Management-Re-Read bei nichtterminalem Ausgang, Update, Unterkategorie, Root-Verschiebung, Zyklusfilter, Aktivstatus, Datentyp-Roundtrip und Delete-Usage ergänzen.
- [x] 5.2 Regressionstests nachweisen lassen, dass Content-Kategorieauswahlen weiterhin ausschließlich aktive Kategorien erhalten.
- [ ] 5.3 Accessibility-Tests für Formular, Parent-/Datentypauswahl, Bestätigungsdialoge und Fehlermeldungen ergänzen.
- [ ] 5.4 Einen E2E-Flow für Management-Read, Create, Update/Reparenting, Deaktivieren/Reaktivieren und Safe-Delete abdecken; destructive Testdaten eindeutig markieren und bereinigen.
- [ ] 5.5 Die Invarianten in `assurance.md` mit ausgeführter Evidenz für den exakten finalen HEAD oder einer ausdrücklich akzeptierten Restrisikoentscheidung aktualisieren.

## 6. Dokumentation und Architektur

- [x] 6.1 Kategorien-Anwenderdokumentation und kontextuelle Hilfe für Verwaltung, Statuskaskade, Datentypen und Delete-Blockaden aktualisieren.
- [x] 6.2 Mainserver-Vertrags- beziehungsweise Betriebsdokumentation um erforderliche Version, Management-Rolle und Readiness-Fehler ergänzen.
- [x] 6.3 Die arc42-Abschnitte 05, 06 und 08 auf Package-Verantwortung, Management-Request-Flow, Action-Matrix und Fehler-/Datenschutzvertrag prüfen und bei Bedarf aktualisieren; eine begründete Nichtänderung dokumentieren.
- [x] 6.4 Bestätigen, dass keine Studio-Datenbankschemaänderung vorliegt; andernfalls vor Umsetzung stoppen und den Change einschließlich Schema-Snapshot neu zuschneiden.
- [x] 6.5 Einen nutzerverständlichen Changelog-Eintrag für die neue Kategorienverwaltung ergänzen.

## 7. Gates und Rollout

- [x] 7.1 Früh die gezielten Unit-/Type-Gates für `plugin-categories` und `sva-mainserver` sowie `pnpm check:server-runtime` ausführen.
- [x] 7.2 Vor PR-Freigabe `pnpm check:file-placement`, die relevanten Nx-Gates und den strikten OpenSpec-Check ausführen; breite Gates gemäß `DEVELOPMENT_RULES.md` und tatsächlichem affected Scope auswählen.
- [ ] 7.3 In Dev die Positiv-/Negativmatrix für zwei Municipalities, alle vier Actions, unbekannte Datentypen, Statuskaskade und alle Delete-Usage-Kategorien nachweisen.
- [ ] 7.4 Studio erst nach bestätigtem Mainserver-Vertrag und Management-Credential-Readiness über `Build` → Dev → Staging → Production mit demselben Image-Digest promoten.
- [ ] 7.5 Vor Production die Browserabnahme für Create, Update, Reparenting, Deaktivieren/Reaktivieren und blockiertes/erfolgreiches Löschen in Staging dokumentieren.
