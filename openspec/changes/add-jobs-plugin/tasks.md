# Aufgaben und Nachweise

Status am 07.11.2026: Lokale Studio-Implementierung im eigenen Worktree `feature/jobs-plugin` abgeschlossen und gezielt geprüft. Der Nutzer hat die Fortsetzung vor dem Mainserver-Fix ausdrücklich freigegeben; ausschließlich die Neuerzeugung der technischen Importreferenz bleibt vorübergehend akzeptiert. SVA-1786 wurde für Daniel Külpmann erstellt und unabhängig zurückgelesen. Kein Mainserver-Quellcode, keine Live-Daten, kein Push, PR, Merge oder Rollout wurden verändert beziehungsweise ausgeführt. Zielinstanz-/App-Abnahme bleibt ausdrücklich offen.

## 1. Entwurf und Vertragsnachweis

- [x] 1.1 Legacy-CMS sowie aktuelle Studio-Gutschein-, Baustellen-, Kategorie- und GenericItem-Pfade lesend untersuchen; Abweichungen und Scope im Proposal/Design festhalten.
- [x] 1.2 Schriftlichen Entwurf fachlich prüfen und vor Implementierungsplanung bestätigen; offene Grenzen insbesondere bei Kategorieerhalt, externer ID und Lösch-Readback nachvollziehbar entscheiden. Nutzer hat nach Vorlage des schriftlichen Entwurfs den Umsetzungsstart ausdrücklich beauftragt.
- [x] 1.3 Vor Codeänderungen verfügbare XERJ-Referenzen in `studio-code` und `payload-code` oder `keystone-code` suchen, Indexstand und Lizenz prüfen und Fundstellen am aktuellen Quellstand bestätigen. Studio-Index `60059753b161236d0fd0b1ca6ffd99ab5feb2a48` ist älter als der Worktree-Basisstand; aktueller zuständiger Projektpfad wurde direkt geprüft. Payload-Index `a08fbed56e07b51ab82d24188d06cb8b45ea4847` liefert Dokumentupdates, keinen passenden externen Rails-Erhaltvertrag. Kein Referenzcode übernommen, daher kein Code-Lizenztransfer.
- [x] 1.4 Vollständige Job-Read-/Write-/Delete-Feldinventur gegen maßgeblichen Mainserver-Quellstand und Schema-Snapshot prüfen; Abhängigkeiten, Null-/Leersemantik, gefilterte Kategorien, typübergreifende externe-ID-Upserts/Bereinigung, verschwundenes Updateziel und technische Integrationsrolle belegen. Abgeschlossen mit negativem Erhaltbefund: `external_reference.last_import_run_id` kann durch normale Updates verloren gehen und ist über GraphQL nicht les-/schreibbar. Die Reproduktion und unabhängige Reviewbestätigung stehen im Design. Anschließend ist ausschließlich die technische Importreferenz als Ausnahme akzeptiert; eine technische Ziel-/Live-Rollenprüfung ist weiterhin kein erbrachter Nachweis.
- [x] 1.5 Kleinsten echten Roundtrip mit repräsentativer Legacy-Fixture, ersetzender Mutation und unabhängigem Readback nachweisen. Bei nicht erfüllbarer Schutzanforderung vor weiterem Implementieren stoppen.

## 2. Bestehende Adapter und Plugin-Einbindung erweitern

- [x] 2.1 Plugin über passenden vorhandenen Nx-Generator nach Discovery/Source-Review/Dry-Run erzeugen; ohne geeigneten Generator begründet im bestehenden Package-Muster bleiben. Workspace-Abhängigkeiten über Package-Manager-Befehle mit `workspace:*` verbinden.
- [x] 2.2 Vorhandenen Studio-Mainserver-Pfad um exakten Job-Read/Write, Snapshot-Erhalt, Fingerprint, Idempotenz und unabhängigen Readback erweitern; früh `pnpm check:server-runtime` und kleinste passende Vitest-/Type-Gates ausführen.
- [x] 2.3 Operationsgebundene Wiederaufnahme bei verlorener Antwort einschließlich ausdrücklich eingegebener externer ID, Mehrdeutigkeit, Reload und lokaler Teilfehler nachweisen; typübergreifenden providergebundenen Kollisionsread vor Create absichern; keine automatischen Provider-Retries.
- [x] 2.4 Bestehenden Kategorie-Lookup für exakt getaggte Anstellungsarten und Job-Rechte erweitern; Altwerte erhalten und neuen Input serverseitig prüfen. Gefilterter/unvollständiger Snapshot und gefährdeter Kategorieerhalt sperren Updates.
- [x] 2.5 Jobs-Modul, Fachrechte, Views, Routing, Distribution, Content-Projektion und Ownership über vorhandene Kataloge anbinden; generische Job-Neuanlage, beide Umtypisierungsrichtungen und weitere technische Schreibumgehungen einschließlich deaktiviertem Modul mit Write-Aufrufzahl null gezielt ausschließen.
- [x] 2.6 Bestätigtes Löschen und ausdrückliche Sichtbarkeitsänderung über bestehende Verträge integrieren; CSRF, Kontext, Typ, Provider, Abhängigkeiten, Readback und lokale Nachverarbeitung prüfen.

