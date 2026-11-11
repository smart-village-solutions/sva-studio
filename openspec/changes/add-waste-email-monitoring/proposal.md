# Änderung: E-Mail-Abos und Versand im Monitoring

## Warum

Für die Diagnose verzögerter Bestätigungen und fehlender Erinnerungen fehlt eine lesende Studio-Übersicht. Der Nutzer hat die Plugin-Zuständigkeit, die Platzierung unter Monitoring, das separate Recht und die serverseitige Maskierung am 10.11.2026 zur Umsetzung freigegeben.

## PR-Zuschnitt

Ziel ist eine separat autorisierte, datensparsame Auswertung bestehender E-Mail-Abos und Versandstände im Monitoring. Maximal betroffen sind Waste-Verträge, Waste-Runtime, das Abfallkalender-Plugin, die Monitoring-Navigation der Studio-Shell und die dazugehörige Dokumentation; Versandlogik, Bounce-Verarbeitung, Datenbankschema, produktive Rechtevergabe und Rollout sind Nicht-Ziele.

## Was sich ändert

- Das Abfallkalender-Plugin liefert eine paginierte Abo-Liste und Versanddetails aus den bestehenden Tabellen.
- Eigener Zugriff über `waste-management.email-reminder-monitoring.read`, ohne automatische Rollenzuweisung.
- Erster und letzter Buchstabe vor/nach `@` bleiben sichtbar; die übrigen Zeichen werden maskiert. Teile mit höchstens zwei Zeichen werden vollständig maskiert.
- Die Navigation liegt unter Monitoring, die Route bleibt im Plugin-Namensraum.

## Auswirkungen und Grenzen

Betroffen: `waste-management-contracts`, `waste-management-runtime`, `plugin-waste-management` und die Monitoring-Gruppierung der Studio-Navigation. Keine Datenbankmigration, Versandänderung, neue Historientabelle, Abo-Mutation oder automatische Rechtevergabe. Vorhandene Versandzeiten sind Verarbeitungszeitpunkte und kein Postfachempfangsnachweis. Die API gibt keine E-Mail-Klartexte, Token, Hashes, vollständigen Payloads oder Provider-Fehlertexte aus. Ort wird ohne Straße und Hausnummer angezeigt.

## Nachweise

Tests prüfen den gesonderten Zugriff, Mandantengrenzen, Filtervalidierung, Maskierung, datensparsame Projektion und die lesende Bedienung. PostgreSQL prüft die realen Abfragen. Type-, Runtime- und Dateiplatzierungschecks sichern die Einbindung. Architektur: Bausteinsicht und Querschnittskonzepte werden beim bestehenden Plugin-/Berechtigungspfad ergänzt.
