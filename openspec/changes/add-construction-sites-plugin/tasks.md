# Umsetzung und Nachweise

Status: Fachlicher Zuschnitt und anschließend Umsetzung am 01.11.2026 freigegeben. Lokal auf Branch `feature/construction-sites-plugin` umgesetzt, einschließlich der explizit akzeptierten Ausnahme für deaktivierte Kategoriezuordnungen. Die belegten Vertragslücken und der Korrekturvorschlag stehen unter „Vertragsprüfung nach Umsetzungsfreigabe“ im Design. Nicht abgehakte Aufgaben sind keine bereits erbrachten Nachweise. Die Reihenfolge ist verbindlich: auf einem roten kleinsten Pflicht-Gate nicht weiterimplementieren.

## 1. Vertrag und Implementierungsgrenze absichern

- [x] 1.1 Aktuelle Plugin-/Mutations-/Historienverträge und den tatsächlichen Ziel-App-Verbrauch gegen den aktuellen Quellstand prüfen; vor nichttrivialen Codeänderungen verfügbare XERJ-Referenzen gemäß `AGENTS.md` untersuchen und deren Indexstand/Lizenz beachten. Lokal geprüft: Studio-Adapter, Legacy-CMS und App-Checkout; XERJ in `studio-code` und `payload-code` durchsucht. Die produktive Ziel-App-/Live-Versionszuordnung ist getrennt in 4.4 offen.
- [x] 1.2 Kleinsten Roundtrip mit einer repräsentativen Legacy-Fixture auf dem vorhandenen GenericItem-Adapter nachweisen: ID, Typ, Null-/Leersemantik, mehrere Relationen, opake Felder und Metadaten. Nachgeschärft: Deaktivierte Kategoriezuordnungen dürfen gemäß expliziter Nutzerentscheidung entfallen. Übrige Inhalte müssen vollständig gelesen und erhalten werden; nicht wiederherstellbare oder beschädigte Beziehungen vor dem Write abweisen. Nachgewiesen durch `construction-sites-snapshot.test.ts` und `service-construction-sites.test.ts`: 14 gezielte Tests einschließlich Schema-/Variablenprüfung, ersetzender Mutation, Erhalt weiterer Felder, Konfliktprüfung und Readback-Mismatch erfolgreich. Kein Live-Nachweis.
- [x] 1.3 Konkretes Ziel und Nicht-Ziele des Implementierungs-PRs sowie maximal betroffene Bereiche aus dem Proposal übernehmen; keine Erweiterung um Delete, neue Fachfunktionen oder Plattformumbauten. Branch: `feature/construction-sites-plugin`; Fachmodell und bestehender Studio-Adapter werden innerhalb dieses Scopes erweitert; kein PR erstellt.

## 2. Fachplugin und Adapter integrieren

- [x] 2.1 `@sva/plugin-construction-sites` nach bestehendem Nx-/Plugin-Muster anlegen, interne Abhängigkeiten mit `workspace:*` verbinden und nur benötigte öffentliche SDK-/UI-Verträge verwenden. Keine Runtime-Abhängigkeit auf andere Fachplugins.
- [x] 2.2 Exakte Zuständigkeit `ConstructionSite`, Content-Type, vorhandenes Host-Routing, Seiten-/Distributionskatalog und Instanzaktivierung registrieren. Nur Read/Create/Update beitragen; keine implizite Delete-Funktion durch Standard-CRUD-Helper.
- [x] 2.3 Fachrechte und Objekt-/Provider-/Identitätsprüfung in bestehende Host-Autorisierung einbinden; Plugin-Fachmapping und validierten Input im vorhandenen Integrationspfad verwenden. Reine Inhaltsänderung erhält Sichtbarkeit; explizite Sichtbarkeitsänderung prüft Host-Veröffentlichungsrechte.
- [x] 2.4 Lesen, globale fachliche Filter/Pagination und Schreiben im Studio-Mainserver-Adapter ergänzen. Frischen Detail-Read, Baseline-Konfliktprüfung, Erhalt weiterer Daten, unabhängigen Readback und getrennte Nachverarbeitung über vorhandene Mutationsverträge absichern.
- [x] 2.5 Unklaren Write-Ausgang, Provider-Erfolg mit lokalem Teilfehler und Medienreferenz-Retry ohne erneute Anlage prüfen. Fehlende/upstreamseitig nicht atomare Konkurrenzgarantie offen dokumentieren.
- [x] 2.6 Gezielte Unit-/Adapter-/Autorisierungstests unmittelbar an den geänderten Pfaden und früh `pnpm check:server-runtime` ausführen; keine Pflicht-Gates abschwächen.