## 3. Redaktionelle Oberfläche und Dokumentation

- [x] 3.1 Übersicht mit Suche, Anstellungsart, Sichtbarkeit, Laufzeit und serverseitiger Seiteneinteilung im vorhandenen Tabellenmuster liefern.
- [x] 3.2 Anlage auf einer Seite und Bearbeitung mit Basis/Inhalt/Historie umsetzen: Firma und Ansprechpartner getrennt, Bestandserhalt zusätzlicher Einträge, Medien, Datumsdefaults nur bei Neuanlage, Fehler-/Konflikt-/Recovery-Zustände.
- [x] 3.3 de/en, Design-System, Light/Dark, Tastatur, Fehlerfokus, Verlassenswarnung und mobile Bedienbarkeit prüfen; geplante Browserabläufe mit lokalen Providerfixtures nachweisen.
- [x] 3.4 Aktuelle Anwenderdokumentation, `docs/reference/jobs.md` samt Bereichsindex sowie betroffene arc42-Abschnitte 04/05/06/08/10 zusammen mit der Funktion fortschreiben.

## 4. Abschluss und Abnahme

- [x] 4.1 Betroffene lokale Unit-/Type-/Runtime-/Integrations-/Security-/Datenintegritätsgates nach `DEVELOPMENT_RULES.md` ausführen; Scope vor einem affected-Unit-Run messen und breite unnötige Wiederholungen vermeiden.
- [x] 4.2 Diffbezogenen Review nach Trigger-Matrix durchführen; Bestandserhalt, Identität, generische Umgehung, Wiederaufnahme und Löschvertrag anhand konkreter Evidenz bewerten.
- [x] 4.3 OpenSpec Strict, Formatierung, Dateiplatzierung, Dokumentationsprüfung und Diff-Prüfung ausführen; alle hinzugefügten/entfernten Artefakte gegen unmittelbar gelieferte Fähigkeit prüfen.
- [ ] 4.4 Erst nach gesonderter Benennung/Freigabe von Zielinstanz, Konto/Principal und isolierten Testdaten: tatsächlichen Serververtrag sowie Erstellen/Öffnen/Bearbeiten/Sichtbarkeit/Löschen prüfen und App-Darstellung fachlich abnehmen. Push und PR sind separat beauftragt; Der Merge wurde am 08.11.2026 gesondert beauftragt; der Rollout bleibt außerhalb dieses Auftrags.

## Tatsächlich erbrachte Nachweise

Studio-Implementierung im eigenen Worktree. Bereits bestanden: ersetzender Job-Roundtrip mit unabhängigem Readback, externe-ID-Kollisionen, Fach-/Medienrechte, Operations-Recovery und Löschen sowie Plugin- und vollständige Studio-Typprüfung. Details zu finalen Gates und Browserprüfung werden nach deren tatsächlichem Abschluss ergänzt. Offene Checkboxen sind keine bestandenen Prüfungen.

Der Proposal-Review wurde am 07.11.2026 nach der bestehenden Trigger-Matrix in drei gebündelten Fachprüfungen durchgeführt: Architektur/Interoperabilität, Sicherheit/Testqualität/Logging und Dokumentation/UX/Accessibility/i18n/User Journey. Separate Operations- und Performance-Reviews waren für den begrenzten Entwurf ohne neue Infrastruktur oder Cache-Verträge nicht erforderlich. Die wesentlichen Datenintegritäts- und Recovery-Nachweise stehen im Design; ein zusätzliches Assurance-Dokument wurde nicht angelegt.

Notwendige Befunde wurden lokal korrigiert und von den jeweiligen Reviewern bestätigt:

- Typübergreifende externe-ID-Kollisionen im Mainserver können andere Inhalte überschreiben. Vollständiger frischer Kollisionsread, Sperre vor Write, `forceCreate`-Grenze, Regression mit bestehender Baustelle und die externe Race-/Upsert-Grenze bei verschwundener ID sind ausdrücklich aufgenommen. Dies ist eine Entwurfskorrektur, kein technisch bereits gelöster Produktpfad.
- Generische Job-Neuanlage und beide Umtypisierungsrichtungen sind ausdrücklich durch den Fachschutz und Negativtests bei aktiviertem/deaktiviertem Modul erfasst.
- Der Nachweiszeitpunkt bezeichnet den Abschluss der Implementierung; der App-Verbrauch erster Firma/ersten Kontakts wird von der CMS-Auswahl des ersten Ablaufdatums und der App-Anzeige sämtlicher Datumswerte unterschieden.

Nach der Korrektur bestanden keine offenen notwendigen Proposal-Befunde aus diesen Reviews. Der Nutzer hat den schriftlichen Entwurf anschließend zum Umsetzungsstart bestätigt. Die vollständige Feldinventur hat danach den neuen Importreferenz-Blocker ergeben; seine Reproduktion wurde unabhängig überprüft. Kein Review bestätigt eine Implementierungs-, Merge-, Live- oder App-Reife.

Erfolgreiche formale Prüfungen, nach Dokumentation des Umsetzungsblockers wiederholt: OpenSpec Strict, Markdown-Formatierung, Dateiplatzierung, Dokumentationsintegrität und Git-Whitespaceprüfung. Reine Dokumentationsänderungen benötigen nach den Projektregeln keine Unit-/Type-Tests. Die konkrete Methodenwirkung wurde separat mit der im Design beschriebenen lokalen Ruby-Reproduktion und synthetischem In-Memory-Bestand geprüft; eine bestandene Job-Roundtrip- oder Produkt-Testsuite wird nicht behauptet.

## Lokaler Implementierungsabschluss am 07.11.2026

Die zugesagte Fähigkeit umfasst Übersicht, Anlage, Bearbeitung, getrennte Firmen-/Kontaktbereiche, vorhandene zusätzliche Einträge, optionale konfigurierte Karte mit manueller Koordinateneingabe, HTML und Medien, Sichtbarkeit, Studio-Historie sowie ausdrücklich bestätigtes Löschen. Ein neues optionales Fachpackage verwendet die vorhandenen SDK-/UI-Verträge; der bestehende Mainserver-Adapter, Katalog, Projektionspfad und Core-Schreibschutz wurden erweitert. Es gibt keine neuen Datenbanken, Plattformdienste oder parallelen Redaktionspfade.

Erfolgreiche gezielte Nachweise:

- `plugin-jobs:test:unit`: 49 Tests in sieben Dateien, einschließlich Browser-Operationsmarker, Reload-Recovery, Verlust einer Delete-Antwort, Medien-/Kartenpfaden und vier gerenderten Seiten-Akzeptanztests.
- `sva-mainserver:test:unit --testFiles=jobs`: 49 Tests. Ersetzender tatsächlicher GraphQL-Write mit Variablenprüfung gegen den Schema-Snapshot und unabhängigem Readback; vollständige repräsentative Legacy-Fixture, erhaltene Metadaten, echte getrennte Browser-/Serverschemas, neue und alte Anstellungsarten, typübergreifende externe-ID-Kollision, optionale leere IDs, degradierte Kategorien und bestätigtes Löschen.
- Kategorienroute: 44 Tests; Core-Mutationsverbraucher: 15 Tests; echter Core-Guard: acht Tests. Allgemeine GenericItem- und Core-Wege lehnen Jobs unabhängig von deren Aktivierung vor der jeweiligen Mutation ab. Beide Umtypisierungsrichtungen und Visibility/Delete/Ownership sind erfasst.
- Gemeinsame Inhaltsliste: 54 Tests einschließlich Ausschluss von Core-Sammelaktionen; Routing: 26 Tests; App-Dispatch: sechs Tests; serverseitige GenericType-Registry: vier Tests; Studio-/SSF-/Custom-Distribution: 21 Tests.
- Plugin-Typprüfung und vollständige Studio-Typprüfung einschließlich 33 Build-Abhängigkeiten; Skript-Typecheck. Der abschließende vollständige Server-Runtime-Guard bestand für 20 Projekte und 23 Abhängigkeitstasks, insgesamt 43 erfolgreiche Tasks.
- Plugin-Lint ohne Fehler; verbleibende Hinweise betreffen Non-null-Assertions. App-/Plugin-UI-/Architekturgrenzen, i18n, regenerierter Anwender-Seitenkatalog, OpenSpec Strict, Formatierung, Dokumentation, Dateiplatzierung und Git-Whitespaceprüfung. Die Architekturprüfung meldet ausschließlich vorhandene Review-Signale anderer Plugins.
- Eingefrorener Lockfile wurde offline einschließlich Supply-Chain-Prüfung akzeptiert. Dependency-Änderungen beschränken sich auf das Job-Package und seine direkten Verbraucher; unverwandte Auflösungsänderungen wurden verworfen.

