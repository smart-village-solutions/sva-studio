# Mehrsprachigkeit — lokaler Katalogeditor

Optionales Studio-Plugin `app-translations`. Der Host registriert Modul-IAM und Lifecycle über den vorhandenen Katalog. Die kommunale Ansicht „Mehrsprachigkeit“ (`/plugins/app-translations`) und die hostgeführte globale Root-Ansicht „Mobile-App → Gemeinsame App-Texte“ (`/admin/app-translations`) verwenden denselben Editor. Die globale Standardpflege bleibt unabhängig von der Aktivierung einzelner Kommunen. Modulzuweisungen im Root-Pfad setzen eine ausdrückliche Instanzauswahl voraus.

Übersicht, technischer Import der App-Textdatei (technisches JSON-Manifest, nur Root, höchstens 1 MiB), gespeicherte Entwürfe, sprachbezogene Overrides/Reset, Korrekturbestätigung und expliziter Basiswechsel sind lokal nutzbar. „Textstand sichern“ versiegelt einen vollständigen Satz; die Vorschau ist unveränderlich und ausdrücklich keine App-Veröffentlichung. Instanz/Organisation kommen aus der Session. Der HTTP-Handler prüft getrennte Read-/Write-/Publishrechte, Pluginzugang und bei Mutationen CSRF, Scopebindung sowie erwartete Revision. Konflikte erhalten ungespeicherte Eingaben.

## Lokal ausprobieren

1. Lokale Datenbank mit regulären Migrationen bis `0107` vorbereiten; kein Seed beim App-Start.
2. Als Root unter „Mobile-App → Gemeinsame App-Texte“ `tests/fixtures/catalog-demo.json` importieren. Der Import übernimmt ausschließlich deutsche Ausgangstexte. Eine `texts.js` muss zunächst manuell in das validierte JSON-Manifest überführt werden; beliebiges Text-JSON genügt nicht.
3. Deutsche Werte suchen, bearbeiten, speichern und als vollständigen lokalen Textstand sichern. Die Trefferliste zeigt höchstens 25 Einträge pro Seite. Ungespeicherte Eingaben sperren Suche/Schlüsselwechsel; ein Revisionskonflikt erhält die Eingabe.
4. In einer Kommune unter „Mobile-App → App-Texte“ eine gesicherte globale deutsche Basis wählen. `app-texts.catalog.read/write/publish` erlauben Lesen/Bearbeiten/Sichern unabhängig vom Mehrsprachigkeitsmodul.
5. Im vorübergehend erhaltenen technischen Root-Direktzugriff `/admin/languages` zentrale Verfügbarkeit festlegen (kein Hauptmenüpunkt mehr), eine Instanz ausdrücklich wählen und zusätzliche Sprachen aktivieren. Dafür muss deren Mehrsprachigkeitsmodul aktiv und lokal bereit/eingeschränkt bereit sein. Die Codes sind technisch unterstützt; diese Verwaltung bestätigt keine Anbieterqualität und lokal noch keine App-Auslieferung.
6. In der Instanz im optionalen Modul „Mehrsprachigkeit“ die aktuelle Sprachauswahl ausdrücklich in den Entwurf übernehmen. Nur diese Fremdsprachen bearbeiten; Deutsch wird hier lediglich als Quelle gezeigt. `app-translations.catalog.read/write/publish` und aktueller Pluginzugang sind nötig. Englische Testwerte dürfen manuell ergänzt werden, ohne Fake-Anbieteraufruf. Gesperrte Sprachwerte bleiben gespeichert und werden aus der regulären Ansicht gefiltert.

## Grenzen und Nachweise

Der Host injiziert `readLocalReadiness(instanceId)`. Der Jobhandler erhält nur Schema-/Konfigurationsmarker, nie den DeepL-Key. `ready`/`degraded` beziehen sich ausschließlich auf die lokale Katalogbasis. Fehlendes Schema sperrt den Zugriff; fehlender Key lässt lokale Redaktion als eingeschränkt bereit zu. Sprachabdeckung und Anbieterzugriff sind damit nicht geprüft.

`suspend`/`reactivate` scheitern weiterhin ausdrücklich mit `app-translations.remote-lifecycle-unavailable`. Publisher und vollständiger Remote-Lifecycle folgen in Tasks 3.8/3.9; kein DeepL, YAML-Roundtrip, automatischer Sprachimport, Main-Server-/Appzugriff oder dynamische Formularanzeige in diesem Abschnitt.

Gezielte Gates: `pnpm nx run plugin-app-translations:test:unit`, `pnpm nx run plugin-app-translations:test:types`, die Auth-/Repositorytests und `pnpm check:server-runtime`. Durchgeführte isolierte Browser-/PostgreSQL-Nachweise und bekannte fremde App-Buildgrenzen stehen im bestehenden Bericht `docs/reports/central-app-translations-proposal-review-2026-10-18.md`.

Der Hauptmenüpunkt „Sprachen“ ist entfernt. Abschnitt 2E ersetzt den vorübergehenden Direktzugriff durch DeepL-Konfiguration und Sprachabfrage je Instanz im bestehenden Schnittstellenbereich; diese Anbindung ist noch nicht umgesetzt. Sie ändert weder die Studio-Oberflächensprache noch lokal die Mobile-App. Gemeinsame deutsche Texte und kommunale Übersetzungen verwenden denselben Editor und Datenbestand; es gibt keine zweite deutsche Quelle.