## 3. Redaktionelle Oberfläche liefern

- [x] 3.1 Liste mit Titel, primärem Standort, Beginn/Ende, zeitlicher Einordnung, letzter Änderung, Suche, Kategorien- und Zeitraumfilter implementieren; leere fachliche Ergebnisseiten und unsichtbare lesbare Einträge abdecken.
- [x] 3.2 Create-Onepager und Edit-Detailbereiche mit denselben Feldkomponenten liefern: Inhalt, Zeitraum, Verkehrsangaben/Einschränkungen, Standort, Kategorien, Medien und vorhandene Host-Steuerung.
- [x] 3.3 Client-/Servervalidierung für Titel, Datum, Null-/Teilkoordinaten und Kategorien ausrichten. Fehlende Altdaten nicht mit heutigen Defaults ersetzen; bewusst gewähltes Enddatum erhalten.
- [x] 3.4 Zusätzliche Bestandsrelationen, erste App-relevante Einträge, Medienreihenfolge und Metadaten zugänglich machen; nicht lesbar erhaltbare Strukturen vor dem Write sichtbar blockieren.
- [x] 3.5 Echte Host-Historie, de-/en-Texte, Feldhilfen, Fehlerzusammenfassung/Fokus, Tastaturbedienung, Verlassenswarnung und getrenntes Speicher-/Teilfehlerfeedback integrieren und gezielt testen.

## 4. Dokumentation und Abnahme

- [x] 4.1 Kritische Adapter-/Routentests gegen tatsächliche Request-Variablen und Readback sowie gezielte Create-/Edit-E2E-Tests ausführen; Kalendergrenzen, verlorene Antworten, Rechte, Bestandserhalt und Reload abdecken.
- [x] 4.2 Arc42 04/05/06/08/10 prüfen und betroffene Abschnitte fortschreiben. Anwenderhilfe und verantwortlichen Referenzvertrag mit Indizes aktualisieren; keine zusätzliche Governance-/Assurance-Schicht anlegen.
- [x] 4.3 Finale zum geänderten Scope passende Pflicht-Gates aus `DEVELOPMENT_RULES.md` einschließlich Auth-/Datenintegritäts-/Server-Runtime-, Boundary-, Typ-, i18n- und Dokumentationsprüfungen nachweisen. Vor einem affected-Unit-Run zuerst Scope messen, sonst kleinste Projekt-/Dateitests nutzen.
- [ ] 4.4 Vor Live-Schreibtests Zielsystem, Konto/Identität und isolierte Testdaten explizit freigeben lassen; danach Anlage und Bearbeitung mit Readback und Darstellung in der Ziel-App fachlich abnehmen. Lokale Fixtures ersetzen diesen Nachweis nicht.
- [x] 4.5 Technische Bereitstellung, Live-Prüfung und fachliche Abnahme getrennt dokumentieren. Ein Rollout ist ein gesonderter Auftrag über den bestehenden kanonischen Prozess.

## Abgeschlossene Konzeptprüfung vor der Umsetzung

