## 1. Vertrag und Charakterisierung

- [x] 1.1 Bestehende Handler-, Listen- und Upload-Verträge durch gezielte Tests charakterisieren
- [x] 1.2 Cursor-, Tenant-Bucket- und synchrone Finalisierungsverträge dokumentieren

## 2. Runtime-Refactoring

- [x] 2.1 Request-Kontext und Schemas ohne generisches Handler-Framework zentralisieren
- [x] 2.2 Handler fachlich aufteilen und die öffentlichen `core.ts`-Exporte stabil halten
- [x] 2.3 Fremdtenant-Storage-Key-Heuristik zugunsten des isolierten Bucket-Vertrags entfernen

## 3. Cursor-Medienbibliothek

- [x] 3.1 Repository und Storage-Port um keyset-/präfixbasierte Listenoperationen ergänzen
- [x] 3.2 Medienlisten-API auf den versionierten Cursorvertrag umstellen
- [x] 3.3 API-Client, Hook und UI auf Weiter/Zurück ohne Gesamtzahl umstellen

## 4. Synchrone Upload-Stabilisierung

- [x] 4.1 Atomaren `pending -> uploaded`-Claim und Statusfehler implementieren
- [x] 4.2 Externe Verarbeitung aus der DB-Transaktion lösen
- [x] 4.3 Quote und vollständigen DB-Abschluss atomar finalisieren und Cleanup absichern
- [x] 4.4 Abgelaufene `uploaded`-Claims lazy und atomar erneut übernehmbar machen

## 5. Qualität und Dokumentation

- [x] 5.1 Unit-, Repository-, Hook- und UI-Tests ergänzen
- [x] 5.2 Betroffene arc42-Abschnitte und Media-API-Dokumentation aktualisieren
- [x] 5.3 Gezielte Type-, Lint-, Runtime- und Unit-Gates ausführen
- [x] 5.4 Affected-Scope prüfen und den breiten PR-Gate-Pfad ausführen
