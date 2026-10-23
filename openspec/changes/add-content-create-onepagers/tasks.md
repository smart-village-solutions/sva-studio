## 1. Baseline und bestehende Verträge

- [x] 1.1 Vor Implementierung Ziel, Nicht-Ziele und maximal betroffene Bereiche aus dem Proposal als PR-Scope festhalten; aktuelle Editor-Kompositionen und relevante laufende Changes gegen den Quellstand prüfen.
- [x] 1.2 Gemäß AGENTS.md bei verfügbarem XERJ `studio-code` und passende Referenz nach bestehender Abschnittskomposition/Fehlerfokus durchsuchen, Fundstellen und Indexstand prüfen; ohne passenden Treffer im zuständigen Projektpfad bleiben.
- [x] 1.3 Vorhandene Feldabschnitte, Formular-/Submit-Owner und Default-/Mapping-Verträge der acht Plugins prüfen. Modellfelder ohne sichtbare Eingabe explizit von der Migration ausschließen.
- [x] 1.4 Pro Plugin vor Umstellung einen kleinen aussagekräftigen Editor-Test für Create und Edit grün nachweisen; keine breite lokale Suite als Vorbedingung.

- [x] 1.5 Für die sieben redaktionellen Typen vorhandene Pflichtangaben, Anzeigeorte erklärungsbedürftiger Texte und Speicher-/Sichtbarkeits-/Statusverträge einschließlich News-Push prüfen; ungeklärte Semantik vor der Textfestlegung klären und keine Terminierung erfinden.
- [x] 1.6 Bestehende öffentliche Integration für den Schutz ungespeicherter Eingaben prüfen. Nur falls passend vorhanden anbinden; andernfalls neue Warnfunktion aus dieser Lieferung ausschließen, ohne Host-/SDK-Ausbau. Bestehende Save-/Medienreferenz-Teilerfolge erhalten.

- [x] 1.7 Ownership-Schnitt aus `design.md` gegen Standard Path und Studio-UI-Boundary prüfen: öffentliche UI-Exporte/Seitenaktionen wiederverwenden, Fachkomposition und Übersetzungen pluginlokal halten. Keine neuen Integrationsverträge oder Allowlist-Ausnahmen.

## 2. Onepager pluginweise umsetzen

Für jeden Punkt: vorhandene Feldabschnitte wiederverwenden, Reihenfolge aus `design.md` herstellen, Create-Tabs ersetzen, Edit-Tabs erhalten; Einstieg, Feldhilfen, Pflicht-/Optional-Kennzeichnung, Zusatzbereichszusammenfassungen und belegte Speicherwirkung für die sieben redaktionellen Typen ergänzen und unmittelbar gezielte Unit-/Type-Gates ausführen. Neue lokale Feldabschnitte ersetzen alten Inline-Code im selben Abschnitt; kein paralleler Feld-/Speicherpfad.

- [x] 2.1 FAQ mit allen sechs direkt sichtbaren Feldern umstellen; Nur-Text-Vertrag und fehlenden Create-Historienbereich absichern.
- [x] 2.2 Cockpit-Karten einschließlich Medien, Linkgruppe und Publikationsfeldern umstellen.
- [x] 2.3 Projekte einschließlich Galerie und bestehendem Statusvertrag umstellen.
- [x] 2.4 Nachrichten einschließlich Veröffentlichung, bedingtem Push, Bestätigung und bestehendem Zielgebiet umstellen; keine Legacy-Felder einblenden.
- [x] 2.5 Veranstaltungen einschließlich Terminen/Wiederholung, Adressen und Zusatzbereichen umstellen; POI-Verknüpfung, Barrierefreiheit, Keywords und Tags verborgen halten.
- [x] 2.6 POI einschließlich Standort/Karte, Kontakt, Öffnungszeiten, Preisen und Betreiber umstellen; keine bisher verborgenen Modellfelder ergänzen.
- [x] 2.7 Generische Inhalte als technischen Sonderfall ohne zusätzlichen Einsteigerflow einschließlich Inhaltsblöcken, wiederholbaren Zusatzdaten und validierter JSON-Payload umstellen.
- [x] 2.8 Umfragen einschließlich Fragen/Optionen, Teilnahmebedingungen und Ergebnisfreigabe umstellen; Create-Hinweistabs entfernen und Edit-Moderation/-Ergebnisse/-Historie erhalten.

