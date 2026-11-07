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
- [ ] 4.4 Erst nach gesonderter Benennung/Freigabe von Zielinstanz, Konto/Principal und isolierten Testdaten: tatsächlichen Serververtrag sowie Erstellen/Öffnen/Bearbeiten/Sichtbarkeit/Löschen prüfen und App-Darstellung fachlich abnehmen. Push und PR sind separat beauftragt; Merge und Rollout bleiben außerhalb dieses Auftrags.

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