- [x] K.1 `pnpm exec openspec validate add-construction-sites-plugin --strict`, `pnpm check:file-placement`, `pnpm check:docs` sowie Diff-/Link-Prüfung erfolgreich abschließen. Sechs neue Markdown-Dateien und sechs interne Links wurden zusätzlich direkt geprüft; Produktcode und bestehende Dateien wurden nicht verändert.

## Historischer Nachweis der Vorprüfung am 01.11.2026

`pnpm nx run sva-mainserver:test:unit --testFiles=src/server/service-internals/generic-item-mappers.test.ts` ist mit sechs Tests erfolgreich. Der gezielte Lauf bestätigt das bestehende Mapping einschließlich toleranter Auslassung beschädigter Daten; er ist ausdrücklich kein bestandener Write-Roundtrip und war noch kein Nachweis für 1.2. Der anschließende vollständige Roundtrip ist oben gesondert vermerkt. Der aktive Mainserver-Versionsstand, tatsächliche Bestandsfälle und eine isolierte schreibende Gegenprüfung wurden nicht ermittelt. Es wurden keine fremden Repository-Dateien oder externen Datensätze verändert.

## Lokale Implementierungsnachweise am 01.11.2026

- Das neue Fachplugin verwendet vorhandene SDK-/UI-, Medien-, Karten-, Historien- und IAM-Verträge. Der Serveradapter validiert unabhängig vom optionalen Plugin; gemeinsame Eingangsbeispiele prüfen beide Seiten. Studio nimmt das Plugin auf, SSF und eine benutzerdefinierte Auswahl können es ausschließen.
- Plugin: 49 Tests in sieben Dateien, Coverage mit 95,77 % Zeilen, 95,30 % Statements, 91,47 % Funktionen und 85,87 % Branches. Gesonderte Listenprüfung nach abschließender Funktionsaufteilung.
- Mainserver: 25 gezielte Tests in drei Dateien erfolgreich. Snapshot-/Roundtrip-Tests mit mehreren Relationen, Null-/Leerwerten, nicht wiederherstellbaren Beziehungen und opaken Metadaten; Routentests für Fachrechte, CSRF, Veröffentlichung, Kategorien, Konflikte, verlorene Antworten, identitätsgebundene Wiederaufnahme und lokale Teilfehler. Schema-/Variablenprüfung gegen den vorhandenen GraphQL-Snapshot.
- Host: 26 gezielte Integrationsprüfungen (Dispatch, exakter GenericItem-Typ, Sichtbarkeit), 34 Routen-/Bindingprüfungen und 26 Routingtests einschließlich Erhalt der Baustellenfilter.
- Browser: lokaler Playwright-Flow mit Anlage, Bearbeitung, Rückkehr zur gemeinsamen Übersicht und Titelsuche erfolgreich. Mobiles Formular bei 390 Pixel ohne horizontalen Überlauf; Create-/Edit-Screenshots visuell geprüft. Alle Provider-Antworten stammen aus Fixtures.
- Distribution: 21 Vertragsfälle geprüft; ein erwarteter Katalogeintrag wurde ergänzt. Ein unter Parallelbelastung zeitüberschrittener Fall sowie der korrigierte Manifestfall bestanden anschließend gezielt (30 Sekunden Laufzeitlimit, keine Änderung am Teststandard). Frozen-Lockfile-Installation offline erfolgreich.
- Früh im Verlauf vollständiges `check:server-runtime` erfolgreich; abschließend `sva-mainserver:check:runtime` einschließlich Build, Plugin-Build, App- und Routing-Typprüfung sowie Skript-Typecheck erfolgreich. Lint für Plugin und Mainserver, i18n, App-/Plugin-Grenzen, Complexity-Gate ohne neue Findings, Dokumentation, Dateiplatzierung, OpenSpec Strict und Diff-Prüfung erfolgreich. Es wurden keine bestehenden Gates oder Baselines abgeschwächt.