- [x] 2.9 Vorhandene Schutz-, Fehler- und Retry-Verträge an berührten Stellen erhalten; Verlassenswarnung über die in Abschnitt 5 freigegebene öffentliche React-Anbindung integrieren. Bestehenden News-Zustand „angelegt, Weiterleitung fehlgeschlagen“ einschließlich Öffnen-Aktion erhalten. Vorhandene Entwurfsfortsetzung verständlich benennen.

## 3. Gemeinsame Akzeptanz absichern

Nachweise folgen geändertem Verhalten: Pro Plugin Feldfolge/-Erreichbarkeit, bestehenden Save-Input und Edit-Erhalt prüfen. Gemeinsame Klapp-, Fokus- und Aktionsmechanik einmal repräsentativ absichern, sofern tatsächlich dieselbe Implementierung verwendet wird; unterschiedliche Implementierungen gezielt prüfen. Medien-, Push- und Statusfälle nur beim zuständigen berührten Plugin. Keine achtfache Wiederholung unveränderter gemeinsamer Verträge.

- [x] 3.1 In den bestehenden Editor-Tests aller acht Plugins Create ohne Tablist, Reihenfolge der Hauptabschnitte und Erreichbarkeit aller bisher sichtbaren zulässigen Felder prüfen.
- [x] 3.2 Werteerhaltung beim Öffnen/Schließen, Fehleröffnung/-fokus, Wiederholungsfelder und genau einen bestehenden Submit-Pfad prüfen; bestehende Default-/Serialisierungstests weiterverwenden.
- [x] 3.3 Medienauswahl, Reihenfolge, Metadaten und Save-/Referenz-Retry an den berührten Pfaden gezielt regressionsprüfen; keine doppelten Medieninstanzen oder Registrierungen.
- [x] 3.4 Edit-Tabs einschließlich Historie sowie Umfrage-Moderation/-Ergebnisse gezielt regressionsprüfen; bestehende Permissions und Principal-Auswahl nicht ändern.
- [x] 3.5 Tastaturbedienung, Fehlerfokus, semantische Überschriften und Sprunglinks sowie schmale/breite Darstellung prüfen; Sprungziel auch bei geschlossenem Abschnitt sichtbar und ohne Verlassenswarnung. Neue Texte in de/en vervollständigen.
- [x] 3.6 Vorhandene Browser-Akzeptanz um einen vollständigen einfachen Create-Flow (FAQ) und einen komplexen Flow mit Zusatzbereich/Validierungsfehler erweitern. Nur bei tatsächlich angebundener Warnfunktion den komplexen Flow um Navigation abbrechen (Eingaben erhalten), Verwerfen bestätigen (Ziel erreicht) und unterstützten nativen Reload-Dialog ergänzen; kein achtfacher Browsernachweis.

- [x] 3.7 Hilfen, Pflicht-/Optional-Kennzeichnung, Einstiege und aktuelle Zusammenfassungen gezielt prüfen. Obere Aktionsbezeichnung/Push-Hinweis und untere Wirkungsbeschreibung aus demselben Formularzustand sowie lokalen Hinweis auf bedingte Push-Rücksetzung beim zuständigen Plugin prüfen.
- [x] 3.8 Nur tatsächlich angebundenen Verlassensschutz gezielt prüfen: unverändertes/geändertes Formular, Verwerfen abbrechen/bestätigen und bestätigter Save ohne erneute Warnung. Vorhandene News-Tests für Medien-Teilerfolg und fehlgeschlagene Weiterleitung weiterverwenden; keine zweite Create-Mutation.
- [x] 3.9 Akzeptanzentscheidung mit dem Nutzer festhalten: Ein Durchlauf mit ungeschulten Personen wurde nicht durchgeführt. Der Nutzer verzichtet aktuell auf diesen Nachweis und bewertet die Praxistauglichkeit anhand des Kundenfeedbacks; dies ist kein aktueller Abschlussblocker. Automatisierte Prüfungen bleiben technische Evidenz und werden nicht als menschlicher Verständlichkeitstest dargestellt.