Der erste breite Runtime-Lauf kollidierte mit einer gleichzeitig gestarteten Typprüfung beim Synchronisieren lokaler Build-Artefakte. Die betroffene Prüfung bestand anschließend seriell; der finale vollständige Runtime-Lauf bestand ebenfalls ohne parallele Builds. Kein deterministischer Produktfehler wurde als erfolgreicher Gate-Lauf gewertet.

Browsernachweis mit synthetischem lokalem Provider und isoliertem Testbrowser:

- Ungültiges Absenden fokussiert das erste Feld und verbindet dessen Fehlermeldung zugänglich.
- Erstellung mit simulierter verlorener Antwort, Neuladen und Recovery ergibt genau eine Provider-Mutation.
- Bearbeiten und ausdrücklicher Sichtbarkeitswechsel werden gespeichert. Änderung der ersten Firma erhält die zweite Firma und den Breitengrad `0`.
- Bestätigtes Löschen mit simulierter verlorener Antwort, bereits verschwundenem Objekt, Neuladen und Recovery ergibt genau eine Delete-Mutation.
- Übersicht und Editor bei 390 Pixeln: `scrollWidth == innerWidth`. Light/Dark-Übersicht sowie Desktop-Editor visuell geprüft; optionale fehlende Karte lässt manuelle Koordinaten verfügbar. Lokale Screenshots liegen unter `output/playwright/`; Testbrowser und Fixture-Server wurden anschließend beendet.

Die drei gebündelten Implementierungsreviews prüften Codequalität/Datenvertrag, Sicherheit/Testqualität/Logging sowie Dokumentation/UX/Accessibility/i18n/User Journey. Die notwendigen Befunde wurden in den bestehenden Pfaden korrigiert und gezielt nachgeprüft: strikte Kategorien, leere externe IDs, Delete ohne globale Inaktivitätssperre, Core-/Bulk-Schreibschutz sowie Arbeitgeber-Spalte, Fehlerzuordnung/Fokus, Leerzustand, Übersetzung und Kartenanbindung. Danach bestanden aus diesen Reviews keine offenen unmittelbar blockierenden lokalen Befunde. Diese Evidenz ist keine Live-, CI-/Merge- oder App-Freigabe. Abschnitt 4.4 bleibt offen.

## CI-Korrekturen für PR #2080

Die kalte CI-Ausführung löste den Browservertrag über den nicht gebauten Plugin-Einstieg auf. Die bestehende Vitest-Aliasliste verweist für die Kompatibilitätsprüfung nun direkt auf den tatsächlichen Browservertrag, wie bereits beim Baustellenplugin. Die bestehende Service-Fixture bildet außerdem den zusätzlichen GenericItem-Read vor dem Sichtbarkeitswechsel ab. Beide zuvor roten Testdateien bestanden gezielt mit 122 Tests.

Die vorhandenen Editor-, Formular- und Übersetzungsteile wurden innerhalb des Jobs-Packages aufgeteilt und doppelte Prüfungen in den bestehenden Funktionen zusammengeführt. Die Job-Dispatch-Funktion wird bei unverändertem öffentlichen Server-Vertrag über den zuständigen GenericItem-Einstieg reexportiert. Es gibt keine neue Plattformschicht, neue Produktfunktion, abgesenkten Schwellenwerte oder zusätzlichen Ausnahmeeinträge. Das Komplexitäts-Gate bestand ohne neue Befunde; die Jobs-Fehlerlogs benennen das richtige Modul.

Nach den Korrekturen bestanden gezielt die 49 Plugin-Tests, 82 Adapter-/GenericItem-Tests, die Routing-Tests, die Plugin-Typprüfung, der Übersetzungscheck sowie Formatierung und Dateiplatzierung. Die verbindliche Gesamtprüfung erfolgt durch die GitHub-Gates am jeweils gepushten HEAD. Die Zielinstanz-/App-Abnahme aus 4.4 bleibt davon unabhängig offen.

