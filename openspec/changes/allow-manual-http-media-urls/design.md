## Context

Der gemeinsame `ContentMediaUsageBlock` bearbeitet manuelle Bild-URLs für News, Events, POI, Generic Items, Projects und Cockpit Cards. Der bestehende Helper für persistierbare Asset-URLs verlangt HTTPS und wird sowohl für manuelle Verwendungen als auch für Media-Asset-Auslieferungen verwendet. Eine globale Lockerung dieses Helpers würde daher unbeabsichtigt den Asset-Vertrag schwächen.

Browser, die das Studio über HTTPS laden, können HTTP-Bilder als Mixed Content blockieren. Eine HTTP-URL kann deshalb speicherbar sein, obwohl die Vorschau im Studio oder in einem anderen HTTPS-Client nicht zuverlässig geladen werden kann. Die Oberfläche muss diesen Unterschied ausdrücklich erklären.

## Goals / Non-Goals

- Goals:
  - Redaktionelle manuelle HTTP-Bildquellen speicherbar machen.
  - HTTPS weiterhin automatisch bevorzugen.
  - Unsichere Speicherung sichtbar und barrierefrei kennzeichnen.
  - Asset-Auslieferung, Zugangsdaten- und Signaturprüfung unverändert streng halten.
- Non-Goals:
  - Kein serverseitiger URL-, `HEAD`- oder Inhaltsabruf.
  - Kein Proxying oder Importieren externer Bilder.
  - Kein stiller Rückfall einer protokollfreien Eingabe auf HTTP.
  - Keine Lockerung für Medienbibliotheksassets oder andere Nicht-Medien-URLs.

## Decisions

### 1. Manuelle und Asset-basierte Persistierbarkeit bleiben getrennte Verträge

Der bestehende HTTPS-only-Helper für Asset-Auslieferungen bleibt streng. Eine getrennte, typklare Validierung erlaubt bei redaktionellen Änderungen am gespeicherten URL-Snapshot `http:` und `https:`, verwirft aber weiterhin Zugangsdaten sowie bekannte signierte oder kurzlebige Query-Parameter. Asset-Auswahl und Asset-Auslieferung verwenden weiterhin ausschließlich den HTTPS-only-Vertrag; nur eine explizite Bearbeitung des URL-Feldes gilt als manuelle Eingabe.

### 2. Normalisierung erfolgt nach abgeschlossener Eingabe

Der gemeinsame Medienblock reagiert auf `blur`, trimmt die Eingabe und klassifiziert sie:

1. Eine gültige HTTPS-URL wird unverändert beziehungsweise getrimmt übernommen.
2. Eine plausible absolute Adresse ohne Protokoll wird ausschließlich als HTTPS-Kandidat geprüft.
3. Eine explizite HTTP-URL wird zuerst als HTTPS-Kandidat geprüft.
4. Lädt der Kandidat über den Browser-Bildpfad, wird HTTPS übernommen und dies textuell gemeldet.
5. Schlägt die Prüfung für eine explizite HTTP-Eingabe fehl, bleibt die getrimmte HTTP-URL erhalten und speicherbar.
6. Schlägt sie für eine protokollfreie Eingabe fehl, bleibt die Eingabe ungültig; das Studio nimmt keinen stillen HTTP-Downgrade vor.

Die Prüfung läuft nicht bei jedem Tastendruck. Pro Feld gilt nur das Ergebnis der zuletzt gestarteten Prüfung, damit langsamere ältere Ergebnisse keine neuere Eingabe überschreiben.

### 3. HTTP ist ein Warnzustand, kein Validierungsfehler

Eine gespeicherte manuelle HTTP-URL erhält direkt am Feld einen sichtbaren Warnhinweis und eine semantisch angebundene Statusmeldung. Der Hinweis erklärt die unsichere Übertragung und die mögliche Blockierung in HTTPS-Anwendungen. Er blockiert das Speichern nicht. Ungültige Syntax, Zugangsdaten und flüchtige Signaturparameter bleiben Fehler.

Eine erfolgreiche Korrektur entfernt einen zuvor angezeigten URL-Fehler unmittelbar. Die HTTPS-Aktualisierung wird über eine höfliche Live-Region angekündigt.

### 4. Keine serverseitige Probe

Die HTTPS-Eignungsprüfung verwendet ein Browser-`Image`-Objekt mit Erfolgs-, Fehler- und Aufräumpfad. Dadurch entstehen keine neuen SSRF-, Redirect- oder Timeout-Verträge im Server. Ein fehlgeschlagenes Laden beweist nicht, dass HTTP selbst unerreichbar ist; deshalb bleibt eine ausdrücklich eingegebene HTTP-URL nach dem fehlgeschlagenen Upgrade erlaubt.

## Verification

- Reine Unit-Tests für URL-Klassifikation und Persistierbarkeit.
- Komponententests für Blur-Zeitpunkt, erfolgreiches HTTPS-Upgrade, HTTP-Warnung, fehlenden stillen Downgrade, Race-Schutz und zugängliche Meldungen.
- Plugin-Test für den POI-Persistenzpfad einschließlich der konkreten Pixelpoint-URL aus #1084.
- Gezielte Nx-Unit- und Type-Targets für den gemeinsamen UI-Baustein und tatsächlich geänderte Plugins.