- [x] 3.10 Fehlerfalltabelle als Erhaltungsregel ausschließlich an tatsächlich geänderten Darstellungsstellen prüfen. Keine Fehlerfallmatrix für alle acht Plugins und keine allgemeine Host-Fehlersanierung. Bestehende Tests wiederverwenden; keine neue Fehler-/Recovery-Infrastruktur.

## 4. Dokumentation und Abschluss

- [x] 4.1 Bestehende Formularinventur um Create-Onepager bei unveränderten Formular-/Submit-/Mapping-Ownern aktualisieren. Betroffene Benutzerhilfe in de/en um Orientierung, Speicherwirkung und vorhandene Entwurfsfortsetzung aktualisieren. Arc42 05, 08 und 10 prüfen und nur betroffene Passagen fortschreiben; unveränderte Grenzen begründen.
- [x] 4.2 Passende vorhandene Nx-Targets für betroffene Unit-/Type-/Lint-Gates ausführen; Dateifilter als `--testFiles=...`. Vor einem affected-Unit-Lauf Scope messen und bei mehr als sechs Projekten gezielt testen; breite finale Gates der CI überlassen.
- [x] 4.3 `pnpm check:plugin-ui-boundary`, `pnpm check:plugin-architecture-boundary`, `pnpm check:file-placement`, `pnpm exec openspec validate add-content-create-onepagers --strict` und `git diff --check` ausführen.
- [x] 4.4 Bilanz neu hinzugefügter/entfernter Komponenten und Ausführungspfade prüfen: keine duplizierten Feldkomponenten, neue Registry, Formular-Engine, API oder Persistenzschicht. Finale CI-Evidenz bei PR-Erstellung für den exakten HEAD prüfen.

## Lokaler Umsetzungsstand vor der freigegebenen Ergänzung (2026-10-23)

- Scope: acht pluginlokale Create-Kompositionen; bestehende Edit-, Formular-, Validierungs-, Save- und Medienverträge erhalten. Keine SDK-, Shared-UI-, Host-Routing-, Schema- oder Persistenzänderung. Neue produktive Dateien ausschließlich die beiden fachlichen Create-Kompositionen für Events und POI; übrige Feldabschnitte wurden im bestehenden Pfad erweitert und für beide Modi wiederverwendet.
- Die damals fehlende öffentliche Verlassenswarnung wird durch die nachträglich freigegebene Ergänzung in Abschnitt 5 geliefert. Vorhandene Teilerfolgs-/Retrypfade bleiben erhalten.
- Plugin-Gates: FAQ 25, Kacheln 37, Projekte 28 sowie 28 Events-/35 POI-Editor-Tests grün; News 61 gezielte Tests grün, Umfragen 103 Projekt-Tests plus 12 finale Editor-/Seitentests grün, generische Items 44 Projekt-Tests plus 7 finale Seitentests grün. Alle acht Plugin-Typechecks und Lints grün. Kleine Folgekorrektur der Pflichtkennzeichnung für FAQ-/Kachel-Sortiergewicht zusätzlich gezielt geprüft.
- UI-Boundary, Dateiplatzierung, OpenSpec strict und `git diff --check` grün. Architektur-Guard meldet weiterhin die unveränderten Bestandssignale `plugin-ssf/src/server.ts` und `plugin-waste-management/src/server.ts`; keine neuen Ausnahmen eingeführt.
- Zusätzliches App-Typegate ausgeführt: `sva-studio-react:test:types` endet mit `TS2589` in den unveränderten Dateien `packages/auth-runtime/src/iam-instance-registry/core.ts:35` und `core-mutations.ts:24`. Kein vollständig grüner App-Typecheck behauptet; keine Erweiterung auf IAM.
- Browsernachweise laufen mit lokalem `local-builder`, leerem Browserzustand und abgefangenen Schreibrequests. Nach unerwartetem echtem Login durch das bestehende Auth-Setup wurde dieser Weg gestoppt; der weitere isolierte Lauf überspringt das Auth-Setup ausdrücklich. Die direkte Playwright-Ausführung vermeidet die Kollision der Nx-Option `project` mit der Playwright-Projektauswahl; der vorhandene Test-/Serveraufbau bleibt bestehen.
- Der Durchlauf mit tatsächlich ungeschulten Personen (3.9) wurde nicht durchgeführt; die spätere Nutzerentscheidung ersetzt ihn aktuell durch Kundenfeedback. Automatisierte Tests sind kein Ersatz. Es wurden weder PR, Push noch Deployment beauftragt oder ausgeführt; CI-Evidenz ist bei einem späteren PR-Auftrag neu zu erheben.