Die nachfolgende vollständige CI machte zwei weitere fehlende Plugin-Registrierungen sichtbar. Build-Auswahl, Workspace-Katalog, Image-Vertrag für Studio/SSF/Custom sowie Coverage- und Codecov-Katalog wurden zusammenhängend geprüft. Der bestehende Image-Validator kennt nun `jobs`; die bestehenden positiven und negativen Paket-/Chunk-Tests gelten auch für Jobs. Coverage-Policy und Codecov-Pfade registrieren das Plugin mit denselben 85-%-Mindestwerten wie Gutschein und Baustellen, ohne bestehende Grenzwerte oder Baselines abzusenken und ohne Ausnahmen hinzuzufügen.

Gezielt bestanden danach 58 Image-/Codecov-Vertragstests sowie der Skript-Typecheck. Die Plugin-Suite enthält jetzt 60 erfolgreiche Tests einschließlich Firmen-/Kontakt-/URL-/HTML-/Medienbearbeitung, Filter-/Seitenwechsel, Principalwechsel und Historie. Die gemessene Plugin-Coverage beträgt 94,07 % Zeilen, 93 % Statements, 93,15 % Funktionen und 87,31 % Branches.

Zwei anschließende Review-Befunde betrafen dieselbe Principal-Grenze. Anlage, Update, Recovery und bestätigtes Löschen wurden zusammenhängend geprüft: Veröffentlichung bei sichtbarer Anlage verwendet die bestehende Actor-basierte Host-Entscheidung und deren Audit; Medienreferenz- und Leserechte verwenden explizit die für diesen Actor aufgelösten Berechtigungen. Recovery wiederholt diese Prüfungen. Updates behalten ihre Actor-basierten zusätzlichen Lifecycle-Actions, und die Referenzbereinigung beim Löschen bleibt an die bestätigte, objektberechtigte Löschung gebunden. Es wurden keine gemeinsamen Host-Verträge erweitert.

Die vorherigen Fehlentscheidungen wurden vor der Korrektur reproduziert. Positive und negative Tests verwenden anschließend die echten IAM-Entscheidungsfunktionen, einschließlich persönlicher/organisatorischer Scopes, fehlender Actor-Rechte trotz Sitzungsrechten, Organisationsrechten ohne persönliche Medienrechte, ausgefallener Berechtigungsauflösung und Recovery ohne erneuten Provider-Write. Das vollständige Mainserver-Projekt bestand mit 874 Tests; Typprüfung, Komplexitäts-Gate ohne neue Befunde und die 43 Server-Runtime-Tasks bestanden ebenfalls. Die veraltete Projektionstest-Erwartung wurde um die bereits implementierte Job-Zuständigkeit ergänzt und gezielt geprüft.

Die anschließenden UI-Befunde wurden in den bestehenden Editor- und Routingpfaden korrigiert: Definitive Principal-/DataProvider-Ablehnungen vor dem Write geben den Entwurf wieder frei; unbekannte Ausgänge und abgelehnte Recovery behalten die Operationsmarkierung. Die ausgewählte Identität wird als validierter Jobs-Suchparameter zwischen Liste, Anlage und Editor weitergereicht und beim Neuladen wiederhergestellt. Feste Host-Vorgaben bleiben maßgeblich; ein Principalwechsel verwendet denselben vorhandenen Suchparameterpfad statt eines parallelen lokalen Auswahlzustands.

Die Plugin-Suite bestand danach mit 81 Tests einschließlich positiver/negativer Principal-Navigation, Reload-Recovery und definitiver Prewrite-Ablehnungen. Gemessen wurden 94,21 % Zeilen, 93,18 % Statements, 93,75 % Funktionen und 88,7 % Branches. Die 26 gezielten Routing-Tests, das Komplexitäts-Gate ohne neue Befunde und die abschließenden 43 Server-Runtime-Tasks bestanden ebenfalls. Nach der Zusammenführung der Listennavigation im bestehenden Filterpfad wurden die 12 Seitentests erneut gezielt bestanden; Plugin-Lint, Formatierung, Dateiplatzierung und OpenSpec Strict waren erfolgreich.

