## 1. Spezifikation und Architekturvertrag
- [x] 1.1 Delta-Spezifikationen für `public-waste-calendar` und `waste-management` anlegen
- [x] 1.2 Delta-Spezifikation für `external-interface-registry` zur zentralen Mail-Transport-Schnittstelle anlegen
- [x] 1.3 Betroffene arc42-Abschnitte für Public-Waste-Kommunikationsfluss, Persistenz, Interface-Anbindung und Datenschutz aktualisieren
- [x] 1.4 OpenSpec-Change strikt validieren

## 2. Datenmodell und Serververträge
- [x] 2.1 Contracts für E-Mail-Reminder-Abos, Fraktions-Slot-Auswahl, DOI-Status und Abmeldung ergänzen
- [x] 2.2 Waste-Persistenz für Subscription-Kopf, Subscription-Items, Token-Hashes, Versandaufträge und Versanddeduplizierung modellieren
- [x] 2.3 DB-Migrationen sowie Schema-Snapshot und Schema-Doku für die neuen Reminder-Tabellen fortschreiben
- [x] 2.4 Host-Fassade für Formularabsendung, DOI-Bestätigung und Abmeldung mit Validierung, Rate-Limits und kanonischer Statusführung ergänzen
- [x] 2.5 Outbox-Schema, Dedupe-Key und Hot-Path-Indizes für ressourcenschonende Versandaufträge definieren

## 3. Öffentliche Web-App
- [x] 3.1 CTA `E-Mail-Erinnerung einrichten` im vollständigen Standortkontext ergänzen
- [x] 3.2 Öffentlichen Formularfluss mit fraktionsbezogener Slot-Auswahl, Datenschutz-Checkbox und Pending-Erfolg umsetzen
- [x] 3.3 DOI-Bestätigungsseite und Abmeldeseite innerhalb derselben Public-Waste-App umsetzen
- [x] 3.4 Öffentliche Texte, Fehlerzustände und Token-Ablaufseiten barrierearm und ohne technische Leaks gestalten

## 4. Versand- und Output-Logik
- [x] 4.1 Waste-seitige Materialisierung für fraktions- und slotbezogene Einzelaufträge mit Deduplizierung und Idempotenz ergänzen
- [x] 4.2 Waste-Management-Card `E-Mail-Erinnerungsdienst` im Tab `output` mit Aktivierung, URLs, Rechtslinks, Textbausteinen und technischen Leitplanken ergänzen
- [x] 4.3 Zentralen Mail-Transport in `interfaces` mit SMTP-/Provider-Parametern, Secret-Referenzen und Waste-Anbindung ergänzen
- [x] 4.4 Inkrementelle Trigger und kleine Batch-Verarbeitung für die Outbox-Materialisierung und den Mail-Konsum festlegen
- [x] 4.5 Feldvertrag der zentralen Mail-Transport-Schnittstelle inklusive Secret-Referenz, Security-Modus, Batch-Limits und Health-Status umsetzen

## 5. Qualität und Nachweise
- [x] 5.1 Relevante Unit-, Type-, Runtime- und betroffene UI-Tests ergänzen oder anpassen
- [x] 5.2 Kleinsten relevanten Nx-Gate-Pfad für die geänderten Projekte ausführen
- [x] 5.3 OpenSpec strikt validieren
