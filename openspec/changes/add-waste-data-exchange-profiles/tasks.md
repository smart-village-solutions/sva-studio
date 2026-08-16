## 1. Kanonische Profilverträge

- [x] 1.1 Gemeinsame, framework-agnostische Waste-Datenprofiltypen für Profilversion, Felder, Referenzen, Eingabekategorie, Defaults und Transferklassifikation ergänzen.
- [x] 1.2 Den bisherigen Importkatalog auf den gemeinsamen Vertrag migrieren, ohne bestehende Profil-IDs und Spezialimporte zu brechen.
- [x] 1.3 Vollständige Profile für Fraktionen, Geografie/Abholorte, Abstandspresets, Touren, Zuordnungen, Einsätze, Ausweichtermine, Feiertagsregeln und portable Einstellungen definieren.
- [x] 1.4 Jedes Waste-Modellfeld als `included` oder begründet `intentionally-excluded` klassifizieren; E-Mail-Abo-, Governance-, Credential-, Job- und Auditdaten verbindlich ausschließen.
- [x] 1.5 Einen Coverage-Test ergänzen, der bei neuen oder unklassifizierten Waste-Modellfeldern fehlschlägt.

## 2. Generische Exportplattform

- [x] 2.1 Den Plugin-Vertrag um deklarative Exportprofile mit owning Namespace, Datenprofil, Format und Schema-/Mappingversion ergänzen.
- [x] 2.2 Build-Registry, Kollisionserkennung und Tests für Exportprofile analog zu Job- und Importprofilen erweitern.
- [x] 2.3 Einen generischen, geschützt herunterladbaren Job-Ergebnisartefaktvertrag mit Content-Type, Dateiname, Prüfsumme, Größe, Ablauf und autorisierter Downloadreferenz ergänzen.
- [x] 2.4 Sicherstellen, dass Ergebnisartefakte und Downloadendpunkte Actor-, Instanz- und Rechteprüfung durch den Host erzwingen.

## 3. JSON-, CSV- und XLSX-Adapter

- [x] 3.1 Den versionierten JSON-Envelope für jedes einzelne Profil implementieren und strikt validieren.
- [x] 3.2 JSON-Parser und -Serializer aus demselben Profilvertrag ableiten und explizite `null`-/Missing-/Defaultsemantik umsetzen.
- [x] 3.3 Bestehende CSV-/XLSX-Adapter gegen die vollständigen Profilfelder härten und Formate ohne verlustfreie Abbildung nicht anbieten.
- [ ] 3.4 Importvorlagen und Exportdateien aus denselben kanonischen Felddefinitionen erzeugen.
- [x] 3.5 Formatübergreifende Roundtrip-Tests für jedes tatsächlich angebotene Profilformat ergänzen.

## 4. Waste-Exportpfad

- [x] 4.1 `waste-management.export-data` und die Action `waste-management.export.execute` in Contracts, Runtime und Berechtigungskatalog ergänzen.
- [x] 4.2 Profilbezogene Repository-Leseoperationen vollständig und deterministisch serialisieren; stabile IDs und Referenzen erhalten.
- [x] 4.3 Einzelprofil-Exporte für JSON und alle nachgewiesen verlustfreien tabellarischen Formate implementieren.
- [x] 4.4 ZIP-Manifest, Profilabhängigkeiten, Datensatzanzahlen und Prüfsummen für Mehrprofilpakete implementieren.
- [x] 4.5 Negative Tests ergänzen, die E-Mail-Abo-, Consent-, Token-, Outbox-, Credential-, Governance-, Audit- und Jobdaten in jedem Exportartefakt ausschließen.

## 5. Waste-Importpfad

- [x] 5.1 Bestehende Importe um bisher fehlende Fachfelder wie Postleitzahl, vollständige Fraktionsdaten und Presetreferenzen ergänzen.
- [x] 5.2 Neue kanonische Importprofile für bislang nicht vollständig importierbare Entitäten implementieren.
- [x] 5.3 Profil-Preflight für Pflichtwerte, optionale Werte, Defaults, Versionen, Referenzen, Konflikte und portable Referenzen ergänzen.
- [x] 5.4 Create-/Update-Semantik für ausgelassene defaultfähige Felder sowie explizites `null` regressionssicher implementieren.
- [x] 5.5 Einzelprofile atomar und Mehrprofilpakete nach vollständigem Preflight paketweit atomar importieren.
- [x] 5.6 Strukturierte Vorschau- und Ergebnisberichte mit neuen, geänderten, unveränderten, fehlerhaften und defaultierten Datensätzen ergänzen.
- [ ] 5.7 Integrations- und Rollbacktests gegen eine leere sowie eine vorbefüllte isolierte Waste-Testdatenbank ergänzen.

## 6. Studio-UI und Bedienung

- [x] 6.1 Data-Tools um getrennte, berechtigungsgeführte Import- und Exportaktionen erweitern.
- [x] 6.2 Einzelprofile, Formatwahl, Mehrfachauswahl für Pakete und verständliche Datenschutzgrenzen zugänglich und übersetzbar darstellen.
- [x] 6.3 Preflight, Defaults, Warnungen, Konflikte, Fortschritt und Ergebnisberichte ohne rohe Backenddaten anzeigen.
- [x] 6.4 Geschützte Exportartefakte erst nach erfolgreichem Job und erneuter Downloadautorisierung anbieten.
- [x] 6.5 Unit- und E2E-Tests für Auswahl, Preflight, Fehler, Download, Import und Rechte-Negativfälle ergänzen.

## 7. Qualität, Dokumentation und Gates

- [x] 7.1 Fachliche Roundtrip-Invariante `import(export(data)) = normalisierte Fachdaten` für alle Profile testen.
- [x] 7.2 Größen-, Batch-, Speicher-, Transaktions- und Artefaktaufbewahrungsgrenzen festlegen und testen.
- [x] 7.3 Waste-Data-Tools-Guide und relevante deutsche Fachdokumentation aktualisieren.
- [x] 7.4 `docs/architecture/05-building-block-view.md`, `docs/architecture/06-runtime-view.md`, `docs/architecture/08-cross-cutting-concepts.md` und `docs/architecture/10-quality-requirements.md` fortschreiben.
- [x] 7.5 Falls Datenbankschemaänderungen erforderlich werden, `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` im selben Change aktualisieren.
- [ ] 7.6 Changelog-Eintrag ergänzen und Dateiablage-, Server-Runtime-, Unit-, Type-, Lint-, Coverage-, Complexity-, Integrations-, Build- und relevante E2E-Gates ausführen.