- Browserabschluss: neun gezielte Chromium-Nachweise grün über fokussierte Läufe: FAQ-Create/Edit/Delete, Kachel-Text/Medien/Reload, POI-CRUD, Event-CRUD auf schmalem Bildschirm mit Tastatur-Sprunglink sowie Fehleröffnung/Fokus im geschlossenen Zusatzbereich, Event-/POI-Create-Axe, Projekt-Galerie/CRUD, News-Veröffentlichung/Push und lokaler News-Medien-Lifecycle. Veraltete Tab-/Save-Selektoren angepasst; bei Event-/POI-Summary-Zielen ist ein kleiner lokaler Fokus-Handler nach dem Browserbefund nötig, die übrigen Abschnittsziele bleiben ohne Zusatzhandler. Keine neue Navigationsabstraktion.


## 5. Freigegebene Ergänzung: gemeinsame Verlassenswarnung

Die spätere ausdrückliche Nutzerfreigabe ersetzt die vorherige Begrenzung „nur bei bereits vorhandener Integration“. Der zusätzliche Scope umfasst ausschließlich eine schmale React-Anbindung im UI-Package, deren Host-Rahmen und die acht Create-Editoren; keine neue SDK-/Manifest-API oder globale Navigationsarchitektur.

- [x] 5.1 Bestehende Host-, Router-, Formular- und Medien-Save-Pfade prüfen; baselinegezielte Tests vor Änderung ausführen.
- [x] 5.2 Wertfreie gemeinsame React-Anbindung und einen Host-Checker mit vorhandenem Router-Blocker/Bestätigungsdialog und de/en-Texten implementieren; Cleanup, Schließen/Reload, synchrones Ack und lokale Abschnittssprünge absichern.
- [x] 5.3 Alle acht Create-Editoren mit tatsächlichen Formular-/Medienänderungen anbinden; bestehende Save-/Retrypfade revisionssicher quittieren und bestätigte IDs gegen doppelte Anlage schützen.
- [x] 5.4 Gezielte Plugin-/Host-/Shared-Tests, Type-/Lint-Gates und Boundaryprüfungen für den finalen Quellstand ausführen.
- [x] 5.5 Repräsentativer echter Browsernachweis: clean verlassen, Änderungen schützen, Abbrechen/Verwerfen, Browser-Zurück, nativer Reload-Dialog und erfolgreicher Save ohne Warnung. Ausschließlich lokaler Mock-Login ohne Auth-Setup.
- [x] 5.6 Bestehende Doku und Oberflächenbilanz fortschreiben; keine globale Formular-/Recoveryarchitektur und keine fachfremden Änderungen.

### Stand der Ergänzung

- Neue produktive Bausteine: eine wertfreie React-Anbindung im bestehenden UI-Package und ein Host-Rahmen am bestehenden Plugin-Editorpfad; jeweils eigene gezielte Tests. Ein lokaler Checker ersetzt jede Registry. Fachliche Dirty-/Save-/Medienzustände bleiben in den Plugins; SDK, Manifest, Server, Datenbank und Persistenz bleiben unverändert.
- Die acht Create-Editoren verwenden Revisionen für vollständige Saves und bestehende Medien-Retries. Bestätigte IDs sperren weitere Anlage und bleiben per vorhandener Edit-Route erreichbar. Medien hinzufügen und wieder entfernen bleibt vor erster Anlage sauber. Fehlende leere Datumsdefaults bei FAQ/Kacheln sind lokal normalisiert, ohne leere Datumswerte an die API zu senden.
- Shared-Nachweise sichern zusätzlich benannte RHF-Initialereignisse ohne falsche Dirty-Meldung und Rücksetzen auf den ursprünglichen Default während eines laufenden Saves. Ein bestätigter älterer Serverstand wird dadurch nicht mit dem neueren Formularstand verwechselt.

