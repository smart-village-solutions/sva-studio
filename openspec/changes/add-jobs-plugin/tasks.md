# Aufgaben und Nachweise

Status am 07.11.2026: Fachlicher Entwurf als Grundlage bestätigt; eigener Worktree `feature/jobs-plugin` angelegt. Schriftliches Proposal zur Prüfung. Kein Produktcode, keine generierten Packages und keine Live-Schreibzugriffe. Die folgenden Implementierungsaufgaben sind ein vorläufiger Zuschnitt; ihre Ausarbeitung beginnt nach Prüfung des schriftlichen Designs.

## 1. Entwurf und Vertragsnachweis

- [x] 1.1 Legacy-CMS sowie aktuelle Studio-Gutschein-, Baustellen-, Kategorie- und GenericItem-Pfade lesend untersuchen; Abweichungen und Scope im Proposal/Design festhalten.
- [ ] 1.2 Schriftlichen Entwurf fachlich prüfen und vor Implementierungsplanung bestätigen; offene Grenzen insbesondere bei Kategorieerhalt, externer ID und Lösch-Readback nachvollziehbar entscheiden.
- [ ] 1.3 Vor Codeänderungen verfügbare XERJ-Referenzen in `studio-code` und `payload-code` oder `keystone-code` suchen, Indexstand und Lizenz prüfen und Fundstellen am aktuellen Quellstand bestätigen.
- [ ] 1.4 Vollständige Job-Read-/Write-/Delete-Feldinventur gegen maßgeblichen Mainserver-Quellstand und Schema-Snapshot prüfen; Abhängigkeiten, Null-/Leersemantik, gefilterte Kategorien, typübergreifende externe-ID-Upserts/Bereinigung, verschwundenes Updateziel und technische Integrationsrolle belegen. Keine Datenverlustausnahme übernehmen.
- [ ] 1.5 Kleinsten echten Roundtrip mit repräsentativer Legacy-Fixture, ersetzender Mutation und unabhängigem Readback nachweisen. Bei nicht erfüllbarer Schutzanforderung vor weiterem Implementieren stoppen.

## 2. Bestehende Adapter und Plugin-Einbindung erweitern

- [ ] 2.1 Plugin über passenden vorhandenen Nx-Generator nach Discovery/Source-Review/Dry-Run erzeugen; ohne geeigneten Generator begründet im bestehenden Package-Muster bleiben. Workspace-Abhängigkeiten über Package-Manager-Befehle mit `workspace:*` verbinden.
- [ ] 2.2 Vorhandenen Studio-Mainserver-Pfad um exakten Job-Read/Write, Snapshot-Erhalt, Fingerprint, Idempotenz und unabhängigen Readback erweitern; früh `pnpm check:server-runtime` und kleinste passende Vitest-/Type-Gates ausführen.
- [ ] 2.3 Operationsgebundene Wiederaufnahme bei verlorener Antwort einschließlich ausdrücklich eingegebener externer ID, Mehrdeutigkeit, Reload und lokaler Teilfehler nachweisen; typübergreifenden providergebundenen Kollisionsread vor Create absichern; keine automatischen Provider-Retries.
- [ ] 2.4 Bestehenden Kategorie-Lookup für exakt getaggte Anstellungsarten und Job-Rechte erweitern; Altwerte erhalten und neuen Input serverseitig prüfen. Gefilterter/unvollständiger Snapshot und gefährdeter Kategorieerhalt sperren Updates.
- [ ] 2.5 Jobs-Modul, Fachrechte, Views, Routing, Distribution, Content-Projektion und Ownership über vorhandene Kataloge anbinden; generische Job-Neuanlage, beide Umtypisierungsrichtungen und weitere technische Schreibumgehungen einschließlich deaktiviertem Modul mit Write-Aufrufzahl null gezielt ausschließen.
- [ ] 2.6 Bestätigtes Löschen und ausdrückliche Sichtbarkeitsänderung über bestehende Verträge integrieren; CSRF, Kontext, Typ, Provider, Abhängigkeiten, Readback und lokale Nachverarbeitung prüfen.

## 3. Redaktionelle Oberfläche und Dokumentation