Die lokale Implementierung ist keine produktive Bereitstellung. Kein PR, Push, Merge, Rollout oder externer Schreibtest ist erfolgt. 4.4 bleibt bis zum gesonderten Auftrag mit freigegebenem Zielkontext offen; die Kategorienentscheidung ersetzt keine Live-/App-Abnahme.

## Review vor dem Staging-Rollout

Der zusätzliche Review gegen den mit `origin/main` integrierten Stand bestätigte einen fehlenden Ausschluss vorläufiger Medien. Der vorhandene Serverguard wurde ohne Änderung des Medienvertrags ergänzt. Der Regressionstest reproduzierte zunächst HTTP 201 statt 409 für ein öffentliches, verarbeitetes, aber vorläufiges Asset; anschließend bestanden alle elf Baustellen-Routentests einschließlich Erstwrite und Wiederaufnahme. Weitere bestätigte Merge-Blocker wurden im gebündelten Fachreview nicht gefunden. Live-Schreib-/App-Abnahme gemäß 4.4 bleibt separat offen.

## GitHub-Review und gezielte CI-Korrekturen in PR #2032

Der Listenabruf erhält den bestehenden SDK-Read-Header mit der vom Host vorgegebenen Identität; bei nicht verfügbarem Organisationskontext lädt der Host die Fachliste noch nicht. Der relative Typimport im Browsertest wurde durch den öffentlichen Package-Import ersetzt. Der bestehende Projektions-Test erwartet nun ebenfalls die neue exakte GenericItem-Zuständigkeit.

Die zusammenhängende Prüfung des Speicherzustandsraums unterscheidet:

| Zustand | Browserverhalten | Bestehender Serververtrag |
| --- | --- | --- |
| Frischer Save mit bestätigter Ablehnung `media_unavailable`, `not_found`, `incomplete`, `dependents_unsupported` (jeweils `construction_site_`) | Pending-Marker entfernen, Entwurf zur Korrektur erhalten | Entsteht vor dem Provider-Write; kein neues Recovery-Protokoll |
| Antwortverlust oder Fehler nach Beginn des Provider-Writes | Pending-Marker behalten, kein zweiter Write | `construction_site_outcome_unknown`; Readback und Nachverarbeitung derselben Operation |
| Bekannter Provider-Erfolg mit lokalem Teilfehler | Pending-Marker behalten | Teilfehlerantwort mit bekannter ID |
| Ablehnung bei Recovery, auch mit einem der obigen Codes | Pending-Marker behalten | Fehlende Expected-Zeile beweist keinen terminalen Ausgang eines noch laufenden Originalrequests |

Die neuen Header-, Principal- und Ablehnungsregressionen wurden zuerst rot reproduziert. Danach bestanden 31 gezielte Plugin-Tests, 35 Host-Routentests und 18 Projektions-Pagingtests. Lint für App und Plugin sowie Plugin-Build sind grün. Auch der lokale Create-/Edit-/Listen-Browserflow mit Prüfung des tatsächlich gesendeten Principal-Headers bestand. Die begrenzte unabhängige Nachprüfung der GitHub-Findings meldete keine verbleibenden Blocker. Vollständige lokale `affected`-/PR-Läufe wurden nicht wiederholt; die GitHub-Gates bleiben für den finalen HEAD maßgeblich.

## Kategorienvertrag und Coverage-Registrierung vor Merge

Der zuvor tatsächlich mit HTTP 400 abgewiesene Baustellen-Kategorienfilter wurde in die bestehende Allowlist aufgenommen; der echte Kategorien-Routentest reproduzierte den Fehler zunächst rot. Anschließend bestanden 26 Kategorien-Routentests und fünf Baustellen-Roundtrips. Der unabhängige Review bestätigte anhand Mainserver `76d2e12a`, `resource_service.rb:224,436,474–485`, die zusätzliche Zuordnung von Provider-Standardkategorien nach Create und Update. Da GraphQL diese nicht als Defaults kennzeichnet, bleibt der bestehende Mindestbestandsvergleich korrekt; strikte Mengengleichheit würde legitime Saves ablehnen. Direkte Fixtures belegen nun sowohl Entfernen einer gewöhnlichen Kategorie bei gleichzeitig hinzugefügtem Providerstandard als auch Ablehnung einer fehlenden angeforderten Kategorie mit bekannter ID und genau einem Write.