- Browser-Zurück/Abbrechen deckte einen bestehenden Host-Lifecyclefehler auf: Router-Reload derselben URL entfernte über das Shell-Ladeskelett den Editor. Der Root-Loading-Selektor unterscheidet nun tatsächliche URL-Wechsel von diesem Reload; keine Form-Snapshots, DOM-Recovery oder neue Navigationsschicht. Der vorhandene Root-Test und der echte Browserfall sichern den Eingabenerhalt ab.

- Finale gezielte Gates: Shared 6 Tests, Host-Boundary 5 Tests und bestehende Host-Bindings, Root 15 Tests sowie die geänderten Guard-/Save-/Medienfälle aller acht Plugins grün; Shared-/Plugin-Types und gezielte Plugin-/Shared-/Boundary-Lints grün. Der zunächst gemeldete Root-Lint-Befund am unveränderten Import `@sva/routing/documentation` ist in der nachgelagerten Klärung unten behandelt. Das nachgelagerte vollständige App-Typegate ist nach der unten beschriebenen Parserkorrektur grün. UI-Boundary, Dateiplatzierung und OpenSpec strict grün; der Architektur-Guard meldet nur die oben genannten bestehenden Runtime-Pfadsignale.

- Finaler echter Chromium-Nachweis grün: FAQ unverändert verlassen, interne Navigation abbrechen/bestätigen, Browser-Zurück abbrechen mit Werteerhalt, nativen Reload-Dialog auslösen/abbrechen mit Werteerhalt und anschließend erfolgreicher Save ohne Warnung; bestehende Edit-/History-/Update-/Delete- und Axe-Prüfungen bestehen weiter. Separater News-Browserlauf für lokalen Bildentwurf, bewusstes Verwerfen, anschließende Anlage und vollständigen Medien-Lifecycle ebenfalls grün. Beide Läufe ausschließlich sequenziell im lokalen Mock-Profil ohne Auth-Setup.
- Technische Umsetzung einschließlich Ergänzung abgeschlossen. Der menschliche Verständlichkeitsnachweis aus 3.9 ist nach späterer Nutzerentscheidung kein Abschlussblocker; die Praxistauglichkeit wird anhand des Kundenfeedbacks bewertet. PR-/CI-/Rolloutarbeit erfolgt jeweils im beauftragten Umfang.

### Nachgelagerte Klärung der Bestandsbefunde

- Die beiden `TS2589`-Fehler waren auf den Vergleich vollständiger Zod-Schemata über Paketgrenzen zurückzuführen: Workspace-Importer nutzen 4.4.3, injizierte Runtime-Snapshots im bestehenden Lockfile 4.6.5. Der vorhandene gemeinsame Body-Parser beschreibt nun nur das tatsächlich verwendete `safeParse(unknown)`-Ergebnis (typisierte Daten oder Issues mit Pfad/Meldung); der Registry-Adapter leitet seinen Eingabetyp davon ab. Keine Casts, Dependency-Upgrades, neuen Dateien oder Änderung der Laufzeitvalidierung. Der vollständige App-Typecheck und der Auth-Runtime-Typecheck sind grün; gezielte Tests sichern weiterhin ungültiges JSON, Schemafehler, Transformationen und die IAM-Handlerverdrahtung ab.
- Die SSF-/Waste-Meldungen sind `review-required-path-signal` für manifeste Server-Einstiegspunkte, keine festgestellten verbotenen Importkanten. Die bestehende Plugin-Entwicklungsdokumentation enthält deren Bewertung anhand der tatsächlichen Host-Verbraucher. Der Reporter nennt jetzt Regel, konkrete Meldung und nur bei echten Importen eine Kante; die beiden Review-Hinweise bleiben sichtbar. Guard-Regeln, Strict-Verhalten und Import-Allowlist bleiben unverändert. 21 gezielte Guardtests, Skript-Typecheck und gezielter Lint sind grün.