Ein weiterer Recovery-Befund wurde an derselben Lifecycle-Grenze geprüft: Eine bereits upstream übernommene Sichtbarkeit darf das ursprüngliche Übergangsrecht nicht verschwinden lassen. Die bestehende Jobs-Reservation speichert deshalb die Ausgangssichtbarkeit und validiert sie bei Recovery. Initiales Update und Recovery ermitteln das zusätzliche Lifecycle-Recht aus demselben ursprünglichen Übergang; aktuelle Objekt-/Provider-Rechte werden weiterhin frisch geprüft. Sichtbare/unsichtbare Neuanlage, beide Update-Übergänge, unveränderte Sichtbarkeit und Löschen wurden zusammenhängend abgeglichen, ohne gemeinsame Host-Verträge oder neue Ausführungspfade einzuführen.

Die beiden Fehlentscheidungen bei Veröffentlichung und Ausblenden wurden vor dem Fix mit 200 statt 403 reproduziert. Danach bestanden 52 gezielte Route-/Provider-Tests einschließlich Rechteentzug, erneut zulässiger Recovery ohne zweiten Write, unveränderter Sichtbarkeit und fehlendem ursprünglichem Sichtbarkeitswert.

Abschließend bestanden das vollständige Mainserver-Projekt mit 881 Tests, die 43 Server-Runtime-Tasks und das Komplexitäts-Gate ohne neue Befunde. Die Gesamtevidenz wird erneut durch die GitHub-Gates am finalen gepushten HEAD erbracht.

Die Principal-Grenze wurde nach weiteren Review-Hinweisen für sämtliche unmittelbaren Verbraucher erneut abgeglichen: Übersicht und Detail verwenden objektbezogene Rechte des ausgewählten Actors; der Kategorien-Lookup prüft jetzt dessen `jobs.read` oder `jobs.create` vor dem Provider-Zugriff; Anlage, Update und Recovery bleiben an dessen Fach-, Lifecycle- und Medienrechte gebunden. Löschen und Delete-Recovery prüfen den ausgewählten Actor anhand des aktuellen beziehungsweise gespeicherten Provider-Objekts. Die Browser-Anzeige kann nur die vom bestehenden Session-Snapshot gelieferten Aktionen auswerten und ist keine Autorisierungsentscheidung. Es wurden keine Host-/SDK-Verträge erweitert.

Die zuvor unberechtigt zugelassenen Organisations-Lookups mit ausschließlich persönlichen Lese- beziehungsweise Anlagerechten wurden reproduziert. Nach der Korrektur bestanden die 85 gezielten Kategorien-/Jobs-Routentests mit echten Scope-Entscheidungen, passenden persönlichen/organisatorischen Rechten, Ausfall der Rechteauflösung und fehlendem Actor. Die beiden betroffenen Testdateien verwenden eine gemeinsame vollständige Actor-Fixture im bestehenden Jobs-Fixture-Modul.

Abschließend bestanden für die Lookup-Korrektur das vollständige Mainserver-Projekt mit 887 Tests, alle 43 Server-Runtime-Tasks und das Komplexitäts-Gate ohne neue Befunde.

## Nicht blockierendes UX-Follow-up