Die fehlende Registrierung von `plugin-construction-sites` in der bestehenden Coverage-Policy wurde mit unveränderten Floors von jeweils 85 Prozent ergänzt; die fünf zugehörigen Codecov-/Projektregistertests bestehen. Der gezielte Mainserver-Build samt Server-Runtime-Gate ist grün. Keine neue Kontrollschicht, Schnittstelle oder Default-Inventur wurde eingeführt.

Auf den vorherigen PR-HEADs scheiterte Coverage zusätzlich an drei 5-Sekunden-Timeouts bestehender SSF-Tests. Die drei unveränderten Fälle bestanden isoliert mit V8-Coverage und unverändertem Zeitlimit (3,2 / 4,6 / 2,5 Sekunden). Dies ist ein gezielter Diagnosenachweis, keine bestandene vollständige Coverage-Prüfung und keine Änderung am SSF-Umfang.

Der Kategorien-Lookup des Baustelleneditors verwendet jetzt ausschließlich für GET auf die Collection ohne `view` und mit genau einem gültigen Baustellenfilter `construction-sites.read` samt festem ContentType. Damit benötigt die Auswahl kein separat aktiviertes Kategorienverwaltungsplugin; Verwaltungs-, andere Inhalts-, Mehrfachfilter- und Schreibzugriffe behalten `categories.*`. Die positive Regression wurde zunächst mit HTTP 403 reproduziert. Danach bestanden alle 34 Kategorien-Routentests einschließlich sieben Abgrenzungsfällen und direkter Rechteverweigerung sowie der gezielte Mainserver-Build mit Server-Runtime-Gate. Die unabhängige Nachprüfung des begrenzten Diffs meldete keine Blocker; Referenz und arc42 wurden im bestehenden Pfad aktualisiert.

Nach erneutem Coverage-Abbruch an denselben drei unveränderten SSF-Oberflächentests hat der Nutzer die Scope-Erweiterung um ausschließlich deren Zeitlimits ausdrücklich freigegeben. In `packages/plugin-ssf/tests/admin.content-v2-page.test.tsx` erhalten nur diese drei Fälle 10.000 statt standardmäßig 5.000 Millisekunden; Abläufe, Assertions und Coverage-Floors bleiben unverändert. Die drei Fälle bestanden anschließend gezielt mit V8-Coverage (3,9 / 3,7 / 3,1 Sekunden). Der begrenzte unabhängige Diffreview meldete keine Blocker. Der gezielte Lauf ersetzt keine vollständige Coverage-Freigabe am finalen PR-HEAD.

Auf diesem Stand bestanden anschließend sämtliche Tests einschließlich SSF; das abschließende New-Code-Gate meldete jedoch 84,75 statt mindestens 85 Prozent. Drei zusätzliche Fälle im vorhandenen Baustellen-Service-Roundtrip prüfen deshalb die reale Create-Recovery bei fehlendem Treffer, mehreren Treffern und ungültiger ID: operationsgebundener Lookup, weiterhin unklarer Ausgang und kein zweiter Provider-Write. Alle acht Tests dieser Datei bestanden mit V8-Coverage. Der Vergleich des betroffenen Service-LCOV mit dem vollständigen CI-Bericht ergibt eine lokale Prognose von 85,61 Prozent für den unveränderten New-Code-Zuschnitt; dies ersetzt ausdrücklich nicht das finale CI-Gate. Produktcode und Coverage-Vorgaben bleiben unverändert, der begrenzte unabhängige Testreview meldete keine Blocker.