- Abschlussnachweis der Bestandskorrektur: vollständiger App-Typecheck nach Neubau der Serverpakete ohne Nx-Cache grün; Auth-Runtime-Typecheck grün; verpflichtendes `pnpm check:server-runtime` mit allen 20 Projekten einschließlich abhängiger Builds grün. 30 gezielte Unit-Tests, betroffene Lints, Skript-Typecheck, Dateiplatzierung und Diffcheck grün. Beide angefragten Bestandsbefunde sind damit behoben beziehungsweise nachvollziehbar bewertet; der separat dokumentierte Root-Lint-Befund wurde anschließend wie unten beschrieben bearbeitet.

### Klärung des Root-Lint-Befunds

- Der einzelne Root-Dateilauf reproduzierte `noImportsOfLazyLoadedLibraries`, während der vollständige App-Lint bereits ohne Fehler lief. Der separate Export `@sva/routing/documentation` wird vom Root synchron für die aktive Dokumentations-ID benötigt und enthält ausschließlich Metadaten-Helfer sowie einen Type-Import. Er zieht keine Route-Factories oder Servermodule in den synchronen Pfad.
- Nx löst den Unterpfad im isolierten Lauf auf dessen Source-Alias auf, erkennt diesen aber nicht als den im Package-Export deklarierten dist-Einstieg. Die bestehende Nx-Option `checkDynamicDependenciesExceptions` enthält deshalb ausschließlich den exakten Unterpfad `@sva/routing/documentation`. Kein Wildcard, keine allgemeine Allowlist und keine Abschaltung der Boundary-Regel. Der bestehende Package-README beschreibt den Schnitt; keine neue Datei oder Laufzeitlogik.
- Positiv-/Negativnachweis mit dem echten ESLint-Runner: Dokumentations-Unterpfad ohne Boundary-Befund; ein statischer Import von `getClientRouteFactories` aus dem lazy geladenen Haupteinstieg `@sva/routing` wird weiterhin abgelehnt.

- Finaler Nachweis: isolierter Root-Lint ohne Cache grün; vollständiger App-Lint ohne Cache mit 0 Fehlern und 14 unveränderten Bestandswarnungen grün. Root-Tests 15/15, Dokumentations-Metadaten-Tests 3/3 und vollständiger App-Typecheck ohne Cache grün. Keine Laufzeitdatei geändert; Korrekturumfang ausschließlich bestehende ESLint-Konfiguration und bestehende Dokumentation.

### PR-Auftrag

- Ziel: Create-Onepager mit verständlicher Speicherwirkung und revisionssicherem Verlassensschutz für die acht vorhandenen Inhaltseditoren liefern und die während der Abnahme identifizierten Typ-/Lint-/Reporter-Befunde abschließen.
- Nicht-Ziele: weitere Inhaltstypen, neue Fachfelder/Mutationsverträge, Datenbank- oder Credentialänderungen, Autosave, Deployment und Merge. Maximaler Scope: die acht Plugin-Editoren und ihre Tests/Übersetzungen, vorhandener Host-Routing-/Root-Rahmen, schmale Shared-UI-Anbindung, bestehende Parser-Typgrenze und Architektur-Reporter sowie zugehörige Dokumentation und gezielte Lint-Konfiguration.
- Der Media-Vorgänger PR #1956 ist gemergt. Der PR wird deshalb auf dem aktuellen `main` isoliert; die fremde Keycloak-Upgrade-Spezifikation bleibt ausgeschlossen. Kundenfeedback ersetzt nach ausdrücklicher Nutzerentscheidung derzeit den nicht durchgeführten Redakteurstest als Abnahmeweg für die Praxistauglichkeit.

### PR-Vorbereitung und aktueller Freigabestatus