- [ ] 3.1 Übersicht mit Suche, Anstellungsart, Sichtbarkeit, Laufzeit und serverseitiger Seiteneinteilung im vorhandenen Tabellenmuster liefern.
- [ ] 3.2 Anlage auf einer Seite und Bearbeitung mit Basis/Inhalt/Historie umsetzen: Firma und Ansprechpartner getrennt, Bestandserhalt zusätzlicher Einträge, Medien, Datumsdefaults nur bei Neuanlage, Fehler-/Konflikt-/Recovery-Zustände.
- [ ] 3.3 de/en, Design-System, Light/Dark, Tastatur, Fehlerfokus, Verlassenswarnung und mobile Bedienbarkeit prüfen; geplante Browserabläufe mit lokalen Providerfixtures nachweisen.
- [ ] 3.4 Aktuelle Anwenderdokumentation, `docs/reference/jobs.md` samt Bereichsindex sowie betroffene arc42-Abschnitte 04/05/06/08/10 zusammen mit der Funktion fortschreiben.

## 4. Abschluss und Abnahme

- [ ] 4.1 Betroffene lokale Unit-/Type-/Runtime-/Integrations-/Security-/Datenintegritätsgates nach `DEVELOPMENT_RULES.md` ausführen; Scope vor einem affected-Unit-Run messen und breite unnötige Wiederholungen vermeiden.
- [ ] 4.2 Diffbezogenen Review nach Trigger-Matrix durchführen; Bestandserhalt, Identität, generische Umgehung, Wiederaufnahme und Löschvertrag anhand konkreter Evidenz bewerten.
- [ ] 4.3 OpenSpec Strict, Formatierung, Dateiplatzierung, Dokumentationsprüfung und Diff-Prüfung ausführen; alle hinzugefügten/entfernten Artefakte gegen unmittelbar gelieferte Fähigkeit prüfen.
- [ ] 4.4 Erst nach gesonderter Benennung/Freigabe von Zielinstanz, Konto/Principal und isolierten Testdaten: tatsächlichen Serververtrag sowie Erstellen/Öffnen/Bearbeiten/Sichtbarkeit/Löschen prüfen und App-Darstellung fachlich abnehmen. Kein impliziter Auftrag für Push, PR, Merge oder Rollout.

## Tatsächlich erbrachte Nachweise

Derzeit ausschließlich lesende Quellprüfung, Erstellung und Prüfung dieses Changes. Offene Implementierungscheckboxen sind keine bereits bestandenen Prüfungen.

Der Proposal-Review wurde am 07.11.2026 nach der bestehenden Trigger-Matrix in drei gebündelten Fachprüfungen durchgeführt: Architektur/Interoperabilität, Sicherheit/Testqualität/Logging und Dokumentation/UX/Accessibility/i18n/User Journey. Separate Operations- und Performance-Reviews waren für den begrenzten Entwurf ohne neue Infrastruktur oder Cache-Verträge nicht erforderlich. Die wesentlichen Datenintegritäts- und Recovery-Nachweise stehen im Design; ein zusätzliches Assurance-Dokument wurde nicht angelegt.

Notwendige Befunde wurden lokal korrigiert und von den jeweiligen Reviewern bestätigt:

- Typübergreifende externe-ID-Kollisionen im Mainserver können andere Inhalte überschreiben. Vollständiger frischer Kollisionsread, Sperre vor Write, `forceCreate`-Grenze, Regression mit bestehender Baustelle und die externe Race-/Upsert-Grenze bei verschwundener ID sind ausdrücklich aufgenommen. Dies ist eine Entwurfskorrektur, kein technisch bereits gelöster Produktpfad.
- Generische Job-Neuanlage und beide Umtypisierungsrichtungen sind ausdrücklich durch den Fachschutz und Negativtests bei aktiviertem/deaktiviertem Modul erfasst.
- Der Nachweiszeitpunkt bezeichnet den Abschluss der Implementierung; der App-Verbrauch erster Firma/ersten Kontakts wird von der CMS-Auswahl des ersten Ablaufdatums und der App-Anzeige sämtlicher Datumswerte unterschieden.

Nach der Korrektur bestehen keine offenen notwendigen Proposal-Befunde aus diesen Reviews. Die Prüfung des schriftlichen Entwurfs durch den Nutzer gemäß 1.2 bleibt offen. Die dokumentierten konservativen Kategorie-Sperren und externen Konkurrenzgrenzen gehören zu dieser Prüfung. Kein Review bestätigt eine Implementierungs-, Merge-, Live- oder App-Reife.

Erfolgreiche formale Prüfungen am abschließenden Dokumentstand: OpenSpec Strict, Markdown-Formatierung, Dateiplatzierung, Dokumentationsintegrität und Git-Whitespaceprüfung. Reine Dokumentationsänderungen benötigen nach den Projektregeln keine Unit-/Type-Tests.