- Die Vorab-Anlagefähigkeit pro ausgewähltem Principal im Formular anzeigen ([Review-Hinweis](https://github.com/smart-village-solutions/sva-studio/pull/2080#discussion_r4504262976)). Der aktuelle Session-Snapshot liefert Aktionsnamen, aber keine Principal-spezifischen Scopes; das Principal-Control liefert Auswahl und Verbindungsbereitschaft. Eine verlässliche Vorabanzeige benötigt deshalb einen separat entworfenen Host-/SDK-Vertrag und gehört nicht in diesen PR-Fix. Akzeptanz für das Follow-up: Bei ausschließlich persönlichen `jobs.create`-Rechten bleibt organisatorische Anlage vor der Eingabe deaktiviert, nach Wechsel auf den persönlichen Principal aktiv; passende Organisationsrechte werden ebenso berücksichtigt. Der bestehende Server verweigert einen unberechtigten Write bereits vor der Mutation, erhält den Entwurf nach definitiver Ablehnung und verlangt beim Verlassen eines geänderten Formulars eine Entscheidung. Dieses Follow-up blockiert den vorliegenden PR nicht.

## Abschließende Coverage-Korrektur

Die erste vollständig durchgelaufene CI-Coverage erfüllte die New-Code-Vorgabe (89,48 % bei geforderten 85 %) und die Plugin-Mindestwerte, scheiterte aber an der Mainserver-Regression gegenüber der bestehenden Baseline: Funktionen -1,45 Prozentpunkte und Statements -0,74 Prozentpunkte bei maximal 0,50. Ungeprüft waren insbesondere öffentliche Jobs-Service-Einstiege, da die vorhandenen Tests Adapter und HTTP-Routen getrennt prüften.

Ein zusätzlicher Vertragstest durchläuft jetzt den realen öffentlichen Service mit paginiertem Lookup, Organisationsidentität, verschachteltem Kontakt-/Medien-Update samt Bestandserhalt, unabhängigem Readback, Recovery ohne zweiten Write sowie Löschen und Abwesenheitsnachweis. Weitere Tests prüfen verschwundene Readbacks, nicht abgeschlossene Löschungen und gleichzeitig ausfallende lokale Journale. Die bestehende Create-Binding-Fixture führt den vertraglichen Reread tatsächlich aus. Produktionscode, Coverage-Policy und Baseline bleiben unverändert.

Das vollständige Mainserver-Coverage-Target bestand danach mit 892 Tests. Das bestehende Coverage-Gate mit aktivierter Regressionsprüfung für `sva-mainserver` bestand lokal: 94,85 % Zeilen, 93,05 % Statements, 95,48 % Funktionen und 84,61 % Branches (Gate-Auswertung). Die finale Gesamtevidenz folgt aus den GitHub-Gates am anschließend gepushten HEAD.

## Nachverarbeitung und gemeinsamer Löschbeweis

Zwei weitere notwendige Review-Befunde betrafen den Abschluss externer Mutationen. Für Jobs meldet der bestehende Projektionsrefresh einen Fehler an den vorhandenen App-Adapter zurück. Dieser liefert den bereits eingeführten 202-Teilerfolgsvertrag mit `reconciliationRequired` und erhält Identitäts-/Kontextheader; die Browser-Recovery bleibt bestehen. Derselbe ursprüngliche Vorgang kann die Nachverarbeitung erneut prüfen. Die anderen Inhaltswege behalten ihren bisherigen Vertrag. Es gibt keine zusätzliche Warteschlange oder Host-/SDK-Schnittstelle.

Beim Löschen bewies der vorhandene `includeInactive`-Guard zwar die benötigte Mainserver-Management-Rolle, aber in einer getrennten Anfrage vor dem Abwesenheitsread. Die neue Verifikationsabfrage kombiniert diesen Guard mit `genericItem(id)` in demselben GraphQL-Kontext. Im geprüften Mainserver-Quellstand `76d2e12af092197f3cf58f2e4886fa8fe2a30c5b` erlaubt `categories_search.rb:71–79` den Guard nur für den Management-Principal der Kommune; `filter_by_role.rb:51–56` liest GenericItems in diesem Kontext ohne Sichtbarkeitsfilter. Ein Rechteverlust lässt die kombinierte Anfrage scheitern. Verbleibende Objekte, technische Fehler und unvollständige Antworten bleiben ungeklärt; es erfolgt kein erneuter Provider-Delete.

Beide vorherigen Fehlentscheidungen wurden reproduziert: Die App lieferte bei fehlgeschlagener Projektion 200/201 statt 202; ein separat gefilterter Null-Read meldete eine verbliebene Anzeige als gelöscht. Die gezielten App-Tests prüfen Create, Update, Delete, fehlende Folgeidentität, erhaltene Header und erneute Nachverarbeitung mit derselben Operationsidentität. Der Provider-Test modelliert den Rollen-/Filterwechsel zwischen getrennten Reads und verlangt nun eine einzige kombinierte Verifikation. Das neue Dokument wird gegen das vorhandene GraphQL-Schema validiert.

Abschließend bestanden für diese Korrekturen 32 gezielte App-Server-Tests, das vollständige Mainserver-Coverage-Target mit 894 Tests und das unveränderte Regressions-Gate, die App-Typprüfung, 43 Server-Runtime-Tasks sowie Komplexität ohne neue Befunde und Formatierung. Die Typprüfung benötigte zuvor einen frischen lokalen Build der bestehenden SSF-Abhängigkeit; deren Quellcode wurde nicht geändert.

## Warnungsprüfung vor dem beauftragten Merge

Die zwölf Lint-Warnungen des neuen Jobs-Packages wurden ohne Regel-Ausnahmen behoben: Laufzeitdaten werden typisiert eingegrenzt, der Delete-Aufruf benötigt einen vorhandenen Request-Body, und die Tests prüfen benötigte Fixtures beziehungsweise DOM-Elemente ausdrücklich. Die entsprechenden Non-null-Assertions im neuen Mainserver-Jobpfad und dessen Tests wurden ebenfalls entfernt. Die 81 Plugin-Tests samt Coverage und 37 gezielte Mainserver-Tests bestanden; Plugin- und Mainserver-Lint melden keine Codewarnungen. Auch Plugin-Typprüfung, die 43 Server-Runtime-Tasks, Formatierung und das Komplexitäts-Gate ohne neue Befunde bestanden.

Die externen Ergebnisse wurden vor dem Merge gesichtet: Codecov `project` und `patch` sind am geprüften HEAD erfolgreich; Hinweise auf einzelne nicht abgedeckte Zeilen werden anhand der unveränderten Coverage-Policy bewertet und sind kein Nachweis eines Produktfehlers. Der Runner-Hinweis zu Ubuntu 26 sowie bestehende Dependency-/Executor-Abkündigungen betreffen den vorhandenen Workspace. Das SonarCloud-Projekt `smart-village-app_sva-studio` hat keine PR-Analysen. Sein separates `main`-Gate meldet Reliability D, unter anderem den bereits am 06.11.2026 angelegten Befund `AaGxX5zkWbzVMTGcQnNQ` in `app-translations-binding.ts`. Die 108 über die Reliability-Abfrage gelieferten offenen Bestands-Issues überschneiden sich mit keiner Datei dieses PRs. Diese Bestandsbefunde werden nicht als erfolgreiche Sonar-PR-Analyse ausgegeben und nicht im Jobs-PR geschlossen. Die Freigabe des Jobs-PRs stützt sich auf die terminalen GitHub-Gates, internen Coverage-/Komplexitätsprüfungen, Codecov und die abgeschlossenen Reviews am exakten finalen HEAD.

Der frühere Codecov-Hinweis auf eine ältere `main`-Coverage bedeutet nicht, dass gegen einen alten Integrationsstand gebaut wurde: Der erfolgreiche PR-Lauf checkte den Merge-Commit `9cccd8bc99400bad5bc6623bcc03c34177340608` aus, also Jobs-HEAD `18b4a54e9` zusammen mit dem aktuellen `main`-Stand `dc3e3755b5c3286e66ff48575e97a159cad17c12`. Nach dem Warnungsfix gelten erneut ausschließlich die Gates des neuen HEADs.

## Providerweite Serialisierung der Jobs-Schreiboperationen

Ein anschließender P1-Review-Befund zeigte, dass zwei parallele Neuanlagen derselben externen ID beide den Kollisionsread passieren konnten. Die Regression reproduzierte sowohl Anlage/Anlage als auch Update/Anlage mit zwei erfolgreichen Antworten und zwei Provider-Writes. Anlage, Update, Löschung und die ausschließlich lesenden Recovery-Pfade wurden gemeinsam geprüft.

Die bestehenden Jobs-Schreibpfade verwenden jetzt denselben vorhandenen Mutationslock pro tatsächlich aufgelöstem DataProvider, auch bei Neuanlagen. Kollisionsread, Mutation und unabhängiger Readback werden gemeinsam serialisiert. Die Provider-Granularität ist bewusst gröber als eine externe ID: Sie schützt auch Updates mit geänderter externer ID und erfordert weder verschachtelte DB-Locks noch einen neuen Plattformvertrag oder Lock-Service. Die Provider-ID wird vor der Write-Reservierung aufgelöst; ein Auflösungsfehler bleibt eine definitive Prewrite-Ablehnung. Recovery führt weiterhin keinen Provider-Write aus. Writes außerhalb dieser Jobs-Pfade und das dokumentierte externe Mainserver-Konkurrenzfenster werden dadurch nicht atomar.

Nach der Korrektur bestanden 42 gezielte Routentests. Die Konkurrenztests verlangen genau einen Provider-Write und einen Konflikt; zusätzliche Fälle prüfen den gemeinsamen Lock für Schreiben/Löschen, verschiedene Provider, denselben Provider bei anderen Credentials/Operationen, gehashte Schlüssel ohne rohe IDs sowie Identity-Ausfall vor Reservierung und Write. Der bestehende Host-Lock wird unverändert verwendet; seine SQL-/Callback-Reihenfolge ist bereits im Host-Vertrag geprüft.

Abschließend bestanden das Mainserver-Coverage-Target mit 899 Tests und das unveränderte Regressions-Gate, Mainserver-Lint ohne Codewarnungen, alle 43 Server-Runtime-Tasks sowie OpenSpec Strict, Formatierung und Komplexität ohne neue Befunde.