- Isolierter PR-Worktree auf aktuellem `origin/main` nach Merge von Media-PR #1956. Fremde Keycloak-Spezifikation und bereits gemergte Contextual-Help-Änderungen sind nicht Teil des Diffs.
- Auf der isolierten Basis erneut grün: Root-/Host-Boundary-Tests 20/20, Shared-Guard-Tests 6/6, vollständiger App-Lint mit 0 Fehlern und 14 Bestandswarnungen, OpenSpec strict, Dateiplatzierung und Diffcheck. Ein erster Teststart scheiterte ausschließlich an noch nicht gebauten SDK-Artefakten im frischen Worktree; nach dem regulären SDK-Build bestand derselbe Testlauf. Keine Source-Korrektur oder Test-Retry-Ausnahme dafür eingeführt.
- Zusätzliches PR-Gate `pnpm complexity-gate --base=origin/main`: rot mit 42 nicht getrackten Größen-/Komplexitätsbefunden in den berührten Editorpfaden (Dateizeilen, Funktionslänge und zyklomatische Komplexität). Damit ist die technische Funktionsprüfung kein vollständiger Merge-Nachweis. Die Qualitätsbefunde bleiben blockierend offen; keine Grenzwert-/Baseline-Änderung und keine späte breite Zerlegung in diesem PR-Vorbereitungsschritt. Veröffentlichung als Draft zur konkreten Prüfung; kein Merge oder Rollout.

- Veröffentlicht als Draft: [PR #1959](https://github.com/smart-village-solutions/sva-studio/pull/1959), Branch `feature/content-create-onepagers-pr` gegen `main`. Die 42 lokalen Komplexitätsbefunde sind im PR als offene Merge-Blocker benannt. Der Studio-Changelog-Eintrag beschreibt die nutzersichtbare Änderung; GitHub-CI und Coverage/Sonar werden getrennt vom bereits vorliegenden Funktionsnachweis beurteilt.


### PR-Reviewkorrektur: Komplexität

- Die 42 im Draft ausgewiesenen offenen Größen-/Komplexitätsbefunde wurden im bestehenden Editorpfad behoben. Formularabschnitte, Save-Validierung, Create-/Medienzustände und Übersetzungsfragmente sind lokal nach ihrer bestehenden Verantwortung getrennt; keine neue gemeinsame Abstraktion, kein neuer Mutationsvertrag und keine parallelen Ausführungspfade.
- Grenzwerte, Tracking-Tickets und Baselines bleiben unverändert. Der vollständige lokale `pnpm complexity-gate` bewertet einschließlich der ausgelagerten Dateien 3425 Quelldateien mit **0 neuen/ungetrackten Befunden**; 199 bestehende getrackte Befunde bleiben separat sichtbar. Auch der diffbezogene Lauf gegen `origin/main` ist grün.
- Gezielte Unit-/Type-/Lint-Nachweise verwenden weiterhin die vorhandenen Plugin-Targets. Die bestehenden Save-/Retry-/Dirty- und Seitentests prüfen die verlagerten Implementierungen über ihre tatsächlichen Verbraucher; unabhängige Code- und Testreviews haben keine zusätzlichen Blocker bestätigt. Browsernachweise wurden für diese verhaltenserhaltende Korrektur nicht erneut ausgeführt.
- Die abschließenden Editorläufe sind fachlich grün. Drei POI-UI-Fälle liefen bei paralleler lokaler Last zunächst in das unveränderte 5-Sekunden-Timeout; die gezielte Wiederholung ausschließlich dieser drei Tests mit einem Worker besteht in jeweils 0,6–1,4 Sekunden. Keine Test-Timeouts oder Assertions wurden verändert.
- GitHub-Gates einschließlich Coverage sind für den nachfolgenden Commit erneut erforderlich; frühere grüne Checks werden nicht auf den neuen HEAD übertragen. Kein Merge und kein Rollout.

- Nach dem ersten Push meldete das strengere App-Type-Gate zwei ungenutzte Bindings in den berührten Plugin-Dateien. Beide sind entfernt; `pnpm nx run sva-studio-react:test:types` ist einschließlich der 29 abhängigen Targets lokal grün. Keine zusätzliche Logik und keine Test-/Konfigurationsänderung.
